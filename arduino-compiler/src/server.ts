import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const app = express();
const port = process.env.PORT || 8080;

interface CompileRequest extends Request {
  body: {
    fqbn?: string;
  };
}

interface CompileResult {
  success: boolean;
  compiler_out?: string;
  compiler_err?: string;
}

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

// Compilation endpoint
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
    
    // Validate FQBN
    const validFQBNs = ['arduino:avr:uno', 'arduino:avr:mega'];
    if (!validFQBNs.includes(fqbn)) {
      res.status(400).json({
        success: false,
        error: `Invalid FQBN. Supported: ${validFQBNs.join(', ')}`
      });
      return;
    }

    // Generate unique compilation directory
    const compileId = crypto.randomBytes(16).toString('hex');
    const compileDir = path.join('/tmp', compileId);
    fs.mkdirSync(compileDir, { recursive: true });

    // Copy uploaded file to sketch directory with .ino extension
    const sketchName = `sketch_${compileId}`;
    const sketchDir = path.join(compileDir, sketchName);
    fs.mkdirSync(sketchDir, { recursive: true });
    
    // Arduino CLI requires the .ino file to have the same name as the folder
    const sketchFile = path.join(sketchDir, `${sketchName}.ino`);
    fs.copyFileSync(req.file.path, sketchFile);

    // Compile with arduino-cli
    const outputDir = path.join(compileDir, 'build');
    const compileCmd = `arduino-cli compile --fqbn ${fqbn} "${sketchDir}" --output-dir "${outputDir}" --format json`;

    const { stdout, stderr } = await execPromise(compileCmd, {
      timeout: 30000 // 30 second timeout
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

    // Find the .hex file
    const hexFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.hex'));
    if (hexFiles.length === 0) {
      res.status(500).json({
        success: false,
        error: 'No hex file generated'
      });
      return;
    }

    const hexFile = path.join(outputDir, hexFiles[0]);
    const hexContent = fs.readFileSync(hexFile, 'utf8');

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
    // Cleanup: remove uploaded file and compilation directory
    try {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (e: any) {
      console.warn('Failed to cleanup uploaded file:', e.message);
    }
  }
});

// Utility function to promisify exec
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

// Error handling middleware
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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});