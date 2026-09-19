import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { authenticate, authorize } from "../lib/auth.js";

export async function registerAuditRoutes(app: FastifyInstance) {
  app.get(
    "/v1/audit",
    {
      preHandler: [
        authenticate,
        authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN)
      ]
    },
    async (request) => {
      const query = z
        .object({
          action: z.string().trim().optional(),
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(50)
        })
        .parse(request.query);

      const where = query.action
        ? {
            action: {
              contains: query.action,
              mode: "insensitive" as const
            }
          }
        : {};

      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: {
            actor: {
              select: {
                id: true,
                employeeCode: true,
                fullName: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: "desc" },
          skip: (query.page - 1) * query.limit,
          take: query.limit
        }),
        prisma.auditLog.count({ where })
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
}
