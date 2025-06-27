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
  functionName: z.string().describe("Name of the function to get schema for"),
});

export const getFunctionSchemaTool = {
  config: {
    description: descriptionLoader.load("get-function-schema"),
    inputSchema: inputSchema.shape,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    dependencies: ServerDependencies,
  ) => {
    try {
      const { functionName, database } = args;
      const { kustoService } = dependencies;

      const result = await kustoService.getFunctionSchema(
        database,
        functionName,
      );

      return formatToolResponse(result);
    } catch (error) {
      toolLogger?.error("Failed to get function schema", {
        functionName: args.functionName,
        error: error instanceof Error ? error.message : "Unknown",
      });
      return formatErrorResponse(error, "get function schema");
    }
  },
};
