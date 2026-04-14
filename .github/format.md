# Code Editor Panel Data Format & Sample Data

This document outlines the required data structure for the left (Problem/Theory) and right (Editor/Execution) panels of the CodeEthnics editor, supporting DSA, Arduino, and other problem types.

---

## 1. DATA FORMAT (JSON SCHEMA)

### A. LEFT PANEL (Problem Statement / Learning Content)
{
  "id": "string",
  "type": "dsa" | "arduino" | "mcq" | "theory",
  "title": "string",
  "difficulty": "easy" | "medium" | "hard",
  "tags": ["string"],
  "content": {
    "description": "markdown/string",
    "input_format": "string",
    "output_format": "string",
    "constraints": ["string"],
    "examples": [
      {
        "input": "string",
        "output": "string",
        "explanation": "string"
      }
    ],
"hints": ["string"],          // optional, shown progressively


    // Arduino specific
    "circuit_diagram": "url/mermaid_code",
    "components": ["string"],
    "pin_mapping": "Record<string, string>"
  }
}



// ── RIGHT PANEL ────────────────────────────────────────────────
{
  "id": "string",

  // DSA fields
  "languages": [
    { "id": 71, "name": "python3", "displayName": "Python 3" },
    { "id": 54, "name": "cpp",     "displayName": "C++ 17"   }
  ],
  "default_language": 71,
  "starter_code": { "python3": "string", "cpp": "string" },
  "driver_code":  { "python3": "string", "cpp": "string" },
  "test_cases": {
    "public":  [{ "input": "string", "output": "string" }],
    "hidden":  [{ "input": "string", "output": "string" }]
  },
  "time_limit_ms": 2000,
  "memory_limit_mb": 256,

  // Arduino fields
  "board": "uno" | "nano" | "mega" | "esp32",
  "fqbn": "arduino:avr:uno",
  "libraries": ["string"],
  "simulation_config": {
    "version": 1,
    "author": "string",
    "editor": "wokwi",
    "parts": [
      { "id": "string", "type": "string", "top": 0, "left": 0, "rotate": 0, "attrs": {} }
    ],
    "connections": [
      ["sourceId:pin", "targetId:pin", "wireColor", ["routing"]]
    ],
    "serialMonitor": { "display": "terminal" }
  },
  "test_cases_arduino": {
    "public": [
      {
        "id": "string",
        "label": "string",
        "type": "pin_state" | "toggle_count" | "serial_output",
        "pin": 13,
        "expected_state": "HIGH" | "LOW",
        "at_ms": 500,
        "tolerance_ms": 100,
        "min_toggles": 6,
        "within_ms": 7000,
        "expected_output": "string"
      }
    ],
    "hidden": []
  },

  // MCQ fields  ← INSIDE the object, not after the closing brace
  "interaction_type": "single_choice" | "multi_choice",
  "questions": [
    {
      "id": "string",
      "question": "string",
      "options": [{ "id": "a", "text": "string" }],
      "correct": ["a"],
      "explanation": "string"
    }
  ],
  "passing_score": 70
}



---

## 2. SAMPLE DATA

### SAMPLE 1: DSA (Two Sum)
[LEFT PANEL]
- Title: Two Sum
- Difficulty: Easy
- Description: Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.
- Examples: 
  Input: nums = [2,7,11,15], target = 9
  Output: [0,1]
  Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].

[RIGHT PANEL]
- Starter Code (Python): 
  class Solution:
      def twoSum(self, nums: List[int], target: int) -> List[int]:
          # Write your code here
          pass

---

### SAMPLE 2: ARDUINO (Blink LED)
[LEFT PANEL]
- Title: LED Blinking Control
- Description: Program the microcontroller to blink an external LED connected to Pin 13 every 1 second.
- Components: ["Arduino Uno", "LED", "220 Ohm Resistor", "Jumper Wires"]
- Pin Mapping: { "13": "LED Anode", "GND": "LED Cathode through resistor" }
- Diagram: (Mermaid)
  graph LR
  Arduino[Digital Pin 13] --> LED[LED Anode]
  LED --> Resistor[220 Ohm Resistor]
  Resistor --> GND[Ground]








[RIGHT PANEL]
- Board: uno
- Starter Code:
  void setup() {
    pinMode(13, OUTPUT);
  }
  void loop() {
    digitalWrite(13, HIGH);
    delay(1000);
    digitalWrite(13, LOW);
    delay(1000);
  }

"simulation_config": {
  "version": 1,
  "author": "CodeEthnics",
  "editor": "wokwi",
  "parts": [
    { "id": "uno",  "type": "wokwi-arduino-uno", "top": 180, "left": 20,  "attrs": {} },
    { "id": "led1", "type": "wokwi-led",          "top": 60,  "left": 160, "attrs": { "color": "red" } },
    { "id": "r1",   "type": "wokwi-resistor",     "top": 130, "left": 160, "rotate": 90, "attrs": { "value": "220" } }
  ],
  "connections": [
    ["uno:13",  "r1:1",              "green", ["v0"]],
    ["r1:2",    "led1:A",            "green", ["v0"]],
    ["led1:C",  "uno:GND.1",         "black", ["v0"]],
    ["uno:TX",  "$serialMonitor:RX", "",      []],
    ["uno:RX",  "$serialMonitor:TX", "",      []]
  ],
  "serialMonitor": { "display": "terminal" }
}


---

### SAMPLE 3: MCQ / THEORY (JavaScript Event Loop)
[LEFT PANEL]
- Title: JavaScript Concurrency Model
- Description: An explanation of how the Event Loop, Call Stack, and Task Queues interact.
- Learning Sections: 
  1. The Call Stack (LIFO)
  2. Web APIs / Node APIs
  3. Callback Queue (Macrotasks)
  4. Microtask Queue (Promises)

[RIGHT PANEL]
- Interaction: Single Choice Questions
- Question: Which queue has higher priority?
- Options: [ "Macrotask Queue", "Microtask Queue" ]
- Correct: "Microtask Queue"




CodeEthnics — Question Submission Template
SECTION A — Coding / DSA Problem


A1 — Basic Details
Field
Your Answer
Question Title
[ e.g. Two Sum ]
Difficulty
[ Easy / Medium / Hard ]
Topic Tags
[ e.g. Arrays, HashMap, Sorting ]
Supported Languages
[ e.g. Python, C++, Java ]
Time Limit (seconds)
[ e.g. 2 ]
Memory Limit (MB)
[ e.g. 256 ]


A2 — Problem Statement
Description (Explain the problem clearly in plain English)
[ Write the full problem description here ]
Input Format (Describe what input the student's code will receive)
[ e.g. First line contains an integer n. Second line contains n space-separated integers. ]
Output Format (Describe what the student's code must return or print)
[ e.g. Print two integers — the indices of the two numbers that add up to target. ]
Constraints (One constraint per line)
[ e.g. 2 ≤ nums.length ≤ 10⁴ ]
[ e.g. -10⁹ ≤ nums[i] ≤ 10⁹ ]
[ e.g. Exactly one valid answer exists ]

A3 — Examples
Give at least 2 examples. Copy the block below for each additional example.
Example 1


Value
Input
[ e.g. nums = [2,7,11,15], target = 9 ]
Output
[ e.g. [0, 1] ]
Explanation
[ e.g. nums[0] + nums[1] = 2 + 7 = 9, so return [0, 1] ]

Example 2


Value
Input
[ ]
Output
[ ]
Explanation
[ ]


A4 — Test Cases
Public test cases are visible to the student. Hidden test cases are used only for grading — the student never sees them. Provide at least 3 public and 3 hidden test cases.
Public Test Cases (student can see these)
#
Input
Expected Output
1
[ ]
[ ]
2
[ ]
[ ]
3
[ ]
[ ]

Hidden Test Cases (for grading only)
#
Input
Expected Output
1
[ ]
[ ]
2
[ ]
[ ]
3
[ ]
[ ]

A5 — Hints (optional)
Hints are shown to the student one at a time if they ask for help. Order from least revealing to most revealing.
Hint
Text
Hint 1
[ e.g. Try using a HashMap to store values you've seen ]
Hint 2
[ e.g. For each number, check if target minus that number already exists ]


SECTION B — Arduino / Hardware Problem
Use this section for microcontroller and embedded programming problems (e.g. LED blinking, button input, PWM, Serial output, sensor reading, etc.)
Copy this entire section for each Arduino question you want to add.

B1 — Basic Details
Field
Your Answer
Question Title
[ e.g. Blink LED, Button-Controlled LED ]
Difficulty
[ Easy / Medium / Hard ]
Topic Tags
[ e.g. GPIO, PWM, Serial, I2C ]
Board
[ Arduino Uno / Arduino Nano / Arduino Mega / ESP32 ]


B2 — Problem Statement
Description (Explain in plain English what the student needs to program the board to do)
[ e.g. Write a program to blink an LED connected to pin 13.
  The LED should turn ON for 1 second and OFF for 1 second, repeating indefinitely. ]

B3 — Components & Circuit
Components Required (List every component the student needs)
#
Component
Quantity
1
Arduino Uno
1
2
[ e.g. LED (Red) ]
[ e.g. 1 ]
3
[ e.g. 220Ω Resistor ]
[ e.g. 1 ]
4
[ e.g. Jumper Wires ]
[ e.g. 2 ]
5
[ add more as needed ]



Pin Connections (Which pin connects to what)
Arduino Pin
Connects To
[ e.g. Pin 13 ]
[ e.g. LED Anode (positive leg) ]
[ e.g. GND ]
[ e.g. LED Cathode through 220Ω resistor ]
[ add more ]



Circuit Description (Describe the circuit in plain English — used to generate the diagram)
[ e.g. The anode (long leg) of the LED connects to pin 13 of the Arduino
  through a 220 ohm resistor. The cathode (short leg) connects to GND. ]

B5 — Expected Correct Behaviour
Describe exactly what the hardware should do when the student's solution is correct. Be specific — include pin numbers, timing, and serial output if relevant.
[ e.g. Pin 13 should be HIGH for exactly 1000ms, then LOW for exactly 1000ms,
  repeating indefinitely. The LED should visibly blink on and off every second. ]
B6 — Libraries Needed (if any)
(Leave blank if none)
[ e.g. Servo.h ]
[ e.g. Wire.h ]

B7 — Hints (optional)
Hint
Text’
Hint 1
[ ]



SECTION C — MCQ / Theory Question
Use this section for multiple choice questions. (e.g. Concept checks, "what does this code output", true/false, best practice questions)
Copy this entire section for each MCQ question you want to add.

C1 — Basic Details
Field
Your Answer
Question Title / Topic
[ e.g. JavaScript Event Loop ]
Difficulty
[ Easy / Medium / Hard ]
Topic Tags
[ e.g. JavaScript, Concurrency, Promises ]
Question Type
[ Single correct answer / Multiple correct answers ]


C2 — Question
Question Text (Write the full question exactly as the student should see it)
[ e.g. Which queue has higher priority in the JavaScript event loop? ]
(If the question includes a code snippet, paste it below)
javascript
// paste code snippet here if needed

C3 — Answer Options
Option
Text
A
[ e.g. Macrotask Queue (setTimeout, setInterval) ]
B
[ e.g. Microtask Queue (Promises, queueMicrotask) ]
C
[ optional ]
D
[ optional ]

Correct Answer(s) (Write the letter — e.g. "B" for single, "A, C" for multiple correct)
[ e.g. B ]

C4 — Explanation
(Shown to the student after they answer — explain why the correct answer is right)
[ e.g. Microtasks (Promises) are processed before macrotasks (setTimeout).
  After each task in the call stack completes, the engine clears the entire
  microtask queue before picking the next macrotask. ]

C5 — Hints (optional)
Hint
Text
Hint 1
[ ]
Hint 2
[ ]


f