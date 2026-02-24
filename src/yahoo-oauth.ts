import { randomBytes } from "crypto";
import { config } from "./config.js";
import { YahooTokenRecord } from "./types.js";

type YahooTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

const AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";
const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const token = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

function normalizeTokenResponse(data: YahooTokenResponse): YahooTokenRecord {
  const now = Date.now();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: now + data.expires_in * 1000,
    tokenType: data.token_type,
    scope: data.scope,
    obtainedAt: new Date(now).toISOString()
  };
}

export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthorizationUrl(state: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  return url.toString();
}

async function requestToken(form: URLSearchParams): Promise<YahooTokenRecord> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(config.clientId, config.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Yahoo token request failed (${response.status}): ${raw}`);
  }

  const parsed = JSON.parse(raw) as YahooTokenResponse;
  return normalizeTokenResponse(parsed);
}

export async function exchangeCodeForToken(code: string): Promise<YahooTokenRecord> {
  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", config.redirectUri);
  form.set("code", code);
  return requestToken(form);
}

export async function refreshAccessToken(refreshToken: string): Promise<YahooTokenRecord> {
  const form = new URLSearchParams();
  form.set("grant_type", "refresh_token");
  form.set("redirect_uri", config.redirectUri);
  form.set("refresh_token", refreshToken);
  return requestToken(form);
}
