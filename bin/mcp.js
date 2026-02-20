#!/usr/bin/env node

// MCP server entry point — implemented in Issue 11
import("../dist/mcp/server.js").catch(() => {
  console.error("MCP server not yet built. Run `npm run build` first.");
  process.exit(1);
});
