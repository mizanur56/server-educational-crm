import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/index.js'
import { normalizeEmail, normalizeUsername } from '../src/modules/auth/identifier.js'
import { PERMISSION_CATALOG, ROLE_DEFAULTS } from '../src/modules/auth/permission-catalog.js'
import { getMasterDataCategory, MASTER_DATA_SEEDS } from '../src/modules/master-data/master-data.catalog.js'
import { hashPassword } from '../src/modules/auth/password.js'


const prisma = new PrismaClient()

const departments = [
  { key: 'counselling', name: 'Counselling' },
  { key: 'sales', name: 'Sales' },
  { key: 'call_center', name: 'Call Center' },
]

const teams = [
  { key: 'team_a', name: 'Team A', departmentKey: 'counselling' },
  { key: 'canada_team', name: 'Canada Team', departmentKey: 'sales' },
  { key: 'call_team', name: 'Call Team', departmentKey: 'call_center' },
]

async function main() {
  const email = normalizeEmail(process.env.SEED_ADMIN_EMAIL || 'admin@crm.local')
  const username = normalizeUsername(process.env.SEED_ADMIN_USERNAME || 'admin')
  const password = process.env.SEED_ADMIN_PASSWORD
  const resetPassword = process.env.SEED_ADMIN_RESET === 'true'

  if (!password) {
    throw new Error('SEED_ADMIN_PASSWORD is required to seed the first admin user')
  }

  for (const item of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: item.resource, action: item.action } },
      update: { module: item.module, description: item.description },
      create: {
        module: item.module,
        resource: item.resource,
        action: item.action,
        description: item.description,
      },
    })
  }

  const permissionRows = await prisma.permission.findMany()
  const allowedKeys = new Set(PERMISSION_CATALOG.map((item) => `${item.resource}:${item.action}`))
  const staleIds = permissionRows.filter((row) => !allowedKeys.has(`${row.resource}:${row.action}`)).map((row) => row.id)

  if (staleIds.length > 0) {
    await prisma.permission.deleteMany({ where: { id: { in: staleIds } } })
  }

  const permissionByKey = new Map(
    (await prisma.permission.findMany()).map((row) => [`${row.resource}:${row.action}`, row]),
  )

  for (const [key, role] of Object.entries(ROLE_DEFAULTS)) {
    await prisma.role.upsert({
      where: { key },
      update: {
        name: role.name,
        description: role.description,
        isSystem: Boolean(role.isSystem),
        status: 'ACTIVE',
      },
      create: {
        key,
        name: role.name,
        description: role.description,
        isSystem: Boolean(role.isSystem),
        status: 'ACTIVE',
      },
    })
  }

  await prisma.role.updateMany({
    where: { key: { notIn: Object.keys(ROLE_DEFAULTS) } },
    data: { status: 'INACTIVE' },
  })

  for (const [key, role] of Object.entries(ROLE_DEFAULTS)) {
    const roleRow = await prisma.role.findUniqueOrThrow({ where: { key } })
    const keys = role.permissions === 'all' ? [...permissionByKey.keys()] : role.permissions
    const permissionIds = keys
      .map((item) => permissionByKey.get(item)?.id)
      .filter((id): id is string => Boolean(id))

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: roleRow.id,
        permissionId: { notIn: permissionIds },
      },
    })

    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId: roleRow.id,
        permissionId,
      })),
      skipDuplicates: true,
    })
  }

  for (const department of departments) {
    await prisma.department.upsert({
      where: { key: department.key },
      update: { name: department.name, status: 'ACTIVE' },
      create: department,
    })
  }

  for (const team of teams) {
    const department = await prisma.department.findUniqueOrThrow({ where: { key: team.departmentKey } })
    await prisma.team.upsert({
      where: { key: team.key },
      update: { name: team.name, departmentId: department.id, status: 'ACTIVE' },
      create: {
        key: team.key,
        name: team.name,
        departmentId: department.id,
      },
    })
  }

  for (const item of MASTER_DATA_SEEDS) {
    const category = getMasterDataCategory(item.categoryKey)
    const parentCategoryKey = category?.parentCategoryKey
    const parent = parentCategoryKey && item.parentCode
      ? await prisma.masterDataItem.findUnique({
          where: { categoryKey_code: { categoryKey: parentCategoryKey, code: item.parentCode } },
        })
      : null

    if (parentCategoryKey && !parent) {
      continue
    }

    await prisma.masterDataItem.upsert({
      where: { categoryKey_code: { categoryKey: item.categoryKey, code: item.code } },
      update: {
        name: item.name,
        nameNormalized: item.name.trim().toLowerCase(),
        description: item.description || null,
        sortOrder: item.sortOrder,
        isSystem: Boolean(item.isSystem),
        behaviorKey: item.behaviorKey || null,
        extras: item.extras ?? undefined,
        parentId: parent?.id ?? null,
        status: 'ACTIVE',
      },
      create: {
        categoryKey: item.categoryKey,
        name: item.name,
        nameNormalized: item.name.trim().toLowerCase(),
        code: item.code,
        description: item.description || null,
        sortOrder: item.sortOrder,
        isSystem: Boolean(item.isSystem),
        behaviorKey: item.behaviorKey || null,
        extras: item.extras ?? undefined,
        parentId: parent?.id ?? null,
      },
    })
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: 'admin' } })
  const existing = await prisma.user.findUnique({ where: { email } })
  const passwordHash = await hashPassword(password)

  const admin = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          username,
          fullName: 'System Admin',
          mobile: existing.mobile || '01700000000',
          primaryRoleId: adminRole.id,
          ...(resetPassword
            ? { passwordHash, status: 'ACTIVE', failedLoginAttempts: 0, lockedUntil: null }
            : {}),
        },
      })
    : await prisma.user.create({
        data: {
          email,
          username,
          fullName: 'System Admin',
          mobile: '01700000000',
          passwordHash,
          status: 'ACTIVE',
          primaryRoleId: adminRole.id,
        },
      })

  for (const [resource, scope] of Object.entries(ROLE_DEFAULTS.admin.scopes)) {
    await prisma.userDataScope.upsert({
      where: { userId_resource: { userId: admin.id, resource } },
      update: { scope },
      create: { userId: admin.id, resource, scope },
    })
  }

  console.log(`Seeded admin ${admin.email} (${admin.username})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
