import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import dotenv from "dotenv";
import { createYahooFantasyMcpServer } from "../dist/server.js";

dotenv.config();

const server = createYahooFantasyMcpServer();
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

const client = new Client(
  { name: "yahoo-fantasy-smoke-test", version: "0.1.0" },
  { capabilities: {} }
);

function parseJsonText(content) {
  if (!Array.isArray(content) || content.length === 0 || content[0].type !== "text") {
    return null;
  }
  try {
    return JSON.parse(content[0].text);
  } catch {
    return null;
  }
}

async function run() {
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const list = await client.listTools();
    const toolNames = list.tools.map((t) => t.name);
    console.log("Tools:", toolNames.join(", "));

    const status = await client.callTool({ name: "oauth_status", arguments: {} });
    const statusJson = parseJsonText(status.content);
    console.log("OAuth status:", JSON.stringify(statusJson, null, 2));

    const diagnostics = await client.callTool({ name: "diagnostics_run", arguments: {} });
    const diagnosticsJson = parseJsonText(diagnostics.content);
    console.log("Diagnostics:", JSON.stringify(diagnosticsJson, null, 2));
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
}

run().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exitCode = 1;
});
