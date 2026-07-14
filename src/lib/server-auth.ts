/// <reference types="node" />
// Web Crypto API — compatible con Edge Runtime y Node.js 18+
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.COACH_TOKEN_SECRET?.trim();
  if (secret) return secret;

  const fallbackPassword = process.env.COACH_PASSWORD?.trim();
  const fallbackUser = process.env.COACH_USERNAME?.trim() || "coach";

  if (fallbackPassword) {
    return `coach-auth:${fallbackUser}:${fallbackPassword}`;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("COACH_TOKEN_SECRET or COACH_PASSWORD is required in production");
  }

  return "dev-insecure-secret-change-me";
}

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signCoachToken(username: string): Promise<string> {
  const payload = `${username}:${Date.now()}`;
  const key = await getHmacKey();
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  const full = `${payload}:${sig}`;
  return btoa(full).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function verifyCoachToken(token: string): Promise<{ username: string } | null> {
  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(padded);
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon === -1) return null;

    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);

    const key = await getHmacKey();
    const sigBuf = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBuf, new TextEncoder().encode(payload));
    if (!valid) return null;

    const parts = payload.split(":");
    if (parts.length < 2) return null;

    const ts = Number(parts[parts.length - 1]);
    if (isNaN(ts) || Date.now() - ts > TOKEN_TTL_MS) return null;

    return { username: parts.slice(0, -1).join(":") };
  } catch {
    return null;
  }
}
