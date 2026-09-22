import { Router } from 'express'
import { requireAuth } from '../auth/require-auth.middleware'
import { globalSearch } from './search.service'

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
