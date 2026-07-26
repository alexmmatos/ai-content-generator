import { contentQueue } from "../lib/content-queue.js";
import { PrismaOutboxRepository } from "../repositories/outbox.repository.js";
import { publishPendingOutboxEvents } from "./publish-pending-outbox-events.js";

const outboxRepository = new PrismaOutboxRepository();
let dispatching = false;

async function dispatch(): Promise<void> {
  if (dispatching) return;
  dispatching = true;
  try {
    await publishPendingOutboxEvents(outboxRepository, contentQueue);
  } catch (error) {
    console.error("Outbox dispatcher failed", error);
  } finally {
    dispatching = false;
  }
}

void dispatch();
setInterval(() => void dispatch(), 1000);
