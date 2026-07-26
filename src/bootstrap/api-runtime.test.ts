import { describe, expect, it, vi } from "vitest";
import type { ApiEnv } from "../shared/env/api-env.type.js";

const mocks = vi.hoisted(() => ({
  app: { addHook: vi.fn() },
  disconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../app.js", () => ({ buildApp: vi.fn(() => mocks.app) }));
vi.mock("../shared/db/prisma.js", () => ({
  prisma: { $disconnect: mocks.disconnect },
}));
vi.mock("../features/content-generation/infrastructure/persistence/content.repository.js", () => ({
  PrismaContentRepository: class {},
}));
vi.mock("../features/content-generation/infrastructure/persistence/generation-request.repository.js", () => ({
  PrismaGenerationRequestRepository: class {},
}));

import { createApiRuntime } from "./api-runtime.js";

const CONFIG = {
  DATABASE_URL: "postgresql://localhost/database",
  NODE_ENV: "test",
  PORT: 3000,
} satisfies ApiEnv;

describe("createApiRuntime", () => {
  it("assembles an API with no Redis, queue or S3 lifecycle", async () => {
    const app = createApiRuntime(CONFIG);

    expect(app).toBe(mocks.app);
    const hookCall = mocks.app.addHook.mock.calls.find(([name]) => name === "onClose");
    const closeHook = hookCall?.[1] as (() => Promise<void>) | undefined;
    if (!closeHook) throw new Error("onClose hook was not registered");

    await closeHook();

    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });
});
