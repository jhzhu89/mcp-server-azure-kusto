import {
  Client as AzureKustoSdkClient,
  KustoConnectionStringBuilder,
} from "azure-kusto-data";
import {
  type ClientFactory,
  type CredentialProvider,
  CredentialType,
} from "@jhzhu89/azure-client-pool";
import { KustoService } from "./service.js";
import { getAuthMode } from "../config/auth-config.js";

export interface KustoServiceOptions {
  clusterUrl: string;
}

export class KustoServiceFactory
  implements ClientFactory<KustoService, KustoServiceOptions>
{
  async createClient(
    credentialProvider: CredentialProvider,
    options?: KustoServiceOptions,
  ): Promise<KustoService> {
    if (!options?.clusterUrl) {
      throw new Error("clusterUrl is required for Kusto service");
    }

    const authMode = getAuthMode();
    const credentialType =
      authMode === "delegated"
        ? CredentialType.Delegated
        : CredentialType.Application;

    const credential = await credentialProvider.getCredential(credentialType);

    const connectionStringBuilder =
      KustoConnectionStringBuilder.withTokenCredential(
        options.clusterUrl,
        credential,
      );

    const sdkClient = new AzureKustoSdkClient(connectionStringBuilder);
    return new KustoService(sdkClient);
  }

  getClientFingerprint(options?: KustoServiceOptions): string | undefined {
    if (!options?.clusterUrl) return undefined;
    return this.simpleHash(options.clusterUrl);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }
}
