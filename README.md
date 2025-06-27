# MCP Server for Azure Data Explorer

An intelligent Azure Data Explorer access layer designed for AI toolchains. Unlike basic API wrappers, this server provides comprehensive schema discovery and context, enabling AI tools to understand your data structure and generate precise, accurate KQL queries.

## Features

- **Schema-Enhanced Discovery**: Comprehensive table and function schema exposure for AI context
- **Intelligent Query Support**: Rich metadata enables precise KQL query generation  
- **Function Intelligence**: Complete stored function discovery with parameter definitions
- **AI-Optimized Integration**: Schema-aware responses designed for AI toolchains
- **Flexible Authentication**: OAuth2 delegation and application modes with automatic caching

## Tools

### Core Tools
- `run-query`: Execute KQL queries with intelligent result management
- `list-functions`: Discover stored functions with metadata
- `get-function-schema`: Retrieve function signatures and parameters
- `list-databases`: Browse available databases

## Setup

1. Install dependencies:
```bash
bun install
```

2. Configure authentication:
```bash
# Quick start with Azure CLI (for local development)
az login

# Set cluster URL in tool calls or environment
export AZURE_AUTH_MODE="application"  # default
```

3. Build and run:
```bash
bun run build
bun run start
```

## Configuration

### Authentication Setup

The server uses `@jhzhu89/azure-client-pool` for intelligent client management with automatic caching and credential fallback.

**Application Mode** (Default - Recommended)
```bash
export AZURE_AUTH_MODE="application"
export AZURE_APPLICATION_AUTH_STRATEGY="chain"  # cli → managed identity fallback
```

**Delegated Mode** (For user-context scenarios)
```bash
export AZURE_AUTH_MODE="delegated"
export AZURE_CLIENT_ID="your-app-client-id"
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_CLIENT_SECRET="your-client-secret"
```

**Advanced Configuration Sources**
```bash
# Option A: Azure App Configuration (Centralized)
export AZURE_APPCONFIG_ENDPOINT="https://your-appconfig.azconfig.io"
export AZURE_APPCONFIG_KEY_PREFIX="azure_kusto_mcp:"

# Option B: Environment variables (shown above)
```

### Query Behavior
- `QUERY_WARNING_THRESHOLD`: Row count warning (default: 1000)
- `QUERY_SOFT_LIMIT`: Soft truncation limit (default: 5000)  
- `QUERY_HARD_LIMIT`: Hard truncation limit (default: 50000)

## Schema-Enhanced Intelligence

The key advantage over basic API wrappers: **deep understanding of your Kusto tables through comprehensive schema discovery**.

- **Rich Schema Context**: Provides detailed table schemas, column types, and function signatures to AI tools
- **Intelligent Query Generation**: AI can write more accurate KQL queries with full knowledge of your data structure
- **Function Discovery**: Exposes stored functions with parameter definitions for precise execution
- **Context-Aware Responses**: Results formatted with schema awareness for better AI comprehension

This schema intelligence enables AI tools to understand your data model and generate precise, executable queries rather than generic templates.

## Authentication

The server leverages `@jhzhu89/azure-client-pool` for sophisticated authentication with automatic caching and credential management.

**How it works:**
- **Application Mode**: Uses service credentials (CLI/Managed Identity) with automatic fallback
- **Delegated Mode**: On-behalf-of flow preserving user identity and permissions
- **Smart Caching**: Clients cached by authentication context and cluster configuration
- **Token Management**: Automatic refresh and JWT validation for delegated flows

**Supported Methods**: Azure CLI, Managed Identity, Client Secret, Certificate, Interactive Browser

## Comparison with Other MCP Implementations

Unlike basic Kusto MCP implementations, this server provides:

| Feature | Other MCP | This Server |
|---------|-----------|-------------|
| **Schema Discovery** | Basic table listing | Comprehensive schema with column types, descriptions, and relationships |
| **Function Support** | Not available | Full function discovery with parameter schemas |
| **Query Assistance** | Raw KQL execution | Schema-aware query generation and validation |
| **AI Integration** | Command-line focused | Rich schema context for intelligent query construction |
| **Result Context** | Raw output | Schema-enhanced responses for better AI comprehension |
| **Data Understanding** | Surface-level access | Deep table structure knowledge |

**Key Advantages:**
- **Schema-Enhanced AI**: Provides complete data model context for accurate query generation
- **Function Intelligence**: Discovers and exposes stored functions with full parameter definitions  
- **Contextual Responses**: All outputs include schema context for improved AI understanding

## Development

```bash
# Watch mode
bun run dev

# Build with watch  
bun run dev:build
```
