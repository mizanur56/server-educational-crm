import { Router } from 'express'
import { serializeAuth } from '../auth/auth.service'
import { requireAuth } from '../auth/require-auth.middleware'

export const meRouter = Router()

meRouter.get('/', requireAuth, (req, res) => {
  res.json(serializeAuth(req.auth!))
})
