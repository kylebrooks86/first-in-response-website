declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FIRE_SERVICE_LOCATIONS_CANDIDATE?: string;
    BUCKET: R2Bucket;
  }
}
