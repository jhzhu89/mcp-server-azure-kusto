import {
  formatToolResponse,
  formatErrorResponse,
  type ServerDependencies,
  baseInputSchema,
} from "./base-tool.js";
import { descriptionLoader } from "./description-loader.js";
import { z } from "zod";

const inputSchema = baseInputSchema;

export const listFunctionsTool = {
  config: {
    description: descriptionLoader.load("list-functions"),
    inputSchema: inputSchema.shape,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    dependencies: ServerDependencies,
  ) => {
    return await listFunctions(args, dependencies);
  },
};

export async function listFunctions(
  args: z.infer<typeof inputSchema>,
  dependencies: ServerDependencies,
) {
  try {
    const result = await dependencies.kustoService.listFunctions(args.database);

    return formatToolResponse({
      functions: result.functions,
      executionTime: result.executionTime,
    });
  } catch (error: unknown) {
    return formatErrorResponse(error, "listing functions");
  }
}
