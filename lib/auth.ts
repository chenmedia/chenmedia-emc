import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "emc_editor_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

function signingSecret() {
  return process.env.EMC_SESSION_SECRET || process.env.EMC_EDITOR_PASSWORD || "";
}

function signature(payload: string) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

function equal(a: string, b: string) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function authConfigured() {
  return Boolean(process.env.EMC_EDITOR_PASSWORD && signingSecret());
}

export function passwordIsValid(candidate: string) {
  const expected = process.env.EMC_EDITOR_PASSWORD ?? "";
  return Boolean(expected && equal(candidate, expected));
}

export function createSessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  const payload = String(expiresAt);
  return `${payload}.${signature(payload)}`;
}

export function validSessionToken(token: string | undefined) {
  if (!token || !authConfigured()) return false;
  const [payload, suppliedSignature, extra] = token.split(".");
  const expiresAt = Number(payload);
  if (extra || !payload || !suppliedSignature || !Number.isFinite(expiresAt)) return false;
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false;
  return equal(suppliedSignature, signature(payload));
}

export async function isEditor() {
  const cookieStore = await cookies();
  return validSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_LIFETIME_SECONDS,
};
