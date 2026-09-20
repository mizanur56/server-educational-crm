import { createHash, randomBytes } from 'node:crypto'
import { config } from '../../config.ts'
import { writeAuditLog } from '../../lib/audit.ts'
import { prisma } from '../../lib/prisma.ts'
import { isEmailIdentifier, normalizeEmail, normalizeIdentifier, normalizeUsername } from './identifier.ts'
import { hashPassword } from './password.ts'

function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

const GENERIC_RESET_MESSAGE = 'If an account exists, password reset instructions have been sent.'

export async function requestPasswordReset(input: {
  identifier: unknown
  actorId?: string | null
  ipAddress?: string
  userAgent?: string
}) {
  const identifier = typeof input.identifier === 'string' ? normalizeIdentifier(input.identifier) : ''

  if (!identifier) {
    return {
      ok: true as const,
      body: { message: GENERIC_RESET_MESSAGE },
    }
  }

  const user = isEmailIdentifier(identifier)
    ? await prisma.user.findUnique({ where: { email: normalizeEmail(identifier) } })
    : await prisma.user.findUnique({ where: { username: normalizeUsername(identifier) } })

  if (!user || user.status === 'SUSPENDED') {
    await writeAuditLog({
      action: 'PASSWORD_RESET_REQUESTED',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { result: 'ignored' },
    })
    return {
      ok: true as const,
      body: { message: GENERIC_RESET_MESSAGE },
    }
  }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + config.resetTokenHours * 60 * 60 * 1000)

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt,
    },
  })

  await writeAuditLog({
    userId: input.actorId ?? user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    entityType: 'user',
    entityId: user.id,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })

  return {
    ok: true as const,
    body: {
      message: GENERIC_RESET_MESSAGE,
      ...(!config.isProduction
        ? {
            devResetToken: token,
            devResetPath: `/reset-password?token=${token}`,
          }
        : {}),
    },
  }
}

export async function completePasswordReset(input: {
  token: unknown
  password: unknown
  ipAddress?: string
  userAgent?: string
}) {
  const token = typeof input.token === 'string' ? input.token.trim() : ''
  const password = typeof input.password === 'string' ? input.password : ''

  if (!token || password.length < config.minPasswordLength) {
    return {
      ok: false as const,
      status: 400,
      body: {
        error: `Password must be at least ${config.minPasswordLength} characters.`,
        code: 'INVALID_INPUT',
      },
    }
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: true },
  })

  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    return {
      ok: false as const,
      status: 400,
      body: { error: 'This reset link is invalid or has expired.', code: 'INVALID_RESET_TOKEN' },
    }
  }

  if (record.user.status === 'SUSPENDED') {
    return {
      ok: false as const,
      status: 403,
      body: { error: 'This user account has been suspended.', code: 'ACCOUNT_SUSPENDED' },
    }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(password),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  await writeAuditLog({
    userId: record.userId,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'user',
    entityId: record.userId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })

  return {
    ok: true as const,
    body: { message: 'Password has been reset. Please sign in.' },
  }
}

export async function changePassword(input: {
  userId: string
  currentPassword: unknown
  newPassword: unknown
  ipAddress?: string
  userAgent?: string
}) {
  const currentPassword = typeof input.currentPassword === 'string' ? input.currentPassword : ''
  const newPassword = typeof input.newPassword === 'string' ? input.newPassword : ''

  if (newPassword.length < config.minPasswordLength) {
    return {
      ok: false as const,
      status: 400,
      body: {
        error: `Password must be at least ${config.minPasswordLength} characters.`,
        code: 'INVALID_INPUT',
      },
    }
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } })
  const { verifyPassword } = await import('./password.ts')
  const matches = await verifyPassword(user.passwordHash, currentPassword)

  if (!matches) {
    return {
      ok: false as const,
      status: 400,
      body: { error: 'Current password is incorrect.', code: 'INVALID_PASSWORD' },
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  })

  await writeAuditLog({
    userId: user.id,
    action: 'PASSWORD_CHANGED',
    entityType: 'user',
    entityId: user.id,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })

  return {
    ok: true as const,
    body: { message: 'Password updated.' },
  }
}
