require("dotenv").config();
const { getConfig } = require("./config");
const { createFaceitClient } = require("./faceit");
const { createApp } = require("./app");

const config = getConfig();
if (!config.faceitApiKey) throw new Error("FACEIT_API_KEY is required");
if (!config.extensionOrigins.length) throw new Error("CHROME_EXTENSION_IDS is required");

const app = createApp({
  faceitClient: createFaceitClient(config.faceitApiKey),
  extensionOrigins: config.extensionOrigins
});

app.listen(config.port, () => console.log(`FACEIT Booster backend listening on port ${config.port}`));
