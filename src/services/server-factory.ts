import {
  ContextualMcpServer,
  type DependencyInjector,
} from "./contextual-mcp-server.js";
import {
  createClientProviderWithMapper,
  getLogger,
  AuthMode,
  type RequestMapper,
  type AuthRequestFactory,
} from "@jhzhu89/azure-client-pool";
import {
  KustoServiceFactory,
  type KustoServiceOptions,
} from "../kusto/service-factory.js";
import { listTablesTool } from "../tools/list-tables.js";
import { runQueryTool } from "../tools/run-query.js";
import { callFunctionTool } from "../tools/call-function.js";
import { listFunctionsTool } from "../tools/list-functions.js";
import { getFunctionSchemaTool } from "../tools/get-function-schema.js";
import { getTableSchemaTool } from "../tools/get-table-schema.js";
import { listDatabasesTool } from "../tools/list-databases.js";
import { type ServerDependencies } from "../tools/base-tool.js";
import { config } from "../config.js";
import { getAuthMode } from "../config/auth-config.js";

const serverLogger = getLogger("server");

class KustoMcpRequestMapper
  implements RequestMapper<Record<string, unknown>, KustoServiceOptions>
{
  extractAuthData(source: Record<string, unknown>): {
    userAssertion?: string;
  } & Record<string, unknown> {
    const params = source.params as Record<string, unknown> | undefined;
    const arguments_ = params?.arguments as Record<string, unknown> | undefined;

    const authData: { userAssertion?: string } & Record<string, unknown> = {};

    if (arguments_?.user_assertion) {
      authData.userAssertion = arguments_.user_assertion as string;
    }

    return authData;
  }

  extractOptions(source: Record<string, unknown>): KustoServiceOptions {
    const params = source.params as Record<string, unknown> | undefined;
    const arguments_ = params?.arguments as Record<string, unknown> | undefined;
    const kustoClusterUrl = arguments_?.kusto_cluster_url as string | undefined;

    if (!kustoClusterUrl) {
      throw new Error(
        "No Kusto cluster URL provided in arguments. You must provide 'kusto_cluster_url' in the tool arguments.",
      );
    }

    return { clusterUrl: kustoClusterUrl };
  }
}

const createAuthRequest: AuthRequestFactory = (
  authData: {
    userAssertion?: string;
  } & Record<string, unknown>,
) => {
  const authMode = getAuthMode();

  if (authMode === "delegated") {
    if (!authData.userAssertion) {
      throw new Error(
        "User assertion token required for delegated authentication",
      );
    }
    return { mode: AuthMode.Delegated, userAssertion: authData.userAssertion };
  }

  return { mode: AuthMode.Application };
};

const { getClient } = await createClientProviderWithMapper(
  new KustoServiceFactory(),
  new KustoMcpRequestMapper(),
  createAuthRequest,
);

export async function createServer(): Promise<
  ContextualMcpServer<ServerDependencies>
> {
  const dependencyInjector: DependencyInjector<ServerDependencies> = async (
    request,
  ) => {
    const kustoService = await getClient(request);

    serverLogger?.debug("Dependencies injected for current request");

    return {
      kustoService,
      config,
    };
  };

  const server = new ContextualMcpServer<ServerDependencies>(
    {
      name: "mcp-kusto-server",
      version: "0.0.1",
    },
    dependencyInjector,
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.registerTool(
    "run-query",
    runQueryTool.config,
    async (args: any, extra: any) => {
      return await runQueryTool.handler(args, extra.injected);
    },
  );

  server.registerTool(
    "list-functions",
    listFunctionsTool.config,
    async (args: any, extra: any) => {
      return await listFunctionsTool.handler(args, extra.injected);
    },
  );

  server.registerTool(
    "get-function-schema",
    getFunctionSchemaTool.config,
    async (args: any, extra: any) => {
      return await getFunctionSchemaTool.handler(args, extra.injected);
    },
  );

  server.registerTool(
    "list-databases",
    listDatabasesTool.config,
    async (args: any, extra: any) => {
      return await listDatabasesTool.handler(args, extra.injected);
    },
  );

  if (config.features.enableBetaTools) {
    server.registerTool(
      "list-tables",
      listTablesTool.config,
      async (args: any, extra: any) => {
        return await listTablesTool.handler(args, extra.injected);
      },
    );

    server.registerTool(
      "call-function",
      callFunctionTool.config,
      async (args: any, extra: any) => {
        return await callFunctionTool.handler(args, extra.injected);
      },
    );

    server.registerTool(
      "get-table-schema",
      getTableSchemaTool.config,
      async (args: any, extra: any) => {
        return await getTableSchemaTool.handler(args, extra.injected);
      },
    );
  }
  return server;
}
