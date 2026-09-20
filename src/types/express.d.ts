import type { AuthContext } from '../modules/auth/session.service.ts'

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

export {}
