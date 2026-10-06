import { DASHBOARD_PASSWORD, MASTER_KEY } from "./env";

export const AUTH_COOKIE = "mrd_auth";

// Deterministic token so both proxy (edge) and route handlers (node) can verify.
// Works everywhere via WebCrypto (async).
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

let cached: string | null = null;
export async function expectedToken(): Promise<string> {
  if (cached) return cached;
  cached = await sha256Hex(`mrd:${DASHBOARD_PASSWORD}:${MASTER_KEY}`);
  return cached;
}

export function authDisabled(): boolean {
  return !DASHBOARD_PASSWORD;
}

export async function verifyPassword(pw: string): Promise<boolean> {
  return pw === DASHBOARD_PASSWORD;
}

export async function isAuthCookieValid(value: string | undefined): Promise<boolean> {
  if (authDisabled()) return true;
  if (!value) return false;
  return value === (await expectedToken());
}
