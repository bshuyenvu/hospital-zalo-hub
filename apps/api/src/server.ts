import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerDepartmentRoutes } from "./routes/departments.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerAuditRoutes } from "./routes/audit.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";
import { registerAnnouncementRoutes } from "./routes/announcements.js";
import { registerConsultationRoutes } from "./routes/consultations.js";
import { registerFileRoutes } from "./routes/files.js";

const app = Fastify({
  logger: {
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie"
    ]
  }
});

const sessionSecret =
  process.env.SESSION_SECRET ??
  (process.env.NODE_ENV === "production" ? "" : "dev-only-change-me");

if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required in production.");
}

await app.register(cors, {
  origin:
    process.env.CORS_ORIGIN?.split(",").map((value) => value.trim()) ?? true,
  credentials: true
});

await app.register(jwt, {
  secret: sessionSecret
});

await app.register(multipart, {
  limits: {
    files: 1,
    fileSize: 20 * 1024 * 1024
  }
});

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: "validation_error",
      message: "Dữ liệu gửi lên không hợp lệ.",
      issues: error.issues
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return reply.code(409).send({
        error: "duplicate_value",
        message: "Mã nhân sự, mã khoa/phòng hoặc email đã tồn tại."
      });
    }

    if (error.code === "P2025") {
      return reply.code(404).send({
        error: "not_found",
        message: "Không tìm thấy dữ liệu cần thao tác."
      });
    }
  }

  request.log.error(error);
  return reply.code(500).send({
    error: "internal_error",
    message: "Có lỗi hệ thống. Vui lòng thử lại hoặc kiểm tra log máy chủ."
  });
});

app.get("/", async (_request, reply) => {
  reply
    .type("text/html; charset=utf-8")
    .header("Cache-Control", "no-store")
    .send(`<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="zalo-platform-site-verification" content="USQxBAZj7mXmyim_yzf87JJ_c4BOYKCSCJCq" />
    <title>Hospital Hub API</title>
  </head>
  <body>Hospital Hub API</body>
</html>`);
});

app.get("/health", async () => ({
  ok: true,
  service: "hospital-zalo-hub-api",
  version: "0.4.0",
  timestamp: new Date().toISOString()
}));

app.get("/v1", async () => ({
  name: "Hospital Zalo Hub API",
  sprint: 1,
  version: "0.3.1",
  modules: [
    "auth",
    "zalo-oauth",
    "zalo-miniapp-auth",
    "zalo-integration-status",
    "users",
    "departments",
    "directory",
    "announcements",
    "consultations",
    "files",
    "rbac",
    "dashboard",
    "audit"
  ]
}));

await registerAuthRoutes(app);
await registerDepartmentRoutes(app);
await registerUserRoutes(app);
await registerAnnouncementRoutes(app);
await registerConsultationRoutes(app);
await registerFileRoutes(app);
await registerDashboardRoutes(app);
await registerAuditRoutes(app);
await registerIntegrationRoutes(app);

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
