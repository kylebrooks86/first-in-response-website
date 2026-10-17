import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type OwnerUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

type IndependentSecrets = {
  FIRE_QA_PASSWORD_HASH?: string;
  FIRE_QA_SESSION_SECRET?: string;
};

const COOKIE_NAME = "fire_qa_session";
const SESSION_SECONDS = 60 * 60 * 12;
const encoder = new TextEncoder();

function qaEnvironmentEnabled() {
  const runtime = env as typeof env & { FIRE_QA_SYNTHETIC_ONLY?: string; FIRE_ENV?: string; SITE_ORIGIN?: string };
  if (runtime.FIRE_QA_SYNTHETIC_ONLY !== "enabled" || runtime.FIRE_ENV !== "synthetic-qa") return false;
  try {
    const address = new URL(runtime.SITE_ORIGIN || "");
    return address.protocol === "https:" && address.hostname.startsWith("fire-fullapp-qa-20261016.")
      && address.hostname.endsWith(".workers.dev") && address.origin === runtime.SITE_ORIGIN
      && !address.username && !address.password && !address.port;
  } catch { return false; }
}


function secrets() {
  return env as typeof env & IndependentSecrets;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function hmac(value: string) {
  const secret = secrets().FIRE_QA_SESSION_SECRET;
  if (!qaEnvironmentEnabled() || !secret || secret.length < 32) return null;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return mismatch === 0;
}

function cookieValue(cookieHeader: string | null) {
  if (!cookieHeader) return "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return "";
}

async function sessionIsValid(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [version, expiresText, signature] = parts;
  if (version !== "v1" || !expiresText || !signature) return false;
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000)) return false;
  const expected = await hmac(version + "." + expiresText);
  return Boolean(expected && constantTimeEqual(signature, expected));
}

export async function verifyIndependentPassword(password: string) {
  const configuredHash = secrets().FIRE_QA_PASSWORD_HASH?.trim().toLowerCase();
  if (!qaEnvironmentEnabled() || !configuredHash || !/^[a-f0-9]{64}$/.test(configuredHash) || password.length < 24 || password.length > 128) return false;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(password)));
  const suppliedHash = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(suppliedHash, configuredHash);
}

export async function independentSessionCookie() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const value = "v1." + expires;
  const signature = await hmac(value);
  if (!signature) throw new Error("FIRE_QA_SESSION_SECRET is missing or too short.");
  return COOKIE_NAME + "=" + value + "." + signature + "; Path=/; Max-Age=" + SESSION_SECONDS + "; HttpOnly; Secure; SameSite=Strict";
}

export function clearedIndependentSessionCookie() {
  return COOKIE_NAME + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict";
}

export async function getOwnerUser(): Promise<OwnerUser | null> {
  if (!qaEnvironmentEnabled()) return null;
  const requestHeaders = await headers();
  if (!await sessionIsValid(cookieValue(requestHeaders.get("cookie")))) return null;
  return { userId: "fire-qa-owner", displayName: "Kyle Brooks", email: "kylebrooks8605@gmail.com", fullName: "Kyle Brooks" };
}

export async function requireOwnerUser(returnTo: string): Promise<OwnerUser> {
  const user = await getOwnerUser();
  if (user) return user;
  redirect(ownerSignInPath(returnTo));
}

export function ownerSignInPath(returnTo: string) {
  return "/login?return_to=" + encodeURIComponent(safeRelativeReturnPath(returnTo));
}

export function ownerSignOutPath(returnTo = "/") {
  return "/api/auth/logout?return_to=" + encodeURIComponent(safeRelativeReturnPath(returnTo));
}

export function safeRelativeReturnPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    return url.origin === "https://app.local" ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}
