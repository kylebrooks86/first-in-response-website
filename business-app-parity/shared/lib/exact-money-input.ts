/** Parse owner-entered USD as exact integer cents.
 * Never round third decimals, exponent notation, negative dollars or unsafe
 * values when posting actual customer payments or refunds.
 * Empty is allowed only where an optional payment/tip/fee field treats it as 0.
 */
export function exactMoneyInputCents(value:string,emptyAsZero=false):number|null{
 if(typeof value!=='string')return null;
 const raw=value.trim();
 if(!raw)return emptyAsZero?0:null;
 const match=/^(?:(\d+)(?:\.(\d{1,2}))?|\.(\d{1,2}))$/.exec(raw);
 if(!match)return null;
 try{
  const dollars=BigInt(match[1]??'0');
  const decimals=BigInt((match[2]??match[3]??'').padEnd(2,'0'));
  const cents=dollars*BigInt(100)+decimals;
  return cents<=BigInt(Number.MAX_SAFE_INTEGER)?Number(cents):null;
 }catch{return null;}
}
