import express from "express";
import { config } from "./config.js";
import { TokenStore } from "./token-store.js";
import { YahooFantasyClient } from "./yahoo-client.js";
import { buildAuthorizationUrl, exchangeCodeForToken, generateState } from "./yahoo-oauth.js";

const app = express();
const tokenStore = new TokenStore(config.tokenPath);
const yahooClient = new YahooFantasyClient(tokenStore);
const pendingStates = new Map<string, number>();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

function pageTemplate(content: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Yahoo Fantasy MCP Setup</title>
  <style>
    :root {
      --bg: #f7f3eb;
      --card: #ffffff;
      --ink: #1f2c3a;
      --accent: #117a65;
      --accent-2: #0f4c81;
      --muted: #667384;
      --border: #d7d9dd;
      --danger: #a73737;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(1200px 600px at -10% -20%, #ffe7c8 0%, transparent 55%),
        radial-gradient(1000px 500px at 120% 0%, #d7f2ec 0%, transparent 50%),
        var(--bg);
      min-height: 100vh;
      padding: 1.5rem;
    }
    .wrap {
      max-width: 900px;
      margin: 0 auto;
      display: grid;
      gap: 1rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1rem 1.2rem;
      box-shadow: 0 4px 18px rgba(17, 35, 63, 0.06);
    }
    h1 { margin: 0; font-size: 1.6rem; }
    h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
    p { margin: 0.4rem 0; color: var(--muted); }
    .row { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.8rem; }
    button, a.button {
      border: 0;
      border-radius: 10px;
      padding: 0.65rem 0.9rem;
      font-size: 0.95rem;
      cursor: pointer;
      color: #fff;
      background: linear-gradient(120deg, var(--accent), var(--accent-2));
      text-decoration: none;
      display: inline-block;
    }
    button.secondary {
      background: #4a5665;
    }
    button.danger {
      background: var(--danger);
    }
    input, textarea {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.6rem;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 0.9rem;
    }
    code, pre {
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 0.88rem;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      background: #f6f8fa;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.8rem;
      max-height: 420px;
      overflow: auto;
    }
    .ok { color: #0f7a4c; font-weight: 600; }
    .bad { color: var(--danger); font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrap">
    ${content}
  </div>
</body>
</html>`;
}

function cleanupStates(): void {
  const cutoff = Date.now() - 15 * 60_000;
  for (const [state, createdAt] of pendingStates.entries()) {
    if (createdAt < cutoff) {
      pendingStates.delete(state);
    }
  }
}

app.get("/", async (_req, res) => {
  const health = await tokenStore.health();
  const statusText = health.hasToken
    ? health.isExpired
      ? `<span class="bad">Token exists, but expired.</span>`
      : `<span class="ok">Token is healthy.</span>`
    : `<span class="bad">No token saved yet.</span>`;

  res.send(
    pageTemplate(`
      <div class="card">
        <h1>Yahoo Fantasy MCP Setup</h1>
        <p>This page helps you connect your Yahoo app and test requests.</p>
      </div>

      <div class="card">
        <h2>1) OAuth Status</h2>
        <p>${statusText}</p>
        <pre>${JSON.stringify(health, null, 2)}</pre>
        <div class="row">
          <a class="button" href="/auth/start">Connect Yahoo Account</a>
          <button class="secondary" onclick="post('/api/refresh')">Refresh Token</button>
          <button class="danger" onclick="post('/api/clear')">Clear Token</button>
        </div>
      </div>

      <div class="card">
        <h2>2) Diagnostics</h2>
        <p>Checks token + live API call to <code>/users;use_login=1/games</code>.</p>
        <div class="row">
          <button onclick="get('/api/diagnostics')">Run Diagnostics</button>
        </div>
      </div>

      <div class="card">
        <h2>3) Test Any Endpoint</h2>
        <p>Use a path like <code>/league/423.l.12345/standings</code></p>
        <label>Path</label>
        <input id="path" value="/users;use_login=1/games" />
        <label style="margin-top:0.6rem;display:block;">Optional JSON query params</label>
        <textarea id="params" rows="5">{}</textarea>
        <div class="row">
          <button onclick="testRequest()">Send Request</button>
        </div>
      </div>

      <div class="card">
        <h2>Result</h2>
        <pre id="output">No request sent yet.</pre>
      </div>

      <script>
        const output = document.getElementById('output');
        function show(data) {
          output.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        }
        async function get(url) {
          try {
            const r = await fetch(url);
            show(await r.json());
          } catch (e) {
            show(String(e));
          }
        }
        async function post(url, body) {
          try {
            const r = await fetch(url, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: body ? JSON.stringify(body) : undefined
            });
            show(await r.json());
          } catch (e) {
            show(String(e));
          }
        }
        async function testRequest() {
          const path = document.getElementById('path').value;
          const raw = document.getElementById('params').value || '{}';
          let params;
          try {
            params = JSON.parse(raw);
          } catch {
            show({ok:false,error:'Params must be valid JSON.'});
            return;
          }
          await post('/api/test-request', { path, params });
        }
      </script>
    `)
  );
});

app.get("/auth/start", (_req, res) => {
  cleanupStates();
  const state = generateState();
  pendingStates.set(state, Date.now());
  const url = buildAuthorizationUrl(state);
  res.redirect(url);
});

app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  const error = req.query.error;

  if (typeof error === "string") {
    res.status(400).send(pageTemplate(`<div class="card"><h2>Yahoo returned an error</h2><pre>${error}</pre></div>`));
    return;
  }

  if (typeof code !== "string" || !code) {
    res.status(400).send(pageTemplate(`<div class="card"><h2>Missing code</h2><p>Callback did not include an OAuth code.</p></div>`));
    return;
  }

  if (typeof state !== "string" || !pendingStates.has(state)) {
    res.status(400).send(
      pageTemplate(`<div class="card"><h2>State validation failed</h2><p>Start login again from this app.</p></div>`)
    );
    return;
  }

  try {
    pendingStates.delete(state);
    const token = await exchangeCodeForToken(code);
    await tokenStore.set(token);
    res.send(
      pageTemplate(`
        <div class="card">
          <h2>Success</h2>
          <p>Your Yahoo token has been saved.</p>
          <pre>${JSON.stringify(
            {
              expiresAt: new Date(token.expiresAt).toISOString(),
              scope: token.scope
            },
            null,
            2
          )}</pre>
          <div class="row"><a class="button" href="/">Back to Setup Page</a></div>
        </div>
      `)
    );
  } catch (err) {
    const message = (err as Error).message;
    res.status(500).send(
      pageTemplate(`
        <div class="card">
          <h2>Token exchange failed</h2>
          <pre>${message}</pre>
          <p>Runtime redirect URI:</p>
          <pre>${config.redirectUri}</pre>
          <p>This must exactly match the Yahoo app redirect URI and the URL used for the current login attempt.</p>
        </div>
      `)
    );
  }
});

app.get("/api/status", async (_req, res) => {
  res.json(await tokenStore.health());
});

app.post("/api/refresh", async (_req, res) => {
  try {
    const refreshed = await yahooClient.refresh();
    res.json({
      ok: true,
      expiresAt: new Date(refreshed.expiresAt).toISOString()
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

app.post("/api/clear", async (_req, res) => {
  await tokenStore.clear();
  res.json({ ok: true, message: "Token file deleted." });
});

app.get("/api/diagnostics", async (_req, res) => {
  const health = await tokenStore.health();
  try {
    const sample = await yahooClient.request("/users;use_login=1/games");
    res.json({ ok: true, health, sample });
  } catch (error) {
    res.status(400).json({ ok: false, health, error: (error as Error).message });
  }
});

app.post("/api/test-request", async (req, res) => {
  const path = req.body?.path;
  const params = req.body?.params;
  if (typeof path !== "string" || !path.trim()) {
    res.status(400).json({ ok: false, error: "`path` is required." });
    return;
  }

  try {
    const data = await yahooClient.request(path, params);
    res.json({ ok: true, data });
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

app.listen(config.uiPort, () => {
  console.log(`Yahoo setup UI: http://127.0.0.1:${config.uiPort}`);
});
