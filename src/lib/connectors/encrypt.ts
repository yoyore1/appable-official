import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

export class ConnectorDecryptError extends Error {
  constructor(
    message = "Could not decrypt connector secret — reconnect this integration in Connections."
  ) {
    super(message);
    this.name = "ConnectorDecryptError";
  }
}

function encryptionKey(): Buffer {
  const secret =
    process.env.CONNECTOR_ENCRYPTION_KEY?.trim() ||
    process.env.APPABLE_SERVICE_KEY?.trim() ||
    "dev-connector-encryption-not-for-production";
  return scryptSync(secret, "appable-connectors-v1", 32);
}

function parsePayload(payload: string): { iv: Buffer; tag: Buffer; data: Buffer } | null {
  if (!payload?.trim()) return null;
  try {
    const buf = Buffer.from(payload, "base64");
    if (buf.length < 28) return null;
    return {
      iv: buf.subarray(0, 12),
      tag: buf.subarray(12, 28),
      data: buf.subarray(28),
    };
  } catch {
    return null;
  }
}

/** AES-256-GCM ciphertext as base64(iv + tag + data). */
export function encryptConnectorSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Returns null when ciphertext is invalid or the server key changed since encrypt. */
export function tryDecryptConnectorSecret(payload: string): string | null {
  const parts = parsePayload(payload);
  if (!parts) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), parts.iv);
    decipher.setAuthTag(parts.tag);
    return Buffer.concat([decipher.update(parts.data), decipher.final()]).toString(
      "utf8"
    );
  } catch {
    return null;
  }
}

export function decryptConnectorSecret(payload: string): string {
  const plain = tryDecryptConnectorSecret(payload);
  if (plain === null) {
    throw new ConnectorDecryptError();
  }
  return plain;
}
