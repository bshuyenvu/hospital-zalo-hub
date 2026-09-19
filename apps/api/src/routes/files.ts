import type { FastifyInstance } from "fastify";
import { InternalFileScope, UserRole } from "@prisma/client";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { authenticate, type SessionUser } from "../lib/auth.js";
import { writeAudit } from "../lib/audit.js";

const storageRoot = process.env.INTERNAL_FILE_DIR ?? "/data/hospital-files";
const adminRoles = new Set<UserRole>([UserRole.SUPER_ADMIN, UserRole.ADMIN]);

function isAdmin(role: UserRole) {
  return adminRoles.has(role);
}

function visibleWhere(session: SessionUser) {
  if (isAdmin(session.role)) {
    return { isActive: true };
  }

  return {
    isActive: true,
    OR: [
      { scope: InternalFileScope.ALL },
      ...(session.departmentId
        ? [
            {
              scope: InternalFileScope.DEPARTMENT,
              departmentId: session.departmentId
            }
          ]
        : [])
    ]
  };
}

function safeDownloadName(name: string) {
  return name.replace(/[\r\n"]/g, "_");
}

export async function registerFileRoutes(app: FastifyInstance) {
  await mkdir(storageRoot, { recursive: true });

  app.get("/v1/files", { preHandler: [authenticate] }, async (request) => {
    const session = request.user as SessionUser;
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(30)
    }).parse(request.query);

    const where = visibleWhere(session);
    const [items, total] = await Promise.all([
      prisma.internalFile.findMany({
        where,
        include: {
          uploader: {
            select: { id: true, fullName: true, employeeCode: true }
          },
          department: {
            select: { id: true, code: true, name: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit
      }),
      prisma.internalFile.count({ where })
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

  app.post("/v1/files", { preHandler: [authenticate] }, async (request, reply) => {
    const session = request.user as SessionUser;
    const query = z.object({
      scope: z.enum(InternalFileScope).default(InternalFileScope.DEPARTMENT),
      departmentId: z.string().optional()
    }).parse(request.query);

    if (query.scope === InternalFileScope.ALL && !isAdmin(session.role)) {
      return reply.code(403).send({
        error: "forbidden",
        message: "Chỉ quản trị được chia sẻ tệp cho toàn viện."
      });
    }

    let departmentId: string | null = null;
    if (query.scope === InternalFileScope.DEPARTMENT) {
      departmentId = isAdmin(session.role)
        ? query.departmentId ?? session.departmentId
        : session.departmentId;

      if (!departmentId) {
        return reply.code(400).send({
          error: "department_required",
          message: "Tài khoản chưa được gán khoa/phòng."
        });
      }

      const department = await prisma.department.findFirst({
        where: { id: departmentId, isActive: true },
        select: { id: true }
      });

      if (!department) {
        return reply.code(400).send({
          error: "invalid_department",
          message: "Khoa/phòng không tồn tại hoặc đã ngưng hoạt động."
        });
      }
    }

    const part = await request.file();
    if (!part) {
      return reply.code(400).send({
        error: "file_required",
        message: "Chưa chọn tệp để tải lên."
      });
    }

    const storedName = randomUUID();
    const target = path.join(storageRoot, storedName);

    let sizeBytes = 0;
    part.file.on("data", (chunk: Buffer) => {
      sizeBytes += chunk.length;
    });

    try {
      await pipeline(part.file, createWriteStream(target, { flags: "wx" }));
    } catch (error) {
      await unlink(target).catch(() => undefined);
      throw error;
    }

    if (part.file.truncated) {
      await unlink(target).catch(() => undefined);
      return reply.code(413).send({
        error: "file_too_large",
        message: "Tệp vượt quá giới hạn 20 MB."
      });
    }

    const record = await prisma.internalFile.create({
      data: {
        originalName: part.filename.slice(0, 240),
        storedName,
        mimeType: part.mimetype || "application/octet-stream",
        sizeBytes,
        scope: query.scope,
        uploaderId: session.sub,
        departmentId
      },
      include: {
        uploader: {
          select: { id: true, fullName: true, employeeCode: true }
        },
        department: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    await writeAudit(request, {
      action: "INTERNAL_FILE_UPLOAD",
      entityType: "InternalFile",
      entityId: record.id,
      metadata: {
        originalName: record.originalName,
        sizeBytes: record.sizeBytes,
        scope: record.scope,
        departmentId: record.departmentId
      }
    });

    return reply.code(201).send(record);
  });

  app.get("/v1/files/:id/download", { preHandler: [authenticate] }, async (request, reply) => {
    const session = request.user as SessionUser;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const record = await prisma.internalFile.findFirst({
      where: {
        id: params.id,
        ...visibleWhere(session)
      }
    });

    if (!record) {
      return reply.code(404).send({
        error: "file_not_found",
        message: "Không tìm thấy tệp hoặc bạn không có quyền truy cập."
      });
    }

    const filePath = path.join(storageRoot, record.storedName);

    await writeAudit(request, {
      action: "INTERNAL_FILE_DOWNLOAD",
      entityType: "InternalFile",
      entityId: record.id
    });

    reply.header("Content-Type", record.mimeType);
    reply.header(
      "Content-Disposition",
      `attachment; filename="${safeDownloadName(record.originalName)}"; filename*=UTF-8''${encodeURIComponent(record.originalName)}`
    );

    return reply.send(createReadStream(filePath));
  });

  app.delete("/v1/files/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const session = request.user as SessionUser;
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const record = await prisma.internalFile.findUnique({
      where: { id: params.id },
      select: { id: true, uploaderId: true, originalName: true, isActive: true }
    });

    if (!record || !record.isActive) {
      return reply.code(404).send({
        error: "file_not_found",
        message: "Không tìm thấy tệp."
      });
    }

    if (!isAdmin(session.role) && record.uploaderId !== session.sub) {
      return reply.code(403).send({
        error: "forbidden",
        message: "Chỉ người tải lên hoặc quản trị được gỡ tệp."
      });
    }

    await prisma.internalFile.update({
      where: { id: params.id },
      data: { isActive: false }
    });

    await writeAudit(request, {
      action: "INTERNAL_FILE_DISABLE",
      entityType: "InternalFile",
      entityId: params.id,
      metadata: { originalName: record.originalName }
    });

    return { ok: true };
  });
}
