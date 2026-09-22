import { randomBytes } from 'node:crypto'
import { hashPassword } from './password'

export const dummyPasswordHash = hashPassword(randomBytes(32).toString('hex'))
