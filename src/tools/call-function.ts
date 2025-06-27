import {
  formatToolResponse,
  formatErrorResponse,
  type ServerDependencies,
  baseInputSchema,
} from "./base-tool.js";
import { descriptionLoader } from "./description-loader.js";
import { z } from "zod";

const inputSchema = baseInputSchema.extend({
  function_name: z.string().describe("Name of the stored function to execute"),
  arguments: z
    .record(z.any())
    .optional()
    .describe("Arguments to pass to the function as key-value pairs"),
  pipeline: z
    .string()
    .optional()
    .describe(
      "Optional KQL pipeline operations to apply to function results (must start with '|')",
    ),
});

export const callFunctionTool = {
  config: {
    description: descriptionLoader.load("call-function"),
    inputSchema: inputSchema.shape,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    dependencies: ServerDependencies,
  ) => {
    return await callFunction(args, dependencies);
  },
};

export async function callFunction(
  args: z.infer<typeof inputSchema>,
  dependencies: ServerDependencies,
) {
  try {
    await dependencies.kustoService.verifyFunctionParams(
      args.database,
      args.function_name,
      args.arguments ?? {},
    );

    const result = await dependencies.kustoService.executeFunction(
      args.database,
      args.function_name,
      args.arguments ?? {},
      args.pipeline,
    );

    return formatToolResponse(result);
  } catch (error: unknown) {
    return formatErrorResponse(error, "calling function");
  }
}
