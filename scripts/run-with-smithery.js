#!/usr/bin/env node

// Run ChatGPT GPT Manager with Smithery configuration
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Default configuration
const config = {
  headless: process.env.HEADLESS === 'true',
  debugMode: process.env.DEBUG === 'true',
  port: process.env.PORT || 8080
};

// Parse any command line arguments
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--headless=')) {
    config.headless = arg.split('=')[1] === 'true';
  } else if (arg.startsWith('--debug=')) {
    config.debugMode = arg.split('=')[1] === 'true';
  } else if (arg.startsWith('--port=')) {
    config.port = parseInt(arg.split('=')[1]);
  }
});

console.log('Starting ChatGPT GPT Manager with config:', config);

// Start the server
const server = spawn('node', ['dist/index.js'], {
  cwd: rootDir,
  env: {
    ...process.env,
    HEADLESS: config.headless.toString(),
    DEBUG: config.debugMode.toString(),
    PORT: config.port.toString()
  },
  stdio: 'inherit'
});

// Handle server process events
server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code);
});

// Handle terminal signals
process.on('SIGINT', () => {
  console.log('Caught interrupt signal, shutting down...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Caught terminate signal, shutting down...');
  server.kill('SIGTERM');
}); 