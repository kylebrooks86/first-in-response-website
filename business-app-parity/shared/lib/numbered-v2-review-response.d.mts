/** Bounded private/no-store owner review HTTP stream only.
 * This validates the CORE-ONLY snapshot, not photo/off-device/full restore.
 */
import type {NumberedCoreSnapshot} from './numbered-v2-owner-file-custody.mjs';
export const MAX_NUMBERED_REVIEW_HTTP_BYTES:number;
export function readOwnerNumberedCoreReviewResponse(response:Response):Promise<NumberedCoreSnapshot>;
