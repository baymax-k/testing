const DEFAULT_ORIGINS: string[] = ["http://localhost:5000", "http://localhost:3000"];

export const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/+$/, "");

function toUniqueOrigins(origins: Array<string | undefined | null>): string[] {
  const normalized = origins
    .filter((origin): origin is string => typeof origin === "string")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  return [...new Set(normalized)];
}

export const getConfiguredOrigins = (): string[] => {
  if (process.env.CORS_ORIGINS) {
    const explicitOrigins = toUniqueOrigins(process.env.CORS_ORIGINS.split(","));
    if (explicitOrigins.length > 0) {
      return explicitOrigins;
    }
  }

  const fallbackOrigins = toUniqueOrigins([
    process.env.APP_URL,
    process.env.BETTER_AUTH_URL,
    process.env.FRONTEND_URL,
    process.env.PRODUCT_ADMIN_URL,
    process.env.ADMIN_URL,
    process.env.COLLEGE_ADMIN_URL,
    ...(process.env.NODE_ENV === "production" ? [] : DEFAULT_ORIGINS),
  ]);

  if (fallbackOrigins.length > 0) {
    return fallbackOrigins;
  }

  return DEFAULT_ORIGINS;
};
