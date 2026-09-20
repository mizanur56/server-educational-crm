export const SESSION_COOKIE = 'crm_session'

function defaultClientOrigins() {
  if (process.env.CLIENT_ORIGIN) {
    return process.env.CLIENT_ORIGIN
  }

  if (process.env.NODE_ENV === 'production') {
    return 'https://admin-educational-crm.vercel.app'
  }

  return 'http://localhost:5173'
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  clientOrigins: defaultClientOrigins()
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === 'production',
  maxFailedLoginAttempts: Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS) || 5,
  lockMinutes: Number(process.env.LOGIN_LOCK_MINUTES) || 15,
  sessionHours: Number(process.env.SESSION_HOURS) || 12,
  rememberMeDays: Number(process.env.REMEMBER_ME_DAYS) || 30,
  resetTokenHours: Number(process.env.RESET_TOKEN_HOURS) || 2,
  minPasswordLength: Number(process.env.MIN_PASSWORD_LENGTH) || 8,
}
