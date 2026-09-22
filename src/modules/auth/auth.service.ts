import { config } from '../../config'
import { writeAuditLog } from '../../lib/audit'
import { prisma } from '../../lib/prisma'
import { dummyPasswordHash } from './dummy-hash'
import { isEmailIdentifier, normalizeEmail, normalizeIdentifier, normalizeUsername } from './identifier'
import { verifyPassword } from './password'
import { buildAuthContext, cookieOptions, createSession, revokeSession, userAuthInclude, type AuthContext } from './session.service'

const GENERIC_LOGIN_ERROR = 'Invalid email/username or password'

export type LoginInput = {
  identifier: unknown
  password: unknown
  rememberMe: unknown
  ipAddress?: string
  userAgent?: string
}

export async function login(input: LoginInput) {
  const identifier = typeof input.identifier === 'string' ? normalizeIdentifier(input.identifier) : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const rememberMe = Boolean(input.rememberMe)
  const { ipAddress, userAgent } = input

  if (!identifier || !password) {
    return {
      ok: false as const,
      status: 400,
      body: { error: 'Email/username and password are required', code: 'INVALID_INPUT' },
    }
  }

  const user = isEmailIdentifier(identifier)
    ? await prisma.user.findUnique({
        where: { email: normalizeEmail(identifier) },
        include: userAuthInclude,
      })
    : await prisma.user.findUnique({
        where: { username: normalizeUsername(identifier) },
        include: userAuthInclude,
      })

  const passwordHash = user?.passwordHash ?? (await dummyPasswordHash)
  const passwordOk = await verifyPassword(passwordHash, password)

  if (!user || !passwordOk) {
    if (user) {
      const nextAttempts = user.failedLoginAttempts + 1
      const shouldLock = nextAttempts >= config.maxFailedLoginAttempts
      const lockedUntil = shouldLock
        ? new Date(Date.now() + config.lockMinutes * 60 * 1000)
        : user.lockedUntil

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: nextAttempts,
          lockedUntil,
        },
      })

      await writeAuditLog({
        userId: user.id,
        action: shouldLock ? 'LOGIN_LOCKED' : 'LOGIN_FAILURE',
        entityType: 'user',
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: { identifierType: isEmailIdentifier(identifier) ? 'email' : 'username' },
      })
    } else {
      await writeAuditLog({
        action: 'LOGIN_FAILURE',
        ipAddress,
        userAgent,
        metadata: { reason: 'unknown_user' },
      })
    }

    return {
      ok: false as const,
      status: 401,
      body: { error: GENERIC_LOGIN_ERROR, code: 'INVALID_CREDENTIALS' },
    }
  }

  if (!user.primaryRole) {
    return {
      ok: false as const,
      status: 400,
      body: { error: 'Please assign a role to the user.', code: 'ROLE_MISSING' },
    }
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await writeAuditLog({
      userId: user.id,
      action: 'LOGIN_DENIED',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
      userAgent,
      metadata: { reason: 'locked' },
    })
    return {
      ok: false as const,
      status: 403,
      body: { error: 'Account is locked. Try again later.', code: 'ACCOUNT_LOCKED' },
    }
  }

  if (user.status === 'INACTIVE') {
    await writeAuditLog({
      userId: user.id,
      action: 'LOGIN_DENIED',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
      userAgent,
      metadata: { reason: 'inactive' },
    })
    return {
      ok: false as const,
      status: 403,
      body: { error: 'This user account is inactive.', code: 'ACCOUNT_INACTIVE' },
    }
  }

  if (user.status === 'SUSPENDED') {
    await writeAuditLog({
      userId: user.id,
      action: 'LOGIN_DENIED',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
      userAgent,
      metadata: { reason: 'suspended' },
    })
    return {
      ok: false as const,
      status: 403,
      body: { error: 'This user account has been suspended.', code: 'ACCOUNT_SUSPENDED' },
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  })

  const session = await createSession({
    userId: user.id,
    rememberMe,
    ipAddress,
    userAgent,
  })

  await writeAuditLog({
    userId: user.id,
    action: 'LOGIN_SUCCESS',
    entityType: 'user',
    entityId: user.id,
    ipAddress,
    userAgent,
  })

  const auth = buildAuthContext({
    sessionId: session.sessionId,
    user: { ...user, primaryRole: user.primaryRole },
  })

  return {
    ok: true as const,
    cookie: {
      name: session.cookieName,
      value: session.token,
      options: cookieOptions(session.maxAge),
    },
    body: serializeAuth(auth),
  }
}

export function serializeAuth(auth: AuthContext) {
  return {
    user: auth.user,
    role: auth.role,
    roles: auth.roles,
    permissions: auth.permissions,
    dataScopes: auth.dataScopes,
    dataScope: auth.dataScope,
  }
}

export async function logout(
  auth: AuthContext | undefined,
  meta: { ipAddress?: string; userAgent?: string },
) {
  if (!auth?.sessionId) {
    return
  }

  await revokeSession(auth.sessionId)
  await writeAuditLog({
    userId: auth.user.id,
    action: 'LOGOUT',
    entityType: 'user',
    entityId: auth.user.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}
