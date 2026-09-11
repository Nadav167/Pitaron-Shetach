import express from "express";
import cors from "cors";
import { env } from "./config/env";
import sitesRoutes from "./routes/sites.routes";
import healthRoutes from "./routes/health.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/sites", sitesRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`CampingIL API listening on http://localhost:${env.port}`);
  if (!env.isSupabaseConfigured) {
    // eslint-disable-next-line no-console
    console.warn("Supabase env vars not set — /api/sites will return 500 until server/.env is configured.");
  }
});
