-- READ ONLY: run against each target independently before the uniqueness migration.
-- Any returned row blocks migration/publication. Do not automatically deduplicate.
SELECT provider_id, COUNT(*) AS collision_count
FROM payments
WHERE provider_id GLOB 'cs_*' OR provider_id GLOB 'refund:*'
GROUP BY provider_id HAVING COUNT(*) > 1;

SELECT r.id AS refund_id, r.payment_id, r.estimate_id
FROM payment_refunds r LEFT JOIN payments p ON p.id=r.payment_id
WHERE p.id IS NULL OR p.estimate_id<>r.estimate_id
   OR p.status<>'paid' OR p.amount_cents<=0 OR r.amount_cents<=0
   OR r.amount_cents>p.amount_cents;

SELECT r.id AS refund_id, COUNT(p.id) AS ledger_count
FROM payment_refunds r LEFT JOIN payments p
 ON p.provider_id='refund:' || r.payment_id || ':' || r.id
WHERE r.status='succeeded'
GROUP BY r.id
HAVING COUNT(p.id)<>1
 OR SUM(CASE WHEN p.estimate_id=r.estimate_id AND p.status='paid'
       AND p.amount_cents=-r.amount_cents
       AND p.type=CASE WHEN (SELECT type FROM payments WHERE id=r.payment_id)='Tip'
                    THEN 'Tip Refund' ELSE 'Refund' END THEN 1 ELSE 0 END)<>1;

-- Individually valid partial requests can collectively over-reserve a payment.
-- Failed/canceled requests do not reserve funds, pending and succeeded do.
SELECT r.payment_id, SUM(r.amount_cents) AS reserved_cents,
       p.amount_cents AS original_cents
FROM payment_refunds r JOIN payments p ON p.id=r.payment_id
WHERE r.status IN ('pending','succeeded')
GROUP BY r.payment_id
HAVING SUM(r.amount_cents)>p.amount_cents;
