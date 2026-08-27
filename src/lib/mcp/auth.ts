import crypto from "node:crypto";

export function isMcpApiKeyConfigured(): boolean {
  return Boolean(process.env.MCP_API_KEY);
}

/**
 * Validates a Bearer token against the comma-separated MCP_API_KEY allow-list.
 * Timing-safe comparison is used for every candidate key.
 */
export function validateMcpApiKey(authHeader?: string | null): boolean {
  const raw = process.env.MCP_API_KEY ?? "";
  const allowedKeys = raw
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  if (!allowedKeys.length) return false;
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  const tokenBuf = Buffer.from(token);
  for (const key of allowedKeys) {
    const keyBuf = Buffer.from(key);
    if (tokenBuf.length !== keyBuf.length) continue;
    if (crypto.timingSafeEqual(tokenBuf, keyBuf)) return true;
  }

  return false;
}
