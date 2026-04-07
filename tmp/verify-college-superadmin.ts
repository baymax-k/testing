import { prisma } from "../src/config/prisma";

async function main() {
  await prisma.user.update({
    where: { email: "collegeadmin@codeethnics.com" },
    data: { emailVerified: true },
  });
  console.log("email verified");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
