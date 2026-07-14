import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/health", (_req, res): void => {
  res.json({ status: "ok", service: "ccb" });
});

export default router;
