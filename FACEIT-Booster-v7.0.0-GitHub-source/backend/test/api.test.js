const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { AppError } = require("../src/errors");

function setup(handler = async (path) => ({ path })) {
  const calls = [];
  const faceitClient = { get: async (path) => { calls.push(path); return handler(path); } };
  return { app: createApp({ faceitClient, extensionOrigins: ["chrome-extension://abcdefghijklmnopabcdefghijklmnop"] }), calls };
}

test("health endpoint reports ok", async () => {
  const { app } = setup();
  const response = await request(app).get("/health").expect(200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("all API routes map only to the intended FACEIT paths", async () => {
  const { app, calls } = setup();
  await request(app).get("/api/matches/1-ab_cd").expect(200);
  await request(app).get("/api/players/player-1").expect(200);
  await request(app).get("/api/players/player-1/stats").expect(200);
  await request(app).get("/api/players/by-nickname/Test_User").expect(200);
  assert.deepEqual(calls, [
    "/matches/1-ab_cd",
    "/players/player-1",
    "/players/player-1/stats/cs2",
    "/players?nickname=Test_User"
  ]);
});

test("invalid parameters are rejected before calling FACEIT", async () => {
  const { app, calls } = setup();
  await request(app).get("/api/matches/bad%20id").expect(400);
  await request(app).get("/api/players/bad%20id").expect(400);
  await request(app).get("/api/players/by-nickname/bad.name").expect(400);
  assert.equal(calls.length, 0);
});

test("responses are cached", async () => {
  const { app, calls } = setup();
  await request(app).get("/api/players/player-1").expect(200);
  await request(app).get("/api/players/player-1").expect(200);
  assert.equal(calls.length, 1);
});

test("stats falls back to csgo only after a cs2 404", async () => {
  const { app, calls } = setup(async (path) => {
    if (path.endsWith("/cs2")) throw new AppError(404, "missing");
    return { game: "csgo" };
  });
  const response = await request(app).get("/api/players/player-1/stats").expect(200);
  assert.equal(response.body.game, "csgo");
  assert.deepEqual(calls, ["/players/player-1/stats/cs2", "/players/player-1/stats/csgo"]);
});

test("CORS allows the configured extension and rejects other origins", async () => {
  const { app } = setup();
  await request(app).get("/health").set("Origin", "chrome-extension://abcdefghijklmnopabcdefghijklmnop")
    .expect("access-control-allow-origin", "chrome-extension://abcdefghijklmnopabcdefghijklmnop").expect(200);
  const response = await request(app).get("/health").set("Origin", "https://evil.example").expect(403);
  assert.equal(response.body.error.code, "CORS_DENIED");
});

test("FACEIT errors use the centralized JSON error shape", async () => {
  const { app } = setup(async () => { throw new AppError(404, "Match not found", "FACEIT_API_ERROR"); });
  const response = await request(app).get("/api/matches/missing").expect(404);
  assert.deepEqual(response.body, { error: { code: "FACEIT_API_ERROR", message: "Match not found" } });
});
