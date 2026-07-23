import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { getAdapters } from "../adapters";
import { registerContainer, listContainers } from "../data/containers";
import { enqueue } from "../processing";

// Web layer of the research module. Mounted at /api/research behind staff
// auth (see routes/index.ts in the API server). Phase 00 exposes only a
// health probe and a minimal container registration endpoint used by tests;
// ingestion UX arrives in Phase 01.

const router: IRouter = Router();

router.get("/health", (_req, res) => {
  const adapters = getAdapters();
  res.json({
    status: "ok",
    phase: "01",
    adapters: {
      storage: adapters.storage.name,
      ocr: { name: adapters.ocr.name, enabled: adapters.ocr.isEnabled() },
      search: adapters.search.name,
      ai: { name: adapters.ai.name, enabled: adapters.ai.isEnabled() },
    },
  });
});

const RegisterContainerBody = z.object({
  originalName: z.string().min(1),
  sourceBatch: z.string().min(1),
  contentSha256: z.string().length(64),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string().optional(),
});

router.post("/containers", async (req, res) => {
  const parsed = RegisterContainerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return;
  }
  const container = await registerContainer({
    ...parsed.data,
    provenance: {
      enteredVia: "api",
      registeredAt: new Date().toISOString(),
    },
  });
  await enqueue(
    "container.registered",
    `container-registered-${container.id}`,
    { containerId: container.id },
    {
      processorVersion: "container.registered@1",
      sourceChecksum: container.contentSha256,
      provenance: { containerId: container.id },
    },
  );
  res.status(201).json(container);
});

router.get("/containers", async (_req, res) => {
  res.json(await listContainers());
});

export default router;
