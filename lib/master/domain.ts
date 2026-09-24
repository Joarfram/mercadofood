export const DEFAULT_MASTER_DOMAIN = "master.meumercadofood.com";

export function isMasterHostname(hostname: string | null, configuredDomain = DEFAULT_MASTER_DOMAIN) {
  const normalized = (hostname || "").split(":")[0].toLowerCase();
  return normalized === configuredDomain.trim().toLowerCase();
}
