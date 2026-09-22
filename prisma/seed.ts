import 'dotenv/config'
import { PrismaClient, type ActivityType, type Prisma } from '../generated/prisma/index'
import { normalizeEmail, normalizeUsername } from '../src/modules/auth/identifier'
import { PERMISSION_CATALOG, ROLE_DEFAULTS } from '../src/modules/auth/permission-catalog'
import { getMasterDataCategory, MASTER_DATA_SEEDS } from '../src/modules/master-data/master-data.catalog'
import { hashPassword } from '../src/modules/auth/password'

const prisma = new PrismaClient()

const ROOT_ADMIN = {
  email: 'admin@campusly.com',
  username: 'root',
  password: '12345678',
  fullName: 'Root Administrator',
  mobile: '01700000001',
}

const departments = [
  { key: 'counselling', name: 'Counselling', description: 'Student counselling and guidance' },
  { key: 'sales', name: 'Sales', description: 'Lead conversion and package sales' },
  { key: 'call_center', name: 'Call Center', description: 'Inbound and outbound calling' },
  { key: 'operations', name: 'Operations', description: 'File processing and documentation' },
]

const teams = [
  { key: 'team_a', name: 'Team A', departmentKey: 'counselling' },
  { key: 'team_b', name: 'Team B', departmentKey: 'counselling' },
  { key: 'canada_team', name: 'Canada Team', departmentKey: 'sales' },
  { key: 'uk_team', name: 'UK Team', departmentKey: 'sales' },
  { key: 'call_team', name: 'Call Team', departmentKey: 'call_center' },
  { key: 'docs_team', name: 'Documents Team', departmentKey: 'operations' },
]

type DemoUserSeed = {
  email: string
  username: string
  fullName: string
  mobile: string
  roleKey: string
  departmentKey: string
  teamKey: string
  designationCode: string
  employeeCode: string
  gender: 'MALE' | 'FEMALE'
  joiningDate: string
}

const DEMO_USERS: DemoUserSeed[] = [
  {
    email: 'ceo@campusly.com',
    username: 'ceo',
    fullName: 'Nadia Rahman',
    mobile: '01710000001',
    roleKey: 'ceo',
    departmentKey: 'operations',
    teamKey: 'docs_team',
    designationCode: 'CEO',
    employeeCode: 'EMP-0002',
    gender: 'FEMALE',
    joiningDate: '2022-01-10',
  },
  {
    email: 'manager@campusly.com',
    username: 'manager',
    fullName: 'Karim Hossain',
    mobile: '01710000002',
    roleKey: 'manager',
    departmentKey: 'counselling',
    teamKey: 'team_a',
    designationCode: 'MANAGER',
    employeeCode: 'EMP-0003',
    gender: 'MALE',
    joiningDate: '2022-06-15',
  },
  {
    email: 'sarah.ahmed@campusly.com',
    username: 'sarah',
    fullName: 'Sarah Ahmed',
    mobile: '01710000003',
    roleKey: 'counsellor',
    departmentKey: 'counselling',
    teamKey: 'team_a',
    designationCode: 'COUNSELLOR',
    employeeCode: 'EMP-0004',
    gender: 'FEMALE',
    joiningDate: '2023-02-01',
  },
  {
    email: 'rafiq.khan@campusly.com',
    username: 'rafiq',
    fullName: 'Rafiq Khan',
    mobile: '01710000004',
    roleKey: 'counsellor',
    departmentKey: 'counselling',
    teamKey: 'team_b',
    designationCode: 'COUNSELLOR',
    employeeCode: 'EMP-0005',
    gender: 'MALE',
    joiningDate: '2023-05-20',
  },
  {
    email: 'call.exec@campusly.com',
    username: 'call.exec',
    fullName: 'Fatima Begum',
    mobile: '01710000005',
    roleKey: 'call_executive',
    departmentKey: 'call_center',
    teamKey: 'call_team',
    designationCode: 'CALL_EXECUTIVE',
    employeeCode: 'EMP-0006',
    gender: 'FEMALE',
    joiningDate: '2024-01-08',
  },
  {
    email: 'imran.ali@campusly.com',
    username: 'imran',
    fullName: 'Imran Ali',
    mobile: '01710000006',
    roleKey: 'call_executive',
    departmentKey: 'call_center',
    teamKey: 'call_team',
    designationCode: 'CALL_EXECUTIVE',
    employeeCode: 'EMP-0007',
    gender: 'MALE',
    joiningDate: '2024-03-12',
  },
  {
    email: 'sales.lead@campusly.com',
    username: 'sales.lead',
    fullName: 'Tanvir Islam',
    mobile: '01710000007',
    roleKey: 'manager',
    departmentKey: 'sales',
    teamKey: 'canada_team',
    designationCode: 'TEAM_LEAD',
    employeeCode: 'EMP-0008',
    gender: 'MALE',
    joiningDate: '2023-09-01',
  },
]

const DEMO_PASSWORD = 'Campusly@123'

function daysAgo(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

async function upsertMasterDataSeeds() {
  for (const item of MASTER_DATA_SEEDS) {
    const category = getMasterDataCategory(item.categoryKey)
    const parentCategoryKey = category?.parentCategoryKey
    const parent =
      parentCategoryKey && item.parentCode
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
}

async function upsertUserWithEmployee(input: {
  email: string
  username: string
  fullName: string
  mobile: string
  passwordHash: string
  roleId: string
  departmentId: string
  teamId: string | null
  designationId: string
  employmentTypeId: string
  employmentStatusId: string
  employeeCode: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  joiningDate: Date
  reportingManagerId?: string | null
  officialEmail?: string
}) {
  const email = normalizeEmail(input.email)
  const username = normalizeUsername(input.username)

  const byEmail = await prisma.user.findUnique({ where: { email } })
  const byUsername = await prisma.user.findUnique({ where: { username } })

  if (byEmail && byUsername && byEmail.id !== byUsername.id) {
    throw new Error(`Cannot seed user: email "${email}" and username "${username}" belong to different accounts`)
  }

  const existing = byEmail || byUsername
  const userData = {
    email,
    username,
    fullName: input.fullName,
    mobile: input.mobile,
    passwordHash: input.passwordHash,
    status: 'ACTIVE' as const,
    failedLoginAttempts: 0,
    lockedUntil: null,
    primaryRoleId: input.roleId,
    departmentId: input.departmentId,
    teamId: input.teamId,
  }

  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: userData })
    : await prisma.user.create({
        data: {
          email,
          username,
          fullName: input.fullName,
          mobile: input.mobile,
          passwordHash: input.passwordHash,
          status: 'ACTIVE',
          primaryRoleId: input.roleId,
          departmentId: input.departmentId,
          teamId: input.teamId,
        },
      })

  const officialEmail = normalizeEmail(input.officialEmail || email)
  const existingEmployee =
    (await prisma.employee.findUnique({ where: { employeeCode: input.employeeCode } })) ||
    (await prisma.employee.findUnique({ where: { userId: user.id } })) ||
    (await prisma.employee.findUnique({ where: { officialEmail } }))

  const employeeData = {
    employeeCode: input.employeeCode,
    fullName: input.fullName,
    gender: input.gender,
    mobile: input.mobile,
    personalEmail: email,
    officialEmail,
    designationId: input.designationId,
    departmentId: input.departmentId,
    teamId: input.teamId,
    roleId: input.roleId,
    employmentTypeId: input.employmentTypeId,
    employmentStatusId: input.employmentStatusId,
    reportingManagerId: input.reportingManagerId ?? null,
    joiningDate: input.joiningDate,
    presentAddress: 'Dhaka, Bangladesh',
    nationality: 'Bangladeshi',
    userId: user.id,
  }

  const employee = existingEmployee
    ? await prisma.employee.update({ where: { id: existingEmployee.id }, data: employeeData })
    : await prisma.employee.create({ data: employeeData })

  return { user, employee }
}

async function seedActivities(userIds: string[]) {
  const existing = await prisma.activity.count()
  if (existing > 0 || userIds.length === 0) {
    return
  }

  const samples: Array<{
    type: ActivityType
    userId: string
    daysAgo: number
    durationMin?: number
    outcome: string
    notes: string
    relatedName: string
    relatedType: string
    nextAction?: string
    nextDays?: number
  }> = [
    {
      type: 'CALL',
      userId: userIds[2] || userIds[0],
      daysAgo: 1,
      durationMin: 18,
      outcome: 'Connected',
      notes: 'Discussed Canada intake options and IELTS requirements.',
      relatedName: 'Ayesha Siddiqua',
      relatedType: 'lead',
      nextAction: 'Send university shortlist',
      nextDays: 1,
    },
    {
      type: 'MEETING',
      userId: userIds[1] || userIds[0],
      daysAgo: 2,
      durationMin: 45,
      outcome: 'Interested',
      notes: 'In-office counselling with student and guardian.',
      relatedName: 'Hasan Mahmud',
      relatedType: 'lead',
      nextAction: 'Collect academic transcripts',
      nextDays: 3,
    },
    {
      type: 'EMAIL',
      userId: userIds[3] || userIds[0],
      daysAgo: 3,
      outcome: 'Sent',
      notes: 'Shared offer letter checklist and fee breakdown.',
      relatedName: 'Nusrat Jahan',
      relatedType: 'lead',
    },
    {
      type: 'MESSAGE',
      userId: userIds[4] || userIds[0],
      daysAgo: 3,
      outcome: 'Replied',
      notes: 'WhatsApp follow-up about May 2027 intake seat availability.',
      relatedName: 'Omar Faruk',
      relatedType: 'lead',
      nextAction: 'Schedule callback',
      nextDays: 1,
    },
    {
      type: 'FOLLOW_UP',
      userId: userIds[5] || userIds[0],
      daysAgo: 4,
      durationMin: 8,
      outcome: 'Call Back Later',
      notes: 'Student requested evening callback after class.',
      relatedName: 'Mithila Chowdhury',
      relatedType: 'lead',
      nextAction: 'Evening call',
      nextDays: 0,
    },
    {
      type: 'NOTE',
      userId: userIds[0],
      daysAgo: 5,
      outcome: 'Internal',
      notes: 'Priority queue updated for hot Canada leads this week.',
      relatedName: 'Canada Pipeline',
      relatedType: 'system',
    },
    {
      type: 'CALL',
      userId: userIds[6] || userIds[0],
      daysAgo: 6,
      durationMin: 12,
      outcome: 'No Answer',
      notes: 'Tried twice; left voicemail regarding document pending list.',
      relatedName: 'Sabbir Ahmed',
      relatedType: 'lead',
      nextAction: 'Retry call',
      nextDays: 1,
    },
    {
      type: 'MEETING',
      userId: userIds[2] || userIds[0],
      daysAgo: 7,
      durationMin: 30,
      outcome: 'Documents reviewed',
      notes: 'Verified passport and HSC transcript scans.',
      relatedName: 'Ruma Akter',
      relatedType: 'lead',
    },
  ]

  await prisma.activity.createMany({
    data: samples.map((item) => ({
      type: item.type,
      userId: item.userId,
      occurredAt: daysAgo(item.daysAgo),
      durationMin: item.durationMin ?? null,
      outcome: item.outcome,
      notes: item.notes,
      relatedName: item.relatedName,
      relatedType: item.relatedType,
      nextAction: item.nextAction ?? null,
      nextDate: item.nextDays == null ? null : daysAgo(-item.nextDays),
    })),
  })
}

async function seedAuditLogs(adminUserId: string, actorIds: string[]) {
  const existing = await prisma.auditLog.count()
  if (existing > 0) {
    return
  }

  const rows: Prisma.AuditLogCreateManyInput[] = [
    {
      userId: adminUserId,
      action: 'AUTH_LOGIN',
      entityType: 'user',
      entityId: adminUserId,
      metadata: { source: 'seed' },
      createdAt: daysAgo(0),
    },
    {
      userId: adminUserId,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: actorIds[1] || adminUserId,
      metadata: { source: 'seed', email: 'manager@campusly.com' },
      createdAt: daysAgo(8),
    },
    {
      userId: adminUserId,
      action: 'EMPLOYEE_CREATED',
      entityType: 'employee',
      entityId: null,
      metadata: { source: 'seed', employeeCode: 'EMP-0003' },
      createdAt: daysAgo(8),
    },
    {
      userId: actorIds[1] || adminUserId,
      action: 'MASTER_DATA_UPDATED',
      entityType: 'master_data',
      metadata: { source: 'seed', categoryKey: 'LEAD_STATUS', name: 'Interested' },
      createdAt: daysAgo(4),
    },
    {
      userId: actorIds[2] || adminUserId,
      action: 'ACTIVITY_CREATED',
      entityType: 'activity',
      metadata: { source: 'seed', type: 'CALL' },
      createdAt: daysAgo(1),
    },
  ]

  await prisma.auditLog.createMany({ data: rows })
}

async function main() {
  const email = normalizeEmail(process.env.SEED_ADMIN_EMAIL || ROOT_ADMIN.email)
  const username = normalizeUsername(process.env.SEED_ADMIN_USERNAME || ROOT_ADMIN.username)
  const password = process.env.SEED_ADMIN_PASSWORD || ROOT_ADMIN.password

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
      update: { name: department.name, description: department.description, status: 'ACTIVE' },
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

  await upsertMasterDataSeeds()

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: 'admin' } })
  const operationsDept = await prisma.department.findUniqueOrThrow({ where: { key: 'operations' } })
  const docsTeam = await prisma.team.findUniqueOrThrow({ where: { key: 'docs_team' } })

  const administratorDesignation = await prisma.masterDataItem.findUniqueOrThrow({
    where: { categoryKey_code: { categoryKey: 'DESIGNATION', code: 'ADMINISTRATOR' } },
  })
  const fullTimeType = await prisma.masterDataItem.findUniqueOrThrow({
    where: { categoryKey_code: { categoryKey: 'EMPLOYMENT_TYPE', code: 'FULL_TIME' } },
  })
  const activeStatus = await prisma.masterDataItem.findUniqueOrThrow({
    where: { categoryKey_code: { categoryKey: 'EMPLOYMENT_STATUS', code: 'ACTIVE' } },
  })

  const passwordHash = await hashPassword(password)
  const demoPasswordHash = await hashPassword(DEMO_PASSWORD)

  const { user: admin, employee: adminEmployee } = await upsertUserWithEmployee({
    email,
    username,
    fullName: ROOT_ADMIN.fullName,
    mobile: ROOT_ADMIN.mobile,
    passwordHash,
    roleId: adminRole.id,
    departmentId: operationsDept.id,
    teamId: docsTeam.id,
    designationId: administratorDesignation.id,
    employmentTypeId: fullTimeType.id,
    employmentStatusId: activeStatus.id,
    employeeCode: 'EMP-0001',
    gender: 'MALE',
    joiningDate: dateOnly('2021-01-01'),
  })

  for (const [resource, scope] of Object.entries(ROLE_DEFAULTS.admin.scopes)) {
    await prisma.userDataScope.upsert({
      where: { userId_resource: { userId: admin.id, resource } },
      update: { scope },
      create: { userId: admin.id, resource, scope },
    })
  }

  const roleRows = await prisma.role.findMany()
  const roleByKey = new Map(roleRows.map((row) => [row.key, row]))
  const departmentRows = await prisma.department.findMany()
  const departmentByKey = new Map(departmentRows.map((row) => [row.key, row]))
  const teamRows = await prisma.team.findMany()
  const teamByKey = new Map(teamRows.map((row) => [row.key, row]))
  const designationRows = await prisma.masterDataItem.findMany({ where: { categoryKey: 'DESIGNATION' } })
  const designationByCode = new Map(designationRows.map((row) => [row.code || '', row]))

  const seededUserIds = [admin.id]
  let managerEmployeeId: string | null = null

  for (const demo of DEMO_USERS) {
    const role = roleByKey.get(demo.roleKey)
    const department = departmentByKey.get(demo.departmentKey)
    const team = teamByKey.get(demo.teamKey)
    const designation = designationByCode.get(demo.designationCode)
    if (!role || !department || !team || !designation) {
      continue
    }

    const { user, employee } = await upsertUserWithEmployee({
      email: demo.email,
      username: demo.username,
      fullName: demo.fullName,
      mobile: demo.mobile,
      passwordHash: demoPasswordHash,
      roleId: role.id,
      departmentId: department.id,
      teamId: team.id,
      designationId: designation.id,
      employmentTypeId: fullTimeType.id,
      employmentStatusId: activeStatus.id,
      employeeCode: demo.employeeCode,
      gender: demo.gender,
      joiningDate: dateOnly(demo.joiningDate),
      reportingManagerId: demo.roleKey === 'counsellor' || demo.roleKey === 'call_executive' ? managerEmployeeId : null,
    })

    if (demo.username === 'manager') {
      managerEmployeeId = employee.id
    }

    const defaults = ROLE_DEFAULTS[demo.roleKey]
    if (defaults) {
      for (const [resource, scope] of Object.entries(defaults.scopes)) {
        await prisma.userDataScope.upsert({
          where: { userId_resource: { userId: user.id, resource } },
          update: { scope },
          create: { userId: user.id, resource, scope },
        })
      }
    }

    seededUserIds.push(user.id)
  }

  // Wire counsellor / call executive reports to manager after manager exists
  if (managerEmployeeId) {
    await prisma.employee.updateMany({
      where: {
        employeeCode: { in: ['EMP-0004', 'EMP-0005', 'EMP-0006', 'EMP-0007'] },
        reportingManagerId: null,
      },
      data: { reportingManagerId: managerEmployeeId },
    })
  }

  await prisma.employee.update({
    where: { id: adminEmployee.id },
    data: {
      designationId: administratorDesignation.id,
      roleId: adminRole.id,
    },
  })

  await seedActivities(seededUserIds)
  await seedAuditLogs(admin.id, seededUserIds)

  const permissionCount = await prisma.rolePermission.count({ where: { roleId: adminRole.id } })
  console.log(`Seeded root administrator ${admin.email} (${admin.username})`)
  console.log(`Administrator role permissions: ${permissionCount}`)
  console.log(`Administrator designation isSystem=${administratorDesignation.isSystem} (not deletable)`)
  console.log(`Demo staff password: ${DEMO_PASSWORD}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
