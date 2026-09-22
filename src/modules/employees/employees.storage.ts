import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { UploadApiErrorResponse, UploadApiResponse } from 'cloudinary'
import cloudinary, { CLOUDINARY_FOLDER } from '../../config/cloudinary'
import { httpError } from '../../lib/http-error'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'employees')

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg'])
const DOCUMENT_TYPES = new Set([
  ...IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export const DOCUMENT_FIELD_MAP = {
  documentNid: 'NID',
  documentPhotograph: 'PHOTOGRAPH',
  documentCv: 'CV',
  documentCertificate: 'EDUCATIONAL_CERTIFICATE',
  documentAppointment: 'APPOINTMENT_LETTER',
  documentJoining: 'JOINING_DOCUMENT',
  documentOther: 'OTHER',
} as const

export type DocumentFieldName = keyof typeof DOCUMENT_FIELD_MAP
type EmployeeDocumentType = (typeof DOCUMENT_FIELD_MAP)[DocumentFieldName]
type CloudinaryResourceType = 'image' | 'raw'
type CloudinaryDeliveryType = 'upload' | 'private'

export type StoredUpload = {
  type: EmployeeDocumentType
  fileName: string
  mimeType: string
  storageKey: string
  fileSize: number
  url: string
}

function extensionFor(mimeType: string, originalName: string) {
  const fromName = path.extname(originalName).toLowerCase()
  if (fromName && fromName.length <= 8) {
    return fromName
  }
  if (mimeType === 'application/pdf') {
    return '.pdf'
  }
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
    return '.jpg'
  }
  if (mimeType.includes('png')) {
    return '.png'
  }
  if (mimeType.includes('webp')) {
    return '.webp'
  }
  if (mimeType.includes('wordprocessingml')) {
    return '.docx'
  }
  if (mimeType === 'application/msword') {
    return '.doc'
  }
  return ''
}

function assertAllowed(file: Express.Multer.File, kind: 'image' | 'document', label: string) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw httpError.invalidUpload(`${label} must be 5 MB or smaller.`)
  }
  const allowed = kind === 'image' ? IMAGE_TYPES : DOCUMENT_TYPES
  if (!allowed.has(file.mimetype)) {
    throw httpError.invalidUpload(`${label} must be a valid ${kind === 'image' ? 'JPG, PNG, or WEBP image' : 'PDF, Word, or image file'}.`)
  }
}

function resourceTypeFor(mimeType: string): CloudinaryResourceType {
  return IMAGE_TYPES.has(mimeType) ? 'image' : 'raw'
}

function employeePrefix(employeeId: string) {
  return `${CLOUDINARY_FOLDER}/employees/${employeeId}`
}

function encodeStorageKey(resourceType: CloudinaryResourceType, deliveryType: CloudinaryDeliveryType, publicId: string) {
  return `${resourceType}:${deliveryType}:${publicId}`
}

function parseStorageKey(storageKey: string) {
  const parts = storageKey.split(':')
  if (parts.length >= 3 && (parts[0] === 'image' || parts[0] === 'raw') && (parts[1] === 'upload' || parts[1] === 'private')) {
    return {
      resourceType: parts[0] as CloudinaryResourceType,
      deliveryType: parts[1] as CloudinaryDeliveryType,
      publicId: parts.slice(2).join(':'),
    }
  }
  return null
}

function uploadBuffer(
  file: Express.Multer.File,
  options: {
    folder: string
    public_id: string
    resource_type: CloudinaryResourceType
    type: CloudinaryDeliveryType
    overwrite?: boolean
    invalidate?: boolean
  },
) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
      if (error || !result) {
        reject(error || new Error('Cloudinary upload failed.'))
        return
      }
      resolve(result)
    })
    stream.end(file.buffer)
  })
}

async function downloadFromCloudinary(publicId: string, resourceType: CloudinaryResourceType, deliveryType: CloudinaryDeliveryType) {
  const url = cloudinary.url(publicId, {
    resource_type: resourceType,
    type: deliveryType,
    sign_url: deliveryType === 'private',
    secure: true,
  })
  const response = await fetch(url)
  if (!response.ok) {
    throw httpError.notFound('File not found.')
  }
  return Buffer.from(await response.arrayBuffer())
}

export function employeeDir(employeeId: string) {
  return path.join(UPLOAD_ROOT, employeeId)
}

export async function saveProfilePhoto(employeeId: string, file: Express.Multer.File) {
  assertAllowed(file, 'image', 'Profile photo')
  const result = await uploadBuffer(file, {
    folder: employeePrefix(employeeId),
    public_id: 'profile',
    resource_type: 'image',
    type: 'upload',
    overwrite: true,
    invalidate: true,
  })
  return {
    storageKey: encodeStorageKey('image', 'upload', result.public_id),
    url: result.secure_url,
    mimeType: file.mimetype,
    fileName: file.originalname,
    fileSize: file.size,
  }
}

export async function saveDocuments(employeeId: string, files: Partial<Record<DocumentFieldName, Express.Multer.File[]>>) {
  const saved: StoredUpload[] = []

  for (const [field, type] of Object.entries(DOCUMENT_FIELD_MAP) as Array<[DocumentFieldName, EmployeeDocumentType]>) {
    const uploads = files[field] || []
    for (const file of uploads) {
      assertAllowed(file, 'document', file.originalname || type)
      const resourceType = resourceTypeFor(file.mimetype)
      const ext = extensionFor(file.mimetype, file.originalname)
      const result = await uploadBuffer(file, {
        folder: `${employeePrefix(employeeId)}/documents`,
        public_id: `${type.toLowerCase()}-${randomUUID()}${resourceType === 'raw' ? ext : ''}`,
        resource_type: resourceType,
        type: 'private',
      })
      saved.push({
        type,
        fileName: file.originalname || result.public_id,
        mimeType: file.mimetype,
        storageKey: encodeStorageKey(resourceType, 'private', result.public_id),
        fileSize: file.size,
        url: result.secure_url,
      })
    }
  }

  return saved
}

export async function destroyStoredUpload(storageKey: string) {
  const parsed = parseStorageKey(storageKey)
  if (!parsed) {
    return
  }
  await cloudinary.uploader
    .destroy(parsed.publicId, {
      resource_type: parsed.resourceType,
      type: parsed.deliveryType,
      invalidate: true,
    })
    .catch(() => undefined)
}

export async function readEmployeeFile(employeeId: string, storageKey: string) {
  if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
    const response = await fetch(storageKey)
    if (!response.ok) {
      throw httpError.notFound('File not found.')
    }
    return Buffer.from(await response.arrayBuffer())
  }

  const parsed = parseStorageKey(storageKey)
  if (parsed) {
    return downloadFromCloudinary(parsed.publicId, parsed.resourceType, parsed.deliveryType)
  }

  const absolutePath = path.resolve(employeeDir(employeeId), storageKey)
  if (!absolutePath.startsWith(employeeDir(employeeId))) {
    throw httpError.notFound('File not found.')
  }
  return readFile(absolutePath)
}

export async function removeEmployeeFiles(employeeId: string) {
  const prefix = employeePrefix(employeeId)
  const attempts = [
    { resource_type: 'image' as const, type: 'upload' as const },
    { resource_type: 'image' as const, type: 'private' as const },
    { resource_type: 'raw' as const, type: 'upload' as const },
    { resource_type: 'raw' as const, type: 'private' as const },
  ]

  await Promise.all(
    attempts.map((options) => cloudinary.api.delete_resources_by_prefix(prefix, options).catch(() => undefined)),
  )
  await cloudinary.api.delete_folder(`${prefix}/documents`).catch(() => undefined)
  await cloudinary.api.delete_folder(prefix).catch(() => undefined)
}
