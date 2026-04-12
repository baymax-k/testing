# Arduino Load Testing

This directory contains k6 load tests for the Arduino compilation system.

## Prerequisites

1. Install k6: https://k6.io/docs/getting-started/installation/
2. Arduino API server running on localhost:3000
3. Valid JWT token for authentication

## Running the Load Tests

### Basic Load Test
```bash
# Test with default settings (localhost:3000)
k6 run arduino-load-test.js

# Test against different environment
k6 run --env BASE_URL=https://api.codeethnics.com arduino-load-test.js

# Test with authentication token
k6 run --env AUTH_TOKEN=your-jwt-token arduino-load-test.js
```

### Customized Load Test
```bash
# Higher load test (100 concurrent users)
k6 run --vus 100 --duration 5m arduino-load-test.js

# Quick smoke test
k6 run --vus 5 --duration 30s arduino-load-test.js
```

## Test Scenarios

The load test simulates realistic Arduino compilation workflows:

1. **Compilation Submission** - Users submit Arduino code for compilation
2. **Status Polling** - Realistic polling intervals (3-second intervals)
3. **Queue Management** - Tests queue capacity under concurrent load
4. **Error Handling** - Validates error responses and rate limiting

## Performance Targets

- **Compilation Queue**: Handle 50+ concurrent compilations
- **Response Time**: 95th percentile under 30 seconds
- **Error Rate**: Less than 10% failures
- **Queue Processing**: No compilation should take longer than 60 seconds

## Metrics Monitored

- HTTP response times
- Error rates
- Queue depth
- Compilation success/failure rates
- Rate limiting effectiveness

## Expected Results

A healthy Arduino system should:
- Accept all compilation requests (202 responses)
- Process compilations within 10-30 seconds
- Maintain queue stats accessibility
- Handle 50+ concurrent users without degradation

## Interpreting Results

```
scenarios: (100.00%) 1 scenario, 50 max VUs, 5m30s max duration
✓ compile job submitted (202)
✓ submission ID returned  
✓ status check successful
✓ compilation completed
✓ queue stats accessible

http_req_duration........: avg=8.2s  min=245ms med=5.1s  max=28s  p(95)=22s
http_req_failed..........: 2.4%
errors...................: 1.8%
```

Good performance indicators:
- Error rate < 5%
- P95 response time < 30s
- All compilation jobs complete successfully