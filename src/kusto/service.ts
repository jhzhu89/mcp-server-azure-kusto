import {
  Client as AzureKustoSdkClient,
  KustoResponseDataSet,
  ClientRequestProperties,
} from "azure-kusto-data";
import {
  QueryResult,
  TableListResult,
  FunctionListResult,
  SchemaResult,
  FunctionSchemaResult,
  Column,
  DatabaseListResult,
} from "./types.js";
import { getLogger } from "@jhzhu89/azure-client-pool";
import { config } from "../config.js";

const serviceLogger = getLogger("kusto-service");

function formatExecutionTime(ms: number): string {
  return `${(ms / 1000).toFixed(3)}s`;
}

async function withPerfLogging<T>(
  operation: string,
  context: Record<string, any>,
  fn: () => Promise<T>,
): Promise<T> {
  const startTime = Date.now();
  serviceLogger?.debug(`executing ${operation}`, context);

  try {
    const result = await fn();
    const executionTime = Date.now() - startTime;
    serviceLogger?.debug(`${operation} completed`, {
      ...context,
      executionTime: formatExecutionTime(executionTime),
    });
    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    serviceLogger?.error(`${operation} failed`, {
      ...context,
      executionTime: formatExecutionTime(executionTime),
      error: error instanceof Error ? error.message : "Unknown",
    });
    throw error;
  }
}

export class KustoService {
  constructor(private readonly sdkClient: AzureKustoSdkClient) {}

  async executeQuery(
    database: string | null,
    query: string,
  ): Promise<QueryResult> {
    return withPerfLogging(
      "kusto query",
      { database, queryLength: query.length },
      async () => {
        const startTime = Date.now();
        const response = await this.executeWithTimeout(
          database,
          query,
          "query",
        );
        const transformResult = this.transformResponse(response);
        const limitedResult = this.applyQueryLimits(transformResult, query);

        return {
          columns: limitedResult.columns,
          data: limitedResult.data,
          rowCount: limitedResult.data.length,
          executionTime: Date.now() - startTime,
          warning: limitedResult.warning,
          suggestion: limitedResult.suggestion,
          truncated: limitedResult.truncated,
          originalRowCount: limitedResult.originalRowCount,
        };
      },
    );
  }

  async executeFunction(
    database: string | null,
    name: string,
    args: Record<string, any>,
    pipeline?: string,
  ): Promise<QueryResult> {
    return withPerfLogging(
      "kusto function",
      { database, functionName: name, argCount: Object.keys(args).length },
      async () => {
        const startTime = Date.now();
        const functionParams = await this.getFunctionParameters(database, name);

        const decls: string[] = [];
        const callArgs: string[] = [];
        const crp = new ClientRequestProperties();

        for (const param of functionParams) {
          const paramValue = args[param.name];

          if (paramValue !== undefined) {
            decls.push(`${param.name}: ${param.type}`);
            callArgs.push(param.name);
            crp.setParameter(param.name, paramValue);
          } else if (!param.hasDefaultValue) {
            throw new Error(`Required parameter '${param.name}' is missing`);
          }
        }

        let query =
          decls.length > 0
            ? `declare query_parameters(${decls.join(", ")});
${name}(${callArgs.join(", ")})`
            : `${name}()`;

        if (pipeline) {
          const validatedPipeline = this.validatePipeline(pipeline);
          query += `\n${validatedPipeline}`;
        }

        const response = await this.executeWithTimeout(
          database,
          query,
          "query",
          crp,
        );
        const transformResult = this.transformResponse(response);
        const limitedResult = this.applyQueryLimits(transformResult, query);

        return {
          columns: limitedResult.columns,
          data: limitedResult.data,
          rowCount: limitedResult.data.length,
          executionTime: Date.now() - startTime,
          warning: limitedResult.warning,
          suggestion: limitedResult.suggestion,
          truncated: limitedResult.truncated,
          originalRowCount: limitedResult.originalRowCount,
        };
      },
    );
  }

  async listTables(database: string | null): Promise<TableListResult> {
    return withPerfLogging("list tables", { database }, async () => {
      const startTime = Date.now();
      const query =
        ".show tables | project Folder, TableName, DatabaseName, DocString | order by TableName asc";
      const response = await this.executeWithTimeout(
        database,
        query,
        "metadata",
      );
      const result = this.transformResponse(response);

      const tables = result.data.map((row: Record<string, any>) => ({
        folder: row.Folder as string | undefined,
        name: row.TableName as string,
        databaseName: row.DatabaseName as string,
        description: row.DocString as string | undefined,
      }));

      return {
        tables,
        executionTime: Date.now() - startTime,
      };
    });
  }

  async listFunctions(database: string | null): Promise<FunctionListResult> {
    return withPerfLogging("list functions", { database }, async () => {
      const startTime = Date.now();
      const query =
        ".show functions | project Folder, Name, DocString | order by Name asc";
      const response = await this.executeWithTimeout(
        database,
        query,
        "metadata",
      );
      const result = this.transformResponse(response);

      const functions = result.data.map((row: Record<string, any>) => ({
        folder: row.Folder as string | undefined,
        name: row.Name as string,
        description: row.DocString as string | undefined,
      }));

      return {
        functions,
        executionTime: Date.now() - startTime,
      };
    });
  }

  async listDatabases(): Promise<DatabaseListResult> {
    return withPerfLogging("list databases", {}, async () => {
      const startTime = Date.now();
      const query =
        ".show databases | project DatabaseName, PrettyName | order by DatabaseName asc";
      const response = await this.executeWithTimeout(null, query, "metadata");
      const result = this.transformResponse(response);

      const databases = result.data.map((row: Record<string, any>) => ({
        name: row.DatabaseName as string,
        description: row.PrettyName as string | undefined,
      }));

      return {
        databases,
        executionTime: Date.now() - startTime,
      };
    });
  }

  async verifyFunctionParams(
    database: string | null,
    name: string,
    args: Record<string, any>,
  ): Promise<void> {
    const functionParams = await this.getFunctionParameters(database, name);

    for (const param of functionParams) {
      const paramValue = args[param.name];

      if (paramValue === undefined && !param.hasDefaultValue) {
        throw new Error(`Required parameter '${param.name}' is missing`);
      }
    }
  }

  async getFunctionSchema(
    database: string | null,
    functionName: string,
  ): Promise<FunctionSchemaResult> {
    return withPerfLogging(
      "get function schema",
      { database, functionName },
      async () => {
        const startTime = Date.now();
        const query = `.show function ${functionName} | project Name, Parameters`;
        const response = await this.executeWithTimeout(
          database,
          query,
          "metadata",
        );
        const result = this.transformResponse(response);

        if (result.data.length === 0) {
          throw new Error(`Function '${functionName}' not found`);
        }

        const row = result.data[0];
        const parameters = this.parseFunctionParameters(
          row.Parameters as string,
        );

        const outputSchema = await this.discoverOutputSchema(
          database,
          functionName,
          parameters,
        );

        return {
          name: row.Name as string,
          parameters,
          outputSchema,
          executionTime: Date.now() - startTime,
        };
      },
    );
  }

  async getTableSchema(
    tableName: string,
    database: string | null,
  ): Promise<SchemaResult | null> {
    return withPerfLogging(
      "get table schema",
      { database, tableName },
      async () => {
        const startTime = Date.now();
        const query = `.show table ['${tableName}'] schema as json
| extend cols = todynamic(Schema).OrderedColumns
| mv-expand col = cols
| project TableName = "${tableName}",
          name = tostring(col.Name),
          type = tostring(col.CslType)
| summarize TableName = any(TableName),
            Schema = make_list(bag_pack('name', name, 'type', type))`;

        serviceLogger?.debug("Executing getTableSchema query", {
          database,
          tableName,
          query,
        });

        const response = await this.executeWithTimeout(
          database,
          query,
          "metadata",
        );

        serviceLogger?.debug("Got response from Kusto", {
          database,
          tableName,
          hasResults: response.primaryResults?.[0] ? true : false,
        });

        const result = this.transformResponse(response);

        serviceLogger?.debug("Transformed response", {
          database,
          tableName,
          rowCount: result.data.length,
          columnCount: result.columns.length,
        });

        if (result.data.length === 0) {
          serviceLogger?.debug("Table not found", { tableName, database });
          return null;
        }

        const row = result.data[0];
        const columns = row.Schema as Array<{ name: string; type: string }>;

        serviceLogger?.debug("Schema array from Kusto", {
          database,
          tableName,
          columnCount: columns.length,
        });

        return {
          schema: {
            name: row.TableName as string,
            columns,
          },
          executionTime: Date.now() - startTime,
        };
      },
    );
  }

  async getFunctionParameters(
    database: string | null,
    functionName: string,
  ): Promise<
    Array<{
      name: string;
      type: string;
      hasDefaultValue: boolean;
      defaultValue?: string;
    }>
  > {
    return withPerfLogging(
      "get function parameters",
      { database, functionName },
      async () => {
        const query = `.show function ${functionName} | project Parameters`;
        const response = await this.executeWithTimeout(
          database,
          query,
          "metadata",
        );
        const result = this.transformResponse(response);

        if (result.data.length === 0) {
          throw new Error(`Function '${functionName}' not found`);
        }

        const row = result.data[0];
        return this.parseFunctionParameters(row.Parameters as string);
      },
    );
  }

  private transformResponse(response: KustoResponseDataSet): {
    columns: Column[];
    data: Record<string, any>[];
  } {
    const transformStart = Date.now();
    const primaryTable = response.primaryResults[0];

    if (!primaryTable) {
      return {
        columns: [],
        data: [],
      };
    }

    const columns: Column[] = primaryTable.columns.map((col) => ({
      name: col.name || "",
      type: col.type || "dynamic",
    }));

    const tableData = primaryTable.toJSON();
    const transformTime = Date.now() - transformStart;

    if (tableData.data.length > 1000 || transformTime > 100) {
      serviceLogger?.debug("transform completed", {
        rowCount: tableData.data.length,
        columnCount: columns.length,
        transformTime: formatExecutionTime(transformTime),
      });
    }

    return { columns, data: tableData.data };
  }

  private applyQueryLimits(
    result: { columns: Column[]; data: Record<string, any>[] },
    query?: string,
  ): {
    columns: Column[];
    data: Record<string, any>[];
    warning?: string;
    suggestion?: string;
    truncated?: boolean;
    originalRowCount?: number;
  } {
    const { warningThreshold, softLimit, hardLimit } = config.queryLimits;
    const rowCount = result.data.length;
    const analysis = query
      ? this.analyzeQuery(query)
      : { suggestions: [], estimatedRisk: "low" as const };

    if (rowCount <= warningThreshold) {
      return analysis.suggestions.length > 0
        ? { ...result, suggestion: analysis.suggestions[0] }
        : result;
    }

    if (rowCount <= softLimit) {
      const suggestions =
        analysis.suggestions.length > 0
          ? ` ${analysis.suggestions.join(" ")}`
          : "";
      return {
        ...result,
        suggestion: `Query returned ${rowCount} rows. Consider adding 'take ${warningThreshold}' for better performance.${suggestions}`,
      };
    }

    if (rowCount <= hardLimit) {
      const suggestions =
        analysis.suggestions.length > 0
          ? ` ${analysis.suggestions.join(" ")}`
          : "";
      return {
        ...result,
        warning: `Large result set: ${rowCount} rows (${analysis.estimatedRisk} risk). Consider using time filters or aggregations to reduce data volume.${suggestions}`,
      };
    }

    const truncatedData = result.data.slice(0, hardLimit);
    serviceLogger?.warn("Query result truncated due to size limits", {
      originalRowCount: rowCount,
      truncatedRowCount: hardLimit,
      queryRisk: analysis.estimatedRisk,
    });

    return {
      columns: result.columns,
      data: truncatedData,
      truncated: true,
      originalRowCount: rowCount,
      warning: `Results truncated at ${hardLimit} rows (original: ${rowCount} rows). ${analysis.suggestions.join(" ")}`,
    };
  }

  private analyzeQuery(query: string): {
    suggestions: string[];
    estimatedRisk: "low" | "medium" | "high";
  } {
    const suggestions: string[] = [];
    let estimatedRisk: "low" | "medium" | "high" = "low";

    const normalizedQuery = query.trim().toLowerCase();

    if (/^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*(\||$)/.test(query.trim())) {
      suggestions.push(
        "Direct table queries may return large datasets. Add filters and limits.",
      );
      estimatedRisk = "high";
    }

    if (!/\|\s*(take|limit)\s+\d+/i.test(query)) {
      suggestions.push("Consider adding '| take N' to limit results.");
      if (estimatedRisk === "low") estimatedRisk = "medium";
    }

    if (
      !/where.*ago\(/i.test(query) &&
      !/timegenerated|timestamp/i.test(normalizedQuery)
    ) {
      suggestions.push("Consider adding time filters for better performance.");
    }

    if (
      normalizedQuery.includes("| where") &&
      normalizedQuery.indexOf("| where") >
        normalizedQuery.indexOf("| summarize")
    ) {
      suggestions.push(
        "Move 'where' clauses before aggregations for better performance.",
      );
    }

    return { suggestions, estimatedRisk };
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return "null";
    }

    if (typeof value === "string") {
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (value instanceof Date) {
      return `datetime('${value.toISOString()}')`;
    }

    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }

  private parseFunctionParameters(parametersString: string): Array<{
    name: string;
    type: string;
    hasDefaultValue: boolean;
    defaultValue?: string;
  }> {
    if (!parametersString || parametersString === "()") {
      return [];
    }

    try {
      const rawParams = parametersString
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      return rawParams.map((param) => {
        const [nameAndType, defaultValue] = param
          .split("=")
          .map((s) => s.trim());
        const [name, type] = nameAndType.split(":").map((s) => s.trim());

        const hasDefaultValue = defaultValue !== undefined;

        return {
          name,
          type: type ?? "dynamic",
          hasDefaultValue,
          defaultValue: hasDefaultValue ? defaultValue : undefined,
        };
      });
    } catch (error) {
      serviceLogger?.warn("Failed to parse function parameters", {
        parametersString,
        error: error instanceof Error ? error.message : "Unknown",
      });
      return [];
    }
  }

  private async discoverOutputSchema(
    database: string | null,
    functionName: string,
    parameters: Array<{
      name: string;
      type: string;
      hasDefaultValue: boolean;
      defaultValue?: string;
    }>,
  ): Promise<Array<{ name: string; type: string; description?: string }>> {
    try {
      const { query, crp } = this.buildSchemaDiscoveryQuery(
        functionName,
        parameters,
      );
      const response = await this.executeWithTimeout(
        database,
        query,
        "metadata",
        crp,
      );
      const result = this.transformResponse(response);
      return this.mapSchemaResult(result.data);
    } catch (error) {
      serviceLogger?.warn("Failed to discover output schema", {
        functionName,
        error: error instanceof Error ? error.message : "Unknown",
      });
      return [];
    }
  }

  private buildSchemaDiscoveryQuery(
    functionName: string,
    parameters: Array<{
      name: string;
      type: string;
      hasDefaultValue: boolean;
      defaultValue?: string;
    }>,
  ): { query: string; crp: ClientRequestProperties } {
    const crp = new ClientRequestProperties();
    let functionCall = `${functionName}()`;

    if (parameters.length > 0) {
      const decls: string[] = [];
      const callArgs: string[] = [];

      for (const param of parameters) {
        if (!param.hasDefaultValue) {
          const fakeValue = this.generateFakeValue(param.type);
          decls.push(`${param.name}: ${param.type}`);
          callArgs.push(param.name);
          crp.setParameter(param.name, fakeValue);
        }
      }

      if (decls.length > 0) {
        functionCall = `declare query_parameters(${decls.join(", ")});
${functionName}(${callArgs.join(", ")})`;
      }
    }

    const query = `let schemaColumns =
    ${functionCall}
    | getschema
    | project ColumnName, ColumnType;
let columnDescriptions =
    union kind=outer isfuzzy=true
        (ColumnDictionary | where TableName == "${functionName}" | project ColumnName, Description, priority=int(1)),
        (ColumnDictionary | where isempty(TableName) or isempty(TableName) | project ColumnName, Description, priority=int(0)),
        (datatable(ColumnName:string, Description:string, priority:int)[]);
let prioritizedDescriptions =
    columnDescriptions
    | summarize arg_max(priority, *) by ColumnName
    | project ColumnName, Description;
schemaColumns
| lookup kind=leftouter prioritizedDescriptions on ColumnName`;

    return { query, crp };
  }

  private mapSchemaResult(
    data: any[],
  ): Array<{ name: string; type: string; description?: string }> {
    return data.map((row: any) => {
      const schema: { name: string; type: string; description?: string } = {
        name: row.ColumnName as string,
        type: row.ColumnType as string,
      };
      if (row.Description && row.Description !== null) {
        schema.description = row.Description as string;
      }
      return schema;
    });
  }

  private generateFakeValue(type: string): any {
    const lowerType = type.toLowerCase();

    if (lowerType.includes("string")) return "fake_string";
    if (lowerType.includes("datetime")) return new Date();
    if (lowerType.includes("int") || lowerType.includes("long")) return 1;
    if (lowerType.includes("real") || lowerType.includes("double")) return 1.0;
    if (lowerType.includes("bool")) return true;
    if (lowerType.includes("timespan")) return "1h";
    if (lowerType.includes("dynamic")) return "fake_value";

    return "fake_value";
  }

  private validatePipeline(pipeline: string): string {
    const trimmed = pipeline.trim();

    if (!trimmed.startsWith("|")) {
      throw new Error("Pipeline must start with '|'");
    }

    const dangerous = [".set", ".drop", ".create", ".alter", ".delete"];
    const lower = trimmed.toLowerCase();

    for (const cmd of dangerous) {
      if (lower.includes(cmd)) {
        throw new Error(`Operation '${cmd}' not allowed`);
      }
    }

    return trimmed;
  }

  private getTimeoutForOperation(
    operationType: "metadata" | "query" | "default",
  ): number {
    const timeouts = config.queryTimeout;
    return Math.min(timeouts[operationType], timeouts.maximum);
  }

  private isTimeoutError(error: Error): boolean {
    return (
      error.message.includes("timeout") ||
      error.message.includes("Request timed out") ||
      error.message.includes("Query timeout")
    );
  }

  private createTimeoutError(
    operationType: string,
    originalError: Error,
  ): Error {
    const timeout = this.getTimeoutForOperation(
      operationType as "metadata" | "query" | "default",
    );
    const suggestions =
      operationType === "query"
        ? "Consider adding time filters, limits, or reducing data scope."
        : "Try again or contact administrator if this persists.";

    return new Error(
      `Query timeout after ${timeout / 1000}s. ${suggestions} Original: ${originalError.message}`,
    );
  }

  private async executeWithTimeout(
    database: string | null,
    query: string,
    operationType: "metadata" | "query" | "default",
    crp?: ClientRequestProperties,
  ): Promise<KustoResponseDataSet> {
    const requestProps = crp || new ClientRequestProperties();
    requestProps.setTimeout(this.getTimeoutForOperation(operationType));

    try {
      return await this.sdkClient.execute(database, query, requestProps);
    } catch (error) {
      if (error instanceof Error && this.isTimeoutError(error)) {
        serviceLogger?.warn("Query timeout occurred", {
          database,
          queryLength: query.length,
          timeoutMs: this.getTimeoutForOperation(operationType),
          operationType,
        });
        throw this.createTimeoutError(operationType, error);
      }
      throw error;
    }
  }
}
