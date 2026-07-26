import { Redis } from "ioredis";

export function createRedisWorkerConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}
