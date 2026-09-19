import type { FastifyInstance } from "fastify";
import { ZaloOAuthMode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { authenticate, type SessionUser } from "../lib/auth.js";
import {
  buildAuthorizationUrl,
  createOneTimeTicket,
  createPkcePair,
  createState,
  exchangeAuthorizationCode,
  getZaloProfile,
  hashTicket
} from "../lib/zalo.js";

const OAUTH_TTL_MS = 10 * 60 * 1000;
const TICKET_TTL_MS = 2 * 60 * 1000;

function toSessionUser(user: {
  id: string;
  employeeCode: string;
  fullName: string;
  role: SessionUser["role"];
  departmentId: string | null;
}): SessionUser {
  return {
    sub: user.id,
    employeeCode: user.employeeCode,
    fullName: user.fullName,
    role: user.role,
    departmentId: user.departmentId
  };
}

function authRedirect(params: Record<string, string>) {
  const url = new URL(
    process.env.ZALO_AUTH_SUCCESS_REDIRECT ??
      "http://localhost:3000/auth/zalo/callback"
  );

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/v1/auth/dev-login", async (request, reply) => {
    if (process.env.ALLOW_DEV_AUTH !== "true") {
      return reply.code(403).send({
        error: "dev_auth_disabled",
        message: "Đăng nhập thử nghiệm đang bị tắt."
      });
    }

    const body = z
      .object({
        employeeCode: z.string().trim().min(1).default("ADMIN001")
      })
      .parse(request.body ?? {});

    const user = await prisma.user.findUnique({
      where: { employeeCode: body.employeeCode },
      include: {
        department: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    if (!user || !user.isActive) {
      return reply.code(404).send({
        error: "user_not_found",
        message: "Không tìm thấy nhân sự đang hoạt động."
      });
    }

    const token = app.jwt.sign(toSessionUser(user), { expiresIn: "8h" });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "AUTH_DEV_LOGIN",
        entityType: "User",
        entityId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] ?? undefined
      }
    });

    return {
      token,
      expiresIn: "8h",
      user: {
        id: user.id,
        employeeCode: user.employeeCode,
        fullName: user.fullName,
        role: user.role,
        zaloLinked: Boolean(user.zaloUserId),
        department: user.department
      }
    };
  });

  app.get(
    "/v1/auth/session",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const session = request.user as SessionUser;
      const user = await prisma.user.findUnique({
        where: { id: session.sub },
        include: {
          department: {
            select: { id: true, code: true, name: true }
          }
        }
      });

      if (!user || !user.isActive) {
        return reply.code(401).send({
          error: "inactive_user",
          message: "Tài khoản không còn hoạt động."
        });
      }

      return {
        user: {
          ...toSessionUser(user),
          zaloLinked: Boolean(user.zaloUserId),
          zaloDisplayName: user.zaloDisplayName,
          zaloAvatarUrl: user.zaloAvatarUrl,
          department: user.department
        }
      };
    }
  );

  app.get("/v1/auth/zalo/start", async (request, reply) => {
    const query = z
      .object({
        mode: z.enum(["login", "link"]).default("login")
      })
      .parse(request.query);

    let userId: string | null = null;

    if (query.mode === "link") {
      try {
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({
          error: "unauthorized",
          message: "Cần đăng nhập nội bộ trước khi liên kết Zalo."
        });
      }

      userId = (request.user as SessionUser).sub;
    }

    const { codeVerifier, codeChallenge } = createPkcePair();
    const state = createState();
    const now = new Date();

    await prisma.zaloOAuthFlow.deleteMany({
      where: { expiresAt: { lt: now } }
    });

    await prisma.zaloOAuthFlow.create({
      data: {
        state,
        codeVerifier,
        mode:
          query.mode === "link"
            ? ZaloOAuthMode.LINK
            : ZaloOAuthMode.LOGIN,
        userId,
        expiresAt: new Date(now.getTime() + OAUTH_TTL_MS)
      }
    });

    return {
      authorizationUrl: buildAuthorizationUrl(state, codeChallenge),
      expiresIn: Math.floor(OAUTH_TTL_MS / 1000)
    };
  });

  app.get("/v1/auth/zalo/callback", async (request, reply) => {
    const query = z
      .object({
        code: z.string().optional(),
        state: z.string().optional(),
        error: z.string().optional(),
        error_reason: z.string().optional()
      })
      .parse(request.query);

    if (query.error) {
      return reply.redirect(
        authRedirect({
          error: query.error_reason || query.error
        })
      );
    }

    if (!query.code || !query.state) {
      return reply.redirect(
        authRedirect({ error: "missing_code_or_state" })
      );
    }

    const flow = await prisma.zaloOAuthFlow.findUnique({
      where: { state: query.state }
    });

    if (!flow || flow.expiresAt <= new Date()) {
      if (flow) {
        await prisma.zaloOAuthFlow.delete({ where: { id: flow.id } });
      }

      return reply.redirect(
        authRedirect({ error: "oauth_state_expired" })
      );
    }

    try {
      const tokenData = await exchangeAuthorizationCode(
        query.code,
        flow.codeVerifier
      );
      const profile = await getZaloProfile(tokenData.access_token!);

      let user;

      if (flow.mode === ZaloOAuthMode.LINK) {
        if (!flow.userId) {
          throw new Error("OAuth link flow has no internal user.");
        }

        const existingLink = await prisma.user.findUnique({
          where: { zaloUserId: profile.id }
        });

        if (existingLink && existingLink.id !== flow.userId) {
          await prisma.zaloOAuthFlow.delete({ where: { id: flow.id } });
          return reply.redirect(
            authRedirect({ error: "zalo_account_already_linked" })
          );
        }

        user = await prisma.user.findFirst({
          where: { id: flow.userId, isActive: true }
        });

        if (!user) {
          await prisma.zaloOAuthFlow.delete({ where: { id: flow.id } });
          return reply.redirect(
            authRedirect({ error: "internal_user_not_found" })
          );
        }

        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            zaloUserId: profile.id,
            zaloDisplayName: profile.name,
            zaloAvatarUrl: profile.picture?.data?.url ?? null,
            lastZaloLoginAt: new Date(),
            lastLoginAt: new Date()
          }
        });
      } else {
        user = await prisma.user.findUnique({
          where: { zaloUserId: profile.id }
        });

        if (!user || !user.isActive) {
          await prisma.zaloOAuthFlow.delete({ where: { id: flow.id } });
          return reply.redirect(
            authRedirect({ error: "zalo_account_not_linked" })
          );
        }

        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            zaloDisplayName: profile.name,
            zaloAvatarUrl: profile.picture?.data?.url ?? null,
            lastZaloLoginAt: new Date(),
            lastLoginAt: new Date()
          }
        });
      }

      const ticket = createOneTimeTicket();

      await prisma.$transaction([
        prisma.zaloOAuthFlow.delete({
          where: { id: flow.id }
        }),
        prisma.authTicket.create({
          data: {
            tokenHash: hashTicket(ticket),
            userId: user.id,
            expiresAt: new Date(Date.now() + TICKET_TTL_MS)
          }
        }),
        prisma.auditLog.create({
          data: {
            actorId: user.id,
            action:
              flow.mode === ZaloOAuthMode.LINK
                ? "AUTH_ZALO_LINK"
                : "AUTH_ZALO_LOGIN",
            entityType: "User",
            entityId: user.id,
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"] ?? undefined,
            metadata: {
              zaloUserId: profile.id,
              zaloDisplayName: profile.name
            }
          }
        })
      ]);

      return reply.redirect(
        authRedirect({
          ticket,
          linked: flow.mode === ZaloOAuthMode.LINK ? "1" : "0"
        })
      );
    } catch (error) {
      request.log.error(error);

      await prisma.zaloOAuthFlow.deleteMany({
        where: { id: flow.id }
      });

      return reply.redirect(
        authRedirect({ error: "zalo_oauth_failed" })
      );
    }
  });

  app.post("/v1/auth/zalo/complete", async (request, reply) => {
    const body = z
      .object({
        ticket: z.string().min(20)
      })
      .parse(request.body);

    const now = new Date();
    const tokenHash = hashTicket(body.ticket);

    const record = await prisma.authTicket.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            department: {
              select: { id: true, code: true, name: true }
            }
          }
        }
      }
    });

    if (
      !record ||
      record.usedAt ||
      record.expiresAt <= now ||
      !record.user.isActive
    ) {
      return reply.code(401).send({
        error: "invalid_auth_ticket",
        message: "Ticket xác thực không hợp lệ hoặc đã hết hạn."
      });
    }

    const consumed = await prisma.authTicket.updateMany({
      where: {
        id: record.id,
        usedAt: null,
        expiresAt: { gt: now }
      },
      data: { usedAt: now }
    });

    if (consumed.count !== 1) {
      return reply.code(401).send({
        error: "auth_ticket_already_used",
        message: "Ticket xác thực đã được sử dụng."
      });
    }

    const token = app.jwt.sign(toSessionUser(record.user), {
      expiresIn: "8h"
    });

    return {
      token,
      expiresIn: "8h",
      user: {
        id: record.user.id,
        employeeCode: record.user.employeeCode,
        fullName: record.user.fullName,
        role: record.user.role,
        zaloLinked: Boolean(record.user.zaloUserId),
        department: record.user.department
      }
    };
  });

  app.post("/v1/auth/zalo/miniapp", async (request, reply) => {
    const body = z
      .object({
        accessToken: z.string().min(20)
      })
      .parse(request.body);

    try {
      const profile = await getZaloProfile(body.accessToken);
      const user = await prisma.user.findUnique({
        where: { zaloUserId: profile.id },
        include: {
          department: {
            select: { id: true, code: true, name: true }
          }
        }
      });

      if (!user || !user.isActive) {
        return reply.code(403).send({
          error: "zalo_account_not_linked",
          message:
            "Tài khoản Zalo này chưa được liên kết với nhân sự nội bộ."
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          zaloDisplayName: profile.name,
          zaloAvatarUrl: profile.picture?.data?.url ?? null,
          lastZaloLoginAt: new Date(),
          lastLoginAt: new Date()
        }
      });

      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "AUTH_ZALO_MINIAPP_LOGIN",
          entityType: "User",
          entityId: user.id,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? undefined
        }
      });

      const token = app.jwt.sign(toSessionUser(user), {
        expiresIn: "8h"
      });

      return {
        token,
        expiresIn: "8h",
        user: {
          id: user.id,
          employeeCode: user.employeeCode,
          fullName: user.fullName,
          role: user.role,
          department: user.department
        }
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(401).send({
        error: "invalid_zalo_access_token",
        message: "Không xác minh được phiên đăng nhập Zalo."
      });
    }
  });

  app.delete(
    "/v1/auth/zalo/link",
    { preHandler: [authenticate] },
    async (request) => {
      const session = request.user as SessionUser;

      await prisma.user.update({
        where: { id: session.sub },
        data: {
          zaloUserId: null,
          zaloDisplayName: null,
          zaloAvatarUrl: null
        }
      });

      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: "AUTH_ZALO_UNLINK",
          entityType: "User",
          entityId: session.sub,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? undefined
        }
      });

      return { ok: true };
    }
  );
}
