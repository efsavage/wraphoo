import { TokenStore } from "./token-store.js";
import { refreshAccessToken } from "./yahoo-oauth.js";
import { YahooTokenRecord } from "./types.js";

const FANTASY_BASE_URL = "https://fantasysports.yahooapis.com/fantasy/v2";

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new Error("Path is required.");
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export class YahooFantasyClient {
  constructor(private readonly tokenStore: TokenStore) {}

  private async getValidToken(): Promise<YahooTokenRecord> {
    const token = await this.tokenStore.get();
    if (!token) {
      throw new Error("No token found. Complete OAuth first.");
    }

    const now = Date.now();
    const expiresSoon = token.expiresAt - now < 45_000;
    if (!expiresSoon) {
      return token;
    }

    const refreshed = await refreshAccessToken(token.refreshToken);
    await this.tokenStore.set(refreshed);
    return refreshed;
  }

  async refresh(): Promise<YahooTokenRecord> {
    const token = await this.tokenStore.get();
    if (!token) {
      throw new Error("No token found. Complete OAuth first.");
    }
    const refreshed = await refreshAccessToken(token.refreshToken);
    await this.tokenStore.set(refreshed);
    return refreshed;
  }

  async request(path: string, params?: Record<string, string>): Promise<unknown> {
    const token = await this.getValidToken();
    const endpoint = new URL(`${FANTASY_BASE_URL}${normalizePath(path)}`);
    endpoint.searchParams.set("format", "json");

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        endpoint.searchParams.set(key, value);
      }
    }

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`
      }
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Yahoo API request failed (${response.status}): ${raw}`);
    }

    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }
}
