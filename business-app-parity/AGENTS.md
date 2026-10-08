# FIRE Business App parity requirement

All active LIVE, Doomsday, staging, and disaster-recovery Business App versions must use identical shared business logic and presentation. Business Command Center, calculators, and marketing sites are outside this requirement.

Apply every approved feature and fix to isolated candidates for every active target. Maintain a complete target inventory. Run the shared-source parity gate and financial regression tests before release. Do not claim deployed parity from source parity alone: record authenticated browser evidence, mobile light/dark review, and deployed release identity for every target.

Never overwrite independent databases, customer/financial records, Stripe configuration, authentication, or migration history to achieve parity. Authentication, environment labels, hosting bindings, and target-specific migration histories are explicit deployment adapters; they must preserve existing security and reach an equivalent final schema. Preserve historical rollback copies unchanged. Do not purchase, subscribe to, or activate paid services.

Production publication requires the owner’s explicit approval of exact candidate commits, database migrations, test results, and rollback plan. Staging must use synthetic records and sandbox Stripe only. Do not process real test payments. A release is blocked while any deployed identity, schema compatibility, security adapter, storage capability, or mobile workflow remains unverified.
