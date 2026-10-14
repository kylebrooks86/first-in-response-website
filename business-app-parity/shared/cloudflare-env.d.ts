declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FIRE_SERVICE_LOCATIONS_CANDIDATE?: string;
    FIRE_CUSTOMER_PROPERTIES_CANDIDATE?: string;
    FIRE_PROPERTY_ESTIMATES_CANDIDATE?: string;
    BUCKET: R2Bucket;
  }
}
