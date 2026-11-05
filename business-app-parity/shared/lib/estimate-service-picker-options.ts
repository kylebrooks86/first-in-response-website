/** Shared ordering for the long service picker in new estimates, revisions,
 * and final invoice edits. Only the UI display order changes. Catalog rates,
 * IDs, persistence and selection semantics remain untouched.
 *
 * Owner can choose Custom Service without scrolling to the bottom of the
 * ~50-entry catalog on iPhone. It remains a SINGLE option, not a duplicate.
 */
export function estimateServicePickerOptions<T extends {id:string}>(catalog:readonly T[]):T[]{
  const custom=catalog.filter(service=>service.id==="custom");
  const standard=catalog.filter(service=>service.id!=="custom");
  return [...custom,...standard];
}
