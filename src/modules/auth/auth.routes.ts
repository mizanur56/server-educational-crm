import { Router } from 'express'
import { SESSION_COOKIE } from '../../config.ts'
import { requestIp, requestUserAgent } from '../../lib/request.ts'
import { login, logout } from './auth.service.ts'
import { changePassword, completePasswordReset, requestPasswordReset } from './password-reset.service.ts'
import { requireAuth } from './require-auth.middleware.ts'
import { clearCookieOptions } from './session.service.ts'

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
    await logout(req.auth, {
      ipAddress: requestIp(req),
      userAgent: requestUserAgent(req),
    })
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
