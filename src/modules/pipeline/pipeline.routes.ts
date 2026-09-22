import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { requireAuth, requirePermission } from '../auth/require-auth.middleware'

export const pipelineRouter = Router()

pipelineRouter.use(requireAuth)

function queryString(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined
}

function daysAgoLabel(date: Date | null | undefined) {
  if (!date) return '—'
  const diffMs = Date.now() - date.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days <= 0) {
    const hours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)))
    return `${hours}h ago`
  }
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

function formatDate(date: Date | null | undefined) {
  if (!date) return '—'
  return date.toISOString().slice(0, 10)
}

function formatDue(date: Date | null | undefined) {
  if (!date) return '—'
  const day = date.toISOString().slice(0, 10)
  const time = date.toISOString().slice(11, 16)
  const today = new Date().toISOString().slice(0, 10)
  if (day === today) return `Today ${time}`
  return `${day} ${time}`
}

pipelineRouter.get('/leads', requirePermission('lead:view'), async (req, res, next) => {
  try {
    const search = queryString(req.query.search)?.toLowerCase()
    const rows = await prisma.lead.findMany({ orderBy: { updatedAt: 'desc' } })
    const items = rows
      .map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        phone: row.phone || '—',
        email: row.email || '—',
        country: row.country || '—',
        source: row.source || '—',
        owner: row.ownerName || '—',
        status: row.status,
        updated: daysAgoLabel(row.updatedAt),
      }))
      .filter((row) => {
        if (!search) return true
        return [row.name, row.phone, row.country, row.source, row.owner, row.status]
          .join(' ')
          .toLowerCase()
          .includes(search)
      })
    res.json({ items, total: items.length })
  } catch (error) {
    next(error)
  }
})

pipelineRouter.get('/applications', requirePermission('lead:convert'), async (req, res, next) => {
  try {
    const search = queryString(req.query.search)?.toLowerCase()
    const rows = await prisma.application.findMany({ orderBy: { updatedAt: 'desc' } })
    const items = rows
      .map((row) => ({
        id: row.id,
        code: row.code,
        applicant: row.applicantName,
        university: row.university || '—',
        program: row.program || '—',
        intake: row.intake || '—',
        counsellor: row.counsellorName || '—',
        status: row.status,
        submitted: row.submittedAt ? formatDate(row.submittedAt) : '—',
      }))
      .filter((row) => {
        if (!search) return true
        return [row.applicant, row.university, row.program, row.counsellor, row.status]
          .join(' ')
          .toLowerCase()
          .includes(search)
      })
    res.json({ items, total: items.length })
  } catch (error) {
    next(error)
  }
})

pipelineRouter.get('/students', requirePermission('lead:convert'), async (req, res, next) => {
  try {
    const search = queryString(req.query.search)?.toLowerCase()
    const rows = await prisma.student.findMany({ orderBy: { updatedAt: 'desc' } })
    const items = rows
      .map((row) => ({
        id: row.id,
        studentId: row.studentCode,
        name: row.name,
        destination: row.destination || '—',
        program: row.program || '—',
        counsellor: row.counsellorName || '—',
        status: row.status,
        enrolled: row.enrolledAt
          ? row.enrolledAt.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
          : '—',
      }))
      .filter((row) => {
        if (!search) return true
        return [row.studentId, row.name, row.destination, row.program, row.counsellor]
          .join(' ')
          .toLowerCase()
          .includes(search)
      })
    res.json({ items, total: items.length })
  } catch (error) {
    next(error)
  }
})

pipelineRouter.get('/documents', requirePermission('document:view'), async (req, res, next) => {
  try {
    const search = queryString(req.query.search)?.toLowerCase()
    const rows = await prisma.crmDocument.findMany({ orderBy: { updatedAt: 'desc' } })
    const items = rows
      .map((row) => ({
        id: row.id,
        owner: row.ownerName,
        type: row.docType,
        category: row.category || '—',
        uploadedBy: row.uploadedBy || '—',
        status: row.status,
        updated: daysAgoLabel(row.updatedAt),
      }))
      .filter((row) => {
        if (!search) return true
        return [row.owner, row.type, row.category, row.uploadedBy, row.status]
          .join(' ')
          .toLowerCase()
          .includes(search)
      })
    res.json({ items, total: items.length })
  } catch (error) {
    next(error)
  }
})

pipelineRouter.get('/payments', requirePermission('payment:view'), async (req, res, next) => {
  try {
    const search = queryString(req.query.search)?.toLowerCase()
    const rows = await prisma.payment.findMany({ orderBy: { createdAt: 'desc' } })
    const items = rows
      .map((row) => ({
        id: row.id,
        invoice: row.invoice,
        payer: row.payerName,
        type: row.type,
        amount: row.amount,
        method: row.method || '—',
        status: row.status,
        date: row.paidAt ? formatDate(row.paidAt) : formatDate(row.createdAt),
      }))
      .filter((row) => {
        if (!search) return true
        return [row.invoice, row.payer, row.type, row.method, row.status]
          .join(' ')
          .toLowerCase()
          .includes(search)
      })
    res.json({ items, total: items.length })
  } catch (error) {
    next(error)
  }
})

pipelineRouter.get('/follow-ups', requirePermission('follow_up:view'), async (req, res, next) => {
  try {
    const search = queryString(req.query.search)?.toLowerCase()
    const rows = await prisma.followUp.findMany({ orderBy: { dueAt: 'asc' } })
    const items = rows
      .map((row) => ({
        id: row.id,
        contact: row.contactName,
        type: row.type,
        owner: row.ownerName || '—',
        due: formatDue(row.dueAt),
        priority: row.priority || '—',
        status: row.status,
      }))
      .filter((row) => {
        if (!search) return true
        return [row.contact, row.type, row.owner, row.priority, row.status]
          .join(' ')
          .toLowerCase()
          .includes(search)
      })
    res.json({ items, total: items.length })
  } catch (error) {
    next(error)
  }
})

pipelineRouter.get('/reports', requirePermission('report:view'), async (_req, res, next) => {
  try {
    const [leads, applications, followUps, payments] = await Promise.all([
      prisma.lead.count(),
      prisma.application.count(),
      prisma.followUp.count({ where: { status: { in: ['Pending', 'Due Soon', 'Overdue'] } } }),
      prisma.payment.count({ where: { status: 'Paid' } }),
    ])

    const items = [
      {
        id: 'metric-leads',
        metric: 'Total leads',
        period: 'All time',
        value: String(leads),
        change: '+12%',
        owner: 'Counselling',
        status: 'Active',
      },
      {
        id: 'metric-apps',
        metric: 'Applications submitted',
        period: 'All time',
        value: String(applications),
        change: '+8',
        owner: 'Operations',
        status: 'Active',
      },
      {
        id: 'metric-followups',
        metric: 'Open follow-ups',
        period: 'Current',
        value: String(followUps),
        change: '-3',
        owner: 'Call Center',
        status: 'Due Soon',
      },
      {
        id: 'metric-payments',
        metric: 'Paid invoices',
        period: 'All time',
        value: String(payments),
        change: '+4%',
        owner: 'Sales',
        status: 'Active',
      },
    ]

    res.json({ items, total: items.length })
  } catch (error) {
    next(error)
  }
})
