import "dotenv/config";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs/promises";

export const R2_PUBLIC_BASE = "https://docs.fairoakscivic.org";
export const R2_ENDPOINT = "https://8f543a54ad9a48c6984d00e7fbf0bc44.r2.cloudflarestorage.com";
export const R2_BUCKET = "focs";

export function getR2Client() {
  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("Missing R2 credentials in .env (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)");
  }
  return new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function uploadFile(client: S3Client, bucket: string, localPath: string, key: string) {
  const body = await fs.readFile(localPath);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: "application/pdf",
  }));
}

export async function getRemoteSize(client: S3Client, bucket: string, key: string): Promise<number | null> {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength ?? null;
  } catch {
    return null;
  }
}
