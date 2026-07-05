import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscribersTable } from "@workspace/db";

const router: IRouter = Router();

const KNOWN_APPS = [
  "MyLitAI",
  "MySyalitAI",
  "MyCorpAI",
  "MyConveyAI",
  "MyCrimAI",
  "MyCorpCommBankLitAi",
  "MyAccidentAi",
];

router.get("/stats/subscribers-by-app", async (req, res): Promise<void> => {
  const confirmedSubs = await db
    .select()
    .from(subscribersTable)
    .where(eq(subscribersTable.paymentStatus, "confirmed"));

  const countMap: Record<string, number> = {};
  for (const app of KNOWN_APPS) {
    countMap[app] = 0;
  }
  for (const sub of confirmedSubs) {
    if (sub.apps) {
      for (const app of sub.apps) {
        countMap[app] = (countMap[app] || 0) + 1;
      }
    }
  }

  const result = Object.entries(countMap).map(([appName, count]) => ({ appName, count }));
  res.json(result);
});

export default router;
