import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const existing = await prisma.user.findFirst();
  if (existing) {
    console.log(`Seed: data already exists (user ${existing.id}), skipping.`);
    return;
  }

  const userWithCredits = await prisma.user.create({
    data: { id: "297c69ca-df7a-4062-b5ce-957df31dfb82", credits: 10 },
  });
  const userWithoutCredits = await prisma.user.create({
    data: { id: "b485e014-75b7-47c7-a84a-14da3fcfaa8e", credits: 0 },
  });

  const completed = await prisma.content.create({
    data: {
      requestId: randomUUID(),
      requestHash: "seed",
      userId: userWithCredits.id,
      topic: "conteúdo já concluído",
      status: "COMPLETED",
    },
  });
  await prisma.content.update({
    where: { id: completed.id },
    data: { resultUrl: "https://example.com/seed-content.txt" },
  });

  await prisma.content.createMany({
    data: [
      {
        requestId: randomUUID(),
        requestHash: "seed",
        userId: userWithCredits.id,
        topic: "conteúdo pendente",
        status: "PENDING",
      },
      {
        requestId: randomUUID(),
        requestHash: "seed",
        userId: userWithCredits.id,
        topic: "conteúdo em processamento",
        status: "PROCESSING",
      },
      {
        requestId: randomUUID(),
        requestHash: "seed",
        userId: userWithCredits.id,
        topic: "conteúdo cancelado",
        status: "CANCELED",
      },
      {
        requestId: randomUUID(),
        requestHash: "seed",
        userId: userWithCredits.id,
        topic: "conteúdo com falha",
        status: "FAILED",
      },
    ],
  });

  console.log(`Seed: user with credits: ${userWithCredits.id} (${userWithCredits.credits} credits)`);
  console.log(`Seed: user without credits: ${userWithoutCredits.id} (0 credits)`);
  console.log(`Seed: content seeded for user ${userWithCredits.id} covering PENDING, PROCESSING, COMPLETED, CANCELED and FAILED`);
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void run();
