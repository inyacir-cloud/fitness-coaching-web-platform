import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.COACH_TOKEN_SECRET;

function getSecret(): string {
  if (!SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("COACH_TOKEN_SECRET is required in production");
    }
    return "dev-insecure-secret-change-me";
  }
  return SECRET;
}

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

export function signCoachToken(username: string): string {
  const timestamp = Date.now().toString();
  const payload = `${username}:${timestamp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyCoachToken(token: string): { username: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon === -1) return null;

    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);

    const expected = createHmac("sha256", getSecret()).update(payload).digest("hex");

    // Comparación segura contra timing attacks
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))
    ) {
      return null;
    }

    const parts = payload.split(":");
    if (parts.length < 2) return null;

    const ts = Number(parts[parts.length - 1]);
    if (isNaN(ts) || Date.now() - ts > TOKEN_TTL_MS) return null;

    const username = parts.slice(0, -1).join(":");
    return { username };
  } catch {
    return null;
  }
}
