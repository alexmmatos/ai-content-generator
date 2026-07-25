import { env } from "./lib/env.js";

// Placeholder entrypoint — the actual BullMQ worker is added in spec 05.
console.log(`Worker starting (env loaded, NODE_ENV=${env.NODE_ENV})`);
setInterval(() => {}, 60_000);
