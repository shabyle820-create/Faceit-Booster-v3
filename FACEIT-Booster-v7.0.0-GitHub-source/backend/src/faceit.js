const { FACEIT_API_BASE_URL } = require("./config");
const { AppError } = require("./errors");

function createFaceitClient(apiKey, fetchImpl = global.fetch) {
  if (!apiKey) throw new Error("FACEIT_API_KEY is required");

  async function get(path) {
    const response = await fetchImpl(`${FACEIT_API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { /* handled below */ }

    if (!response.ok) {
      const detail = data?.errors?.[0]?.message || data?.message || "FACEIT request failed";
      throw new AppError(response.status, detail, "FACEIT_API_ERROR");
    }
    return data;
  }

  return { get };
}

module.exports = { createFaceitClient };
