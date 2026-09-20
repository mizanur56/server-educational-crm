export const SESSION_COOKIE = 'crm_session'

export const config = {
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  isProduction: process.env.NODE_ENV === 'production',
  maxFailedLoginAttempts: Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS) || 5,
  lockMinutes: Number(process.env.LOGIN_LOCK_MINUTES) || 15,
  sessionHours: Number(process.env.SESSION_HOURS) || 12,
  rememberMeDays: Number(process.env.REMEMBER_ME_DAYS) || 30,
  resetTokenHours: Number(process.env.RESET_TOKEN_HOURS) || 2,
  minPasswordLength: Number(process.env.MIN_PASSWORD_LENGTH) || 8,
}
