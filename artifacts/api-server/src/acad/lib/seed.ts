import { db } from "@workspace/db";
import { appsTable } from "@workspace/db/acad";
import { notInArray } from "drizzle-orm";
import { APPS_SEED } from "./apps-data";
import { logger } from "../../lib/logger";

export async function seedApps(): Promise<void> {
  for (const app of APPS_SEED) {
    await db
      .insert(appsTable)
      .values(app)
      .onConflictDoUpdate({
        target: appsTable.slug,
        set: {
          name: app.name,
          domain: app.domain,
          tagline: app.tagline,
          description: app.description,
          accentColor: app.accentColor,
          category: app.category,
          features: app.features,
        },
      });
  }

  // Prune any apps that are no longer part of the canonical seed (e.g. legacy
  // hallucinated entries from earlier iterations). Templates store app slugs in
  // a JSONB array (no FK), so removal is safe — stale slugs in old templates
  // simply have no matching app and are skipped by question generation.
  const validSlugs = APPS_SEED.map((a) => a.slug);
  const removed = await db
    .delete(appsTable)
    .where(notInArray(appsTable.slug, validSlugs))
    .returning({ slug: appsTable.slug });

  if (removed.length > 0) {
    logger.info(
      { removed: removed.map((r) => r.slug) },
      "Pruned obsolete apps not in seed",
    );
  }

  logger.info({ count: APPS_SEED.length }, "Seeded apps");
}
