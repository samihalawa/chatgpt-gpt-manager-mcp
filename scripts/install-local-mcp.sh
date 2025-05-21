#!/bin/bash

# Install the local MCP for development
# This installs the current directory as a local NPM package

echo "Installing ChatGPT GPT Manager MCP locally..."

# Create directories for temp data
mkdir -p temp

# Build the package
npm run build

# Install locally
npm install -g .

echo "Installation complete!"
echo "To use the MCP, run 'chatgpt-gpt-manager' or 'gpt-manager'" 