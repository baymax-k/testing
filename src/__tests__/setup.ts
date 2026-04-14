// Load environment variables before anything else
import "dotenv/config";

import { beforeAll, afterAll, afterEach } from "vitest";
import { prisma } from "../config/prisma.js";

// Clean up database before all tests
beforeAll(async () => {
  // This ensures we have a clean state
  console.log("Test suite starting...");
});

// Clean up after each test
afterEach(async () => {
  // Clean up test data after each test if needed
  // Be careful not to delete production data
});

// Cleanup after all tests
afterAll(async () => {
  await prisma.$disconnect();
  console.log("Test suite completed");
});
