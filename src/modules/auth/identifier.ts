export function normalizeIdentifier(identifier: string) {
  return identifier.trim()
}

export function isEmailIdentifier(identifier: string) {
  return identifier.includes('@')
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase()
}
