import { Redis } from "ioredis";

export function createRedisProducerConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
}
