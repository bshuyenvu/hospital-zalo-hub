import type { FastifyInstance } from "fastify";
import { AnnouncementPriority, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { authenticate, authorize, type SessionUser } from "../lib/auth.js";
import { writeAudit } from "../lib/audit.js";

const adminRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN] as const;
const prioritySchema = z.enum(AnnouncementPriority);

function visibleWhere(session: SessionUser, now = new Date()) {
  return {
    isActive: true,
    publishedAt: { lte: now },
    AND: [
      {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      },
      {
        OR: [
          { targetDepartmentId: null },
          ...(session.departmentId
            ? [{ targetDepartmentId: session.departmentId }]
            : [])
        ]
      }
    ]
  };
}

export async function registerAnnouncementRoutes(app: FastifyInstance) {
  app.get(
    "/v1/announcements",
    { preHandler: [authenticate] },
    async (request) => {
      const session = request.user as SessionUser;
      const query = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(50).default(20)
        })
        .parse(request.query);

      const where = visibleWhere(session);
      const [items, total, unreadCount] = await Promise.all([
        prisma.announcement.findMany({
          where,
          include: {
            author: {
              select: { id: true, fullName: true, employeeCode: true }
            },
            targetDepartment: {
              select: { id: true, code: true, name: true }
            },
            reads: {
              where: { userId: session.sub },
              select: { readAt: true },
              take: 1
            }
          },
          orderBy: { publishedAt: "desc" },
          skip: (query.page - 1) * query.limit,
          take: query.limit
        }),
        prisma.announcement.count({ where }),
        prisma.announcement.count({
          where: {
            ...where,
            reads: {
              none: { userId: session.sub }
            }
          }
        })
      ]);

      return {
        items: items.map(({ reads, ...item }) => ({
          ...item,
          readAt: reads[0]?.readAt ?? null,
          unread: reads.length === 0
        })),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.max(1, Math.ceil(total / query.limit)),
          unreadCount
        }
      };
    }
  );

  app.post(
    "/v1/announcements",
    { preHandler: [authenticate, authorize(...adminRoles)] },
    async (request, reply) => {
      const session = request.user as SessionUser;
      const body = z
        .object({
          title: z.string().trim().min(2).max(180),
          body: z.string().trim().min(2).max(10000),
          priority: prioritySchema.default(AnnouncementPriority.NORMAL),
          targetDepartmentId: z.string().nullable().optional(),
          expiresAt: z.coerce.date().nullable().optional()
        })
        .parse(request.body);

      if (body.targetDepartmentId) {
        const department = await prisma.department.findFirst({
          where: { id: body.targetDepartmentId, isActive: true },
          select: { id: true }
        });

        if (!department) {
          return reply.code(400).send({
            error: "invalid_department",
            message: "Khoa/phòng nhận thông báo không tồn tại hoặc đã ngưng hoạt động."
          });
        }
      }

      if (body.expiresAt && body.expiresAt <= new Date()) {
        return reply.code(400).send({
          error: "invalid_expiry",
          message: "Thời hạn thông báo phải ở tương lai."
        });
      }

      const announcement = await prisma.announcement.create({
        data: {
          title: body.title,
          body: body.body,
          priority: body.priority,
          authorId: session.sub,
          targetDepartmentId: body.targetDepartmentId ?? null,
          expiresAt: body.expiresAt ?? null
        },
        include: {
          targetDepartment: {
            select: { id: true, code: true, name: true }
          }
        }
      });

      await writeAudit(request, {
        action: "ANNOUNCEMENT_CREATE",
        entityType: "Announcement",
        entityId: announcement.id,
        metadata: {
          priority: announcement.priority,
          targetDepartmentId: announcement.targetDepartmentId
        }
      });

      return reply.code(201).send(announcement);
    }
  );

  app.post(
    "/v1/announcements/:id/read",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const session = request.user as SessionUser;
      const params = z.object({ id: z.string().min(1) }).parse(request.params);

      const announcement = await prisma.announcement.findFirst({
        where: {
          id: params.id,
          ...visibleWhere(session)
        },
        select: { id: true }
      });

      if (!announcement) {
        return reply.code(404).send({
          error: "announcement_not_found",
          message: "Không tìm thấy thông báo hoặc thông báo không còn khả dụng."
        });
      }

      const receipt = await prisma.announcementRead.upsert({
        where: {
          announcementId_userId: {
            announcementId: params.id,
            userId: session.sub
          }
        },
        update: { readAt: new Date() },
        create: {
          announcementId: params.id,
          userId: session.sub
        }
      });

      return { ok: true, readAt: receipt.readAt };
    }
  );

  app.delete(
    "/v1/announcements/:id",
    { preHandler: [authenticate, authorize(...adminRoles)] },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);

      const announcement = await prisma.announcement.update({
        where: { id: params.id },
        data: { isActive: false },
        select: { id: true, title: true }
      });

      await writeAudit(request, {
        action: "ANNOUNCEMENT_DISABLE",
        entityType: "Announcement",
        entityId: announcement.id,
        metadata: { title: announcement.title }
      });

      return { ok: true };
    }
  );
}
