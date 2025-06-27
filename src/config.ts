import { getLogger } from "@jhzhu89/azure-client-pool";

const configLogger = getLogger("kusto-config");

export interface ServerConfig {
  queryLimits: {
    warningThreshold: number;
    softLimit: number;
    hardLimit: number;
  };
  queryTimeout: {
    default: number;
    metadata: number;
    query: number;
    maximum: number;
  };
  features: {
    enableBetaTools: boolean;
  };
}

function loadServerConfig(): ServerConfig {
  configLogger?.debug("Loading Kusto server configuration");

  const warningThreshold = parseInt(
    process.env.QUERY_WARNING_THRESHOLD || "1000",
  );
  const softLimit = parseInt(process.env.QUERY_SOFT_LIMIT || "5000");
  const hardLimit = parseInt(process.env.QUERY_HARD_LIMIT || "50000");
  const enableBetaTools =
    process.env.ENABLE_BETA_TOOLS?.toLowerCase() === "true";

  const defaultTimeout = parseInt(process.env.QUERY_TIMEOUT_DEFAULT || "30000");
  const metadataTimeout = parseInt(
    process.env.QUERY_TIMEOUT_METADATA || "30000",
  );
  const queryTimeout = parseInt(process.env.QUERY_TIMEOUT_QUERY || "60000");
  const maximumTimeout = parseInt(
    process.env.QUERY_TIMEOUT_MAXIMUM || "120000",
  );

  if (warningThreshold <= 0 || warningThreshold > hardLimit) {
    throw new Error(
      `QUERY_WARNING_THRESHOLD must be between 1 and ${hardLimit}, got: ${warningThreshold}`,
    );
  }

  if (softLimit <= warningThreshold || softLimit > hardLimit) {
    throw new Error(
      `QUERY_SOFT_LIMIT must be between ${warningThreshold} and ${hardLimit}, got: ${softLimit}`,
    );
  }

  if (hardLimit <= softLimit || hardLimit > 100000) {
    throw new Error(
      `QUERY_HARD_LIMIT must be between ${softLimit} and 100000, got: ${hardLimit}`,
    );
  }

  if (defaultTimeout <= 0 || defaultTimeout > maximumTimeout) {
    throw new Error(
      `QUERY_TIMEOUT_DEFAULT must be between 1 and ${maximumTimeout}, got: ${defaultTimeout}`,
    );
  }

  if (metadataTimeout <= 0 || metadataTimeout > maximumTimeout) {
    throw new Error(
      `QUERY_TIMEOUT_METADATA must be between 1 and ${maximumTimeout}, got: ${metadataTimeout}`,
    );
  }

  if (queryTimeout <= 0 || queryTimeout > maximumTimeout) {
    throw new Error(
      `QUERY_TIMEOUT_QUERY must be between 1 and ${maximumTimeout}, got: ${queryTimeout}`,
    );
  }

  if (maximumTimeout <= 0 || maximumTimeout > 600000) {
    throw new Error(
      `QUERY_TIMEOUT_MAXIMUM must be between 1 and 600000 (10 minutes), got: ${maximumTimeout}`,
    );
  }

  configLogger?.debug("Server configuration loaded successfully", {
    warningThreshold,
    softLimit,
    hardLimit,
    enableBetaTools,
    defaultTimeout,
    metadataTimeout,
    queryTimeout,
    maximumTimeout,
  });

  return {
    queryLimits: {
      warningThreshold,
      softLimit,
      hardLimit,
    },
    queryTimeout: {
      default: defaultTimeout,
      metadata: metadataTimeout,
      query: queryTimeout,
      maximum: maximumTimeout,
    },
    features: {
      enableBetaTools,
    },
  };
}

export const config: ServerConfig = loadServerConfig();
