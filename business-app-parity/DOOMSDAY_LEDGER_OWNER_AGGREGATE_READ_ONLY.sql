-- READ ONLY. FIRE Doomsday D1 fire-app-staging-db ONLY.
-- Reports four anomaly COUNTS; it does NOT select payment IDs, customer data,
-- card data or any financial row values. A query error is a STOP, not 0.
-- All 0s mean a point-in-time narrow financial integrity preflight only.
-- Never run a migration or deploy based on these counts alone.
SELECT
  (SELECT COUNT(*) FROM payment_refunds r LEFT JOIN payments p ON p.id=r.payment_id
   WHERE p.id IS NULL OR p.estimate_id<>r.estimate_id
      OR p.status<>'paid' OR p.amount_cents<=0 OR r.amount_cents<=0
      OR r.amount_cents>p.amount_cents) AS invalid_refund_links,

  (SELECT COUNT(*) FROM (
    SELECT r.id FROM payment_refunds r LEFT JOIN payments p
      ON p.provider_id='refund:' || r.payment_id || ':' || r.id
    WHERE r.status='succeeded'
    GROUP BY r.id
    HAVING COUNT(p.id)<>1
      OR SUM(CASE WHEN p.estimate_id=r.estimate_id AND p.status='paid'
          AND p.amount_cents=-r.amount_cents
          AND p.type=CASE WHEN (SELECT type FROM payments WHERE id=r.payment_id)='Tip'
                         THEN 'Tip Refund' ELSE 'Refund' END
          THEN 1 ELSE 0 END)<>1
  )) AS succeeded_refund_ledger_mismatches,

  (SELECT COUNT(*) FROM (
    SELECT r.payment_id FROM payment_refunds r JOIN payments p
      ON p.id=r.payment_id
    WHERE r.status IN ('pending','succeeded')
    GROUP BY r.payment_id
    HAVING SUM(r.amount_cents)>p.amount_cents
  )) AS over_reserved_payment_groups,

  (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violations;
