#!/bin/bash

# Install ChatGPT GPT Manager MCP as a Smithery package
# This script installs the package using the Smithery CLI

echo "Installing ChatGPT GPT Manager with Smithery..."

if ! command -v npx &> /dev/null; then
  echo "Error: npx is not installed. Please install Node.js first."
  exit 1
fi

# Check if the Smithery CLI is available
if ! npx @smithery/cli --version &> /dev/null; then
  echo "Installing Smithery CLI..."
  npm install -g @smithery/cli
fi

# Install the MCP package
echo "Installing ChatGPT GPT Manager MCP..."
npx @smithery/cli install chatgpt-gpt-manager --client claude

echo "Installation complete!"
echo "To run the MCP, use: npx @smithery/cli run chatgpt-gpt-manager" 