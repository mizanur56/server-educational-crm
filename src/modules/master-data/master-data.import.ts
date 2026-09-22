import ExcelJS from 'exceljs'
import { writeAuditLog } from '../../lib/audit'
import { httpError } from '../../lib/http-error'
import type { AuthContext } from '../auth/session.service'
import { categoryOrThrow, createItem, listItems, type AuditMeta, type ItemRecord } from './master-data.service'
import type { MasterDataCategory } from './master-data.catalog'

type ImportRow = {
  name?: string
  code?: string
  description?: string
  status?: string
  sortOrder?: string | number
  parentCode?: string
  startDate?: string
  endDate?: string
  behaviorKey?: string
}

export type ImportError = { row: number; message: string }

const EXPORT_COLUMNS = [
  { header: 'Name', key: 'name', width: 28 },
  { header: 'Code', key: 'code', width: 18 },
  { header: 'Description', key: 'description', width: 32 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Sort Order', key: 'sortOrder', width: 12 },
  { header: 'Parent Code', key: 'parentCode', width: 18 },
  { header: 'Start Date', key: 'startDate', width: 14 },
  { header: 'End Date', key: 'endDate', width: 14 },
  { header: 'Behavior Key', key: 'behaviorKey', width: 16 },
] as const

function headerKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function cellText(value: unknown) {
  if (value == null) {
    return ''
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  return String(value).trim()
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        current += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        current += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(current)
      current = ''
    } else if (char === '\n') {
      row.push(current.replace(/\r$/, ''))
      rows.push(row)
      row = []
      current = ''
    } else {
      current += char
    }
  }
  if (current.length || row.length) {
    row.push(current.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows.filter((item) => item.some((cell) => cell.trim()))
}

function rowsFromGrid(grid: string[][]): ImportRow[] {
  const [header, ...body] = grid
  if (!header) {
    return []
  }
  const index = new Map(header.map((item, i) => [headerKey(item), i]))
  return body.map((line) => ({
    name: line[index.get('name') ?? -1],
    code: line[index.get('code') ?? -1],
    description: line[index.get('description') ?? -1],
    status: line[index.get('status') ?? -1],
    sortOrder: line[index.get('sortorder') ?? -1],
    parentCode: line[index.get('parentcode') ?? -1],
    startDate: line[index.get('startdate') ?? -1],
    endDate: line[index.get('enddate') ?? -1],
    behaviorKey: line[index.get('behaviorkey') ?? -1],
  }))
}

async function parseWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as never)
  const sheet = workbook.worksheets[0]
  if (!sheet) {
    return []
  }
  const grid: string[][] = []
  sheet.eachRow((row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : []
    grid.push(values.map((cell) => cellText(cell)))
  })
  return rowsFromGrid(grid)
}

export async function parseImportFile(fileName: string, buffer: Buffer): Promise<ImportRow[]> {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    try {
      return await parseWorkbook(buffer)
    } catch {
      throw httpError.masterDataImportFailed()
    }
  }
  if (lower.endsWith('.csv') || !fileName) {
    return rowsFromGrid(parseCsv(buffer.toString('utf8').replace(/^\uFEFF/, '')))
  }
  throw httpError.masterDataImportFailed()
}

function extrasOf(item: ItemRecord) {
  const extras = item.extras || {}
  return {
    startDate: typeof extras.startDate === 'string' ? extras.startDate : '',
    endDate: typeof extras.endDate === 'string' ? extras.endDate : '',
  }
}

export async function buildExport(categoryKey: string, format: 'csv' | 'xlsx') {
  const category = categoryOrThrow(categoryKey)
  const items = await listItems({ category: category.key })
  const parentCodes = new Map(items.map((item) => [item.id, item.code || '']))
  if (category.parentCategoryKey) {
    const parents = await listItems({ category: category.parentCategoryKey })
    for (const parent of parents) {
      parentCodes.set(parent.id, parent.code || '')
    }
  }

  const rows = items.map((item) => {
    const extras = extrasOf(item)
    return {
      name: item.name,
      code: item.code || '',
      description: item.description || '',
      status: item.status,
      sortOrder: item.sortOrder,
      parentCode: item.parentId ? parentCodes.get(item.parentId) || '' : '',
      startDate: extras.startDate,
      endDate: extras.endDate,
      behaviorKey: item.behaviorKey || '',
    }
  })

  const fileBase = category.key.toLowerCase().replace(/_/g, '-')
  if (format === 'csv') {
    const header = EXPORT_COLUMNS.map((column) => column.header).join(',')
    const lines = rows.map((row) =>
      EXPORT_COLUMNS.map((column) => {
        const value = String(row[column.key as keyof typeof row] ?? '')
        return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
      }).join(','),
    )
    return {
      fileName: `${fileBase}.csv`,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(`\uFEFF${[header, ...lines].join('\n')}`),
    }
  }

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(category.name.slice(0, 31))
  sheet.columns = [...EXPORT_COLUMNS]
  rows.forEach((row) => sheet.addRow(row))
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  return {
    fileName: `${fileBase}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  }
}

export async function importItems(
  auth: AuthContext,
  category: MasterDataCategory,
  rows: ImportRow[],
  meta: AuditMeta,
) {
  if (!rows.length) {
    throw httpError.masterDataImportFailed()
  }

  const existing = await listItems({ category: category.key })
  const parents = category.parentCategoryKey ? await listItems({ category: category.parentCategoryKey }) : []
  const parentByCode = new Map(parents.filter((item) => item.code).map((item) => [item.code!.toUpperCase(), item]))
  const seenNames = new Set<string>()
  const seenCodes = new Set<string>()
  const errors: ImportError[] = []
  let successful = 0

  for (const [index, row] of rows.entries()) {
    const line = index + 2
    const name = (row.name || '').trim()
    const code = (row.code || '').trim().toUpperCase()
    if (!name) {
      errors.push({ row: line, message: httpError.missingMasterDataName().message })
      continue
    }
    const nameKey = name.toLowerCase()
    if (seenNames.has(nameKey) || existing.some((item) => item.name.toLowerCase() === nameKey)) {
      errors.push({ row: line, message: httpError.duplicateMasterDataImport().message })
      continue
    }
    if (code && (seenCodes.has(code) || existing.some((item) => item.code === code))) {
      errors.push({ row: line, message: httpError.invalidMasterDataCode().message })
      continue
    }

    let parentId: string | undefined
    if (category.parentCategoryKey) {
      const parentCode = (row.parentCode || '').trim().toUpperCase()
      const parent = parentByCode.get(parentCode)
      if (!parent) {
        errors.push({ row: line, message: httpError.invalidMasterDataParent().message })
        continue
      }
      if (parent.status === 'INACTIVE') {
        errors.push({ row: line, message: httpError.inactiveMasterDataParent().message })
        continue
      }
      parentId = parent.id
    }

    try {
      const created = await createItem(
        auth,
        category.key,
        {
          name,
          code: row.code,
          description: row.description,
          status: row.status,
          sortOrder: row.sortOrder,
          parentId,
          startDate: row.startDate,
          endDate: row.endDate,
          behaviorKey: row.behaviorKey,
        },
        meta,
        { skipAudit: true },
      )
      successful += 1
      seenNames.add(nameKey)
      if (created.code) {
        seenCodes.add(created.code)
      }
      existing.push(created)
    } catch (error) {
      const message = error instanceof Error ? error.message : httpError.invalidMasterData().message
      errors.push({ row: line, message })
    }
  }

  await writeAuditLog({
    userId: auth.user.id,
    action: 'MASTER_DATA_IMPORTED',
    entityType: 'master_data',
    entityId: category.key,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { categoryKey: category.key, total: rows.length, successful, failed: errors.length },
  })

  return {
    total: rows.length,
    successful,
    failed: errors.length,
    errors,
  }
}
