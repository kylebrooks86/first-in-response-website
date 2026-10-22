/** Accept only exact nonnegative integer cents/basis-points.
 * Retain compatibility with integer strings from older clients; reject fractional,
 * negative, overflowed or malformed input rather than rounding/clamping it.
 */
export function submittedDiscountCents(raw:unknown):number|null{
  if(raw===undefined||raw===null)return 0;
  const value=typeof raw==='string'&&/^\d+$/.test(raw)?Number(raw):raw;
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
}
