#!/bin/bash

# Arduino Testing Suite Runner
# This script runs comprehensive tests for the Arduino system

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_ENV="test"
TIMEOUT=120
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --timeout|-t)
      TIMEOUT="$2"
      shift 2
      ;;
    --help|-h)
      echo "Arduino Testing Suite"
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --verbose, -v     Enable verbose output"
      echo "  --timeout, -t     Set timeout in seconds (default: 120)"
      echo "  --help, -h        Show this help message"
      echo ""
      echo "Test Types:"
      echo "  unit              Run unit tests only"
      echo "  integration       Run integration tests only"
      echo "  load              Run load tests only"
      echo "  smoke             Run smoke tests only"
      echo "  all               Run all tests (default)"
      exit 0
      ;;
    *)
      TEST_TYPE="$1"
      shift
      ;;
  esac
done

# Default test type
TEST_TYPE=${TEST_TYPE:-"all"}

echo -e "${BLUE}🧪 Arduino Testing Suite${NC}"
echo -e "${BLUE}=========================${NC}"
echo ""
echo "Test Type: $TEST_TYPE"
echo "Timeout: ${TIMEOUT}s"
echo "Verbose: $VERBOSE"
echo ""

# Function to run a test with logging
run_test() {
  local test_name="$1"
  local test_command="$2"
  local test_description="$3"
  
  echo -e "${YELLOW}🔧 Running: $test_description${NC}"
  
  if [ "$VERBOSE" = true ]; then
    echo "Command: $test_command"
  fi
  
  local start_time=$(date +%s)
  
  if timeout $TIMEOUT bash -c "$test_command"; then
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo -e "${GREEN}✅ $test_name completed successfully (${duration}s)${NC}"
    return 0
  else
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo -e "${RED}❌ $test_name failed (${duration}s)${NC}"
    return 1
  fi
}

# Function to check prerequisites
check_prerequisites() {
  echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
  
  # Check if required services are available
  local failed=false
  
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
    failed=true
  fi
  
  if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed or not in PATH${NC}"
    failed=true
  fi
  
  # Check if .env exists
  if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    failed=true
  fi
  
  # Check if Docker daemon is running
  if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    failed=true
  fi
  
  if [ "$failed" = true ]; then
    echo -e "${RED}❌ Prerequisites check failed${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to setup test environment
setup_test_environment() {
  echo -e "${YELLOW}🏗️  Setting up test environment...${NC}"
  
  # Start required services
  echo "Starting Docker services..."
  if ! docker compose up -d postgres redis judge0-server judge0-workers; then
    echo -e "${RED}❌ Failed to start Docker services${NC}"
    exit 1
  fi
  
  # Wait for services to be ready
  echo "Waiting for services to be ready..."
  sleep 15
  
  # Run database migrations
  echo "Running database migrations..."
  if ! pnpm prisma migrate deploy; then
    echo -e "${RED}❌ Failed to run database migrations${NC}"
    exit 1
  fi
  
  # Generate Prisma client
  echo "Generating Prisma client..."
  if ! pnpm prisma generate; then
    echo -e "${RED}❌ Failed to generate Prisma client${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Test environment setup completed${NC}"
}

# Function to cleanup test environment
cleanup_test_environment() {
  echo -e "${YELLOW}🧹 Cleaning up test environment...${NC}"
  
  # Clean up test data
  if command -v psql &> /dev/null; then
    export PGPASSWORD=password
    psql -h localhost -U postgres -d codeethnics -c "
      DELETE FROM arduino_submission WHERE user_id LIKE 'test-%' OR user_id LIKE 'load-test-%';
      DELETE FROM users WHERE email LIKE '%test%' OR email LIKE '%loadtest%';
    " 2>/dev/null || echo "Database cleanup: Some tables may not exist yet"
  fi
  
  echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Function to run unit tests
run_unit_tests() {
  run_test "Unit Tests" "pnpm test:arduino:unit" "Arduino Unit Tests"
}

# Function to run integration tests
run_integration_tests() {
  run_test "Integration Tests" "pnpm test:arduino:integration" "Arduino Integration Tests"
}

# Function to run load tests
run_load_tests() {
  run_test "Load Tests" "pnpm test:arduino:load" "Arduino Load Tests"
}

# Function to run smoke tests
run_smoke_tests() {
  run_test "Smoke Tests" "pnpm smoke:arduino" "Arduino Smoke Tests"
}

# Function to run all tests
run_all_tests() {
  local failed_tests=()
  
  echo -e "${BLUE}📋 Running Complete Test Suite${NC}"
  echo ""
  
  # Run smoke tests first
  if ! run_smoke_tests; then
    failed_tests+=("smoke")
  fi
  echo ""
  
  # Run unit tests
  if ! run_unit_tests; then
    failed_tests+=("unit")
  fi
  echo ""
  
  # Run integration tests
  if ! run_integration_tests; then
    failed_tests+=("integration")
  fi
  echo ""
  
  # Run load tests
  if ! run_load_tests; then
    failed_tests+=("load")
  fi
  echo ""
  
  # Report results
  if [ ${#failed_tests[@]} -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed successfully!${NC}"
    return 0
  else
    echo -e "${RED}❌ Some tests failed:${NC}"
    for test in "${failed_tests[@]}"; do
      echo -e "${RED}  - $test${NC}"
    done
    return 1
  fi
}

# Function to generate test report
generate_test_report() {
  local test_result=$1
  local report_file="test-results-$(date +%Y%m%d-%H%M%S).txt"
  
  echo "Arduino Test Results - $(date)" > "$report_file"
  echo "=========================" >> "$report_file"
  echo "" >> "$report_file"
  echo "Test Type: $TEST_TYPE" >> "$report_file"
  echo "Result: $([ $test_result -eq 0 ] && echo "PASSED" || echo "FAILED")" >> "$report_file"
  echo "Duration: ${SECONDS}s" >> "$report_file"
  echo "" >> "$report_file"
  
  # Add system information
  echo "System Information:" >> "$report_file"
  echo "- OS: $(uname -s) $(uname -r)" >> "$report_file"
  echo "- Node.js: $(node --version 2>/dev/null || echo 'Not available')" >> "$report_file"
  echo "- Docker: $(docker --version 2>/dev/null || echo 'Not available')" >> "$report_file"
  echo "- pnpm: $(pnpm --version 2>/dev/null || echo 'Not available')" >> "$report_file"
  echo "" >> "$report_file"
  
  echo "Report saved to: $report_file"
}

# Trap to cleanup on exit
trap cleanup_test_environment EXIT

# Main execution
main() {
  local test_result=0
  
  # Check prerequisites
  check_prerequisites
  
  # Setup test environment
  setup_test_environment
  
  # Run tests based on type
  case $TEST_TYPE in
    unit)
      run_unit_tests || test_result=$?
      ;;
    integration)
      run_integration_tests || test_result=$?
      ;;
    load)
      run_load_tests || test_result=$?
      ;;
    smoke)
      run_smoke_tests || test_result=$?
      ;;
    all)
      run_all_tests || test_result=$?
      ;;
    *)
      echo -e "${RED}❌ Unknown test type: $TEST_TYPE${NC}"
      echo "Valid types: unit, integration, load, smoke, all"
      exit 1
      ;;
  esac
  
  # Generate test report
  generate_test_report $test_result
  
  # Final result
  echo ""
  if [ $test_result -eq 0 ]; then
    echo -e "${GREEN}🎉 Arduino testing completed successfully!${NC}"
  else
    echo -e "${RED}❌ Arduino testing failed${NC}"
  fi
  
  return $test_result
}

# Run main function
main "$@"