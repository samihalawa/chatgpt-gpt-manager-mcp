#!/bin/bash

# Script to run the ChatGPT GPT Manager with a Smithery API key
# Usage: ./run-with-smithery-key.sh [smithery-api-key]

API_KEY=${1:-$SMITHERY_API_KEY}

if [ -z "$API_KEY" ]; then
  echo "Error: No Smithery API key provided"
  echo "Usage: ./run-with-smithery-key.sh <YOUR-SMITHERY-API-KEY>"
  echo "Or set the SMITHERY_API_KEY environment variable"
  exit 1
fi

echo "Starting ChatGPT GPT Manager with Smithery API key..."
SMITHERY_API_KEY=$API_KEY node dist/index.js 