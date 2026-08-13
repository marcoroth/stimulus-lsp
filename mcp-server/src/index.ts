import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "./server.js"

async function main() {
  const transport = new StdioServerTransport();
  await Server.connect(transport);
  console.error("Stimulus MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
