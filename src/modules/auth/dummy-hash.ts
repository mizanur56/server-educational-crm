import { randomBytes } from 'node:crypto'
import { hashPassword } from './password.ts'

export const dummyPasswordHash = hashPassword(randomBytes(32).toString('hex'))
