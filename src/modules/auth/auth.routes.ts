import { Router } from 'express'
import { SESSION_COOKIE } from '../../config'
import { writeAuditLog } from '../../lib/audit'
import { requestIp, requestUserAgent } from '../../lib/request'
import { login } from './auth.service'
import { changePassword, completePasswordReset, requestPasswordReset } from './password-reset.service'
import { requireAuth } from './require-auth.middleware'
import { clearCookieOptions, revokeSessionByToken } from './session.service'

export const authRouter = Router()

authRouter.post('/login', async (req, res, next) => {
  try {
    const result = await login({
      identifier: req.body?.identifier,
      password: req.body?.password,
      rememberMe: req.body?.rememberMe,
      ipAddress: requestIp(req),
      userAgent: requestUserAgent(req),
    })

    if (!result.ok) {
      res.status(result.status).json(result.body)
      return
    }

    res.cookie(result.cookie.name, result.cookie.value, result.cookie.options)
    res.json(result.body)
  } catch (error) {
    next(error)
  }
})

authRouter.post('/logout', async (req, res, next) => {
  try {
    const session = await revokeSessionByToken(req.cookies?.[SESSION_COOKIE])
    if (session) {
      void writeAuditLog({
        userId: session.userId,
        action: 'LOGOUT',
        entityType: 'user',
        entityId: session.userId,
        ipAddress: requestIp(req),
        userAgent: requestUserAgent(req),
      }).catch((error) => console.error('Failed to write audit log', error))
    }
    res.clearCookie(SESSION_COOKIE, clearCookieOptions())
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const result = await requestPasswordReset({
      identifier: req.body?.identifier,
      ipAddress: requestIp(req),
      userAgent: requestUserAgent(req),
    })
    res.json(result.body)
  } catch (error) {
    next(error)
  }
})

authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const result = await completePasswordReset({
      token: req.body?.token,
      password: req.body?.password,
      ipAddress: requestIp(req),
      userAgent: requestUserAgent(req),
    })

    if (!result.ok) {
      res.status(result.status).json(result.body)
      return
    }

    res.json(result.body)
  } catch (error) {
    next(error)
  }
})

authRouter.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const result = await changePassword({
      userId: req.auth!.user.id,
      currentPassword: req.body?.currentPassword,
      newPassword: req.body?.newPassword,
      ipAddress: requestIp(req),
      userAgent: requestUserAgent(req),
    })

    if (!result.ok) {
      res.status(result.status).json(result.body)
      return
    }

    res.json(result.body)
  } catch (error) {
    next(error)
  }
})
