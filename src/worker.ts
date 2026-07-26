import { createWorkerRuntime } from "./bootstrap/worker-runtime.js";
import { parseWorkerEnv } from "./lib/parse-worker-env.js";
import { CONTENT_QUEUE_NAME } from "./lib/queue-name.js";

const env = parseWorkerEnv(process.env);
const runtime = createWorkerRuntime(env);
runtime.start();

console.log(
  `Worker listening on queue "${CONTENT_QUEUE_NAME}" (NODE_ENV=${env.NODE_ENV})`
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void runtime.close());
}
