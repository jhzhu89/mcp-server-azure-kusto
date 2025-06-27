import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./services/server-factory.js";
import { getLogger } from "@jhzhu89/azure-client-pool";
import { getAuthMode } from "./config/auth-config.js";

const serverLogger = getLogger("server");

const app = express();
app.use(express.json());

const authMode = getAuthMode();

serverLogger.info(`Azure Kusto MCP Server initialized - authMode: ${authMode}`);

app.post("/mcp", async (req, res) => {
  serverLogger.debug("MCP request received");
  try {
    // Create a new server instance for each request to ensure proper isolation
    const server = await createServer();

    serverLogger.debug(`Server created, connecting... - authMode: ${authMode}`);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      serverLogger.debug("Connection closed");
      transport.close();
      server.close();
    });

    await server.connect(transport);
    serverLogger.debug("Transport connected");
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    serverLogger.error(
      `MCP request failed: ${err instanceof Error ? err.message : err}`,
    );
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req, res) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    }),
  );
});

app.delete("/mcp", async (req, res) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    }),
  );
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.listen(PORT, () => {
  serverLogger.info(`Azure Kusto MCP Server listening on port: ${PORT}`);
});
