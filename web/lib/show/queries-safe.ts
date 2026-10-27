import { isDbConfigured } from "@/lib/env";
import { getShowByOwner, type ShowRow } from "@/db/queries";

/**
 * Read the user's show without failing keyless previews (no DB configured):
 * returns null there instead of throwing. With a DB configured, errors surface.
 */
export async function getShowByOwnerSafe(ownerId: string): Promise<ShowRow | null> {
  if (!isDbConfigured()) return null;
  return getShowByOwner(ownerId);
}
