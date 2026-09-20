import type { Prisma } from './prisma-client.ts'
import { prisma } from './prisma.ts'

export async function writeAuditLog(input: {
  userId?: string | null
  action: string
  entityType?: string
  entityId?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Prisma.InputJsonValue
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: input.metadata,
    },
  })
}
