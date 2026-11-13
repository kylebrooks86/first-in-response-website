import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {verifyCloudflareAccessOwnerJwt} from "../lib/access-passkey-identity.mjs";

export type OwnerUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

type IndependentSecrets = {
  FIRE_ADMIN_PASSWORD_HASH?: string;
  FIRE_SESSION_SECRET?: string;
};

const COOKIE_NAME = "fire_admin_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

function secrets() {
  return env as typeof env & IndependentSecrets;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function hmac(value: string) {
  const secret = secrets().FIRE_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
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
  if (version !== "v1" || !expiresText || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
  const expires = Number(expiresText);
  // Reject a correctly signed cookie whose expiry exceeds this deployment
  // configured 30-day maximum. HMAC validity alone is not unlimited lifetime.
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expires) || expires <= now || expires > now + SESSION_SECONDS) return false;
  const expected = await hmac(version + "." + expiresText);
  return Boolean(expected && constantTimeEqual(signature, expected));
}

export async function verifyIndependentPassword(password: string) {
  const configuredHash = secrets().FIRE_ADMIN_PASSWORD_HASH?.trim().toLowerCase();
  if (!configuredHash || !/^[a-f0-9]{64}$/.test(configuredHash) || !password) return false;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(password)));
  const suppliedHash = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(suppliedHash, configuredHash);
}


/** Optional secure convenience login. Defaults OFF in every compiled environment.
 * Cloudflare Access must first verify owner identity for this exact Worker.
 * A PIN alone NEVER authenticates an unverified public request.
 */
export function quickUnlockEnabled() {
 return (env as typeof env & {FIRE_QUICK_AUTH_MODE?:string}).FIRE_QUICK_AUTH_MODE==='passkey-or-pin-v1';
}
export async function verifyAccessOwnerRequest(request:{headers:Pick<Headers,'get'>}) {
 if(!quickUnlockEnabled())return false;
 const v=env as typeof env & {FIRE_ACCESS_TEAM_DOMAIN?:string;
  FIRE_ACCESS_AUDIENCE?:string;FIRE_ACCESS_OWNER_EMAIL?:string};
 return verifyCloudflareAccessOwnerJwt(request.headers.get('cf-access-jwt-assertion'),{
  teamDomain:v.FIRE_ACCESS_TEAM_DOMAIN,
  audience:v.FIRE_ACCESS_AUDIENCE,ownerEmail:v.FIRE_ACCESS_OWNER_EMAIL
 });
}
export async function verifyIndependentPin(pin:string) {
 const v=env as typeof env & {FIRE_PIN_HASH?:string;FIRE_PIN_PEPPER?:string};
 if(!quickUnlockEnabled()||typeof pin!=='string'||! /^\d{4}$/.test(pin)||
  typeof v.FIRE_PIN_HASH!=='string'||!/^[0-9a-f]{64}$/.test(v.FIRE_PIN_HASH)||
  !v.FIRE_PIN_PEPPER||v.FIRE_PIN_PEPPER.length<32)return false;
 const key=await crypto.subtle.importKey('raw',encoder.encode(v.FIRE_PIN_PEPPER),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const proof=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(pin)));
 const digest=Array.from(proof,b=>b.toString(16).padStart(2,'0')).join('');
 return constantTimeEqual(digest,v.FIRE_PIN_HASH);
}

export async function independentSessionCookie() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const value = "v1." + expires;
  const signature = await hmac(value);
  if (!signature) throw new Error("FIRE_SESSION_SECRET is missing or too short.");
  return COOKIE_NAME + "=" + value + "." + signature + "; Path=/; Max-Age=" + SESSION_SECONDS + "; HttpOnly; Secure; SameSite=Strict";
}

export function clearedIndependentSessionCookie() {
  return COOKIE_NAME + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict";
}

export async function getOwnerUser(): Promise<OwnerUser | null> {
  const requestHeaders = await headers();
  if(quickUnlockEnabled()&&!await verifyAccessOwnerRequest({headers:requestHeaders}))return null;
  if (process.env.NODE_ENV !== "production" && requestHeaders.get("host")?.startsWith("terminal.local")) {
    return { userId: "preview-owner", displayName: "Kyle Brooks", email: "kylebrooks8605@gmail.com", fullName: "Kyle Brooks" };
  }
  if (!await sessionIsValid(cookieValue(requestHeaders.get("cookie")))) return null;
  return { userId: "fire-owner", displayName: "Kyle Brooks", email: "kylebrooks8605@gmail.com", fullName: "Kyle Brooks" };
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
