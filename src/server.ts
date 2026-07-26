import { createApiRuntime } from "./bootstrap/api-runtime.js";
import { parseApiEnv } from "./lib/env/parse-api-env.js";

const env = parseApiEnv(process.env);
const app = createApiRuntime(env);

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void app.close());
}
