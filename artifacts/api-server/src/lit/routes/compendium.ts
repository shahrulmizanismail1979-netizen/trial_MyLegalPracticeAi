import { Router, type IRouter } from "express";
import { compendium, compendiumMeta } from "../lib/compendium";

const router: IRouter = Router();

// GET /api/compendium — full Compendium of Personal Injury Awards (meta + all categories)
router.get("/", (_req, res) => {
  res.json({ meta: compendiumMeta, categories: compendium });
});

// GET /api/compendium/:slug — a single injury category
router.get("/:slug", (req, res) => {
  const category = compendium.find((c) => c.slug === (req.params.slug as string));
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json({ meta: compendiumMeta, category });
});

export default router;
