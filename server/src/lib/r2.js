import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET;
const publicBase = process.env.R2_PUBLIC_BASE;

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Uploads a buffer and returns the public URL.
export async function uploadBuffer({ buffer, mimeType, originalName }) {
  const ext = (originalName?.split('.').pop() || 'bin').toLowerCase();
  const key = `designs/${crypto.randomUUID()}.${ext}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  return `${publicBase.replace(/\/$/, '')}/${key}`;
}
