
// Change this one value after deploying the backend.
const BACKEND_BASE_URL = "https://faceit-booster-api.onrender.com";
const DEFAULTS = {
  enabled: true,
  autoAnalyze: true,
  showTeamElo: true,
  showFlags: true,
  showPerformance: true,
  showSmurfRisk: true,
  showEloEstimate: true,
  highlightTeamLeaders: true,
  compactMode: false,
  autoReady: false,
  autoParty: false,
  readyDelay: 3,
  partyDelay: 3,
  nickname: ""
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(DEFAULTS);
  await chrome.storage.sync.set(current);
});

async function getSettings() {
  return chrome.storage.sync.get(DEFAULTS);
}

async function request(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response;

  try {
    response = await fetch(BACKEND_BASE_URL + path, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("The FACEIT Booster server took too long to respond. Please try again.");
    }
    throw new Error("Could not reach the FACEIT Booster server. Please try again.");
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (_) {}

  if (!response.ok) {
    const detail = data?.error?.message || data?.message || raw || "Request failed";
    throw new Error(`Backend ${response.status}: ${String(detail).slice(0, 180)}`);
  }
  return data;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "GET_MATCH") {
        sendResponse({ok: true, data: await request(`/api/matches/${encodeURIComponent(msg.matchId)}`)});
      } else if (msg?.type === "GET_PLAYER") {
        sendResponse({ok: true, data: await request(`/api/players/${encodeURIComponent(msg.playerId)}`)});
      } else if (msg?.type === "GET_PLAYER_STATS") {
        sendResponse({ok: true, data: await request(`/api/players/${encodeURIComponent(msg.playerId)}/stats`)});
      } else if (msg?.type === "GET_PLAYER_BY_NICKNAME") {
        sendResponse({ok: true, data: await request(`/api/players/by-nickname/${encodeURIComponent(msg.nickname)}`)});
      } else if (msg?.type === "GET_SETTINGS") {
        sendResponse({ok: true, data: await getSettings()});
      } else {
        sendResponse({ok: false, error: "Unknown request"});
      }
    } catch (e) {
      sendResponse({ok: false, error: e?.message || String(e)});
    }
  })();
  return true;
});
