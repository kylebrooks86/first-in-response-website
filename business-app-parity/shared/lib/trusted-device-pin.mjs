/** Trusted-device PIN cryptographic primitives. Not a login endpoint.
 * Integration MUST reserve a rate-limited attempt atomically in D1 before
 * verifying a PIN, require a live non-revoked enrollment and issue a separate
 * revocable session. No public PIN-only authorization is provided here.
 */
const enc = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,"0")).join("");
export const validPin = pin => typeof pin === "string" && /^[0-9]{4}$/.test(pin);
export const validDeviceToken = token => typeof token === "string" && /^[0-9a-f]{64}$/.test(token);
export function newDeviceToken() { return hex(crypto.getRandomValues(new Uint8Array(32))); }
function validScope(scope) {
 return typeof scope === "string" && ["qa","staging","dr","new-live"].includes(scope);
}
function validateSecret(secret) {
 if (typeof secret !== "string" || secret.length < 32) throw Error("Invalid trusted-device configuration");
}
async function mac(secret, message) {
 validateSecret(secret);
 const key = await crypto.subtle.importKey("raw", enc.encode(secret), {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return hex(await crypto.subtle.sign("HMAC",key,enc.encode(message)));
}
export async function deviceLookupKey(scope, token, secret) {
 if (!validScope(scope) || !validDeviceToken(token)) throw Error("Invalid trusted-device identity");
 return mac(secret, JSON.stringify(["fire-device-lookup-v1",scope,token]));
}
export async function devicePinVerifier(scope, token, pin, secret) {
 if (!validScope(scope) || !validDeviceToken(token) || !validPin(pin)) throw Error("Invalid trusted-device credential");
 return mac(secret,JSON.stringify(["fire-device-pin-v1",scope,token,pin]));
}
export async function verifyDevicePin(scope, token, pin, secret, storedVerifier) {
 if (!validScope(scope) || !validDeviceToken(token) || !validPin(pin) ||
  typeof storedVerifier !== "string" || !/^[0-9a-f]{64}$/.test(storedVerifier)) return false;
 try {
  const expected=await devicePinVerifier(scope,token,pin,secret);
  let difference=0;
  for(let i=0;i<64;i++) difference|=expected.charCodeAt(i)^storedVerifier.charCodeAt(i);
  return difference===0;
 } catch { return false; }
}
