import {
  formatToolResponse,
  formatErrorResponse,
  type ServerDependencies,
  baseInputSchema,
  toolLogger,
} from "./base-tool.js";
import { descriptionLoader } from "./description-loader.js";
import { z } from "zod";

const inputSchema = baseInputSchema.extend({
  query: z.string().describe("KQL query to execute"),
});

export const runQueryTool = {
  config: {
    description: descriptionLoader.load("run-query"),
    inputSchema: inputSchema.shape,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    dependencies: ServerDependencies,
  ) => {
    return await runKustoQuery(args, dependencies);
  },
};

export async function runKustoQuery(
  args: z.infer<typeof inputSchema>,
  dependencies: ServerDependencies,
) {
  try {
    toolLogger?.debug("Starting query execution", {
      queryLength: args.query.length,
    });

    const result = await dependencies.kustoService.executeQuery(
      args.database,
      args.query,
    );

    return formatToolResponse(result);
  } catch (error: unknown) {
    return formatErrorResponse(error, "executing query");
  }
}
