/**
 * Show the current state of all pilot-v1 containers and their pending jobs.
 */
import { db, researchSourceContainers, researchJobs, researchCaseCandidates } from "@workspace/db";
import { like, inArray, and, sql } from "drizzle-orm";

const containers = await db
  .select()
  .from(researchSourceContainers)
  .where(like(researchSourceContainers.sourceBatch, "pilot-v1%"));

console.log(`\nPilot-v1 containers (${containers.length}):`);
for (const c of containers) {
  console.log(`  #${c.id}  ${c.originalName.padEnd(36)} ${c.processingState.padEnd(30)} rights:${c.rightsStatus}`);
}

if (containers.length > 0) {
  const ids = containers.map((c) => c.id);

  // Jobs
  const allJobs = await db.select().from(researchJobs);
  const relevant = allJobs.filter((j) => {
    const p = j.payload as Record<string, unknown>;
    return p?.containerId && ids.includes(p.containerId as number);
  });
  console.log(`\nRelevant jobs (${relevant.length}):`);
  for (const j of relevant) {
    const p = j.payload as Record<string, unknown>;
    console.log(`  #${j.id}  ${j.kind.padEnd(35)} ${j.state.padEnd(20)} cid:${p.containerId}`);
  }

  // Candidates
  const candidates = await db
    .select()
    .from(researchCaseCandidates)
    .where(inArray(researchCaseCandidates.containerId, ids));
  console.log(`\nCandidates (${candidates.length}):`);
  for (const c of candidates) {
    console.log(`  #${c.id}  cid:${c.containerId}  status:${c.reviewStatus ?? "null"}`);
  }
}
process.exit(0);
