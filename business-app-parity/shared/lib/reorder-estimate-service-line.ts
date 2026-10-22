/** Reorder an estimate without mutating service objects or prices. */
export function moveEstimateServiceLine<T>(lines:readonly T[],from:number,to:number):T[]{
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=lines.length||to>=lines.length||from===to)return [...lines];
 const reordered=[...lines];
 const [selected]=reordered.splice(from,1);
 reordered.splice(to,0,selected);
 return reordered;
}
