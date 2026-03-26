import { prisma } from "../src/config/prisma";

async function main() {
  const rows = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
    take: 20,
  });
  console.log(rows);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
