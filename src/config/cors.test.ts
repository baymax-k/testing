import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("CORS origin configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CORS_ORIGINS;
    delete process.env.FRONTEND_URL;
    delete process.env.APP_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("normalizes trailing slashes in fallback URLs", async () => {
    process.env.APP_URL = "http://localhost:5000/";
    process.env.FRONTEND_URL = "https://app.codeethnics.dnyx.in/";

    const { allowedOrigins, isAllowedOrigin } = await import("./cors.js");

    expect(allowedOrigins).toContain("http://localhost:5000");
    expect(allowedOrigins).toContain("https://app.codeethnics.dnyx.in");
    expect(isAllowedOrigin("https://app.codeethnics.dnyx.in")).toBe(true);
    expect(isAllowedOrigin("https://app.codeethnics.dnyx.in/")).toBe(true);
  });

  it("uses and normalizes explicit CORS_ORIGINS list", async () => {
    process.env.CORS_ORIGINS = "https://admin.example.com/, https://app.example.com";

    const { allowedOrigins, isAllowedOrigin } = await import("./cors.js");

    expect(allowedOrigins).toEqual(["https://admin.example.com", "https://app.example.com"]);
    expect(isAllowedOrigin("https://admin.example.com")).toBe(true);
    expect(isAllowedOrigin("https://admin.example.com/")).toBe(true);
    expect(isAllowedOrigin("https://unknown.example.com")).toBe(false);
  });
});
