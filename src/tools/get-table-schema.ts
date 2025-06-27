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
  table_name: z.string().describe("Name of the table to get schema for"),
});

export const getTableSchemaTool = {
  config: {
    description: descriptionLoader.load("get-table-schema"),
    inputSchema: inputSchema.shape,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    dependencies: ServerDependencies,
  ) => {
    return await getTableSchema(args, dependencies);
  },
};

export async function getTableSchema(
  args: z.infer<typeof inputSchema>,
  dependencies: ServerDependencies,
) {
  try {
    toolLogger?.debug("Starting getTableSchema", {
      tableName: args.table_name,
      database: args.database,
    });

    const result = await dependencies.kustoService.getTableSchema(
      args.table_name,
      args.database,
    );

    if (!result) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Table '${args.table_name}' not found`,
          },
        ],
      };
    }

    toolLogger?.debug("getTableSchema completed successfully", {
      tableName: result.schema.name,
      columnCount: result.schema.columns.length,
      executionTime: result.executionTime,
    });

    return formatToolResponse(result);
  } catch (error: unknown) {
    toolLogger?.error("getTableSchema failed", {
      tableName: args.table_name,
      database: args.database,
      error: error instanceof Error ? error.message : String(error),
    });

    return formatErrorResponse(error, "getting table schema");
  }
}
