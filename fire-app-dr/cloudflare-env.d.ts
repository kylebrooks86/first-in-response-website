declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    CASH_APP_HANDLE?: string;
    VENMO_HANDLE?: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    SITE_ORIGIN?: string;
  }
}
