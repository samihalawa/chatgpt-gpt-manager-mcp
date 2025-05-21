#!/bin/bash

# Run ChatGPT GPT Manager MCP with Smithery
# This script runs the package using the Smithery CLI

echo "Running ChatGPT GPT Manager with Smithery..."

if ! command -v npx &> /dev/null; then
  echo "Error: npx is not installed. Please install Node.js first."
  exit 1
fi

# Parse command line arguments
CONFIG="{}"
CLIENT="claude"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --config) CONFIG="$2"; shift ;;
    --client) CLIENT="$2"; shift ;;
    --headless) 
      # Create config with headless mode
      CONFIG="{\"headless\":true}"
      ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# Run the MCP package
echo "Starting ChatGPT GPT Manager MCP..."
npx @smithery/cli run chatgpt-gpt-manager --client "$CLIENT" --config "$CONFIG"

echo "Server stopped." 