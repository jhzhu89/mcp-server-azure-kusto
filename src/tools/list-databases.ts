import {
  formatToolResponse,
  formatErrorResponse,
  type ServerDependencies,
  clusterInputSchema,
  toolLogger,
} from "./base-tool.js";
import { descriptionLoader } from "./description-loader.js";
import { z } from "zod";

const inputSchema = clusterInputSchema;

export const listDatabasesTool = {
  config: {
    description: descriptionLoader.load("list-databases"),
    inputSchema: inputSchema.shape,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    dependencies: ServerDependencies,
  ) => {
    return await listDatabases(args, dependencies);
  },
};

export async function listDatabases(
  args: z.infer<typeof inputSchema>,
  dependencies: ServerDependencies,
) {
  try {
    const result = await dependencies.kustoService.listDatabases();

    toolLogger?.debug("Databases retrieved", {
      databaseCount: result.databases.length,
    });

    return formatToolResponse({
      databases: result.databases,
      executionTime: result.executionTime,
    });
  } catch (error: unknown) {
    return formatErrorResponse(error, "listing databases");
  }
}
