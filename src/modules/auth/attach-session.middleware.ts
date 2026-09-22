import type { NextFunction, Request, Response } from 'express'
import { SESSION_COOKIE } from '../../config'
import { loadAuthFromToken } from './session.service'

export async function attachSession(req: Request, _res: Response, next: NextFunction) {
  try {
    req.auth = (await loadAuthFromToken(req.cookies?.[SESSION_COOKIE])) ?? undefined
    next()
  } catch (error) {
    next(error)
  }
}
