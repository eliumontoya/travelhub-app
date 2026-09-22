import { timingSafeEqual } from "node:crypto";

/**
 * Returns `true` when `MCP_API_KEY` is set to a non-empty (non-whitespace) value.
 *
 * The MCP route MUST refuse requests when no key is configured: there is no
 * usable default and an empty/blank value should never authorize traffic.
 */
export function isMcpApiKeyConfigured(): boolean {
  const raw = process.env.MCP_API_KEY;
  return typeof raw === "string" && raw.trim().length > 0;
}

/**
 * Validates a Bearer-style `Authorization` header against the configured
 * `MCP_API_KEY` allow-list.
 *
 * The env value may be a single key or a comma-separated list to support key
 * rotation without redeploys. Each candidate is compared using
 * `crypto.timingSafeEqual` over equal-length buffers to close the classic
 * timing oracle of plain `===`. Headers that are missing, malformed, or
 * whose scheme is not `Bearer` are rejected outright before any comparison
 * runs.
 */
export function validateMcpApiKey(authHeader: string | null | undefined): boolean {
  if (!authHeader) return false;
  const match = /^Bearer\s+(.+)$/.exec(authHeader.trim());
  if (!match) return false;
  const presented = match[1].trim();
  if (!presented) return false;

  const allowListRaw = process.env.MCP_API_KEY;
  if (typeof allowListRaw !== "string") return false;
  const allowList = allowListRaw
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  if (allowList.length === 0) return false;

  const presentedBuf = Buffer.from(presented, "utf8");
  for (const candidate of allowList) {
    const candidateBuf = Buffer.from(candidate, "utf8");
    if (candidateBuf.length !== presentedBuf.length) continue;
    if (timingSafeEqual(presentedBuf, candidateBuf)) return true;
  }
  return false;
}