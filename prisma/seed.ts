import { prisma } from "../src/lib/prisma.js";

async function main() {
  const existing = await prisma.user.findFirst();
  if (existing) {
    console.log(`Seed: user already exists (${existing.id}), skipping.`);
    return;
  }

  const user = await prisma.user.create({ data: { credits: 10 } });
  console.log(`Seed: created default user ${user.id} with ${user.credits} credits.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
