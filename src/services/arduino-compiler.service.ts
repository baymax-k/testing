import axios, { AxiosResponse } from 'axios';

interface ArduinoTestCase {
  id: string;
  label: string;
  type: 'pin_state' | 'serial_output' | 'toggle_count' | 'timing';
  pin?: number;
  expectedState?: 'HIGH' | 'LOW';
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

interface CompileResponse {
  success: boolean;
  hexFile?: string;
  compileTimeMs: number;
  fqbn?: string;
  sketchName?: string;
  errors?: string[];
  warnings?: string[];
  error?: string;
}

interface SimulateResponse {
  success: boolean;
  results: TestResult[];
  allTestsPassed: boolean;
  simulationTimeMs: number;
  output?: string;
  error?: string;
}

interface Board {
  id: string;
  name: string;
  fqbn: string;
}

interface BoardsResponse {
  success: boolean;
  boards: Board[];
  error?: string;
}

class ArduinoCompilerService {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    // Get Arduino compiler service URL from environment or default
    this.baseUrl = process.env.ARDUINO_COMPILER_URL || 'http://localhost:8080';
    this.timeout = parseInt(process.env.ARDUINO_COMPILER_TIMEOUT || '30000');
  }

  /**
   * Check if Arduino compiler service is healthy
   */
  async healthCheck(): Promise<{ status: string; version: string } | null> {
    try {
      const response: AxiosResponse = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('Arduino compiler health check failed:', error);
      return null;
    }
  }

  /**
   * Compile Arduino code and return hex file
   */
  async compile(
    code: string, 
    boardType: string = 'uno', 
    libraries: string[] = []
  ): Promise<CompileResponse> {
    try {
      const response: AxiosResponse<CompileResponse> = await axios.post(
        `${this.baseUrl}/compile/json`,
        {
          code,
          boardType,
          libraries
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Arduino compilation failed:', error);
      
      // Handle axios errors
      if (error.response) {
        // Server responded with error status
        return error.response.data as CompileResponse;
      } else if (error.request) {
        // Request was made but no response received
        return {
          success: false,
          error: 'Arduino compiler service is unreachable',
          compileTimeMs: 0
        };
      } else {
        // Something else happened
        return {
          success: false,
          error: `Arduino compiler error: ${error.message}`,
          compileTimeMs: 0
        };
      }
    }
  }

  /**
   * Simulate Arduino hex file execution and validate test cases
   */
  async simulate(hexFile: string, testCases: ArduinoTestCase[]): Promise<SimulateResponse> {
    try {
      const response: AxiosResponse<SimulateResponse> = await axios.post(
        `${this.baseUrl}/simulate`,
        {
          hexFile,
          testCases
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Arduino simulation failed:', error);
      
      // Handle axios errors
      if (error.response) {
        return error.response.data as SimulateResponse;
      } else if (error.request) {
        return {
          success: false,
          results: [],
          allTestsPassed: false,
          simulationTimeMs: 0,
          error: 'Arduino compiler service is unreachable'
        };
      } else {
        return {
          success: false,
          results: [],
          allTestsPassed: false,
          simulationTimeMs: 0,
          error: `Arduino simulation error: ${error.message}`
        };
      }
    }
  }

  /**
   * Get supported Arduino boards
   */
  async getBoards(): Promise<BoardsResponse> {
    try {
      const response: AxiosResponse<BoardsResponse> = await axios.get(
        `${this.baseUrl}/boards`,
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Failed to get Arduino boards:', error);
      
      if (error.response) {
        return error.response.data as BoardsResponse;
      } else {
        return {
          success: false,
          boards: [],
          error: 'Failed to fetch Arduino boards'
        };
      }
    }
  }

  /**
   * Compile and validate Arduino code in one step
   * This is a convenience method for the full workflow
   */
  async compileAndValidate(
    code: string, 
    testCases: ArduinoTestCase[], 
    boardType: string = 'uno'
  ): Promise<{
    compileResult: CompileResponse;
    simulateResult?: SimulateResponse;
    success: boolean;
  }> {
    // Step 1: Compile the code
    const compileResult = await this.compile(code, boardType);
    
    if (!compileResult.success || !compileResult.hexFile) {
      return {
        compileResult,
        success: false
      };
    }

    // Step 2: Run simulation if compilation succeeded
    const simulateResult = await this.simulate(compileResult.hexFile, testCases);
    
    return {
      compileResult,
      simulateResult,
      success: simulateResult.success && simulateResult.allTestsPassed
    };
  }
}

// Export singleton instance
export const arduinoCompilerService = new ArduinoCompilerService();
export { ArduinoTestCase, TestResult, CompileResponse, SimulateResponse, Board };