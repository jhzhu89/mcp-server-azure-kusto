import {
  formatToolResponse,
  formatErrorResponse,
  type ServerDependencies,
  baseInputSchema,
} from "./base-tool.js";
import { descriptionLoader } from "./description-loader.js";
import { z } from "zod";

const inputSchema = baseInputSchema;

export const listTablesTool = {
  config: {
    description: descriptionLoader.load("list-tables"),
    inputSchema: inputSchema.shape,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    dependencies: ServerDependencies,
  ) => {
    return await listTables(args, dependencies);
  },
};

export async function listTables(
  args: z.infer<typeof inputSchema>,
  dependencies: ServerDependencies,
) {
  try {
    const result = await dependencies.kustoService.listTables(args.database);

    return formatToolResponse(result);
  } catch (error: unknown) {
    return formatErrorResponse(error, "listing tables");
  }
}
