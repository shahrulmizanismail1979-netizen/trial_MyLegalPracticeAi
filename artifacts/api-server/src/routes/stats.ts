import { Router, type IRouter } from "express";
import { db, appStatsTable } from "@workspace/db";

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

router.get("/stats/subscribers-by-app", async (_req, res): Promise<void> => {
  const rows = await db.select().from(appStatsTable);
  const rowMap = new Map(rows.map((r) => [r.appName, r.subscriberCount]));

  const result = KNOWN_APPS.map((appName) => ({
    appName,
    count: rowMap.get(appName) ?? 0,
  }));

  res.json(result);
});

export default router;
