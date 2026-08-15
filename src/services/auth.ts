import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseCookies(header: string | undefined) {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

export class PinAuth {
  constructor(private readonly pin: string, private readonly secret: string) {}

  verifyPin(candidate: string) {
    return safeEqual(candidate, this.pin);
  }

  issueSession(now = new Date(), lifetimeSeconds = 30 * 24 * 60 * 60) {
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now.getTime() / 1000) + lifetimeSeconds })).toString("base64url");
    return `${payload}.${this.sign(payload)}`;
  }

  verifySession(token: string | undefined, now = new Date()) {
    if (!token) return false;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra || !safeEqual(signature, this.sign(payload))) return false;
    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
      return typeof parsed.exp === "number" && parsed.exp > Math.floor(now.getTime() / 1000);
    } catch { return false; }
  }

  private sign(payload: string) {
    return createHmac("sha256", this.secret).update(payload).digest("base64url");
  }
}
