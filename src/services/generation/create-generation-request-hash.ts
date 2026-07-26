import { createHash } from "node:crypto";

export function createGenerationRequestHash(input: {
  requestId?: string;
  userId: string;
  topic: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        operation: "content.generate.v1",
        userId: input.userId,
        topic: input.topic,
      })
    )
    .digest("hex");
}
