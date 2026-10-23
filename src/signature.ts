import { createHmac, timingSafeEqual } from "node:crypto";

const toleranceSeconds = 300;

export function verifySignature(
  rawBody: Buffer,
  timestamp: string | undefined,
  signature: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): boolean {
  if (!timestamp || !signature) return false;
  const signedAt = Number(timestamp);
  if (!Number.isInteger(signedAt) || Math.abs(nowSeconds - signedAt) > toleranceSeconds) return false;

  const supplied = signature.startsWith("v1=") ? signature.slice(3) : signature;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody.toString("utf8")}`)
    .digest("hex");
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}
