import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET ?? "usaii-launchify";

export const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });

export const uploadToS3 = async (key: string, body: Buffer, contentType: string): Promise<void> => {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
};

export const deleteFromS3 = async (key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};
