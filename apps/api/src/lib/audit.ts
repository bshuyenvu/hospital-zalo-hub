import type { FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import type { SessionUser } from "./auth.js";

type AuditInput = {
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: unknown;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

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
      metadata: toJsonValue(input.metadata)
    }
  });
}
