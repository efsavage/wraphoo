import dotenv from "dotenv";
import path from "path";

dotenv.config();

const clientId = process.env.YAHOO_CLIENT_ID;
const clientSecret = process.env.YAHOO_CLIENT_SECRET;
const redirectUri = process.env.YAHOO_REDIRECT_URI || "http://localhost:3476/auth/callback";
const scope = process.env.YAHOO_SCOPE || "fspt-r";
const tokenPath = process.env.YAHOO_TOKEN_PATH || path.resolve(process.cwd(), ".yahoo-tokens.json");
const uiPort = Number(process.env.UI_PORT || "3476");

if (!clientId || !clientSecret) {
  throw new Error(
    "Missing Yahoo credentials. Set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET in your environment or .env file."
  );
}

export const config = {
  clientId,
  clientSecret,
  redirectUri,
  scope,
  tokenPath,
  uiPort
};
