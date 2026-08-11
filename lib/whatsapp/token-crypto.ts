import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey() {
  const secret = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("Chave de criptografia do WhatsApp não configurada.");
  return createHash("sha256").update(secret).digest();
}

export function encryptWhatsAppToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    encryptedAccessToken: encrypted.toString("base64"),
    tokenIv: iv.toString("base64"),
    tokenTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptWhatsAppToken(encryptedAccessToken: string, tokenIv: string, tokenTag: string) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(tokenIv, "base64"));
  decipher.setAuthTag(Buffer.from(tokenTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedAccessToken, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
