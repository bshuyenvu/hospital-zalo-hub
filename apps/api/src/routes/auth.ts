import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { authenticate, type SessionUser } from "../lib/auth.js";

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

    const payload: SessionUser = {
      sub: user.id,
      employeeCode: user.employeeCode,
      fullName: user.fullName,
      role: user.role,
      departmentId: user.departmentId
    };

    const token = app.jwt.sign(payload, { expiresIn: "8h" });

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
        department: user.department
      }
    };
  });

  app.get(
    "/v1/auth/session",
    { preHandler: [authenticate] },
    async (request) => {
      const session = request.user as SessionUser;
      return { user: session };
    }
  );

  app.get("/v1/auth/zalo/callback", async (request, reply) => {
    const query = z
      .object({
        code: z.string().optional(),
        state: z.string().optional()
      })
      .parse(request.query);

    if (!query.code) {
      return reply.code(400).send({
        error: "missing_authorization_code",
        message: "Thiếu authorization code từ Zalo."
      });
    }

    return reply.code(501).send({
      error: "zalo_oauth_not_configured",
      message:
        "Đã nhận authorization code. Bước tiếp theo là cấu hình App ID/App Secret để đổi token và ánh xạ người dùng nội bộ."
    });
  });
}
