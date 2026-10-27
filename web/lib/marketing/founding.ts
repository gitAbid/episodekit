// M10/MK-1 founding counter for marketing pages — derived from the DB
// (WP-08 lib/billing semantics), never stored or faked. Null when the DB is
// unavailable (keyless preview): pages then omit the count instead of showing
// an invented number (§0.5 no fake metrics).
import { countFoundingWorkspaces } from "@/db/queries";
import { foundingLeft } from "@/lib/billing/entitlements";

export async function foundingRemainingForMarketing(): Promise<number | null> {
  try {
    return foundingLeft(await countFoundingWorkspaces());
  } catch {
    return null;
  }
}
