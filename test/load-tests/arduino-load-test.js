import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');

// Load test configuration
export let options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 25 },   // Increase to 25 users  
    { duration: '2m', target: 50 },   // Peak at 50 concurrent compilations
    { duration: '1m', target: 25 },   // Ramp down
    { duration: '30s', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<30000'], // 95% of requests under 30s
    http_req_failed: ['rate<0.1'],      // Error rate under 10%
    errors: ['rate<0.1'],
  },
};

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'your-test-jwt-token';

// Sample Arduino code for testing
const testArduinoCode = `
void setup() {
  Serial.begin(9600);
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
  Serial.println("LED Blink!");
}
`;

export default function () {
  // Test Arduino compilation under load
  
  // 1. Submit compilation job
  const compilePayload = JSON.stringify({
    problemId: 'test-problem-id',
    code: testArduinoCode,
    boardType: 'uno'
  });

  const compileParams = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  };

  const compileResponse = http.post(
    `${BASE_URL}/api/v1/arduino/compile`,
    compilePayload,
    compileParams
  );

  // Check compilation job submission
  check(compileResponse, {
    'compile job submitted (202)': (r) => r.status === 202,
    'submission ID returned': (r) => r.json('data.submissionId') !== undefined,
  }) || errorRate.add(1);

  if (compileResponse.status === 202) {
    const submissionId = compileResponse.json('data.submissionId');
    
    // 2. Poll for compilation status (simulate realistic polling)
    let completed = false;
    let attempts = 0;
    const maxAttempts = 20; // 20 attempts = ~60 seconds max wait
    
    while (!completed && attempts < maxAttempts) {
      sleep(3); // Wait 3 seconds between polls
      attempts++;
      
      const statusResponse = http.get(
        `${BASE_URL}/api/v1/arduino/jobs/${submissionId}`,
        compileParams
      );
      
      check(statusResponse, {
        'status check successful': (r) => r.status === 200,
      }) || errorRate.add(1);
      
      if (statusResponse.status === 200) {
        const status = statusResponse.json('data.status');
        if (status === 'compiled' || status === 'failed') {
          completed = true;
          
          // Verify final result
          check(statusResponse, {
            'compilation completed': (r) => r.json('data.status') !== 'processing',
            'has compile time': (r) => r.json('data.result.compileTime') > 0,
          });
        }
      }
    }
    
    if (!completed) {
      console.warn(`Compilation ${submissionId} did not complete within ${maxAttempts * 3} seconds`);
      errorRate.add(1);
    }
  }

  // 3. Test queue stats endpoint (admin)
  const queueStatsResponse = http.get(
    `${BASE_URL}/api/v1/arduino/admin/queue/stats`,
    compileParams
  );

  check(queueStatsResponse, {
    'queue stats accessible': (r) => r.status === 200 || r.status === 403, // 403 if not admin
    'queue stats format': (r) => r.status === 200 ? r.json('waiting') !== undefined : true,
  });

  // Random sleep between 1-5 seconds to simulate realistic usage
  sleep(Math.random() * 4 + 1);
}

// Setup function - runs once per VU
export function setup() {
  console.log('Starting Arduino load test...');
  console.log(`Target: ${BASE_URL}`);
  console.log('Simulating 50 concurrent Arduino compilations');
  
  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/api/v1/arduino/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Arduino API not accessible: ${healthCheck.status}`);
  }
  
  return {};
}

// Teardown function - runs once after all VUs finish  
export function teardown(data) {
  console.log('Arduino load test completed');
}