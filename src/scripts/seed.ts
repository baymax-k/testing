// ─── Database Seed ────────────────────────────────────────────────────────────
// Creates two sample users for development and testing.
// Run after migration: npx tsx src/seed.ts

import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SALT_ROUNDS = 12;

// Setup SSL for AWS RDS if needed
function setupSSLCert(): void {
  if (process.env.NODE_ENV === "production") return;

  const certPath = process.env.RDS_SSL_CERT
    ? path.resolve(__dirname, "../../..", process.env.RDS_SSL_CERT)
    : null;
  if (certPath && fs.existsSync(certPath)) {
    process.env.NODE_EXTRA_CA_CERTS = certPath;
    console.log("[prisma] Using RDS SSL cert:", certPath);
  }
}

setupSSLCert();

// Create PostgreSQL pool with proper configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

const users = [
  {
    email: "admin@codeethnics.com",
    username: "admin",
    name: "Admin User",
    password: "Admin@1234",
    role: "product_admin" as const,
  },
  {
    email: "student@codeethnics.com",
    username: "student",
    name: "Sample Student",
    password: "Student@1234",
    role: "student" as const,
  },
];

const mcqQuestions = [
  {
    id: "mcq-practice-001",
    title: "JavaScript Event Loop Basics",
    description: "Which queue gets executed before macrotasks in JavaScript runtime?",
    difficulty: "easy",
    tags: ["javascript", "runtime"],
    options: ["Callback queue", "Microtask queue", "Timer queue", "Render queue"],
    correctAnswer: 1,
  },
  {
    id: "mcq-practice-002",
    title: "SQL Aggregate Clause",
    description: "Which clause is used to filter grouped records after aggregation?",
    difficulty: "easy",
    tags: ["sql", "database"],
    options: ["WHERE", "HAVING", "GROUP", "ORDER BY"],
    correctAnswer: 1,
  },
  {
    id: "mcq-practice-003",
    title: "Time Complexity of Binary Search",
    description: "What is the worst-case time complexity of binary search on a sorted array?",
    difficulty: "easy",
    tags: ["dsa", "arrays"],
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correctAnswer: 1,
  },
  {
    id: "mcq-practice-004",
    title: "HTTP Idempotent Method",
    description: "Which HTTP method is idempotent by definition?",
    difficulty: "medium",
    tags: ["backend", "http"],
    options: ["POST", "PATCH", "PUT", "CONNECT"],
    correctAnswer: 2,
  },
  {
    id: "mcq-practice-005",
    title: "Normalization Concept",
    description: "Which normal form eliminates transitive dependency?",
    difficulty: "medium",
    tags: ["sql", "database"],
    options: ["1NF", "2NF", "3NF", "BCNF"],
    correctAnswer: 2,
  },
  {
    id: "mcq-practice-006",
    title: "TypeScript Utility Type",
    description: "Which utility type makes all properties in a type optional?",
    difficulty: "easy",
    tags: ["typescript", "frontend"],
    options: ["Required<T>", "Readonly<T>", "Partial<T>", "Pick<T, K>"],
    correctAnswer: 2,
  },
  {
    id: "mcq-practice-007",
    title: "OOP Principle",
    description: "Which OOP principle allows deriving a new class from an existing class?",
    difficulty: "easy",
    tags: ["oops", "fundamentals"],
    options: ["Encapsulation", "Inheritance", "Polymorphism", "Abstraction"],
    correctAnswer: 1,
  },
  {
    id: "mcq-practice-008",
    title: "Redis Use Case",
    description: "Which is the most common use case for Redis in backend systems?",
    difficulty: "medium",
    tags: ["redis", "backend"],
    options: ["Relational joins", "Long-term cold storage", "Caching hot data", "Compile TypeScript"],
    correctAnswer: 2,
  },
  {
    id: "mcq-practice-009",
    title: "Prisma Migration Command",
    description: "Which Prisma command creates and applies a new migration in development?",
    difficulty: "medium",
    tags: ["prisma", "backend"],
    options: ["prisma generate", "prisma db push", "prisma migrate deploy", "prisma migrate dev"],
    correctAnswer: 3,
  },
  {
    id: "mcq-practice-010",
    title: "Big-O for Hash Map Lookup",
    description: "Average-case time complexity for hash map key lookup is:",
    difficulty: "easy",
    tags: ["dsa", "hashmap"],
    options: ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-011",
    title: "Array Insert at End",
    description: "In a dynamic array (amortized), appending an element is usually:",
    difficulty: "easy",
    tags: ["arrays", "dsa"],
    options: ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-012",
    title: "Two Pointer Technique",
    description: "Two pointers works best when input is typically:",
    difficulty: "easy",
    tags: ["arrays", "dsa"],
    options: ["Sorted", "Randomized", "Graph", "Tree"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-013",
    title: "Prefix Sum Use Case",
    description: "Prefix sums are mainly used to optimize:",
    difficulty: "medium",
    tags: ["arrays", "dsa"],
    options: ["Range sum queries", "Sorting", "Hash collisions", "Tree traversal"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-014",
    title: "Kadane's Algorithm",
    description: "Kadane's algorithm solves which problem in O(n)?",
    difficulty: "medium",
    tags: ["arrays", "dsa"],
    options: ["Maximum subarray sum", "Median of stream", "Topological sort", "Shortest path"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-015",
    title: "Sliding Window",
    description: "Fixed-size sliding window is useful for:",
    difficulty: "easy",
    tags: ["arrays", "dsa"],
    options: ["Consecutive segment computation", "Tree balancing", "Union-find", "Heap merge"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-016",
    title: "Array Index Bounds",
    description: "Valid index range for array of length n is:",
    difficulty: "easy",
    tags: ["arrays", "fundamentals"],
    options: ["1 to n", "0 to n", "0 to n-1", "1 to n-1"],
    correctAnswer: 2,
  },
  {
    id: "mcq-practice-017",
    title: "In-place Reversal",
    description: "Reversing array in-place typically uses:",
    difficulty: "easy",
    tags: ["arrays", "dsa"],
    options: ["Two pointers swap", "Hash map", "Priority queue", "DFS recursion"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-018",
    title: "Duplicate Detection",
    description: "Fastest average approach to detect duplicates in an array is:",
    difficulty: "medium",
    tags: ["arrays", "hashmap"],
    options: ["Hash set lookup", "Nested loops", "Binary tree always", "Bubble sort first"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-019",
    title: "Rotation by k",
    description: "Array rotation by k can be done in-place using:",
    difficulty: "medium",
    tags: ["arrays", "dsa"],
    options: ["Three reversals", "Only extra array", "Only linked list", "Heapify twice"],
    correctAnswer: 0,
  },
  {
    id: "mcq-practice-020",
    title: "Frequency Count",
    description: "To compute frequency of elements efficiently, preferred structure is:",
    difficulty: "easy",
    tags: ["arrays", "hashmap"],
    options: ["Hash map", "Stack", "Queue", "Trie"],
    correctAnswer: 0,
  },
] as const;

const dsaQuestions = [
  {
    id: "dsa-practice-001",
    title: "Two Sum",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
    difficulty: "easy",
    tags: ["arrays", "hashmap"],
    hiddenTestCases: [
      { input: "[2,7,11,15]\n9", output: "[0,1]" },
      { input: "[3,2,4]\n6", output: "[1,2]" },
      { input: "[3,3]\n6", output: "[0,1]" }
    ],
  },
  {
    id: "dsa-practice-002",
    title: "Reverse String",
    description: "Write a function that reverses a string. The input string is given as an array of characters s.\n\nYou must do this by modifying the input array in-place with O(1) extra memory.",
    difficulty: "easy",
    tags: ["strings", "two-pointers"],
    hiddenTestCases: [
      { input: "[\"h\",\"e\",\"l\",\"l\",\"o\"]", output: "[\"o\",\"l\",\"l\",\"e\",\"h\"]" },
      { input: "[\"H\",\"a\",\"n\",\"n\",\"a\",\"h\"]", output: "[\"h\",\"a\",\"n\",\"n\",\"a\",\"H\"]" }
    ],
  },
  {
    id: "dsa-practice-003",
    title: "Maximum Subarray",
    description: "Given an integer array nums, find the subarray with the largest sum, and return its sum.",
    difficulty: "medium",
    tags: ["arrays", "divide-and-conquer", "dynamic-programming"],
    hiddenTestCases: [
      { input: "[-2,1,-3,4,-1,2,1,-5,4]", output: "6" },
      { input: "[1]", output: "1" },
      { input: "[5,4,-1,7,8]", output: "23" }
    ],
  }
];

const arduinoQuestions = [
  {
    id: "arduino-practice-001",
    title: "Blink LED",
    description: `# LED Blink Pattern

Write an Arduino program that blinks the built-in LED on pin 13.

## Requirements:
- Turn LED ON for 1 second
- Turn LED OFF for 1 second
- Repeat continuously

## Expected Behavior:
The LED should blink with a 1-second interval (HIGH for 1s, LOW for 1s).

## Starter Template:
\`\`\`cpp
void setup() {
  // Configure pin 13 as output
}

void loop() {
  // Implement blinking logic
}
\`\`\``,
    difficulty: "easy",
    tags: ["arduino", "basics", "gpio"],
    board: "uno",
    fqbn: "arduino:avr:uno",
    libraries: [] as string[],
    starterCode: `void setup() {
  // Configure pin 13 as output
  pinMode(13, OUTPUT);
}

void loop() {
  // Write your code here
  
}`,
    simulationConfig: {
      version: 1,
      author: "CodeEthnics",
      editor: "wokwi",
      parts: [
        { type: "wokwi-arduino-uno", id: "uno", top: 0, left: 0 }
      ],
      connections: []
    },
    testCases: [
      {
        label: "LED should toggle every 1000ms",
        type: "pin_state",
        isHidden: false,
        pin: 13,
        expectedState: "TOGGLE",
        atMs: 1000,
        toleranceMs: 100,
        order: 1
      }
    ]
  },
  {
    id: "arduino-practice-002",
    title: "Serial Communication",
    description: `# Serial Hello World

Write an Arduino program that prints "Hello Arduino!" to the serial monitor every second.

## Requirements:
- Initialize serial communication at 9600 baud rate
- Print "Hello Arduino!" every 1000ms
- Use Serial.println()

## Expected Output:
\`\`\`
Hello Arduino!
Hello Arduino!
Hello Arduino!
...
\`\`\`

## Starter Template:
\`\`\`cpp
void setup() {
  // Initialize serial communication
}

void loop() {
  // Print message and wait
}
\`\`\``,
    difficulty: "easy",
    tags: ["arduino", "serial", "basics"],
    board: "uno",
    fqbn: "arduino:avr:uno",
    libraries: [] as string[],
    starterCode: `void setup() {
  // Initialize serial communication at 9600 baud
  
}

void loop() {
  // Print "Hello Arduino!" and wait 1 second
  
}`,
    simulationConfig: {
      version: 1,
      author: "CodeEthnics",
      editor: "wokwi",
      parts: [
        { type: "wokwi-arduino-uno", id: "uno", top: 0, left: 0 }
      ],
      connections: []
    },
    testCases: [
      {
        label: "Should print 'Hello Arduino!' to serial",
        type: "serial_output",
        isHidden: false,
        expectedOutput: "Hello Arduino!",
        order: 1
      }
    ]
  },
  {
    id: "arduino-practice-003",
    title: "Button Controlled LED",
    description: `# Button Input Control

Create an Arduino program that controls an LED using a push button.

## Requirements:
- Button connected to pin 2 (with internal pull-up resistor)
- LED connected to pin 13
- When button is pressed (LOW), LED should turn ON
- When button is released (HIGH), LED should turn OFF

## Circuit:
- Button: Pin 2 (INPUT_PULLUP)
- LED: Pin 13 (OUTPUT)

## Starter Template:
\`\`\`cpp
void setup() {
  // Configure pins
}

void loop() {
  // Read button and control LED
}
\`\`\``,
    difficulty: "medium",
    tags: ["arduino", "gpio", "input", "output"],
    board: "uno",
    fqbn: "arduino:avr:uno",
    libraries: [] as string[],
    starterCode: `const int buttonPin = 2;
const int ledPin = 13;

void setup() {
  // Configure button pin with internal pull-up
  
  // Configure LED pin as output
  
}

void loop() {
  // Read button state and control LED
  
}`,
    simulationConfig: {
      version: 1,
      author: "CodeEthnics",
      editor: "wokwi",
      parts: [
        { type: "wokwi-arduino-uno", id: "uno", top: 0, left: 0 },
        { type: "wokwi-pushbutton", id: "btn1", top: 100, left: 200 },
        { type: "wokwi-led", id: "led1", top: 100, left: 300 }
      ],
      connections: [
        ["btn1:1.l", "uno:2", "green"],
        ["btn1:1.r", "uno:GND", "black"],
        ["led1:A", "uno:13", "red"],
        ["led1:C", "uno:GND", "black"]
      ]
    },
    testCases: [
      {
        label: "LED should turn on when button is pressed",
        type: "pin_state",
        isHidden: false,
        pin: 13,
        expectedState: "HIGH",
        order: 1
      },
      {
        label: "LED should turn off when button is released",
        type: "pin_state",
        isHidden: false,
        pin: 13,
        expectedState: "LOW",
        order: 2
      }
    ]
  },
  {
    id: "arduino-practice-004",
    title: "PWM Fading LED",
    description: `# PWM LED Fading

Use PWM (Pulse Width Modulation) to create a smooth fading effect on an LED.

## Requirements:
- LED connected to PWM-capable pin 9
- Fade LED from 0 to 255 brightness
- Fade LED from 255 to 0 brightness
- Use analogWrite() for PWM control
- Create a smooth transition

## Expected Behavior:
LED should smoothly fade in and fade out continuously.

## Starter Template:
\`\`\`cpp
void setup() {
  // Configure PWM pin
}

void loop() {
  // Implement fading logic
}
\`\`\``,
    difficulty: "medium",
    tags: ["arduino", "pwm", "analog"],
    board: "uno",
    fqbn: "arduino:avr:uno",
    libraries: [] as string[],
    starterCode: `const int ledPin = 9;  // PWM pin

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  // Fade in from 0 to 255
  
  // Fade out from 255 to 0
  
}`,
    simulationConfig: {
      version: 1,
      author: "CodeEthnics",
      editor: "wokwi",
      parts: [
        { type: "wokwi-arduino-uno", id: "uno", top: 0, left: 0 },
        { type: "wokwi-led", id: "led1", top: 100, left: 300 }
      ],
      connections: [
        ["led1:A", "uno:9", "red"],
        ["led1:C", "uno:GND", "black"]
      ]
    },
    testCases: [
      {
        label: "LED should fade in and out smoothly using PWM",
        type: "pin_state",
        isHidden: false,
        pin: 9,
        expectedState: "PWM",
        order: 1
      }
    ]
  },
  {
    id: "arduino-practice-005",
    title: "Traffic Light Simulator",
    description: `# Traffic Light System

Simulate a traffic light using three LEDs (Red, Yellow, Green).

## Requirements:
- Red LED on pin 10 (5 seconds)
- Yellow LED on pin 11 (2 seconds)
- Green LED on pin 12 (5 seconds)
- Cycle: RED → YELLOW → GREEN → repeat

## Timing:
1. Red: 5 seconds
2. Yellow: 2 seconds
3. Green: 5 seconds

## Starter Template:
\`\`\`cpp
void setup() {
  // Configure LED pins
}

void loop() {
  // Implement traffic light sequence
}
\`\`\``,
    difficulty: "medium",
    tags: ["arduino", "gpio", "timing", "logic"],
    board: "uno",
    fqbn: "arduino:avr:uno",
    libraries: [] as string[],
    starterCode: `const int redPin = 10;
const int yellowPin = 11;
const int greenPin = 12;

void setup() {
  // Configure all LED pins as OUTPUT
  
}

void loop() {
  // Implement traffic light sequence
  
}`,
    simulationConfig: {
      version: 1,
      author: "CodeEthnics",
      editor: "wokwi",
      parts: [
        { type: "wokwi-arduino-uno", id: "uno", top: 0, left: 0 },
        { type: "wokwi-led", id: "red", top: 100, left: 250, attrs: { color: "red" } },
        { type: "wokwi-led", id: "yellow", top: 150, left: 250, attrs: { color: "yellow" } },
        { type: "wokwi-led", id: "green", top: 200, left: 250, attrs: { color: "green" } }
      ],
      connections: [
        ["red:A", "uno:10", "red"],
        ["red:C", "uno:GND", "black"],
        ["yellow:A", "uno:11", "orange"],
        ["yellow:C", "uno:GND", "black"],
        ["green:A", "uno:12", "green"],
        ["green:C", "uno:GND", "black"]
      ]
    },
    testCases: [
      {
        label: "Red LED should be on for 5 seconds",
        type: "pin_state",
        isHidden: false,
        pin: 10,
        expectedState: "HIGH",
        atMs: 1000,
        toleranceMs: 200,
        order: 1
      },
      {
        label: "Yellow LED should be on after red",
        type: "pin_state",
        isHidden: false,
        pin: 11,
        expectedState: "HIGH",
        atMs: 5500,
        toleranceMs: 200,
        order: 2
      },
      {
        label: "Green LED should be on after yellow",
        type: "pin_state",
        isHidden: false,
        pin: 12,
        expectedState: "HIGH",
        atMs: 7500,
        toleranceMs: 200,
        order: 3
      }
    ]
  }
];

async function seed() {
  console.log("🌱 Seeding database...\n");

  let adminUserId: string | null = null;

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, username: u.username, name: u.name, role: u.role, emailVerified: true },
      create: {
        email: u.email,
        username: u.username,
        name: u.name,
        passwordHash,
        role: u.role,
        emailVerified: true,
      },
    });

    console.log(`✓ ${user.role.padEnd(15)} ${user.email}  (password: ${u.password})`);

    if (u.role === "product_admin") {
      adminUserId = user.id;
    }
  }

  if (!adminUserId) {
    throw new Error("Unable to find product_admin user for MCQ seed");
  }

  const uniqueTagNames = Array.from(new Set(mcqQuestions.flatMap((question) => question.tags)));
  for (const tagName of uniqueTagNames) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: { type: "topic" },
      create: {
        name: tagName,
        type: "topic",
      },
    });
  }

  for (const question of mcqQuestions) {
    const tagConnections = question.tags.map((name) => ({ name }));

    await prisma.question.upsert({
      where: { id: question.id },
      update: {
        type: "mcq",
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        createdBy: adminUserId,
        options: question.options,
        correctAnswer: question.correctAnswer,
        tags: {
          set: [],
          connect: tagConnections,
        },
      },
      create: {
        id: question.id,
        type: "mcq",
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        createdBy: adminUserId,
        options: question.options,
        correctAnswer: question.correctAnswer,
        tags: {
          connect: tagConnections,
        },
      },
    });
  }

  console.log(`✓ Seeded ${mcqQuestions.length} MCQ practice questions`);

  for (const question of dsaQuestions) {
    const tagConnections = question.tags.map((name) => ({ name }));
    // Ensure tags exist
    for (const tagName of question.tags) {
      await prisma.tag.upsert({
        where: { name: tagName },
        update: { type: "topic" },
        create: { name: tagName, type: "topic" },
      });
    }

    await prisma.question.upsert({
      where: { id: question.id },
      update: {
        type: "dsa",
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        createdBy: adminUserId,
        hiddenTestCases: question.hiddenTestCases,
        tags: {
          set: [],
          connect: tagConnections,
        },
      },
      create: {
        id: question.id,
        type: "dsa",
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        createdBy: adminUserId,
        hiddenTestCases: question.hiddenTestCases,
        tags: {
          connect: tagConnections,
        },
      },
    });
  }

  console.log(`✓ Seeded ${dsaQuestions.length} DSA practice questions`);

  // ─── Seed Arduino Problems ──────────────────────────────────────────────────
  console.log("\nSeeding Arduino problems...");
  
  for (const arduino of arduinoQuestions) {
    // Ensure Arduino-specific tags exist
    for (const tagName of arduino.tags) {
      await prisma.tag.upsert({
        where: { name: tagName },
        update: { type: "topic" },
        create: { name: tagName, type: "topic" },
      });
    }

    const tagConnections = arduino.tags.map((name) => ({ name }));

    // Create the base Question first
    const question = await prisma.question.upsert({
      where: { id: arduino.id },
      update: {
        type: "arduino",
        title: arduino.title,
        description: arduino.description,
        difficulty: arduino.difficulty,
        createdBy: adminUserId,
        tags: {
          set: [],
          connect: tagConnections,
        },
      },
      create: {
        id: arduino.id,
        type: "arduino",
        title: arduino.title,
        description: arduino.description,
        difficulty: arduino.difficulty,
        createdBy: adminUserId,
        tags: {
          connect: tagConnections,
        },
      },
    });

    // Create or update the ArduinoProblem
    await prisma.arduinoProblem.upsert({
      where: { questionId: question.id },
      update: {
        board: arduino.board,
        fqbn: arduino.fqbn,
        libraries: arduino.libraries,
        starterCode: arduino.starterCode,
        simulationConfig: arduino.simulationConfig,
      },
      create: {
        questionId: question.id,
        board: arduino.board,
        fqbn: arduino.fqbn,
        libraries: arduino.libraries,
        starterCode: arduino.starterCode,
        simulationConfig: arduino.simulationConfig,
      },
    });

    // Get the ArduinoProblem to link test cases
    const arduinoProblem = await prisma.arduinoProblem.findUnique({
      where: { questionId: question.id }
    });

    if (!arduinoProblem) {
      console.error(`Arduino problem not found for question ${question.id}`);
      continue;
    }

    // Create test cases for the Arduino problem
    for (const testCase of arduino.testCases) {
      await prisma.arduinoTestCase.create({
        data: {
          problemId: arduinoProblem.id,
          label: testCase.label,
          type: testCase.type,
          isHidden: testCase.isHidden,
          pin: testCase.pin,
          expectedState: testCase.expectedState,
          atMs: testCase.atMs,
          toleranceMs: testCase.toleranceMs,
          expectedOutput: testCase.expectedOutput,
          order: testCase.order,
        },
      });
    }
  }

  console.log(`✓ Seeded ${arduinoQuestions.length} Arduino problems with test cases`);

  // ─── Seed Daily Challenges ──────────────────────────────────────────────────
  // Note: DailyChallenge model not yet implemented in schema
  // Uncomment when model is added to Prisma schema
  
  // const { default: dailyChallengesData } = await import("../data/daily-challenges.json", { with: { type: "json" } });
  // const now = new Date();
  // for (const entry of dailyChallengesData) {
  //   const challengeDate = new Date(
  //     Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + entry.daysFromToday)
  //   );
  //   await prisma.dailyChallenge.upsert({
  //     where: { date: challengeDate },
  //     update: {
  //       questionId: entry.questionId,
  //       createdBy: adminUserId,
  //     },
  //     create: {
  //       questionId: entry.questionId,
  //       date: challengeDate,
  //       createdBy: adminUserId,
  //     },
  //   });
  // }
  // console.log(`✓ Seeded ${dailyChallengesData.length} daily challenges`);

  console.log("\n✅ Seed complete.");
}

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());