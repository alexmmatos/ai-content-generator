import { env } from "./lib/env.js";
import "./workers/content-generation.worker.js";

console.log(`Worker listening on queue "content-generation" (NODE_ENV=${env.NODE_ENV})`);
