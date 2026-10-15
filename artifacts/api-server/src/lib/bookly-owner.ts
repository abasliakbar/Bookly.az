import { eq } from "drizzle-orm";
import { db, businessesTable } from "@workspace/db";

export async function getOwnerBusiness(ownerId: string) {
  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.ownerId, ownerId))
    .limit(1);
  return business;
}
