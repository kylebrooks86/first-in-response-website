type FollowUpEstimate = { status: string; createdAt: string; lastEstimateSentAt?: string|null; lastEstimateContactAt?: string|null };
function timestamp(value: string|null|undefined) { const time=value?Date.parse(value):NaN;return Number.isFinite(time)?time:null; }
// Only owner-confirmed estimate communication qualifies as contact. Legacy dates
// fall back transparently; preparation/copy events must never enter these fields.
export function estimateFollowUpTiming(estimate: FollowUpEstimate, now: number) {
  const created=timestamp(estimate.createdAt);
  const confirmed=estimate.status==="sent"?[timestamp(estimate.lastEstimateSentAt),timestamp(estimate.lastEstimateContactAt)].filter((time):time is number=>time!==null):[];
  const anchor=confirmed.length?Math.max(...confirmed):created;
  return { ageDays:anchor===null||!Number.isFinite(now)?0:Math.max(0,Math.floor((now-anchor)/86400000)), confirmedContact:confirmed.length>0 };
}
