import type { FastifyRequest } from "fastify";
import { prisma } from "./db.js";
import type { SessionUser } from "./auth.js";

type AuditInput = {
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(
  request: FastifyRequest,
  input: AuditInput
) {
  const actor = request.user as SessionUser | undefined;

  await prisma.auditLog.create({
    data: {
      actorId: actor?.sub,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? undefined,
      metadata: input.metadata
    }
  });
}
