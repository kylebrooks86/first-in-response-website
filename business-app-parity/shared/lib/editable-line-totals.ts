/** Preserve exact historical line-item totals during no-op estimate/invoice edits.
 *
 * Existing records store line total, quantity and unit, but not always an exact
 * integer-cent unit rate. Inferring a rounded unit rate and multiplying it on
 * an unchanged save can silently alter an invoice or estimate by cents.
 *
 * Preserved amounts are from already-stored server records. Any deliberate
 * quantity/unit-rate/service/name edit clears that preservation and uses the
 * existing integer-cent calculation; descriptive edits preserve money.
 */
export type EditableMoneyLine = {
  flatPriceCents?: number;
  quantity: number;
  unitRateCents: number;
  preservedLineTotalCents?: number;
  serviceId?: string;
  name?: string;
  unit?: string;
};

function cents(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid historical service total.');
  return value;
}

export function restoreEditableLineMoney(quantity: number, lineTotalCents: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Invalid stored service quantity.');
  cents(lineTotalCents);
  const inferredUnitRate = Math.round(lineTotalCents / quantity);
  cents(inferredUnitRate);
  return { unitRateCents: inferredUnitRate, preservedLineTotalCents: lineTotalCents };
}

export function editMoneyLine<T extends EditableMoneyLine>(item: T, patch: Partial<T>): T {
  const explicitReprice = ['quantity','unitRateCents','serviceId','name','unit','flatPriceCents']
    .some(key => Object.prototype.hasOwnProperty.call(patch,key));
  return { ...item, ...patch,
    ...(explicitReprice ? { preservedLineTotalCents: undefined } : {}) };
}

export function editableLineTotalCents(item: EditableMoneyLine): number {
  if (item.flatPriceCents !== undefined) return Number.isSafeInteger(item.flatPriceCents) && item.flatPriceCents >= 0 ? item.flatPriceCents : 0;
  if (item.preservedLineTotalCents !== undefined) return cents(item.preservedLineTotalCents);
  // Draft UI may temporarily contain an empty, incomplete or invalid field.
  // Retain the existing zero-preview behavior; API save validation must reject
  // non-finite/negative/unsafe entries before any financial record is written.
  if (!Number.isFinite(item.quantity) || item.quantity < 0
      || !Number.isFinite(item.unitRateCents) || item.unitRateCents < 0) return 0;
  const computed = Math.round(item.quantity * item.unitRateCents);
  return Number.isSafeInteger(computed) && computed >= 0 ? computed : 0;
}

export function validEditablePrice(item: EditableMoneyLine): boolean {
  return item.flatPriceCents !== undefined ? Number.isSafeInteger(item.flatPriceCents) && item.flatPriceCents >= 0 : Number.isSafeInteger(item.unitRateCents) && item.unitRateCents >= 0 && (item.preservedLineTotalCents !== undefined || Number.isSafeInteger(Math.round(item.quantity * item.unitRateCents)));
}
