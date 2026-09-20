import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { config } from './config.ts'
import { HttpError } from './lib/http-error.ts'
import { attachSession } from './modules/auth/attach-session.middleware.ts'
import { authRouter } from './modules/auth/auth.routes.ts'
import { activitiesRouter } from './modules/activities/activities.routes.ts'
import { auditRouter } from './modules/audit/audit.routes.ts'
import { healthRouter } from './modules/health/health.routes.ts'
import { employeesRouter } from './modules/employees/employees.routes.ts'
import { masterDataRouter } from './modules/master-data/master-data.routes.ts'
import { meRouter } from './modules/me/me.routes.ts'
import { permissionsRouter } from './modules/permissions/permissions.routes.ts'
import { rolesRouter } from './modules/roles/roles.routes.ts'
import { searchRouter } from './modules/search/search.routes.ts'
import { usersRouter } from './modules/users/users.routes.ts'

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
    }),
  )
  app.use(express.json())
  app.use(cookieParser())
  app.use(attachSession)

  app.use('/api/health', healthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/me', meRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/employees', employeesRouter)
  app.use('/api/roles', rolesRouter)
  app.use('/api/permissions', permissionsRouter)
  app.use('/api/master-data', masterDataRouter)
  app.use('/api/audit-logs', auditRouter)
  app.use('/api/activities', activitiesRouter)
  app.use('/api/search', searchRouter)

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path })
  })

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({
        error: error.message,
        code: error.code,
        ...(error.fields ? { fields: error.fields } : {}),
      })
      return
    }

    if (error instanceof SyntaxError) {
      res.status(400).json({ error: 'Invalid request body.', code: 'INVALID_INPUT' })
      return
    }

    console.error(error)
    res.status(500).json({
      error: 'Unable to process the request. Please try again.',
      code: 'SERVER_ERROR',
    })
  })

  return app
}

const app = createApp()

export default app
