import { argon2id, hash, verify } from 'argon2'

export function hashPassword(password: string) {
  return hash(password, { type: argon2id })
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}
