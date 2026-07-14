const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const NodeCache = require("node-cache");
const { AppError } = require("./errors");
const { validateMatchId, validatePlayerId, validateNickname } = require("./validation");

function createApp({ faceitClient, extensionOrigins = [], cache = new NodeCache() }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(cors({
    origin(origin, callback) {
      if (!origin || extensionOrigins.includes(origin)) return callback(null, true);
      return callback(new AppError(403, "Origin is not allowed", "CORS_DENIED"));
    },
    methods: ["GET"],
    allowedHeaders: ["Accept"]
  }));

  app.use(rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many requests" } }
  }));

  const cached = (ttl, loader) => async (req, res, next) => {
    try {
      const key = req.originalUrl;
      const hit = cache.get(key);
      if (hit !== undefined) return res.json(hit);
      const data = await loader(req);
      cache.set(key, data, ttl);
      res.json(data);
    } catch (error) { next(error); }
  };

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/matches/:matchId", validateMatchId,
    cached(15, (req) => faceitClient.get(`/matches/${encodeURIComponent(req.params.matchId)}`)));
  app.get("/api/players/by-nickname/:nickname", validateNickname,
    cached(300, (req) => faceitClient.get(`/players?nickname=${encodeURIComponent(req.params.nickname)}`)));
  app.get("/api/players/:playerId/stats", validatePlayerId, cached(120, async (req) => {
    const id = encodeURIComponent(req.params.playerId);
    try { return await faceitClient.get(`/players/${id}/stats/cs2`); }
    catch (error) {
      if (error.status !== 404) throw error;
      return faceitClient.get(`/players/${id}/stats/csgo`);
    }
  }));
  app.get("/api/players/:playerId", validatePlayerId,
    cached(300, (req) => faceitClient.get(`/players/${encodeURIComponent(req.params.playerId)}`)));

  app.use((_req, _res, next) => next(new AppError(404, "Route not found", "NOT_FOUND")));
  app.use((error, _req, res, _next) => {
    const status = Number(error.status) || 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    res.status(safeStatus).json({ error: {
      code: error.code || "INTERNAL_ERROR",
      message: safeStatus === 500 ? "Internal server error" : error.message
    }});
  });

  return app;
}

module.exports = { createApp };
