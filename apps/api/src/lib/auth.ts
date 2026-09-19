import type {
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler
} from "fastify";
import type { UserRole } from "@prisma/client";

export type SessionUser = {
  sub: string;
  employeeCode: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
};

export const authenticate: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({
      error: "unauthorized",
      message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
    });
  }
};

export function authorize(...roles: UserRole[]): preHandlerHookHandler {
  return async (request, reply) => {
    const user = request.user as SessionUser | undefined;

    if (!user || !roles.includes(user.role)) {
      return reply.code(403).send({
        error: "forbidden",
        message: "Tài khoản không có quyền thực hiện thao tác này."
      });
    }
  };
}
