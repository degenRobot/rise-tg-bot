#!/bin/bash

# RISE TG Bot - Run All Tests
# This script runs all test files in the tests directory

set -e

echo "🧪 RISE TG Bot - Running All Tests"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to tg-bot directory
cd "$(dirname "$0")/.."

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  pnpm install
fi

# Array of test files
tests=(
  "test-swap-prompts.ts"
  "test-query-prompts.ts"
  "test-llm-routing.ts"
  "test-edge-cases.ts"
  "test-improved-router.ts"
)

# Track results
total_tests=${#tests[@]}
passed_tests=0
failed_tests=0

echo "Found ${total_tests} test files to run"
echo ""

# Run each test
for test in "${tests[@]}"; do
  echo -e "${YELLOW}Running: ${test}${NC}"
  echo "----------------------------------------"
  
  if pnpm tsx "tests/${test}" 2>&1; then
    echo -e "${GREEN}✅ ${test} passed${NC}"
    ((passed_tests++))
  else
    echo -e "${RED}❌ ${test} failed${NC}"
    ((failed_tests++))
  fi
  
  echo ""
  echo "========================================" 
  echo ""
  
  # Small delay between tests
  sleep 1
done

# Summary
echo "Test Summary"
echo "============"
echo -e "Total: ${total_tests}"
echo -e "${GREEN}Passed: ${passed_tests}${NC}"
echo -e "${RED}Failed: ${failed_tests}${NC}"

if [ ${failed_tests} -eq 0 ]; then
  echo -e "\n${GREEN}🎉 All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}❌ Some tests failed${NC}"
  exit 1
fi