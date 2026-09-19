import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { authenticate, authorize } from "../lib/auth.js";
import { writeAudit } from "../lib/audit.js";

const adminRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN] as const;
const userRoleSchema = z.enum(UserRole);
const booleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const userSelect = {
  id: true,
  employeeCode: true,
  fullName: true,
  email: true,
  phone: true,
  zaloUserId: true,
  role: true,
  departmentId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  department: {
    select: { id: true, code: true, name: true }
  }
} as const;

export async function registerUserRoutes(app: FastifyInstance) {
  app.get(
    "/v1/users",
    {
      preHandler: [authenticate, authorize(...adminRoles)]
    },
    async (request) => {
      const query = z
        .object({
          search: z.string().trim().optional(),
          departmentId: z.string().optional(),
          role: userRoleSchema.optional(),
          includeInactive: booleanQuery.optional(),
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(30)
        })
        .parse(request.query);

      const where = {
        ...(query.includeInactive ? {} : { isActive: true }),
        ...(query.departmentId
          ? { departmentId: query.departmentId }
          : {}),
        ...(query.role ? { role: query.role } : {}),
        ...(query.search
          ? {
              OR: [
                {
                  fullName: {
                    contains: query.search,
                    mode: "insensitive" as const
                  }
                },
                {
                  employeeCode: {
                    contains: query.search,
                    mode: "insensitive" as const
                  }
                },
                {
                  email: {
                    contains: query.search,
                    mode: "insensitive" as const
                  }
                }
              ]
            }
          : {})
      };

      const [items, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: userSelect,
          orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit
        }),
        prisma.user.count({ where })
      ]);

      return {
        items,
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.max(1, Math.ceil(total / query.limit))
        }
      };
    }
  );

  app.get(
    "/v1/directory",
    { preHandler: [authenticate] },
    async (request) => {
      const query = z
        .object({
          search: z.string().trim().optional(),
          departmentId: z.string().optional()
        })
        .parse(request.query);

      const items = await prisma.user.findMany({
        where: {
          isActive: true,
          ...(query.departmentId
            ? { departmentId: query.departmentId }
            : {}),
          ...(query.search
            ? {
                OR: [
                  {
                    fullName: {
                      contains: query.search,
                      mode: "insensitive"
                    }
                  },
                  {
                    employeeCode: {
                      contains: query.search,
                      mode: "insensitive"
                    }
                  }
                ]
              }
            : {})
        },
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          phone: true,
          role: true,
          department: {
            select: { id: true, code: true, name: true }
          }
        },
        orderBy: { fullName: "asc" },
        take: 100
      });

      return { items };
    }
  );

  app.post(
    "/v1/users",
    {
      preHandler: [authenticate, authorize(...adminRoles)]
    },
    async (request, reply) => {
      const body = z
        .object({
          employeeCode: z.string().trim().min(2).max(40),
          fullName: z.string().trim().min(2).max(160),
          email: z.string().email().nullable().optional(),
          phone: z.string().trim().max(30).nullable().optional(),
          role: userRoleSchema.default(UserRole.STAFF),
          departmentId: z.string().nullable().optional()
        })
        .parse(request.body);

      if (body.departmentId) {
        const department = await prisma.department.findFirst({
          where: { id: body.departmentId, isActive: true },
          select: { id: true }
        });

        if (!department) {
          return reply.code(400).send({
            error: "invalid_department",
            message: "Khoa/phòng không tồn tại hoặc đã ngưng hoạt động."
          });
        }
      }

      const user = await prisma.user.create({
        data: {
          employeeCode: body.employeeCode.toUpperCase(),
          fullName: body.fullName,
          email: body.email ?? null,
          phone: body.phone ?? null,
          role: body.role,
          departmentId: body.departmentId ?? null
        },
        select: userSelect
      });

      await writeAudit(request, {
        action: "USER_CREATE",
        entityType: "User",
        entityId: user.id,
        metadata: {
          employeeCode: user.employeeCode,
          role: user.role,
          departmentId: user.departmentId
        }
      });

      return reply.code(201).send(user);
    }
  );

  app.patch(
    "/v1/users/:id",
    {
      preHandler: [authenticate, authorize(...adminRoles)]
    },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = z
        .object({
          employeeCode: z.string().trim().min(2).max(40).optional(),
          fullName: z.string().trim().min(2).max(160).optional(),
          email: z.string().email().nullable().optional(),
          phone: z.string().trim().max(30).nullable().optional(),
          role: userRoleSchema.optional(),
          departmentId: z.string().nullable().optional(),
          isActive: z.boolean().optional()
        })
        .refine((value) => Object.keys(value).length > 0, {
          message: "Cần ít nhất một trường để cập nhật."
        })
        .parse(request.body);

      if (body.departmentId) {
        const department = await prisma.department.findFirst({
          where: { id: body.departmentId, isActive: true },
          select: { id: true }
        });

        if (!department) {
          return reply.code(400).send({
            error: "invalid_department",
            message: "Khoa/phòng không tồn tại hoặc đã ngưng hoạt động."
          });
        }
      }

      const user = await prisma.user.update({
        where: { id: params.id },
        data: {
          ...(body.employeeCode
            ? { employeeCode: body.employeeCode.toUpperCase() }
            : {}),
          ...(body.fullName ? { fullName: body.fullName } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.role ? { role: body.role } : {}),
          ...(body.departmentId !== undefined
            ? { departmentId: body.departmentId }
            : {}),
          ...(body.isActive !== undefined
            ? { isActive: body.isActive }
            : {})
        },
        select: userSelect
      });

      await writeAudit(request, {
        action: "USER_UPDATE",
        entityType: "User",
        entityId: user.id,
        metadata: body
      });

      return user;
    }
  );

  app.delete(
    "/v1/users/:id",
    {
      preHandler: [authenticate, authorize(...adminRoles)]
    },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);

      const actorId = (request.user as { sub?: string } | undefined)?.sub;
      if (actorId === params.id) {
        return reply.code(409).send({
          error: "cannot_disable_self",
          message: "Không thể tự ngưng chính tài khoản đang đăng nhập."
        });
      }

      const user = await prisma.user.update({
        where: { id: params.id },
        data: { isActive: false },
        select: userSelect
      });

      await writeAudit(request, {
        action: "USER_DISABLE",
        entityType: "User",
        entityId: user.id
      });

      return { ok: true, user };
    }
  );
}
