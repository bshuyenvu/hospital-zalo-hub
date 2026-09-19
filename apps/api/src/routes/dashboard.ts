import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { authenticate, authorize } from "../lib/auth.js";

const dashboardRoles = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.DEPARTMENT_MANAGER
];

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get(
    "/v1/dashboard",
    {
      preHandler: [authenticate, authorize(...dashboardRoles)]
    },
    async () => {
      const [activeUsers, activeDepartments, byRole, recentAudit] =
        await Promise.all([
          prisma.user.count({ where: { isActive: true } }),
          prisma.department.count({ where: { isActive: true } }),
          prisma.user.groupBy({
            by: ["role"],
            where: { isActive: true },
            _count: { _all: true }
          }),
          prisma.auditLog.findMany({
            take: 8,
            orderBy: { createdAt: "desc" },
            include: {
              actor: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true
                }
              }
            }
          })
        ]);

      return {
        activeUsers,
        activeDepartments,
        roles: byRole.map((item) => ({
          role: item.role,
          count: item._count._all
        })),
        recentAudit
      };
    }
  );
}
