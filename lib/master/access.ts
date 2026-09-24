export type PlatformLevel = "viewer" | "support" | "master";

const rank: Record<PlatformLevel, number> = { viewer: 1, support: 2, master: 3 };

export function hasPlatformAccess(level: PlatformLevel | undefined, minimum: PlatformLevel) {
  return Boolean(level && rank[level] >= rank[minimum]);
}
