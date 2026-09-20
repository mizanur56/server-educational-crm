import type { UploadApiErrorResponse, UploadApiResponse } from 'cloudinary'
import cloudinary, { CLOUDINARY_FOLDER } from '../../config/cloudinary.ts'
import { httpError } from '../../lib/http-error.ts'

export const MAX_USER_PHOTO_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg'])

function assertAllowed(file: Express.Multer.File) {
  if (file.size > MAX_USER_PHOTO_BYTES) {
    throw httpError.invalidUpload('Profile photo must be 5 MB or smaller.')
  }
  if (!IMAGE_TYPES.has(file.mimetype)) {
    throw httpError.invalidUpload('Profile photo must be a JPG, PNG, or WEBP image.')
  }
}

export async function saveUserProfilePhoto(userId: string, file: Express.Multer.File) {
  assertAllowed(file)
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${CLOUDINARY_FOLDER}/users/${userId}`,
        public_id: 'profile',
        resource_type: 'image',
        type: 'upload',
        overwrite: true,
        invalidate: true,
      },
      (error: UploadApiErrorResponse | undefined, uploaded: UploadApiResponse | undefined) => {
        if (error || !uploaded) {
          reject(error || new Error('Cloudinary upload failed.'))
          return
        }
        resolve(uploaded)
      },
    )
    stream.end(file.buffer)
  })

  return {
    url: result.secure_url,
    mimeType: file.mimetype,
    fileName: file.originalname,
    fileSize: file.size,
  }
}
