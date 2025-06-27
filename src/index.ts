#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';

// Define schemas for tool arguments
const CreateGPTSchema = z.object({
  name: z.string().describe('Name of the GPT'),
  instructions: z.string().describe('Instructions for the GPT'),
  options: z.object({
    capabilities: z.array(z.string()).optional()
  }).optional()
});

const TestGPTSchema = z.object({
  gptId: z.string().describe('ID of the GPT to test'),
  prompt: z.string().describe('Test prompt')
});

// Define main class for ChatGPT GPT Manager
class ChatGPTGPTManager {
  private browser: Browser | null = null;
  public config = {
    headless: process.env.HEADLESS !== 'false', // Default to true for performance
    debugMode: process.env.DEBUG_MODE === 'true' || false,
    screenshotDir: process.env.SCREENSHOT_DIR || './temp',
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '3')
  };

  constructor() {
    // Create screenshot directory if it doesn't exist
    if (!fs.existsSync(this.config.screenshotDir)) {
      fs.mkdirSync(this.config.screenshotDir, { recursive: true });
    }
  }

  async initialize(): Promise<Browser> {
    // Use system Chromium if available
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
    
    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      executablePath: fs.existsSync(executablePath) ? executablePath : undefined,
      defaultViewport: { width: 1280, height: 800 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    });
    
    if (this.config.debugMode) {
      console.error(`Browser initialized (headless: ${this.config.headless})`);
    }
    
    return this.browser;
  }

  // Intelligent waiting for ChatGPT response completion
  private async waitForResponse(page: Page, timeout = 30000): Promise<void> {
    try {
      // First, wait for the stop button to appear (response started)
      await page.waitForSelector('button[aria-label*="Stop"]', { timeout: 5000 });
      
      // Then wait for it to disappear (response completed)
      await page.waitForSelector('button[aria-label*="Stop"]', { 
        hidden: true, 
        timeout: timeout 
      });
    } catch (error) {
      // Fallback: look for other completion indicators
      try {
        await page.waitForSelector('[data-response-complete]', { timeout: timeout * 0.5 });
      } catch {
        // If no specific indicators, wait for network idle as last resort
        await page.waitForLoadState?.('networkidle') || 
              page.waitForFunction('!document.querySelector("button[aria-label*=\'Stop\']")', { timeout: timeout * 0.3 });
      }
    }
  }

  async createGPT(name: string, instructions: string, options: any = {}): Promise<Page> {
    if (!this.browser) await this.initialize();
    
    const page = await this.browser!.newPage();
    
    try {
      await page.goto('https://chat.openai.com/gpts/editor', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Handle login if needed
      const currentUrl = page.url();
      if (currentUrl.includes('auth') || currentUrl.includes('login')) {
        console.error('Login required. Please log in to ChatGPT in the browser window.');
        // Wait for navigation to the editor after login
        await page.waitForNavigation({ 
          timeout: 120000,
          waitUntil: 'networkidle2'
        });
      }
      
      // Wait for and fill in GPT name
      await page.waitForSelector('input[placeholder*="Name"]', { timeout: 10000 });
      await page.type('input[placeholder*="Name"]', name);
      
      // Wait for and fill in instructions
      await page.waitForSelector('textarea[placeholder*="What does this GPT do"]', { timeout: 10000 });
      await page.type('textarea[placeholder*="What does this GPT do"]', instructions);
      
      // Apply additional options if provided
      if (options?.capabilities) {
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
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  async testGPT(gptId: string, prompt: string): Promise<string> {
    if (!this.browser) await this.initialize();
    
    const page = await this.browser!.newPage();
    
    try {
      await page.goto(`https://chat.openai.com/g/${gptId}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Wait for chat interface
      await page.waitForSelector('textarea[placeholder*="Message"]', { timeout: 10000 });
      await page.type('textarea[placeholder*="Message"]', prompt);
      
      // Submit message
      await page.keyboard.press('Enter');
      
      // Wait for response to start and complete intelligently
      await this.waitForResponse(page);
      
      // Take screenshot
      const screenshotPath = path.join(this.config.screenshotDir, `${gptId}_test.png`);
      await page.screenshot({ path: screenshotPath });
      
      // Extract response text
      const response = await page.evaluate(() => {
        // Try multiple selectors for response text
        const selectors = [
          '.prose',
          '[data-message-author-role="assistant"]',
          '.markdown',
          '.text-base'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            const lastElement = elements[elements.length - 1];
            const text = lastElement.textContent?.trim();
            if (text) return text;
          }
        }
        
        return 'No response found';
      });
      
      await page.close();
      return response;
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      if (this.config.debugMode) {
        console.error('Browser closed');
      }
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
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'browser_initialize',
          description: 'Initialize the browser for ChatGPT automation',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'create_gpt',
          description: 'Create a new custom GPT on ChatGPT',
          inputSchema: {
            type: 'object',
            properties: {
              name: { 
                type: 'string', 
                description: 'Name of the GPT' 
              },
              instructions: { 
                type: 'string', 
                description: 'Instructions for the GPT behavior' 
              },
              options: { 
                type: 'object',
                properties: {
                  capabilities: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of capabilities to enable'
                  }
                },
                description: 'Additional options for GPT creation' 
              }
            },
            required: ['name', 'instructions']
          }
        },
        {
          name: 'test_gpt',
          description: 'Test a GPT with a prompt and get its response',
          inputSchema: {
            type: 'object',
            properties: {
              gptId: { 
                type: 'string', 
                description: 'ID of the GPT to test' 
              },
              prompt: { 
                type: 'string', 
                description: 'Test prompt to send to the GPT' 
              }
            },
            required: ['gptId', 'prompt']
          }
        },
        {
          name: 'browser_close',
          description: 'Close the browser and clean up resources',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    try {
      switch (name) {
        case 'browser_initialize': {
          await gptManager.initialize();
          return { 
            content: [{ 
              type: 'text', 
              text: 'Browser initialized successfully' 
            }] 
          };
        }
          
        case 'create_gpt': {
          const validatedArgs = CreateGPTSchema.parse(args);
          const page = await gptManager.createGPT(
            validatedArgs.name, 
            validatedArgs.instructions, 
            validatedArgs.options
          );
          await page.close();
          
          const screenshotPath = path.join(
            gptManager.config.screenshotDir, 
            `${validatedArgs.name.replace(/[^a-z0-9]/gi, '_')}_creation.png`
          );
          
          return {
            content: [{
              type: 'text',
              text: `GPT "${validatedArgs.name}" creation started.\nScreenshot saved to: ${screenshotPath}\n\nPlease complete the creation process in the browser if not in headless mode.`
            }]
          };
        }
        
        case 'test_gpt': {
          const validatedArgs = TestGPTSchema.parse(args);
          const response = await gptManager.testGPT(
            validatedArgs.gptId, 
            validatedArgs.prompt
          );
          
          const screenshotPath = path.join(
            gptManager.config.screenshotDir, 
            `${validatedArgs.gptId}_test.png`
          );
          
          return {
            content: [{
              type: 'text',
              text: `GPT Response:\n${response}\n\nScreenshot saved to: ${screenshotPath}`
            }]
          };
        }
        
        case 'browser_close': {
          await gptManager.close();
          return { 
            content: [{ 
              type: 'text', 
              text: 'Browser closed successfully' 
            }] 
          };
        }
          
        default:
          return { 
            content: [{ 
              type: 'text', 
              text: `Unknown tool: ${name}` 
            }] 
          };
      }
    } catch (error: any) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error: ${error.message || 'Unknown error occurred'}` 
        }] 
      };
    }
  });

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.error('\nShutting down gracefully...');
    await gptManager.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('\nShutting down gracefully...');
    await gptManager.close();
    process.exit(0);
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('ChatGPT GPT Manager MCP server started');
  console.error(`Screenshot directory: ${gptManager.config.screenshotDir}`);
  console.error(`Headless mode: ${gptManager.config.headless}`);
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});