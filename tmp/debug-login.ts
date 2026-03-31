import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    // Check users
    const users = await prisma.user.findMany({
      where: {
        email: "collegeadmin@codeethnics.com",
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        passwordHash: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    console.log("Users found:", JSON.stringify(users, null, 2));

    // Check if there's an account
    const accounts = await prisma.account.findMany({
      where: {
        user: {
          email: "collegeadmin@codeethnics.com",
        },
      },
    });

    console.log("Accounts:", JSON.stringify(accounts, null, 2));

    // Check sessions
    const sessions = await prisma.session.findMany({
      where: {
        user: {
          email: "collegeadmin@codeethnics.com",
        },
      },
    });

    console.log("Sessions:", JSON.stringify(sessions, null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
