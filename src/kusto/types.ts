export interface FunctionSummary {
  folder?: string;
  name: string;
  description?: string;
}

export interface TableSummary {
  folder?: string;
  name: string;
  databaseName: string;
  description?: string;
}

export interface TableSchema {
  name: string;
  columns: Column[];
}

export interface Column {
  name: string;
  type: string;
  aliases?: string[];
  examples?: string[];
  joinHintScore?: number;
}

export interface QueryResult {
  columns: Column[];
  data: Record<string, any>[];
  rowCount: number;
  executionTime: number;
  warning?: string;
  suggestion?: string;
  truncated?: boolean;
  originalRowCount?: number;
}

export interface TableListResult {
  tables: TableSummary[];
  executionTime: number;
}

export interface FunctionListResult {
  functions: FunctionSummary[];
  executionTime: number;
}

export interface SchemaResult {
  schema: TableSchema;
  executionTime: number;
}

export interface FunctionSchemaResult {
  name: string;
  parameters: Array<{
    name: string;
    type: string;
    hasDefaultValue: boolean;
    defaultValue?: string;
  }>;
  outputSchema: Array<{ name: string; type: string; description?: string }>;
  executionTime: number;
}

export interface DatabaseSummary {
  name: string;
  description?: string;
}

export interface DatabaseListResult {
  databases: DatabaseSummary[];
  executionTime: number;
}
