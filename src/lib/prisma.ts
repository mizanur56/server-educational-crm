import { PrismaClient } from './prisma-client.ts'

const globalForPrisma = globalThis as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

globalForPrisma.prisma = prisma
