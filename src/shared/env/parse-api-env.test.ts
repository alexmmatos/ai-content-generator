import { describe, expect, it } from "vitest";
import { parseApiEnv } from "./parse-api-env.js";

describe("parseApiEnv", () => {
  it("starts the API with only PostgreSQL configuration", () => {
    expect(
      parseApiEnv({ DATABASE_URL: "postgresql://localhost/database" })
    ).toMatchObject({
      NODE_ENV: "development",
      PORT: 3000,
    });
  });

  it("does not require worker infrastructure values", () => {
    expect(() =>
      parseApiEnv({ DATABASE_URL: "postgresql://localhost/database" })
    ).not.toThrow();
  });
});
