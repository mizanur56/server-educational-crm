import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { requireAuth, requirePermission } from '../auth/require-auth.middleware'

export const permissionsRouter = Router()

permissionsRouter.use(requireAuth, requirePermission(['permission:view', 'role:view', 'permission:configure']))

permissionsRouter.get('/', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : ''
    const rows = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
    })

    const permissions = rows
      .map((row) => ({
        id: row.id,
        key: `${row.resource}:${row.action}`,
        module: row.module,
        resource: row.resource,
        action: row.action,
        description: row.description,
      }))
      .filter((row) => {
        if (!search) {
          return true
        }
        return `${row.module} ${row.key} ${row.description ?? ''}`.toLowerCase().includes(search)
      })

    res.json({ permissions })
  } catch (error) {
    next(error)
  }
})
