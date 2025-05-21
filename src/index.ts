#!/usr/bin/env node

import { MCPServer } from '@modelcontextprotocol/sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';

// Define main class for ChatGPT GPT Manager
class ChatGPTGPTManager {
  private browser: puppeteer.Browser | null = null;
  private config = {
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
      headless: this.config.headless ? 'new' : false,
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
    await page.waitForSelector('textarea[placeholder="What does your GPT do? How does it behave?"]');
    await page.type('textarea[placeholder="What does your GPT do? How does it behave?"]', instructions);
    
    // Take a screenshot
    await page.screenshot({ path: path.join(this.config.screenshotDir, `${name.replace(/[^a-z0-9]/gi, '_')}_creation.png`) });
    
    // Return page for further operations
    return page;
  }

  async testGPT(gptId: string, prompt: string) {
    if (!this.browser) await this.initialize();
    
    const page = await this.browser!.newPage();
    await page.goto(`https://chat.openai.com/g/${gptId}`);
    
    // Type prompt
    await page.waitForSelector('textarea[placeholder="Message"]');
    await page.type('textarea[placeholder="Message"]', prompt);
    
    // Press Enter to send
    await page.keyboard.press('Enter');
    
    // Wait for response
    await page.waitForSelector('.markdown-content');
    
    // Get the response text
    const responseText = await page.evaluate(() => {
      const elements = document.querySelectorAll('.markdown-content');
      return elements[elements.length - 1].textContent || '';
    });
    
    // Take a screenshot
    await page.screenshot({ path: path.join(this.config.screenshotDir, `${gptId}_test.png`) });
    
    return responseText;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Create MCP Server
async function main() {
  const gptManager = new ChatGPTGPTManager();
  
  const server = new MCPServer({
    name: 'chatgpt-gpt-manager',
    version: '1.0.0',
  });

  // Register MCP functions
  server.addTool('browser_initialize', async () => {
    await gptManager.initialize();
    return { success: true, message: 'Browser initialized successfully' };
  });

  server.addTool('create_gpt', async ({ name, instructions, options }) => {
    try {
      const page = await gptManager.createGPT(name, instructions, options);
      return {
        success: true,
        message: `GPT "${name}" creation started`,
        screenshot: path.join(gptManager.config.screenshotDir, `${name.replace(/[^a-z0-9]/gi, '_')}_creation.png`)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  server.addTool('test_gpt', async ({ gptId, prompt }) => {
    try {
      const response = await gptManager.testGPT(gptId, prompt);
      return {
        success: true,
        response,
        screenshot: path.join(gptManager.config.screenshotDir, `${gptId}_test.png`)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  server.addTool('browser_close', async () => {
    await gptManager.close();
    return { success: true, message: 'Browser closed successfully' };
  });

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await gptManager.close();
    process.exit(0);
  });

  // Start the server
  await server.listen();
  console.log(`ChatGPT GPT Manager MCP server running on ${server.address}`);
}

main().catch(console.error);
