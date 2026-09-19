import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { authenticate, authorize } from "../lib/auth.js";

function isConfigured(value?: string) {
  return Boolean(value?.trim());
}

function sessionSecretIsProductionSafe() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) return false;
  return secret !== "replace_with_a_long_random_secret" && secret.length >= 32;
}

export async function registerIntegrationRoutes(app: FastifyInstance) {
  app.get(
    "/v1/integrations/zalo/status",
    {
      preHandler: [
        authenticate,
        authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN)
      ]
    },
    async () => {
      const socialOAuthReady =
        isConfigured(process.env.ZALO_APP_ID) &&
        isConfigured(process.env.ZALO_APP_SECRET) &&
        isConfigured(process.env.ZALO_REDIRECT_URI) &&
        isConfigured(process.env.ZALO_AUTH_SUCCESS_REDIRECT);

      const oaReady =
        isConfigured(process.env.ZALO_OA_ID) &&
        isConfigured(process.env.ZALO_OA_SECRET);

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
          oaIdConfigured: isConfigured(process.env.ZALO_OA_ID),
          oaSecretConfigured: isConfigured(process.env.ZALO_OA_SECRET)
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
}
