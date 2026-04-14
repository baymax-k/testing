import { Response } from 'express';
import type { AuthRequest } from '../../../middleware/auth';

export class ArduinoHardwareController {

  // Get hardware upload instructions
  async getUploadInstructions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const instructions = {
        overview: "Upload compiled Arduino code to physical hardware",
        
        supportedBoards: [
          {
            name: "Arduino Uno",
            board: "uno",
            fqbn: "arduino:avr:uno",
            processor: "ATmega328P",
            uploadSpeed: "115200",
            programmer: "arduino"
          },
          {
            name: "Arduino Mega 2560", 
            board: "mega",
            fqbn: "arduino:avr:mega",
            processor: "ATmega2560",
            uploadSpeed: "115200",
            programmer: "wiring"
          }
        ],

        prerequisites: [
          "Physical Arduino board (Uno/Mega)",
          "USB cable (Type A to Type B)",
          "Arduino IDE or arduino-cli installed on your computer",
          "Compiled HEX file from CodeEthnics platform"
        ],

        steps: [
          {
            step: 1,
            title: "Download HEX File",
            description: "Download the compiled HEX file from your successful submission",
            commands: [],
            notes: "The HEX file contains the compiled machine code for your Arduino"
          },
          {
            step: 2,
            title: "Connect Arduino Board",
            description: "Connect your Arduino to your computer via USB cable",
            commands: [],
            notes: "Make sure the power LED on the Arduino lights up"
          },
          {
            step: 3,
            title: "Identify COM Port (Windows)",
            description: "Find which COM port your Arduino is connected to",
            commands: [
              "# Open Device Manager",
              "# Look under 'Ports (COM & LPT)'",
              "# Note the COM port (e.g., COM3, COM4)"
            ],
            notes: "The port usually appears as 'Arduino Uno (COM3)'"
          },
          {
            step: 4,
            title: "Identify Device (Linux/Mac)",
            description: "Find the device path for your Arduino",
            commands: [
              "# Linux:",
              "dmesg | grep tty",
              "ls /dev/ttyACM* /dev/ttyUSB*",
              "",
              "# Mac:",
              "ls /dev/cu.usbmodem* /dev/cu.usbserial*"
            ],
            notes: "Common paths: /dev/ttyACM0 (Linux), /dev/cu.usbmodem14101 (Mac)"
          },
          {
            step: 5,
            title: "Upload using Arduino CLI",
            description: "Use arduino-cli to upload the HEX file",
            commands: [
              "# Windows:",
              "arduino-cli upload -p COM3 --fqbn arduino:avr:uno --input-file sketch.hex",
              "",
              "# Linux/Mac:",
              "arduino-cli upload -p /dev/ttyACM0 --fqbn arduino:avr:uno --input-file sketch.hex",
              "",
              "# For Arduino Mega:",
              "arduino-cli upload -p [PORT] --fqbn arduino:avr:mega --input-file sketch.hex"
            ],
            notes: "Replace [PORT] with your actual port and adjust FQBN for your board"
          },
          {
            step: 6,
            title: "Upload using Arduino IDE",
            description: "Alternative method using Arduino IDE",
            commands: [
              "1. Open Arduino IDE",
              "2. Go to Tools > Board > Select your board (Uno/Mega)",
              "3. Go to Tools > Port > Select your COM port",
              "4. Go to Sketch > Upload Using Programmer",
              "5. Select 'AVR ISP' or 'Arduino as ISP'",
              "6. Use Tools > Burn Bootloader if needed"
            ],
            notes: "You may need to create a minimal sketch and replace the HEX file manually"
          },
          {
            step: 7,
            title: "Using avrdude directly",
            description: "Advanced users can use avrdude for direct HEX upload",
            commands: [
              "# Arduino Uno:",
              "avrdude -c arduino -p atmega328p -P [PORT] -b 115200 -U flash:w:sketch.hex",
              "",
              "# Arduino Mega:",
              "avrdude -c wiring -p atmega2560 -P [PORT] -b 115200 -U flash:w:sketch.hex",
              "",
              "# Example for Windows:",
              "avrdude -c arduino -p atmega328p -P COM3 -b 115200 -U flash:w:sketch.hex"
            ],
            notes: "avrdude is included with Arduino IDE installation"
          }
        ],

        troubleshooting: [
          {
            problem: "Port not found / Access denied",
            solutions: [
              "Check USB cable connection",
              "Try a different USB port",
              "Restart Arduino IDE",
              "On Linux: Add user to dialout group: sudo usermod -a -G dialout $USER",
              "On Windows: Install Arduino drivers"
            ]
          },
          {
            problem: "Upload fails / Timeout",
            solutions: [
              "Press reset button on Arduino before uploading",
              "Check if another program is using the serial port",
              "Try lowering baud rate to 57600",
              "Use different USB cable",
              "Try uploading a simple blink sketch first"
            ]
          },
          {
            problem: "Wrong board type error",
            solutions: [
              "Verify FQBN matches your physical board",
              "Check board selection in Arduino IDE",
              "Ensure you're using the correct HEX file for your board type"
            ]
          }
        ],

        additionalResources: [
          {
            title: "Arduino CLI Documentation",
            url: "https://arduino.github.io/arduino-cli/"
          },
          {
            title: "Arduino IDE Download", 
            url: "https://www.arduino.cc/en/software"
          },
          {
            title: "avrdude Manual",
            url: "https://www.nongnu.org/avrdude/user-manual/avrdude.html"
          }
        ],

        tips: [
          "Always disconnect power when wiring circuits",
          "Use the same board type for compilation and upload",
          "Keep HEX files organized by problem and submission",
          "Test with a simple blink program first",
          "Some boards may require pressing reset during upload"
        ]
      };

      res.json({
        success: true,
        data: instructions
      });
    } catch (error: any) {
      console.error('Hardware upload instructions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get upload instructions',
        message: error.message
      });
    }
  }
}