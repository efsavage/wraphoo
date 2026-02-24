import process from "node:process";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createYahooFantasyMcpServer } from "./server.js";

const server = createYahooFantasyMcpServer();
const transport = new StdioServerTransport();

await server.connect(transport);
process.stdin.resume();
