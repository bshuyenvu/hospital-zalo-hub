import type { FastifyInstance } from "fastify";
import { ConsultationPriority, ConsultationStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { authenticate, type SessionUser } from "../lib/auth.js";
import { writeAudit } from "../lib/audit.js";

const prioritySchema = z.enum(ConsultationPriority);
const statusSchema = z.enum(ConsultationStatus);

function isAdmin(role: UserRole) {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
}

async function canAccess(consultationId: string, session: SessionUser) {
  if (isAdmin(session.role)) return true;

  const found = await prisma.consultationCase.findFirst({
    where: {
      id: consultationId,
      OR: [
        { ownerId: session.sub },
        { participants: { some: { userId: session.sub } } }
      ]
    },
    select: { id: true }
  });

  return Boolean(found);
}

export async function registerConsultationRoutes(app: FastifyInstance) {
  app.get("/v1/consultations", { preHandler: [authenticate] }, async (request) => {
    const session = request.user as SessionUser;
    const query = z.object({
      status: statusSchema.optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20)
    }).parse(request.query);

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(isAdmin(session.role)
        ? {}
        : {
            OR: [
              { ownerId: session.sub },
              { participants: { some: { userId: session.sub } } }
            ]
          })
    };

    const [items, total] = await Promise.all([
      prisma.consultationCase.findMany({
        where,
        include: {
          owner: { select: { id: true, fullName: true, employeeCode: true } },
          department: { select: { id: true, code: true, name: true } },
          _count: { select: { participants: true, messages: true } }
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit
      }),
      prisma.consultationCase.count({ where })
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
  });

  app.post("/v1/consultations", { preHandler: [authenticate] }, async (request, reply) => {
    const session = request.user as SessionUser;
    const body = z.object({
      title: z.string().trim().min(3).max(180),
      summary: z.string().trim().min(3).max(10000),
      priority: prioritySchema.default(ConsultationPriority.ROUTINE),
      departmentId: z.string().nullable().optional(),
      participantIds: z.array(z.string()).max(50).default([])
    }).parse(request.body);

    const participantIds = Array.from(new Set([session.sub, ...body.participantIds]));

    const validUsers = await prisma.user.findMany({
      where: { id: { in: participantIds }, isActive: true },
      select: { id: true }
    });

    if (validUsers.length !== participantIds.length) {
      return reply.code(400).send({
        error: "invalid_participants",
        message: "Có thành viên không tồn tại hoặc đã ngưng hoạt động."
      });
    }

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

    const consultation = await prisma.consultationCase.create({
      data: {
        title: body.title,
        summary: body.summary,
        priority: body.priority,
        ownerId: session.sub,
        departmentId: body.departmentId ?? session.departmentId ?? null,
        participants: {
          create: participantIds.map((userId) => ({ userId }))
        }
      },
      include: {
        owner: { select: { id: true, fullName: true, employeeCode: true } },
        department: { select: { id: true, code: true, name: true } },
        participants: {
          include: {
            user: {
              select: { id: true, fullName: true, employeeCode: true, role: true }
            }
          }
        }
      }
    });

    await writeAudit(request, {
      action: "CONSULTATION_CREATE",
      entityType: "ConsultationCase",
      entityId: consultation.id,
      metadata: {
        priority: consultation.priority,
        participantCount: participantIds.length
      }
    });

    return reply.code(201).send(consultation);
  });

  app.get("/v1/consultations/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const session = request.user as SessionUser;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    if (!(await canAccess(params.id, session))) {
      return reply.code(403).send({
        error: "forbidden",
        message: "Bạn không thuộc ca hội chẩn này."
      });
    }

    const consultation = await prisma.consultationCase.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, fullName: true, employeeCode: true } },
        department: { select: { id: true, code: true, name: true } },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
                role: true,
                department: { select: { id: true, code: true, name: true } }
              }
            }
          },
          orderBy: { joinedAt: "asc" }
        },
        messages: {
          include: {
            author: { select: { id: true, fullName: true, employeeCode: true } }
          },
          orderBy: { createdAt: "asc" },
          take: 200
        }
      }
    });

    if (!consultation) {
      return reply.code(404).send({
        error: "consultation_not_found",
        message: "Không tìm thấy ca hội chẩn."
      });
    }

    return consultation;
  });

  app.post("/v1/consultations/:id/participants", { preHandler: [authenticate] }, async (request, reply) => {
    const session = request.user as SessionUser;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({ userIds: z.array(z.string()).min(1).max(50) }).parse(request.body);

    const consultation = await prisma.consultationCase.findUnique({
      where: { id: params.id },
      select: { id: true, ownerId: true, status: true }
    });

    if (!consultation) {
      return reply.code(404).send({ error: "consultation_not_found", message: "Không tìm thấy ca hội chẩn." });
    }

    if (!isAdmin(session.role) && consultation.ownerId !== session.sub) {
      return reply.code(403).send({ error: "forbidden", message: "Chỉ người tạo ca hoặc quản trị được mời thành viên." });
    }

    if (consultation.status === ConsultationStatus.CLOSED) {
      return reply.code(409).send({ error: "consultation_closed", message: "Ca hội chẩn đã đóng." });
    }

    const ids = Array.from(new Set(body.userIds));
    const valid = await prisma.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true }
    });

    if (valid.length !== ids.length) {
      return reply.code(400).send({ error: "invalid_participants", message: "Có thành viên không hợp lệ." });
    }

    await prisma.consultationParticipant.createMany({
      data: ids.map((userId) => ({ consultationId: params.id, userId })),
      skipDuplicates: true
    });

    await writeAudit(request, {
      action: "CONSULTATION_PARTICIPANTS_ADD",
      entityType: "ConsultationCase",
      entityId: params.id,
      metadata: { userIds: ids }
    });

    return { ok: true };
  });

  app.post("/v1/consultations/:id/messages", { preHandler: [authenticate] }, async (request, reply) => {
    const session = request.user as SessionUser;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({ body: z.string().trim().min(1).max(5000) }).parse(request.body);

    if (!(await canAccess(params.id, session))) {
      return reply.code(403).send({ error: "forbidden", message: "Bạn không thuộc ca hội chẩn này." });
    }

    const consultation = await prisma.consultationCase.findUnique({
      where: { id: params.id },
      select: { status: true }
    });

    if (!consultation) {
      return reply.code(404).send({ error: "consultation_not_found", message: "Không tìm thấy ca hội chẩn." });
    }

    if (consultation.status === ConsultationStatus.CLOSED) {
      return reply.code(409).send({ error: "consultation_closed", message: "Ca hội chẩn đã đóng." });
    }

    const message = await prisma.consultationMessage.create({
      data: {
        consultationId: params.id,
        authorId: session.sub,
        body: body.body
      },
      include: {
        author: { select: { id: true, fullName: true, employeeCode: true } }
      }
    });

    await prisma.consultationCase.update({
      where: { id: params.id },
      data: { updatedAt: new Date() }
    });

    await writeAudit(request, {
      action: "CONSULTATION_MESSAGE_CREATE",
      entityType: "ConsultationCase",
      entityId: params.id,
      metadata: { messageId: message.id }
    });

    return reply.code(201).send(message);
  });

  app.patch("/v1/consultations/:id/status", { preHandler: [authenticate] }, async (request, reply) => {
    const session = request.user as SessionUser;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({ status: statusSchema }).parse(request.body);

    const consultation = await prisma.consultationCase.findUnique({
      where: { id: params.id },
      select: { id: true, ownerId: true }
    });

    if (!consultation) {
      return reply.code(404).send({ error: "consultation_not_found", message: "Không tìm thấy ca hội chẩn." });
    }

    if (!isAdmin(session.role) && consultation.ownerId !== session.sub) {
      return reply.code(403).send({ error: "forbidden", message: "Chỉ người tạo ca hoặc quản trị được đổi trạng thái." });
    }

    const updated = await prisma.consultationCase.update({
      where: { id: params.id },
      data: {
        status: body.status,
        closedAt: body.status === ConsultationStatus.CLOSED ? new Date() : null
      }
    });

    await writeAudit(request, {
      action: "CONSULTATION_STATUS_CHANGE",
      entityType: "ConsultationCase",
      entityId: params.id,
      metadata: { status: body.status }
    });

    return updated;
  });
}
