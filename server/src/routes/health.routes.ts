import { Router } from "express";
import { env } from "../config/env";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    supabaseConfigured: env.isSupabaseConfigured,
    timestamp: new Date().toISOString(),
  });
});

export default router;
