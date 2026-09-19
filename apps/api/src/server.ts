import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";

const app = Fastify({
  logger: {
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie"
    ]
  }
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(",").map((value) => value.trim()) ?? true,
  credentials: true,
});

app.get("/health", async () => ({
  ok: true,
  service: "hospital-zalo-hub-api",
  version: "0.1.0",
  timestamp: new Date().toISOString(),
}));

app.get("/v1", async () => ({
  name: "Hospital Zalo Hub API",
  sprint: 1,
  modules: ["auth", "users", "departments", "rbac", "audit"],
}));

app.get("/v1/auth/zalo/callback", async (request, reply) => {
  const query = z
    .object({
      code: z.string().optional(),
      state: z.string().optional(),
    })
    .parse(request.query);

  if (!query.code) {
    return reply.code(400).send({
      error: "missing_authorization_code",
      message: "Zalo callback placeholder is ready. OAuth token exchange is implemented after credentials are configured.",
    });
  }

  return reply.code(501).send({
    error: "zalo_oauth_not_configured",
    message: "Authorization code received. Configure ZALO_APP_ID/ZALO_APP_SECRET before enabling token exchange.",
  });
});

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
