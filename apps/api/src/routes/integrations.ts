import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";
import { prisma } from "../lib/db.js";
import {
  authenticate,
  authorize,
  type SessionUser
} from "../lib/auth.js";
import { writeAudit } from "../lib/audit.js";

const adminGuard = [
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN)
] as const;

const PRIMARY_OA_CONNECTION_ID = "primary";
const OA_PERMISSION_URL = "https://oauth.zaloapp.com/v4/oa/permission";
const OA_ACCESS_TOKEN_URL = "https://oauth.zaloapp.com/v4/oa/access_token";
const OA_INFO_URL = "https://openapi.zalo.me/v2.0/oa/getoa";

function isConfigured(value?: string) {
  return Boolean(value?.trim());
}

function sessionSecretIsProductionSafe() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) return false;
  return secret !== "replace_with_a_long_random_secret" && secret.length >= 32;
}

function createOAPKCE() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier, "ascii")
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

function oaRedirectUri() {
  const value = process.env.ZALO_OA_REDIRECT_URI?.trim();
  if (!value) {
    throw new Error("ZALO_OA_REDIRECT_URI is required.");
  }
  return value;
}

function oaSuccessRedirect() {
  return (
    process.env.ZALO_OA_SUCCESS_REDIRECT?.trim() ??
    "https://hub.huyenvu.cloud/integrations/zalo"
  );
}

function encryptionKey() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("SESSION_SECRET is required.");
  }

  return createHash("sha256")
    .update(`hospital-zalo-hub:oa-token:${secret}`)
    .digest();
}

function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

function open(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (
    version !== "v1" ||
    !ivValue ||
    !tagValue ||
    !encryptedValue
  ) {
    throw new Error("Invalid encrypted OA token.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function expiresAt(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000);
}

type OATokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: string | number;
  refresh_token_expires_in?: string | number;
  error?: number;
  error_name?: string;
  error_reason?: string;
  message?: string;
};

async function requestOAToken(params: URLSearchParams) {
  const appSecret = process.env.ZALO_APP_SECRET?.trim();
  if (!appSecret) {
    throw new Error("ZALO_APP_SECRET is required.");
  }

  const response = await fetch(OA_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: appSecret
    },
    body: params
  });

  const payload = (await response.json()) as OATokenResponse;

  if (
    !response.ok ||
    !payload.access_token ||
    (!payload.refresh_token && params.get("grant_type") === "authorization_code")
  ) {
    throw new Error(
      payload.message ??
        payload.error_reason ??
        payload.error_name ??
        "Không đổi được OA authorization code thành access token."
    );
  }

  return payload;
}

async function getOAInfo(accessToken: string) {
  const response = await fetch(OA_INFO_URL, {
    headers: {
      access_token: accessToken
    }
  });

  const payload = (await response.json()) as {
    error?: number;
    message?: string;
    data?: {
      oaid?: string | number;
      id?: string | number;
      name?: string;
      description?: string;
      avatar?: string;
    };
  };

  if (!response.ok || payload.error !== 0 || !payload.data) {
    throw new Error(payload.message ?? "Không lấy được thông tin Zalo OA.");
  }

  const oaId = String(payload.data.oaid ?? payload.data.id ?? "");
  if (!oaId) {
    throw new Error("Zalo OA response không có OA ID.");
  }

  return {
    oaId,
    name: payload.data.name ?? null,
    description: payload.data.description ?? null,
    avatar: payload.data.avatar ?? null
  };
}

async function refreshOAConnection() {
  const connection = await prisma.zaloOAConnection.findUnique({
    where: { id: PRIMARY_OA_CONNECTION_ID }
  });

  if (!connection) {
    throw new Error("Chưa kết nối Zalo Official Account.");
  }

  if (
    connection.refreshExpiresAt &&
    connection.refreshExpiresAt <= new Date()
  ) {
    throw new Error("OA refresh token đã hết hạn. Cần cấp quyền lại.");
  }

  const appId = process.env.ZALO_APP_ID?.trim();
  if (!appId) {
    throw new Error("ZALO_APP_ID is required.");
  }

  const currentRefreshToken = open(connection.refreshTokenEncrypted);
  const params = new URLSearchParams({
    app_id: appId,
    refresh_token: currentRefreshToken,
    grant_type: "refresh_token"
  });

  const token = await requestOAToken(params);
  const nextRefreshToken = token.refresh_token ?? currentRefreshToken;

  const updated = await prisma.zaloOAConnection.update({
    where: { id: PRIMARY_OA_CONNECTION_ID },
    data: {
      accessTokenEncrypted: seal(token.access_token!),
      refreshTokenEncrypted: seal(nextRefreshToken),
      accessExpiresAt: expiresAt(token.expires_in),
      refreshExpiresAt:
        expiresAt(token.refresh_token_expires_in) ??
        connection.refreshExpiresAt
    }
  });

  return {
    connection: updated,
    accessToken: token.access_token!
  };
}

async function validOAAccessToken() {
  const connection = await prisma.zaloOAConnection.findUnique({
    where: { id: PRIMARY_OA_CONNECTION_ID }
  });

  if (!connection) {
    throw new Error("Chưa kết nối Zalo Official Account.");
  }

  const refreshThreshold = new Date(Date.now() + 2 * 60 * 1000);
  if (
    !connection.accessExpiresAt ||
    connection.accessExpiresAt > refreshThreshold
  ) {
    return {
      connection,
      accessToken: open(connection.accessTokenEncrypted)
    };
  }

  return refreshOAConnection();
}

function callbackRedirect(params: Record<string, string>) {
  const url = new URL(oaSuccessRedirect());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function registerIntegrationRoutes(app: FastifyInstance) {
  app.get(
    "/v1/integrations/zalo/status",
    { preHandler: [...adminGuard] },
    async () => {
      const socialOAuthReady =
        isConfigured(process.env.ZALO_APP_ID) &&
        isConfigured(process.env.ZALO_APP_SECRET) &&
        isConfigured(process.env.ZALO_REDIRECT_URI) &&
        isConfigured(process.env.ZALO_AUTH_SUCCESS_REDIRECT);

      const oaOAuthConfigured =
        isConfigured(process.env.ZALO_APP_ID) &&
        isConfigured(process.env.ZALO_APP_SECRET) &&
        isConfigured(process.env.ZALO_OA_REDIRECT_URI);

      const connection = await prisma.zaloOAConnection.findUnique({
        where: { id: PRIMARY_OA_CONNECTION_ID },
        select: {
          oaId: true,
          oaName: true,
          accessExpiresAt: true,
          refreshExpiresAt: true,
          connectedAt: true
        }
      });

      const oaReady = oaOAuthConfigured && Boolean(connection);
      const miniAppReady = isConfigured(process.env.ZALO_MINI_APP_ID);
      const devAuthEnabled = process.env.ALLOW_DEV_AUTH === "true";
      const sessionSecretSafe = sessionSecretIsProductionSafe();

      return {
        socialOAuth: {
          ready: socialOAuthReady,
          appIdConfigured: isConfigured(process.env.ZALO_APP_ID),
          appSecretConfigured: isConfigured(process.env.ZALO_APP_SECRET),
          redirectUriConfigured: isConfigured(process.env.ZALO_REDIRECT_URI),
          successRedirectConfigured: isConfigured(
            process.env.ZALO_AUTH_SUCCESS_REDIRECT
          ),
          redirectUri: process.env.ZALO_REDIRECT_URI ?? null,
          successRedirect: process.env.ZALO_AUTH_SUCCESS_REDIRECT ?? null
        },
        officialAccount: {
          ready: oaReady,
          oauthConfigured: oaOAuthConfigured,
          connected: Boolean(connection),
          oaId: connection?.oaId ?? null,
          oaName: connection?.oaName ?? null,
          accessExpiresAt: connection?.accessExpiresAt ?? null,
          refreshExpiresAt: connection?.refreshExpiresAt ?? null,
          connectedAt: connection?.connectedAt ?? null,
          redirectUri: process.env.ZALO_OA_REDIRECT_URI ?? null,
          webhookSecretConfigured: isConfigured(
            process.env.ZALO_OA_WEBHOOK_SECRET
          )
        },
        miniApp: {
          ready: miniAppReady,
          miniAppIdConfigured: miniAppReady
        },
        security: {
          productionReady: !devAuthEnabled && sessionSecretSafe,
          devAuthEnabled,
          sessionSecretSafe
        },
        overallReady:
          socialOAuthReady &&
          oaReady &&
          miniAppReady &&
          !devAuthEnabled &&
          sessionSecretSafe
      };
    }
  );

  app.get(
    "/v1/integrations/zalo/oa/start",
    { preHandler: [...adminGuard] },
    async (request, reply) => {
      const appId = process.env.ZALO_APP_ID?.trim();
      if (!appId) {
        return reply.code(503).send({
          error: "zalo_app_not_configured",
          message: "ZALO_APP_ID chưa được cấu hình."
        });
      }

      try {
        const state = randomBytes(24).toString("base64url");
        const { codeVerifier, codeChallenge } = createOAPKCE();
        const session = request.user as SessionUser;

        await prisma.zaloOAOAuthFlow.deleteMany({
          where: { expiresAt: { lt: new Date() } }
        });

        await prisma.zaloOAOAuthFlow.create({
          data: {
            state,
            userId: session.sub,
            codeVerifierEncrypted: seal(codeVerifier),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
          }
        });

        const redirectUri = oaRedirectUri();
        const url = new URL(OA_PERMISSION_URL);
        url.searchParams.set("app_id", appId);
        url.searchParams.set("redirect_uri", redirectUri);
        url.searchParams.set("code_challenge", codeChallenge);
        url.searchParams.set("state", state);

        return {
          authorizationUrl: url.toString(),
          redirectUri,
          codeChallenge,
          expiresInSeconds: 600
        };
      } catch (error) {
        request.log.error(error);
        return reply.code(503).send({
          error: "oa_oauth_not_configured",
          message:
            "Cấu hình OA OAuth chưa hoàn chỉnh. Kiểm tra App ID, App Secret và callback."
        });
      }
    }
  );

  app.get(
    "/v1/integrations/zalo/oa/callback",
    async (request, reply) => {
      const query = request.query as {
        code?: string;
        state?: string;
        oa_id?: string;
        error?: string;
        error_code?: string;
      };

      if (query.error || query.error_code) {
        return reply.redirect(
          callbackRedirect({
            oa: "error",
            reason: query.error ?? query.error_code ?? "authorization_denied"
          })
        );
      }

      if (!query.code || !query.state) {
        return reply.redirect(
          callbackRedirect({
            oa: "error",
            reason: "missing_code_or_state"
          })
        );
      }

      const flow = await prisma.zaloOAOAuthFlow.findUnique({
        where: { state: query.state }
      });

      if (!flow || flow.expiresAt <= new Date()) {
        if (flow) {
          await prisma.zaloOAOAuthFlow.delete({ where: { id: flow.id } });
        }
        return reply.redirect(
          callbackRedirect({
            oa: "error",
            reason: "invalid_or_expired_state"
          })
        );
      }

      try {
        const appId = process.env.ZALO_APP_ID?.trim();
        if (!appId) {
          throw new Error("ZALO_APP_ID is required.");
        }

        const params = new URLSearchParams({
          app_id: appId,
          code: query.code,
          grant_type: "authorization_code",
          code_verifier: open(flow.codeVerifierEncrypted)
        });

        const token = await requestOAToken(params);
        const info = await getOAInfo(token.access_token!);

        if (query.oa_id && String(query.oa_id) !== info.oaId) {
          throw new Error("OA ID từ callback không khớp OA access token.");
        }

        const connection = await prisma.zaloOAConnection.upsert({
          where: { id: PRIMARY_OA_CONNECTION_ID },
          update: {
            oaId: info.oaId,
            oaName: info.name,
            accessTokenEncrypted: seal(token.access_token!),
            refreshTokenEncrypted: seal(token.refresh_token!),
            accessExpiresAt: expiresAt(token.expires_in),
            refreshExpiresAt: expiresAt(token.refresh_token_expires_in),
            connectedById: flow.userId,
            connectedAt: new Date()
          },
          create: {
            id: PRIMARY_OA_CONNECTION_ID,
            oaId: info.oaId,
            oaName: info.name,
            accessTokenEncrypted: seal(token.access_token!),
            refreshTokenEncrypted: seal(token.refresh_token!),
            accessExpiresAt: expiresAt(token.expires_in),
            refreshExpiresAt: expiresAt(token.refresh_token_expires_in),
            connectedById: flow.userId
          }
        });

        await prisma.auditLog.create({
          data: {
            actorId: flow.userId,
            action: "ZALO_OA_CONNECT",
            entityType: "ZaloOAConnection",
            entityId: connection.id,
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"] ?? undefined,
            metadata: {
              oaId: connection.oaId,
              oaName: connection.oaName
            }
          }
        });

        await prisma.zaloOAOAuthFlow.delete({ where: { id: flow.id } });

        return reply.redirect(
          callbackRedirect({
            oa: "connected",
            oa_id: connection.oaId
          })
        );
      } catch (error) {
        request.log.error(error);
        await prisma.zaloOAOAuthFlow
          .delete({ where: { id: flow.id } })
          .catch(() => undefined);

        return reply.redirect(
          callbackRedirect({
            oa: "error",
            reason: "token_exchange_failed"
          })
        );
      }
    }
  );

  app.get(
    "/v1/integrations/zalo/oa/info",
    { preHandler: [...adminGuard] },
    async (request, reply) => {
      try {
        const { accessToken } = await validOAAccessToken();
        const info = await getOAInfo(accessToken);
        return info;
      } catch (error) {
        request.log.error(error);
        return reply.code(503).send({
          error: "oa_not_available",
          message:
            error instanceof Error
              ? error.message
              : "Không đọc được thông tin Zalo OA."
        });
      }
    }
  );

  app.post(
    "/v1/integrations/zalo/oa/refresh",
    { preHandler: [...adminGuard] },
    async (request, reply) => {
      try {
        const { connection } = await refreshOAConnection();

        await writeAudit(request, {
          action: "ZALO_OA_TOKEN_REFRESH",
          entityType: "ZaloOAConnection",
          entityId: connection.id,
          metadata: { oaId: connection.oaId }
        });

        return {
          ok: true,
          oaId: connection.oaId,
          accessExpiresAt: connection.accessExpiresAt,
          refreshExpiresAt: connection.refreshExpiresAt
        };
      } catch (error) {
        request.log.error(error);
        return reply.code(503).send({
          error: "oa_refresh_failed",
          message:
            error instanceof Error
              ? error.message
              : "Không thể làm mới OA access token."
        });
      }
    }
  );

  app.delete(
    "/v1/integrations/zalo/oa",
    { preHandler: [...adminGuard] },
    async (request) => {
      const connection = await prisma.zaloOAConnection.findUnique({
        where: { id: PRIMARY_OA_CONNECTION_ID },
        select: { id: true, oaId: true }
      });

      if (connection) {
        await prisma.zaloOAConnection.delete({
          where: { id: PRIMARY_OA_CONNECTION_ID }
        });

        await writeAudit(request, {
          action: "ZALO_OA_DISCONNECT",
          entityType: "ZaloOAConnection",
          entityId: connection.id,
          metadata: { oaId: connection.oaId }
        });
      }

      return { ok: true };
    }
  );
}
