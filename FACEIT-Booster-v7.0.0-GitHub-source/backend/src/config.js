const FACEIT_API_BASE_URL = "https://open.faceit.com/data/v4";

function getConfig() {
  const extensionIds = String(process.env.CHROME_EXTENSION_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return {
    faceitApiKey: String(process.env.FACEIT_API_KEY || "").trim(),
    extensionOrigins: extensionIds.map((id) => `chrome-extension://${id}`),
    port: Number(process.env.PORT) || 3000
  };
}

module.exports = { FACEIT_API_BASE_URL, getConfig };
