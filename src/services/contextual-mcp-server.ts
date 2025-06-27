import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Implementation } from "@modelcontextprotocol/sdk/types.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

type DependencyInjector<TDeps = any> = (request: {
  params: { arguments?: Record<string, any> };
}) => Promise<TDeps>;

export type { DependencyInjector };

export interface EnhancedRequestHandlerExtra<TDeps = any>
  extends RequestHandlerExtra<any, any> {
  injected: TDeps;
}

export class ContextualMcpServer<TDeps = any> extends McpServer {
  private dependencyInjector: DependencyInjector<TDeps>;

  constructor(
    serverInfo: Implementation,
    dependencyInjector: DependencyInjector<TDeps>,
    options?: any,
  ) {
    super(serverInfo, options);
    this.dependencyInjector = dependencyInjector;
    this.installHook();
  }

  private installHook() {
    const server = this.server;
    const original = server.setRequestHandler.bind(server);

    server.setRequestHandler = (schema: any, handler: any) => {
      if (schema.shape?.method?.value === "tools/call") {
        const enhanced = async (request: any, extra: any) => {
          try {
            const deps = await this.dependencyInjector(request);
            const enhancedExtra: EnhancedRequestHandlerExtra<TDeps> = {
              ...extra,
              injected: deps,
            };
            return await handler(request, enhancedExtra);
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    error instanceof Error
                      ? error.message
                      : "Dependency injection failed",
                },
              ],
              isError: true,
            };
          }
        };
        return original(schema, enhanced);
      }

      return original(schema, handler);
    };
  }
}
