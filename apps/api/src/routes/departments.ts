import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { authenticate, authorize } from "../lib/auth.js";
import { writeAudit } from "../lib/audit.js";

const adminRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN] as const;

const booleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export async function registerDepartmentRoutes(app: FastifyInstance) {
  app.get(
    "/v1/departments",
    { preHandler: [authenticate] },
    async (request) => {
      const query = z
        .object({
          search: z.string().trim().optional(),
          includeInactive: booleanQuery.optional()
        })
        .parse(request.query);

      const departments = await prisma.department.findMany({
        where: {
          ...(query.includeInactive ? {} : { isActive: true }),
          ...(query.search
            ? {
                OR: [
                  { code: { contains: query.search, mode: "insensitive" } },
                  { name: { contains: query.search, mode: "insensitive" } }
                ]
              }
            : {})
        },
        include: {
          _count: {
            select: {
              users: {
                where: { isActive: true }
              }
            }
          }
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }]
      });

      return {
        items: departments.map((department) => ({
          id: department.id,
          code: department.code,
          name: department.name,
          isActive: department.isActive,
          activeUsers: department._count.users,
          createdAt: department.createdAt,
          updatedAt: department.updatedAt
        }))
      };
    }
  );

  app.post(
    "/v1/departments",
    {
      preHandler: [authenticate, authorize(...adminRoles)]
    },
    async (request, reply) => {
      const body = z
        .object({
          code: z.string().trim().min(2).max(20),
          name: z.string().trim().min(2).max(160)
        })
        .parse(request.body);

      const department = await prisma.department.create({
        data: {
          code: body.code.toUpperCase(),
          name: body.name
        }
      });

      await writeAudit(request, {
        action: "DEPARTMENT_CREATE",
        entityType: "Department",
        entityId: department.id,
        metadata: { code: department.code, name: department.name }
      });

      return reply.code(201).send(department);
    }
  );

  app.patch(
    "/v1/departments/:id",
    {
      preHandler: [authenticate, authorize(...adminRoles)]
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = z
        .object({
          code: z.string().trim().min(2).max(20).optional(),
          name: z.string().trim().min(2).max(160).optional(),
          isActive: z.boolean().optional()
        })
        .refine((value) => Object.keys(value).length > 0, {
          message: "Cần ít nhất một trường để cập nhật."
        })
        .parse(request.body);

      const department = await prisma.department.update({
        where: { id: params.id },
        data: {
          ...(body.code ? { code: body.code.toUpperCase() } : {}),
          ...(body.name ? { name: body.name } : {}),
          ...(body.isActive !== undefined
            ? { isActive: body.isActive }
            : {})
        }
      });

      await writeAudit(request, {
        action: "DEPARTMENT_UPDATE",
        entityType: "Department",
        entityId: department.id,
        metadata: body
      });

      return department;
    }
  );

  app.delete(
    "/v1/departments/:id",
    {
      preHandler: [authenticate, authorize(...adminRoles)]
    },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);

      const activeUsers = await prisma.user.count({
        where: { departmentId: params.id, isActive: true }
      });

      if (activeUsers > 0) {
        return reply.code(409).send({
          error: "department_has_active_users",
          message:
            "Không thể ngưng khoa/phòng khi vẫn còn nhân sự đang hoạt động.",
          activeUsers
        });
      }

      const department = await prisma.department.update({
        where: { id: params.id },
        data: { isActive: false }
      });

      await writeAudit(request, {
        action: "DEPARTMENT_DISABLE",
        entityType: "Department",
        entityId: department.id
      });

      return { ok: true, department };
    }
  );
}
