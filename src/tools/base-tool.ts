import type { KustoService } from "../kusto/service.js";
import type { ServerConfig } from "../config.js";
import { z } from "zod";
import { getLogger } from "@jhzhu89/azure-client-pool";

export const toolLogger = getLogger("tool");

export const baseInputSchema = z.object({
  kusto_cluster_url: z
    .string()
    .describe(
      "Direct Kusto cluster URL (e.g., 'https://mycluster.eastus.kusto.windows.net')",
    ),
  database: z.string().describe("Database name"),
});

export const clusterInputSchema = z.object({
  kusto_cluster_url: z
    .string()
    .describe(
      "Direct Kusto cluster URL (e.g., 'https://mycluster.eastus.kusto.windows.net')",
    ),
});

export interface ServerDependencies {
  kustoService: KustoService;
  config: ServerConfig;
}

export function formatToolResponse<T = any>(data: T, metadata?: any) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function formatErrorResponse(error: unknown, operation: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(error, null, 2) || `Error during ${operation}`,
      },
    ],
    isError: true,
  };
}
