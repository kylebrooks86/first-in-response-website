/** Offline candidate persistence for trusted-device PIN. Not wired to a hosted
 * route. Caller must independently verify exact environment, owner session and
 * fresh recovery proof before enrollment; never expose this directly.
 */
import {validPin,validDeviceToken,newDeviceToken,deviceLookupKey,devicePinVerifier,verifyDevicePin} from "./trusted-device-pin.mjs";
const TTL=30*86400;
const LIMIT=5;
const BLOCK=1800;
// Reserve BEFORE checking PIN; SQLite serializes the conditional UPDATE.
// No success reset: concurrent guesses cannot refill the attempt budget.
export const reserveSql=`UPDATE fire_trusted_devices SET
 attempts=CASE WHEN blocked_until<=? AND blocked_until>0 THEN 1 ELSE attempts+1 END,
 blocked_until=CASE WHEN blocked_until<=? AND blocked_until>0 THEN 0
 WHEN attempts+1>=? THEN ? ELSE blocked_until END
 WHERE device_key=? AND revoked_at IS NULL AND expires_at>?
 AND (blocked_until=0 OR blocked_until<=?)
 RETURNING pin_verifier AS verifier`;
export const schemaSql=`CREATE TABLE IF NOT EXISTS fire_trusted_devices (
 device_key TEXT PRIMARY KEY NOT NULL CHECK(length(device_key)=64),
 pin_verifier TEXT NOT NULL CHECK(length(pin_verifier)=64),
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 revoked_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
 blocked_until INTEGER NOT NULL DEFAULT 0,
 CHECK(expires_at>created_at)
)`;
function clock(now){if(!Number.isSafeInteger(now)||now<=0)throw Error("Invalid clock");return now;}
export async function enrollVerifiedDevice(db,{scope,pin,secret,now,ownerProofVerified}){
 clock(now);
 if(ownerProofVerified!==true||!validPin(pin))throw Error("Enrollment refused");
 const token=newDeviceToken();
 const key=await deviceLookupKey(scope,token,secret);
 const verifier=await devicePinVerifier(scope,token,pin,secret);
 const result=await db.prepare("INSERT INTO fire_trusted_devices(device_key,pin_verifier,created_at,expires_at) VALUES(?,?,?,?)").bind(key,verifier,now,now+TTL).run();
 if(result.success!==true||result.meta?.changes!==1)throw Error("Enrollment failed");
 return {token,expiresAt:now+TTL};
}
export async function checkTrustedDevicePin(db,{scope,token,pin,secret,now}){
 clock(now);
 if(!validDeviceToken(token)||!validPin(pin))return false;
 const key=await deviceLookupKey(scope,token,secret);
 const row=await db.prepare(reserveSql).bind(now,now,LIMIT,now+BLOCK,key,now,now).first();
 if(!row||!await verifyDevicePin(scope,token,pin,secret,row.verifier))return false;
 // Recheck revocation/expiry; final session issuance must still bind to device
 // and validate revocation on every authenticated request.
 const active=await db.prepare("SELECT device_key FROM fire_trusted_devices WHERE device_key=? AND revoked_at IS NULL AND expires_at>?").bind(key,now).first();
 return Boolean(active);
}
export async function revokeDevice(db,{scope,token,secret,now}){
 clock(now);
 if(!validDeviceToken(token))return false;
 const key=await deviceLookupKey(scope,token,secret);
 const r=await db.prepare("UPDATE fire_trusted_devices SET revoked_at=? WHERE device_key=? AND revoked_at IS NULL").bind(now,key).run();
 return r.success===true&&r.meta?.changes===1;
}
