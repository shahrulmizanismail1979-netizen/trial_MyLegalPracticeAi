import { Router, type IRouter } from "express";
import {
  GetRecognitionLeaderboardResponse,
  GetRecognitionRecommendationsResponse,
} from "../apiZod";
import { requireManagerSession } from "../lib/managerSession";
import {
  buildLeaderboard,
  buildRecommendations,
} from "../lib/recognitionService";

const router: IRouter = Router();

// Public performance leaderboard.
router.get("/recognition/leaderboard", async (_req, res): Promise<void> => {
  const payload = await buildLeaderboard();
  res.json(GetRecognitionLeaderboardResponse.parse(payload));
});

// Manager-only bonus & promotion recommendations.
router.get("/recognition/recommendations", async (req, res): Promise<void> => {
  if ((await requireManagerSession(req)) == null) {
    res
      .status(403)
      .json({ error: "Only managers can view bonus and promotion recommendations." });
    return;
  }
  const payload = await buildRecommendations();
  res.json(GetRecognitionRecommendationsResponse.parse(payload));
});

export default router;
