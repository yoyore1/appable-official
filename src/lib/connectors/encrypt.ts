import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

function encryptionKey(): Buffer {
  const secret =
    process.env.CONNECTOR_ENCRYPTION_KEY?.trim() ||
    process.env.APPABLE_SERVICE_KEY?.trim() ||
    "dev-connector-encryption-not-for-production";
  return scryptSync(secret, "appable-connectors-v1", 32);
}

/** AES-256-GCM ciphertext as base64(iv + tag + data). */
export function encryptConnectorSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptConnectorSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
