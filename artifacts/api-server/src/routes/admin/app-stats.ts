import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, appStatsTable } from "@workspace/db";
import {
  UpdateAppStatBody,
  ListAppStatsResponseItem,
} from "@workspace/api-zod";

const KNOWN_APPS = [
  "MyLitAI",
  "MySyalitAI",
  "MyCorpAI",
  "MyConveyAI",
  "MyCrimAI",
  "MyCCBLitAI",
  "MyAccidentAI",
  "MyLawFirmAi",
  "MyLawAcad",
];

const router: IRouter = Router();

router.get("/app-stats", async (_req, res): Promise<void> => {
  const rows = await db.select().from(appStatsTable);
  const rowMap = new Map(rows.map((r) => [r.appName, r]));

  const result = KNOWN_APPS.map((appName) =>
    ListAppStatsResponseItem.parse({
      appName,
      subscriberCount: rowMap.get(appName)?.subscriberCount ?? 0,
      updatedAt: rowMap.get(appName)?.updatedAt ?? new Date(),
    }),
  );

  res.json(result);
});

router.patch("/app-stats/:appName", async (req, res): Promise<void> => {
  const appName = req.params.appName;
  if (!KNOWN_APPS.includes(appName)) {
    res.status(400).json({ error: "Unknown app name" });
    return;
  }

  const parsed = UpdateAppStatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(appStatsTable)
    .values({ appName, subscriberCount: parsed.data.subscriberCount })
    .onConflictDoUpdate({
      target: appStatsTable.appName,
      set: { subscriberCount: parsed.data.subscriberCount },
    })
    .returning();

  res.json(ListAppStatsResponseItem.parse(row));
});

export default router;
