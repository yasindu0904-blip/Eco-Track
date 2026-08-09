import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { lookupDsDivisionByCoordinate } from "./services/nsdiService.js";

const app = express();
const backendRoot = path.resolve(__dirname, "..");

app.use(express.json());
app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org"],
      },
    },
  }),
);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/lookup-ds-division", async (req, res) => {
  const { latitude, longitude } = req.body;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return res.status(400).json({ error: "latitude and longitude must be numbers" });
  }

  try {
    const result = await lookupDsDivisionByCoordinate(latitude, longitude);

    if (!result) {
      return res.status(404).json({
        error: "No DS division found for the provided coordinate",
      });
    }

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "NSDI service lookup failed" });
  }
});

app.use(
  "/vendor/leaflet",
  express.static(path.join(backendRoot, "node_modules", "leaflet", "dist")),
);
app.use(express.static(path.join(backendRoot, "public")));

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
