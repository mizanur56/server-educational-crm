import { Router } from 'express'
import { requireAuth } from '../auth/require-auth.middleware.ts'
import { globalSearch } from './search.service.ts'

export const searchRouter = Router()

searchRouter.use(requireAuth)

searchRouter.get('/', async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : ''
    const results = await globalSearch(req.auth!, query)
    res.json({ results })
  } catch (error) {
    next(error)
  }
})
