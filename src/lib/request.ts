import type { Request } from 'express'

export function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export function requestIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim()
  }

  return req.ip
}

export function requestUserAgent(req: Request) {
  const value = req.headers['user-agent']
  return typeof value === 'string' ? value : undefined
}
