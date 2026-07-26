import { prisma } from "../src/lib/prisma.js";
import { uploadContentFile } from "../src/lib/upload-content-file.js";

async function main() {
  const existing = await prisma.user.findFirst();
  if (existing) {
    console.log(`Seed: data already exists (user ${existing.id}), skipping.`);
    return;
  }

  const userWithCredits = await prisma.user.create({
    data: { id: "11111111-1111-1111-1111-111111111111", credits: 10 },
  });
  const userWithoutCredits = await prisma.user.create({
    data: { id: "22222222-2222-2222-2222-222222222222", credits: 0 },
  });

  const completed = await prisma.content.create({
    data: { userId: userWithCredits.id, topic: "conteúdo já concluído", status: "COMPLETED" },
  });
  const resultUrl = await uploadContentFile(
    completed.id,
    `Conteúdo gerado sobre "${completed.topic}" (seed).`
  );
  await prisma.content.update({ where: { id: completed.id }, data: { resultUrl } });

  await prisma.content.createMany({
    data: [
      { userId: userWithCredits.id, topic: "conteúdo pendente", status: "PENDING" },
      { userId: userWithCredits.id, topic: "conteúdo em processamento", status: "PROCESSING" },
      { userId: userWithCredits.id, topic: "conteúdo cancelado", status: "CANCELED" },
      { userId: userWithCredits.id, topic: "conteúdo com falha", status: "FAILED" },
    ],
  });

  console.log(`Seed: user with credits: ${userWithCredits.id} (${userWithCredits.credits} credits)`);
  console.log(`Seed: user without credits: ${userWithoutCredits.id} (0 credits)`);
  console.log(`Seed: content seeded for user ${userWithCredits.id} covering PENDING, PROCESSING, COMPLETED, CANCELED and FAILED`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
