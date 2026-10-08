export type PaymentHandleEnv = { CASH_APP_HANDLE?: string; VENMO_HANDLE?: string };

export const DEFAULT_CASH_APP_HANDLE = "$FIREExteriors";
export const DEFAULT_VENMO_HANDLE = "@FirstInResponseExteriors";

export function paymentHandles(runtime?: PaymentHandleEnv) {
  const cashApp = runtime?.CASH_APP_HANDLE?.trim() || DEFAULT_CASH_APP_HANDLE;
  const venmo = runtime?.VENMO_HANDLE?.trim() || DEFAULT_VENMO_HANDLE;
  return { cashApp, venmo };
}
