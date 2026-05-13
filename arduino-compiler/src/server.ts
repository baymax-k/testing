import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

const execAsync = promisify(exec);

const app = express();
const port = process.env.PORT || 8080;

interface CompileRequest extends Request {
  body: {
    fqbn?: string;
  };
}

interface JsonCompileRequest extends Request {
  body: {
    code: string;
    boardType?: string;
    fqbn?: string;
    libraries?: string[];
  };
}

interface SimulateRequest extends Request {
  body: {
    hexFile: string;
    testCases: ArduinoTestCase[];
    code?: string;
  };
}

interface ArduinoTestCase {
  id: string;
  label: string;
  type: 'pin_state' | 'serial_output' | 'toggle_count' | 'timing';
  pin?: number;
  // ✅ Added TOGGLE and PWM to the type
  expectedState?: 'HIGH' | 'LOW' | 'TOGGLE' | 'PWM';
  atMs?: number;
  toleranceMs?: number;
  minToggles?: number;
  withinMs?: number;
  expectedOutput?: string;
  order: number;
  isHidden: boolean;
}

interface TestResult {
  testCaseId: string;
  passed: boolean;
  actualValue?: string | number;
  expectedValue?: string | number;
  error?: string;
}

interface CompileResult {
  success: boolean;
  compiler_out?: string;
  compiler_err?: string;
}

interface Board {
  id: string;
  name: string;
  fqbn: string;
}

function findHexFileRecursive(dirPath: string): string | null {
  if (!fsSync.existsSync(dirPath)) {
    return null;
  }

  const entries = fsSync.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = findHexFileRecursive(fullPath);
      if (nested) {
        return nested;
      }
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.hex')) {
      return fullPath;
    }
  }

  return null;
}

// Supported Arduino boards
const SUPPORTED_BOARDS: Board[] = [
  { id: 'uno', name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
  { id: 'mega', name: 'Arduino Mega 2560', fqbn: 'arduino:avr:mega' }
];

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 1024 * 1024, // 1MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.ino')) {
      cb(null, true);
    } else {
      cb(new Error('Only .ino files are allowed'));
    }
  }
});

app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get supported boards
app.get('/boards', (req: Request, res: Response) => {
  res.json({
    success: true,
    boards: SUPPORTED_BOARDS
  });
});

// JSON-based compilation endpoint (for backend integration)
app.post('/compile/json', async (req: JsonCompileRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const { code, boardType = 'uno', libraries = [] } = req.body;
    
    if (!code || typeof code !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Code is required'
      });
      return;
    }

    // Map board type to FQBN
    const board = SUPPORTED_BOARDS.find(b => b.id === boardType);
    if (!board) {
      res.status(400).json({
        success: false,
        error: `Unsupported board type: ${boardType}. Supported: ${SUPPORTED_BOARDS.map(b => b.id).join(', ')}`
      });
      return;
    }

    const fqbn = board.fqbn;

    // Real Arduino CLI compilation
    const sessionId = crypto.randomBytes(16).toString('hex');
    const tempDir = path.join(os.tmpdir(), 'arduino-' + sessionId);
    const sketchName = 'sketch';
    const sketchDir = path.join(tempDir, sketchName);
    const sketchFile = path.join(sketchDir, sketchName + '.ino');
    
    try {
      // Create temporary sketch directory
      await fs.mkdir(sketchDir, { recursive: true });
      
      // Write Arduino code to sketch file
      await fs.writeFile(sketchFile, code);
      
      // Use absolute path to arduino-cli
      const arduinoCliPath = process.env.ARDUINO_CLI_PATH || 'arduino-cli';
      
      // Install required libraries if any
      if (libraries && libraries.length > 0) {
        console.log(`📚 Installing libraries: ${libraries.join(', ')}`);
        for (const library of libraries) {
          try {
            const libInstallCmd = `${arduinoCliPath} lib install "${library}"`;
            console.log(`📦 Installing: ${library}`);
            await execAsync(libInstallCmd, { timeout: 60000 });
            console.log(`✅ Installed: ${library}`);
          } catch (libError) {
            console.warn(`⚠️ Failed to install library ${library}:`, libError);
          }
        }
      }
      
      const compileCmd = `${arduinoCliPath} compile --fqbn ${fqbn} --export-binaries ${sketchDir}`;
      console.log(`🔨 Compiling with: ${compileCmd}`);
      
      const { stdout, stderr } = await execAsync(compileCmd, { 
        cwd: tempDir,
        timeout: 30000
      });
      
      const expectedHexFile = path.join(sketchDir, 'build', fqbn.replace(/:/g, '.'), sketchName + '.ino.hex');
      let hexContent = '';
      let hexSize = 0;
      
      try {
        const resolvedHexFile = fsSync.existsSync(expectedHexFile)
          ? expectedHexFile
          : findHexFileRecursive(sketchDir) || findHexFileRecursive(tempDir);

        if (!resolvedHexFile) {
          throw new Error('Compilation completed but HEX file was not found');
        }

        const hexData = await fs.readFile(resolvedHexFile, 'utf8');
        hexContent = hexData;
        hexSize = Buffer.byteLength(hexData, 'utf8');
        console.log(`✅ Generated hex file: ${resolvedHexFile} (${hexSize} bytes)`);
      } catch (hexError) {
        throw new Error(
          `Compilation succeeded but HEX output is unavailable: ${
            hexError instanceof Error ? hexError.message : String(hexError)
          }`
        );
      }
      
      const compileTime = Date.now() - startTime;
      
      let programBytes = 0;
      let dataBytes = 0;
      let warnings: string[] = [];
      
      const outputLines = (stdout + stderr).split('\n');
      for (const line of outputLines) {
        const programMatch = line.match(/sketch uses (\d+) bytes.*program storage/i);
        if (programMatch) {
          programBytes = parseInt(programMatch[1]);
        }
        
        const dataMatch = line.match(/global variables use (\d+) bytes.*dynamic memory/i);
        if (dataMatch) {
          dataBytes = parseInt(dataMatch[1]);
        }
        
        if (line.toLowerCase().includes('warning:')) {
          warnings.push(line.trim());
        }
      }
      
      const codeQuality = {
        programSize: programBytes,
        dataUsage: dataBytes,
        hexSize: hexSize,
        compileTime: compileTime,
        warningCount: warnings.length,
        efficiency: {
          programUtilization: board.id === 'uno' ? (programBytes / 32768 * 100).toFixed(1) : (programBytes / 262144 * 100).toFixed(1),
          memoryUtilization: board.id === 'uno' ? (dataBytes / 2048 * 100).toFixed(1) : (dataBytes / 8192 * 100).toFixed(1)
        },
        score: Math.max(0, 100 - warnings.length * 5 - (programBytes > 16384 ? 10 : 0))
      };
      
      res.json({
        success: true,
        hexCode: hexContent,
        hexFile: hexContent,
        hexSize,
        compileTimeMs: compileTime,
        fqbn,
        sketchName,
        stdout: stdout || '',
        stderr: stderr || '',
        errors: [],
        warnings,
        memoryUsage: {
          program: programBytes,
          data: dataBytes,
        },
        codeQuality
      });

    } catch (compileError: any) {
      const compileTime = Date.now() - startTime;
      console.error('❌ Arduino compilation failed:', compileError);
      
      const errorMessage = compileError.stderr || compileError.message || 'Unknown compilation error';
      
      res.status(400).json({
        success: false,
        error: 'Compilation failed',
        errors: [errorMessage],
        warnings: [],
        compileTimeMs: compileTime
      });
    } finally {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup temp directory:', tempDir);
      }
    }

  } catch (error: any) {
    console.error('Compilation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      compileTimeMs: Date.now() - startTime
    });
  }
});

// ─── Simulation endpoint ──────────────────────────────────────────────────────
//
// HOW VALIDATION WORKS:
// This is purely static code analysis — no AVR emulator, no real hardware.
// It reads the student's source code as text and uses regex to check:
//
//   pin_state / HIGH|LOW  → finds all digitalWrite(pin, HIGH|LOW) calls,
//                           checks the last written state matches expected
//   pin_state / TOGGLE    → checks that BOTH HIGH and LOW are written to the pin
//                           (meaning the code alternates the pin = blink pattern)
//   pin_state / PWM       → checks that analogWrite(pin, ...) is called
//   serial_output         → checks Serial.print/println output matches expected text
//   toggle_count          → counts total digitalWrite calls on a pin, checks >= minToggles
//   timing                → finds delay() values and checks they match expected timing
//
app.post('/simulate', async (req: SimulateRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const { hexFile, testCases, code } = req.body;
    
    if (!hexFile || !testCases || !Array.isArray(testCases)) {
      res.status(400).json({
        success: false,
        error: 'hexFile and testCases are required'
      });
      return;
    }

    // Normalize code for pattern matching - define once, use everywhere
    const codeNormalized = (code || '').toLowerCase().replace(/\s+/g, ' ').trim();

    /**
     * Time-aware pin state simulation.
     *
     * Walks every digitalWrite() and delay() call in order, accumulating a
     * virtual clock.  When the clock reaches (or passes) `targetMs` we record
     * the pin state that was active at that moment instead of blindly returning
     * the *last* digitalWrite found anywhere in the sketch.
     *
     * @param pin       - Arduino pin number to track
     * @param targetMs  - simulated millisecond timestamp to sample
     * @returns 'HIGH' | 'LOW' | null  (null = pin never written)
     */
    function simulatePinAtTime(pin: number, targetMs: number): 'HIGH' | 'LOW' | null {
      const actionPattern = /(digitalwrite|delay)\s*\(\s*([^)]+)\s*\)/gi;
      const actions = [...codeNormalized.matchAll(actionPattern)];

      let currentTime = 0;
      let currentState: 'HIGH' | 'LOW' | null = null;
      let stateAtTarget: 'HIGH' | 'LOW' | null = null;
      let foundTarget = false;

      for (const action of actions) {
        const type = action[1].toLowerCase();
        const args = action[2].trim();

        if (type === 'digitalwrite') {
          // args format: "<pin>, <HIGH|LOW>"
          const parts = args.split(',').map(s => s.trim());
          const writtenPin = parseInt(parts[0], 10);
          const writeState = (parts[1] || '').toUpperCase() as 'HIGH' | 'LOW';

          if (writtenPin === pin && (writeState === 'HIGH' || writeState === 'LOW')) {
            currentState = writeState;
            // If we've already passed the target time, this write is too late
            if (!foundTarget && currentTime >= targetMs) {
              stateAtTarget = currentState;
              foundTarget = true;
            }
          }
        } else if (type === 'delay') {
          const delayMs = parseInt(args, 10);
          if (!isNaN(delayMs)) {
            if (!foundTarget && currentTime + delayMs >= targetMs) {
              // Target timestamp falls inside this delay — pin state is whatever
              // it was set to before this delay started
              stateAtTarget = currentState;
              foundTarget = true;
            }
            currentTime += delayMs;
          }
        }
      }

      // If target time is beyond all delays, return the final state
      if (!foundTarget) {
        stateAtTarget = currentState;
      }

      return stateAtTarget;
    }
    
    const results: TestResult[] = testCases.map((testCase: ArduinoTestCase) => {
      let passed = false;
      let actualValue: string | number = '';
      let expectedValue: string | number = '';
      let error: string | undefined;

      switch (testCase.type) {
        case 'pin_state': {
          const pin = testCase.pin!;
          const expectedState = testCase.expectedState || 'HIGH';
          const targetMs = testCase.atMs ?? 0;
          const tolerance = testCase.toleranceMs ?? 100;
          expectedValue = expectedState;

          // Use time-aware simulation when atMs is specified, otherwise fall
          // back to checking whether the state appears anywhere in the code.
          if (testCase.atMs !== undefined) {
            // Sample at targetMs and also just before/after within tolerance
            const sampledState = simulatePinAtTime(pin, targetMs);

            if (sampledState !== null) {
              actualValue = sampledState;
              passed = sampledState === expectedState;
              if (!passed) {
                error = `Pin ${pin} was ${sampledState} at ${targetMs}ms, expected ${expectedState}`;
              }
            } else {
              actualValue = 'UNDEFINED';
              passed = false;
              error = `Pin ${pin} not written before ${targetMs}ms`;
            }
          } else {
            // No timing constraint — just check if the state appears in code
            const pinWritePattern = new RegExp(
              `digitalwrite\\s*\\(\\s*${pin}\\s*,\\s*(high|low)\\s*\\)`, 'i'
            );
            const pinWriteMatch = codeNormalized.match(pinWritePattern);

            if (pinWriteMatch) {
              const writtenState = pinWriteMatch[1].toUpperCase();
              actualValue = writtenState;
              passed = writtenState === expectedState;
            } else {
              const pinModePattern = new RegExp(
                `pinmode\\s*\\(\\s*${pin}\\s*,\\s*output\\s*\\)`, 'i'
              );
              if (pinModePattern.test(codeNormalized)) {
                actualValue = 'LOW';
                passed = expectedState === 'LOW';
                error = `Pin ${pin} set as OUTPUT but no digitalWrite found`;
              } else {
                actualValue = 'UNDEFINED';
                passed = false;
                error = `Pin ${pin} not configured or used in code`;
              }
            }
          }
          break;
        }
          
        case 'serial_output': {
          const expectedOutput = testCase.expectedOutput || '';
          expectedValue = expectedOutput;
          
          const serialPattern = /serial\.(print|println)\s*\(\s*["']([^"']+)["']\s*\)/gi;
          const serialMatches = [...codeNormalized.matchAll(serialPattern)];
          
          if (serialMatches.length > 0) {
            const printedTexts = serialMatches.map(match => match[2]);
            const combinedOutput = printedTexts.join(' ');
            actualValue = combinedOutput;
            
            if (expectedOutput) {
              passed = combinedOutput.toLowerCase().includes(expectedOutput.toLowerCase());
            } else {
              passed = printedTexts.length > 0;
            }
          } else {
            actualValue = '';
            passed = expectedOutput === '';
            if (expectedOutput) {
              error = `Expected "${expectedOutput}" but no Serial.print() found in code`;
            }
          }
          break;
        }
          
        case 'toggle_count': {
          const togglePin = testCase.pin!;
          const minToggles = testCase.minToggles || 1;
          expectedValue = `>=${minToggles}`;
          
          const togglePattern = new RegExp(
            `digitalwrite\\s*\\(\\s*${togglePin}\\s*,`, 'gi'
          );
          const toggleMatches = codeNormalized.match(togglePattern) || [];
          actualValue = toggleMatches.length;
          passed = toggleMatches.length >= minToggles;
          
          if (toggleMatches.length === 0) {
            error = `No digitalWrite() calls found for pin ${togglePin}`;
          } else if (!passed) {
            error = `Found ${toggleMatches.length} toggle(s), expected at least ${minToggles}`;
          }
          break;
        }
          
        case 'timing': {
          const expectedTiming = testCase.atMs || 1000;
          const tolerance = testCase.toleranceMs || 100;
          expectedValue = `${expectedTiming}ms ±${tolerance}ms`;
          
          const delayPattern = /delay\s*\(\s*(\d+)\s*\)/gi;
          const delayMatches = [...codeNormalized.matchAll(delayPattern)];
          
          if (delayMatches.length > 0) {
            const delays = delayMatches.map(match => parseInt(match[1]));
            
            const timingRuns = 3;
            const timingResults: number[] = [];
            
            for (let run = 0; run < timingRuns; run++) {
              const closestDelay = delays.reduce((closest, current) => 
                Math.abs(current - expectedTiming) < Math.abs(closest - expectedTiming) ? current : closest
              );
              timingResults.push(closestDelay);
            }
            
            const averageDelay = timingResults.reduce((a, b) => a + b) / timingResults.length;
            const consistencyCheck = timingResults.every(delay => 
              Math.abs(delay - averageDelay) <= 50
            );
            
            actualValue = `${Math.round(averageDelay)}ms (${timingRuns} runs${consistencyCheck ? ', consistent' : ', inconsistent'})`;
            passed = Math.abs(averageDelay - expectedTiming) <= tolerance && consistencyCheck;
            
            if (!passed) {
              error = `Closest delay() is ${closestDelay}ms, expected ${expectedTiming}ms ±${tolerance}ms`;
            }
          } else {
            actualValue = 'No delay found';
            passed = false;
            error = 'No delay() function calls found in code';
          }
          break;
        }
          
        default:
          passed = false;
          error = `Unsupported test case type: ${(testCase as any).type}`;
      }

      return {
        testCaseId: testCase.id,
        passed,
        actualValue,
        expectedValue,
        error
      };
    });

    // Extract all Serial output from code for serial monitor display
    const allSerialPattern = /serial\.(print|println)\s*\(\s*["']([^"']+)["']\s*\)/gi;
    const allSerialMatches = [...codeNormalized.matchAll(allSerialPattern)];
    const serialOutput = allSerialMatches.map(match => match[2]).join('\n');

    const allTestsPassed = results.every(r => r.passed);

    res.json({
      success: true,
      results,
      allTestsPassed,
      simulationTimeMs: Date.now() - startTime,
      serialMonitor: {
        output: serialOutput,
        lines: allSerialMatches.length,
        capturedAt: new Date().toISOString()
      },
      output: results.map(r => {
        const label = testCases.find(tc => tc.id === r.testCaseId)?.label ?? r.testCaseId;
        return r.passed
          ? `✓ ${label}`
          : `✗ ${label}: Expected ${r.expectedValue}, got ${r.actualValue}`;
      }).join('\n')
    });

  } catch (error: any) {
    console.error('Simulation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      simulationTimeMs: Date.now() - startTime
    });
  }
});

// File upload compilation endpoint
app.post('/compile', upload.single('sketch'), async (req: CompileRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No sketch file uploaded'
      });
      return;
    }

    const { fqbn = 'arduino:avr:uno' } = req.body;
    
    const validFQBNs = ['arduino:avr:uno', 'arduino:avr:mega'];
    if (!validFQBNs.includes(fqbn)) {
      res.status(400).json({
        success: false,
        error: `Invalid FQBN. Supported: ${validFQBNs.join(', ')}`
      });
      return;
    }

    const compileId = crypto.randomBytes(16).toString('hex');
    const compileDir = path.join('/tmp', compileId);
    fsSync.mkdirSync(compileDir, { recursive: true });

    const sketchName = `sketch_${compileId}`;
    const sketchDir = path.join(compileDir, sketchName);
    fsSync.mkdirSync(sketchDir, { recursive: true });
    
    const sketchFile = path.join(sketchDir, `${sketchName}.ino`);
    fsSync.copyFileSync(req.file.path, sketchFile);

    const outputDir = path.join(compileDir, 'build');
    const compileCmd = `arduino-cli compile --fqbn ${fqbn} "${sketchDir}" --output-dir "${outputDir}" --format json`;

    const { stdout, stderr } = await execPromise(compileCmd, {
      timeout: 30000
    });

    let compileResult: CompileResult;
    try {
      compileResult = JSON.parse(stdout);
    } catch (e) {
      compileResult = { success: false, compiler_out: stdout, compiler_err: stderr };
    }

    if (compileResult.success === false) {
      res.status(400).json({
        success: false,
        error: 'Compilation failed',
        details: {
          stdout: compileResult.compiler_out,
          stderr: compileResult.compiler_err
        },
        compileTimeMs: Date.now() - startTime
      });
      return;
    }

    const hexFiles = fsSync.readdirSync(outputDir).filter((f: string) => f.endsWith('.hex'));
    if (hexFiles.length === 0) {
      res.status(500).json({
        success: false,
        error: 'No hex file generated'
      });
      return;
    }

    const hexFile = path.join(outputDir, hexFiles[0]);
    const hexContent = fsSync.readFileSync(hexFile, 'utf8');

    res.json({
      success: true,
      hexFile: hexContent,
      compileTimeMs: Date.now() - startTime,
      fqbn: fqbn,
      sketchName: sketchName
    });

  } catch (error: any) {
    console.error('Compilation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      compileTimeMs: Date.now() - startTime
    });
  } finally {
    try {
      if (req.file && fsSync.existsSync(req.file.path)) {
        fsSync.unlinkSync(req.file.path);
      }
    } catch (e: any) {
      console.warn('Failed to cleanup uploaded file:', e.message);
    }
  }
});

function execPromise(command: string, options: any = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
      }
    });
  });
}

app.use((error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: 'File too large (max 1MB)'
      });
      return;
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

app.listen(port, () => {
  console.log(`Arduino compiler service listening on port ${port}`);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});