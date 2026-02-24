import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.js";
import { TokenStore } from "./token-store.js";
import { YahooFantasyClient } from "./yahoo-client.js";
import { buildAuthorizationUrl, exchangeCodeForToken, generateState } from "./yahoo-oauth.js";

function textResult(data: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
  };
}

const tools = [
  {
    name: "oauth_status",
    description: "Show whether a Yahoo OAuth token exists and whether it is expired.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "oauth_authorization_url",
    description: "Generate a Yahoo OAuth authorization URL to start login in a browser.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "string", description: "Optional custom state value for CSRF protection." }
      },
      additionalProperties: false
    }
  },
  {
    name: "oauth_exchange_code",
    description: "Exchange the authorization code from Yahoo callback for access and refresh tokens.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "OAuth authorization code from the callback URL." }
      },
      required: ["code"],
      additionalProperties: false
    }
  },
  {
    name: "oauth_refresh",
    description: "Refresh the current Yahoo access token using the saved refresh token.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "oauth_clear",
    description: "Clear the locally saved Yahoo token file.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "fantasy_request",
    description:
      "Call any Yahoo Fantasy API v2 path. Example path: /users;use_login=1/games or /league/{league_key}/standings",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Yahoo Fantasy path, with or without leading slash." },
        params: {
          type: "object",
          description: "Optional query string params.",
          additionalProperties: { type: "string" }
        }
      },
      required: ["path"],
      additionalProperties: false
    }
  },
  {
    name: "fantasy_user_games",
    description: "Convenience endpoint: fetch games for the logged-in Yahoo user.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "diagnostics_run",
    description: "Run basic checks: token status plus a live Yahoo Fantasy API request.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  }
];

export function createYahooFantasyMcpServer(): Server {
  const tokenStore = new TokenStore(config.tokenPath);
  const yahooClient = new YahooFantasyClient(tokenStore);

  const server = new Server(
    { name: "yahoo-fantasy-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments || {}) as Record<string, unknown>;

    if (name === "oauth_status") {
      return textResult(await tokenStore.health());
    }

    if (name === "oauth_authorization_url") {
      const state = typeof args.state === "string" && args.state ? args.state : generateState();
      return textResult({
        state,
        authorizationUrl: buildAuthorizationUrl(state),
        redirectUri: config.redirectUri
      });
    }

    if (name === "oauth_exchange_code") {
      const code = args.code;
      if (typeof code !== "string" || !code.trim()) {
        throw new Error("`code` is required.");
      }
      const token = await exchangeCodeForToken(code.trim());
      await tokenStore.set(token);
      return textResult({
        message: "OAuth code exchanged successfully.",
        expiresAt: new Date(token.expiresAt).toISOString()
      });
    }

    if (name === "oauth_refresh") {
      const token = await yahooClient.refresh();
      return textResult({
        message: "Token refreshed.",
        expiresAt: new Date(token.expiresAt).toISOString()
      });
    }

    if (name === "oauth_clear") {
      await tokenStore.clear();
      return textResult({ message: "Saved token cleared." });
    }

    if (name === "fantasy_request") {
      const path = args.path;
      if (typeof path !== "string" || !path.trim()) {
        throw new Error("`path` is required.");
      }
      const params =
        typeof args.params === "object" && args.params !== null
          ? (args.params as Record<string, string>)
          : undefined;
      const result = await yahooClient.request(path, params);
      return textResult(result);
    }

    if (name === "fantasy_user_games") {
      const result = await yahooClient.request("/users;use_login=1/games");
      return textResult(result);
    }

    if (name === "diagnostics_run") {
      const health = await tokenStore.health();
      if (!health.hasToken) {
        return textResult({
          ok: false,
          health,
          checks: [{ name: "live_api", ok: false, error: "No token found." }]
        });
      }

      try {
        const result = await yahooClient.request("/users;use_login=1/games");
        return textResult({
          ok: true,
          health,
          checks: [{ name: "live_api", ok: true }],
          sample: result
        });
      } catch (error) {
        return textResult({
          ok: false,
          health,
          checks: [{ name: "live_api", ok: false, error: (error as Error).message }]
        });
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}
