#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';

interface CreateGPTArgs {
  name: string;
  instructions: string;
  options?: any;
}

interface TestGPTArgs {
  gptId: string;
  prompt: string;
}

// Define main class for ChatGPT GPT Manager
class ChatGPTGPTManager {
  private browser: puppeteer.Browser | null = null;
  public config = {
    headless: process.env.HEADLESS === 'true' || false,
    debugMode: process.env.DEBUG === 'true' || false,
    screenshotDir: process.env.SCREENSHOT_DIR || './temp',
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '3')
  };

  constructor() {
    // Create screenshot directory if it doesn't exist
    if (!fs.existsSync(this.config.screenshotDir)) {
      fs.mkdirSync(this.config.screenshotDir, { recursive: true });
    }
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    console.log(`Browser initialized (headless: ${this.config.headless})`);
    return this.browser;
  }

  async createGPT(name: string, instructions: string, options: any = {}) {
    if (!this.browser) await this.initialize();
    
    const page = await this.browser!.newPage();
    await page.goto('https://chat.openai.com/gpts/editor');
    
    // Handle login if needed
    if (await page.url().includes('auth')) {
      console.log('Login required. Please log in to ChatGPT in the browser window.');
      // Wait for navigation to the editor after login
      await page.waitForNavigation({ timeout: 120000 });
    }
    
    // Fill in GPT name
    await page.waitForSelector('input[placeholder="Name your GPT"]');
    await page.type('input[placeholder="Name your GPT"]', name);
    
    // Fill in instructions
    await page.waitForSelector('textarea[placeholder="What does this GPT do? How does it behave? What should it avoid doing?"]');
    await page.type('textarea[placeholder="What does this GPT do? How does it behave? What should it avoid doing?"]', instructions);
    
    // Apply additional options if provided
    if (options.capabilities) {
      // Handle capabilities checkboxes
      for (const capability of options.capabilities) {
        const checkbox = await page.$(`input[type="checkbox"][value="${capability}"]`);
        if (checkbox) await checkbox.click();
      }
    }
    
    // Take screenshot
    const screenshotPath = path.join(this.config.screenshotDir, `${name.replace(/[^a-z0-9]/gi, '_')}_creation.png`);
    await page.screenshot({ path: screenshotPath });
    
    return page;
  }

  async testGPT(gptId: string, prompt: string) {
    if (!this.browser) await this.initialize();
    
    const page = await this.browser!.newPage();
    await page.goto(`https://chat.openai.com/g/${gptId}`);
    
    // Wait for chat interface
    await page.waitForSelector('textarea[placeholder="Message"]');
    await page.type('textarea[placeholder="Message"]', prompt);
    
    // Submit message
    await page.keyboard.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(5000); // Wait for response to generate
    
    // Take screenshot
    const screenshotPath = path.join(this.config.screenshotDir, `${gptId}_test.png`);
    await page.screenshot({ path: screenshotPath });
    
    // Extract response text
    const response = await page.evaluate(() => {
      const messages = document.querySelectorAll('.prose');
      return messages[messages.length - 1]?.textContent || 'No response found';
    });
    
    return response;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('Browser closed');
    }
  }
}

// Create MCP Server
async function main() {
  const gptManager = new ChatGPTGPTManager();
  
  const server = new Server({
    name: 'chatgpt-gpt-manager',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: {}
    }
  });

  // Register MCP tools
  server.setRequestHandler('tools/list', async () => {
    return {
      tools: [
        {
          name: 'browser_initialize',
          description: 'Initialize the browser for ChatGPT automation',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'create_gpt',
          description: 'Create a new custom GPT',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the GPT' },
              instructions: { type: 'string', description: 'Instructions for the GPT' },
              options: { type: 'object', description: 'Additional options' }
            },
            required: ['name', 'instructions']
          }
        },
        {
          name: 'test_gpt',
          description: 'Test a GPT with a prompt',
          inputSchema: {
            type: 'object',
            properties: {
              gptId: { type: 'string', description: 'ID of the GPT to test' },
              prompt: { type: 'string', description: 'Test prompt' }
            },
            required: ['gptId', 'prompt']
          }
        },
        {
          name: 'browser_close',
          description: 'Close the browser',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    };
  });

  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;
    
    switch (name) {
      case 'browser_initialize':
        await gptManager.initialize();
        return { content: [{ type: 'text', text: 'Browser initialized successfully' }] };
        
      case 'create_gpt': {
        const { name, instructions, options } = args as CreateGPTArgs;
        try {
          const page = await gptManager.createGPT(name, instructions, options);
          return {
            content: [{
              type: 'text',
              text: `GPT "${name}" creation started. Screenshot saved to ${path.join(gptManager.config.screenshotDir, `${name.replace(/[^a-z0-9]/gi, '_')}_creation.png`)}`
            }]
          };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
        }
      }
      
      case 'test_gpt': {
        const { gptId, prompt } = args as TestGPTArgs;
        try {
          const response = await gptManager.testGPT(gptId, prompt);
          return {
            content: [{
              type: 'text',
              text: `Response: ${response}\nScreenshot saved to ${path.join(gptManager.config.screenshotDir, `${gptId}_test.png`)}`
            }]
          };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
        }
      }
      
      case 'browser_close':
        await gptManager.close();
        return { content: [{ type: 'text', text: 'Browser closed successfully' }] };
        
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    }
  });

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await gptManager.close();
    process.exit(0);
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ChatGPT GPT Manager MCP server started');
}

main().catch(console.error);