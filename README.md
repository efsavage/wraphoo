# Yahoo Fantasy MCP Server

An MCP server + local setup UI for the Yahoo Fantasy Sports API.

You can use this in other projects (Cursor, Claude Desktop, custom MCP clients) and avoid hand-writing OAuth flows each time.

## What You Get
- MCP server over `stdio` for Yahoo Fantasy API calls.
- Local web UI to do OAuth login in a browser.
- Token storage + automatic refresh.
- Diagnostics and endpoint testing.

## Before You Start
You already created a Yahoo app. Good.

Make sure your Yahoo app has this callback URL:
- `http://localhost:3476/auth/callback`

If your callback differs, set `YAHOO_REDIRECT_URI` to match exactly.

## 1) Install
```bash
npm install
```

## 2) Configure Credentials
Create `.env` from the template:

```bash
cp .env.example .env
```

Open `.env` and set:
- `YAHOO_CLIENT_ID`
- `YAHOO_CLIENT_SECRET`
- optionally `YAHOO_REDIRECT_URI`, `UI_PORT`, `YAHOO_TOKEN_PATH`

Important:
- Do not commit `.env`.
- If you shared your client secret publicly, rotate it in Yahoo developer settings.

## 3) Run the Setup UI (Recommended First)
```bash
npm run dev:ui
```

Open:
- `http://localhost:3476`

Use the page to:
1. Click `Connect Yahoo Account`
2. Approve Yahoo access
3. Return to callback and save token
4. Run diagnostics
5. Test any endpoint

If everything works, your token is saved in:
- `./.yahoo-tokens.json` (or `YAHOO_TOKEN_PATH` if you changed it)

## 4) Run the MCP Server
For development:
```bash
npm run dev:mcp
```

For production:
```bash
npm run build
npm run start:mcp
```

## MCP Tools Included
- `oauth_status`
- `oauth_authorization_url`
- `oauth_exchange_code`
- `oauth_refresh`
- `oauth_clear`
- `fantasy_request`
- `fantasy_user_games`
- `diagnostics_run`

## Claude Desktop Setup (Step-by-Step)
This is the easiest way to use the server in a real assistant workflow.

1. Build once:
```bash
npm run build
```

2. Find Claude Desktop config file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

3. Add this server entry (merge with your existing JSON if needed):
```json
{
  "mcpServers": {
    "yahoo-fantasy": {
      "command": "node",
      "args": ["/home/efs/wraphoo/dist/mcp.js"],
      "env": {
        "YAHOO_CLIENT_ID": "YOUR_CLIENT_ID",
        "YAHOO_CLIENT_SECRET": "YOUR_CLIENT_SECRET",
        "YAHOO_REDIRECT_URI": "http://localhost:3476/auth/callback",
        "YAHOO_SCOPE": "fspt-r",
        "YAHOO_TOKEN_PATH": "/home/efs/wraphoo/.yahoo-tokens.json"
      }
    }
  }
}
```

4. Restart Claude Desktop completely.

5. In Claude, ask:
- `Use the yahoo-fantasy MCP server and run oauth_status.`

If you get token errors, complete OAuth first via:
```bash
npm run dev:ui
```
Then open `http://localhost:3476`.

If Yahoo requires HTTPS redirect URIs, run an HTTPS tunnel (for example `ngrok http 3476`) and set:
- Yahoo app redirect URI: `https://YOUR-NGROK-DOMAIN/auth/callback`
- `YAHOO_REDIRECT_URI` to that exact same value

## Useful Claude Prompt Examples
You can paste these directly into Claude Desktop.

1. Basic health check:
- `Use yahoo-fantasy tools to run diagnostics_run. If it fails, explain the exact fix in plain English.`

2. Find your league keys:
- `Use fantasy_user_games and list all my game and league keys in a table.`

3. Get standings for one league:
- `Use fantasy_request with path /league/423.l.12345/standings and summarize the top 5 teams.`

4. Get team roster:
- `Use fantasy_request with path /team/423.l.12345.t.7/roster and format players by position.`

5. Player stats:
- `Use fantasy_request with path /player/423.p.5479/stats and explain the key numbers.`

6. Multi-step analysis:
- `Use yahoo-fantasy MCP tools to find my current NFL fantasy league, fetch standings, then identify which teams are within 1 game of first place.`

## Example MCP Client Config
Use a command that starts the MCP server with your `.env` loaded.

Example idea (adjust to your client):
```json
{
  "mcpServers": {
    "yahoo-fantasy": {
      "command": "npx",
      "args": ["tsx", "src/mcp.ts"],
      "cwd": "/home/efs/wraphoo",
      "env": {
        "YAHOO_CLIENT_ID": "YOUR_CLIENT_ID",
        "YAHOO_CLIENT_SECRET": "YOUR_CLIENT_SECRET",
        "YAHOO_REDIRECT_URI": "http://localhost:3476/auth/callback"
      }
    }
  }
}
```

You can also point to built files:
- command: `node`
- args: `["dist/mcp.js"]` (after `npm run build`)
- For Claude Desktop, prefer built files over `tsx` for reliability.

## Common Endpoint Examples
Use these in the UI tester or `fantasy_request` tool:
- `/users;use_login=1/games`
- `/league/{league_key}/standings`
- `/team/{team_key}/roster`
- `/player/{player_key}/stats`

## Troubleshooting
- Redirect mismatch:
  - Yahoo app callback and `YAHOO_REDIRECT_URI` must be identical.
  - `localhost` and `127.0.0.1` are different values; use the same one in both places.
- `No token found`:
  - Complete OAuth in the setup UI first.
- Token expired:
  - Run refresh in UI or `oauth_refresh` tool.
- 401 / invalid token:
  - Clear token and reconnect from UI.

## Architecture (Quick)
- `src/mcp.ts`: MCP stdio server
- `src/ui.ts`: local setup + diagnostics UI
- `src/yahoo-oauth.ts`: OAuth URL/exchange/refresh
- `src/yahoo-client.ts`: authenticated API requests
- `src/token-store.ts`: persistent token file handling
