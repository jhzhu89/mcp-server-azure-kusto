export function getAuthMode(): string {
  return process.env.AZURE_AUTH_MODE || "application";
}
