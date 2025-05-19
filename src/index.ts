import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError } from "@modelcontextprotocol/sdk/errors.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ParsedJsonObject
} from "@modelcontextprotocol/sdk/types.js";
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

// MCP Server initialization
const server = new Server({
  name: "chatgpt-gpt-manager",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// Browser session storage
interface Session {
  browser: puppeteer.Browser;
  page: puppeteer.Page;
  isLoggedIn: boolean;
  lastAction: string;
  createdGPTs: string[];
}

const sessions: Record<string, Session> = {};

// Helper functions
async function ensureSession(sessionId: string): Promise<Session> {
  if (!sessions[sessionId]) {
    const browser = await puppeteer.launch({
      headless: false, // Set to false for debugging
      defaultViewport: { width: 1280, height: 800 }
    });
    const page = await browser.newPage();
    sessions[sessionId] = {
      browser,
      page,
      isLoggedIn: false,
      lastAction: "session_created",
      createdGPTs: []
    };
  }
  return sessions[sessionId];
}

async function waitForNavigation(page: puppeteer.Page) {
  await Promise.race([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    page.waitForTimeout(5000)
  ]).catch(() => {});
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "initialize_gpt_manager",
        description: "Initialize a new browser session for managing ChatGPT custom GPTs",
        parameters: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Unique identifier for the browser session"
            },
            headless: {
              type: "boolean",
              description: "Whether to run the browser in headless mode",
              default: false
            }
          },
          required: ["session_id"]
        }
      },
      {
        name: "login_to_chatgpt",
        description: "Login to ChatGPT with provided credentials",
        parameters: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session identifier created with initialize_gpt_manager"
            },
            use_existing: {
              type: "boolean",
              description: "Use existing login session if available",
              default: true
            }
          },
          required: ["session_id"]
        }
      },
      {
        name: "create_new_gpt",
        description: "Create a new custom GPT in ChatGPT",
        parameters: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session identifier"
            },
            name: {
              type: "string",
              description: "Name for the new GPT"
            },
            description: {
              type: "string",
              description: "Description for the GPT"
            },
            instructions: {
              type: "string",
              description: "Instructions for the GPT"
            }
          },
          required: ["session_id", "name", "instructions"]
        }
      },
      {
        name: "add_gpt_action",
        description: "Add an action to a GPT configuration",
        parameters: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session identifier"
            },
            action_type: {
              type: "string",
              description: "Type of action to add (API, code_interpreter, browsing)",
              enum: ["API", "code_interpreter", "browsing"]
            },
            api_schema: {
              type: "string",
              description: "OpenAPI schema for API actions (required for API type)"
            },
            authentication_type: {
              type: "string",
              description: "Authentication type for API actions",
              enum: ["none", "api_key", "oauth"]
            }
          },
          required: ["session_id", "action_type"]
        }
      },
      {
        name: "upload_gpt_file",
        description: "Upload a file to a GPT (knowledge, image, etc.)",
        parameters: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session identifier"
            },
            file_path: {
              type: "string",
              description: "Path to the file to upload"
            },
            file_type: {
              type: "string",
              description: "Type of file being uploaded",
              enum: ["knowledge", "image", "other"]
            }
          },
          required: ["session_id", "file_path"]
        }
      },
      {
        name: "configure_gpt_settings",
        description: "Configure settings for a GPT",
        parameters: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session identifier"
            },
            web_browsing: {
              type: "boolean",
              description: "Enable web browsing capability"
            },
            code_interpreter: {
              type: "boolean",
              description: "Enable code interpreter capability"
            },
            image_generation: {
              type: "boolean",
              description: "Enable DALL-E image generation"
            },
            privacy_mode: {
              type: "string",
              description: "Privacy setting for the GPT",
              enum: ["private", "public", "limited_access"]
            }
          },
          required: ["session_id"]
        }
      },
      {
        name: "save_and_publish_gpt",
        description: "Save and publish the current GPT configuration",
        parameters: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session identifier"
            }
          },
          required: ["session_id"]
        }
      },
      {
        name: "test_gpt",
        description: "Open and test a GPT",
        parameters: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session identifier"
            },
            test_prompts: {
              type: "array",
              description: "List of prompts to test with the GPT",
              items: {
                type: "string"
              }
            }
          },
          required: ["session_id"]
        }
      },
      {
        name: "list_my_gpts",
        description: "List all GPTs created by the user",
        parameters: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session identifier"
            }
          },
          required: ["session_id"]
        }
      },
      {
        name: "close_session",
        description: "Close the browser session",
        parameters: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session identifier to close"
            }
          },
          required: ["session_id"]
        }
      },
      {
        name: "take_screenshot",
        description: "Take a screenshot of the current page",
        parameters: {
          type: "object",
          properties: {
            session_id: {
              type: "string",
              description: "Session identifier"
            },
            output_path: {
              type: "string",
              description: "Path to save the screenshot"
            }
          },
          required: ["session_id", "output_path"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, parameters } = request;

  try {
    switch (name) {
      case "initialize_gpt_manager": {
        const { session_id, headless = false } = parameters as ParsedJsonObject;

        // Close existing session if it exists
        if (sessions[session_id as string]) {
          await sessions[session_id as string].browser.close();
          delete sessions[session_id as string];
        }

        // Create new browser session
        const browser = await puppeteer.launch({
          headless: !!headless,
          defaultViewport: { width: 1280, height: 800 },
          args: ['--window-size=1280,800']
        });

        const page = await browser.newPage();

        sessions[session_id as string] = {
          browser,
          page,
          isLoggedIn: false,
          lastAction: "session_initialized",
          createdGPTs: []
        };

        return {
          result: {
            success: true,
            message: `Browser session initialized with ID: ${session_id}`,
            status: "ready"
          }
        };
      }

      case "login_to_chatgpt": {
        const { session_id, use_existing = true } = parameters as ParsedJsonObject;
        const session = await ensureSession(session_id as string);

        // Navigate to ChatGPT
        await session.page.goto('https://chatgpt.com/', { waitUntil: 'networkidle2' });

        // Check if already logged in
        const isLoggedIn = await session.page.evaluate(() => {
          // Check for elements that would indicate a logged-in state
          const conversationElement = document.querySelector('[data-testid="explore-gpts-button"]');
          return !!conversationElement;
        });

        if (isLoggedIn && use_existing) {
          session.isLoggedIn = true;

          return {
            result: {
              success: true,
              message: "Already logged in to ChatGPT",
              status: "logged_in"
            }
          };
        }

        // Login requires user interaction due to various authentication methods
        // Prompt the user to log in manually
        return {
          result: {
            success: true,
            message: "Please log in to ChatGPT in the browser window. Call this function again with use_existing=true once logged in.",
            status: "awaiting_login"
          }
        };
      }

      case "create_new_gpt": {
        const { session_id, name, description = "", instructions } = parameters as ParsedJsonObject;
        const session = await ensureSession(session_id as string);

        if (!session.isLoggedIn) {
          throw new McpError("Not logged in to ChatGPT. Call login_to_chatgpt first.");
        }

        // Navigate to Explore GPTs page
        await session.page.goto('https://chatgpt.com/', { waitUntil: 'networkidle2' });

        // Click on "Explore GPTs" button
        await session.page.waitForSelector('[data-testid="explore-gpts-button"]');
        await session.page.click('[data-testid="explore-gpts-button"]');
        await session.page.waitForTimeout(2000);

        // Navigate to "My GPTs" section
        // The selector may vary depending on UI language, using a more general approach
        const myGptsButtons = await session.page.$$('button');
        for (const button of myGptsButtons) {
          const text = await session.page.evaluate(el => el.textContent, button);
          if (text && (text.includes('My GPT') || text.includes('我的 GPT'))) {
            await button.click();
            break;
          }
        }
        await session.page.waitForTimeout(2000);

        // Click Create new GPT button (using the first item in the list)
        const createButtons = await session.page.$$('div:nth-of-type(1) > a > div.text-token-text-tertiary > div > div');
        if (createButtons && createButtons.length > 0) {
          await createButtons[0].click();
        }
        await session.page.waitForTimeout(2000);

        // Click on Create radio button
        const radioButtons = await session.page.$$('div.h-screen > div.grow > div.flex > div > div > div.flex > div > button:nth-of-type(1)');
        if (radioButtons && radioButtons.length > 0) {
          await radioButtons[0].click();
        }
        await session.page.waitForTimeout(2000);

        // Fill in GPT instructions (in the message input area)
        const messageInput = await session.page.$('div[contenteditable="true"]');
        if (messageInput) {
          await messageInput.click({ clickCount: 3 }); // Triple click to select all
          await messageInput.type(instructions as string);

          // Press Enter to send
          await session.page.keyboard.press('Enter');
          await session.page.waitForTimeout(2000);
        }

        // Click Configure button to add more details
        const configureButtons = await session.page.$$('[data-testid="gizmo-editor-configure-button"]');
        if (configureButtons && configureButtons.length > 0) {
          await configureButtons[0].click();
        }
        await session.page.waitForTimeout(2000);

        // Set name
        const nameInput = await session.page.$('input[placeholder="Name your GPT"]');
        if (nameInput) {
          await nameInput.click({ clickCount: 3 });
          await nameInput.type(name as string);
        }

        // Set description if provided
        if (description) {
          const descInput = await session.page.$('textarea[placeholder="Add a description"]');
          if (descInput) {
            await descInput.click({ clickCount: 3 });
            await descInput.type(description as string);
          }
        }

        // Add to session record
        session.createdGPTs.push(name as string);
        session.lastAction = "gpt_created";

        return {
          result: {
            success: true,
            message: `Created new GPT: ${name}`,
            status: "created"
          }
        };
      }

      case "add_gpt_action": {
        const {
          session_id,
          action_type,
          api_schema = "",
          authentication_type = "none"
        } = parameters as ParsedJsonObject;

        const session = await ensureSession(session_id as string);

        if (session.lastAction !== "gpt_created" && session.lastAction !== "action_added") {
          throw new McpError("No GPT in creation mode. Create a new GPT first.");
        }

        // Make sure we're in the configuration page
        const configureButtons = await session.page.$$('[data-testid="gizmo-editor-configure-button"]');
        if (configureButtons && configureButtons.length > 0) {
          await configureButtons[0].click();
        }
        await session.page.waitForTimeout(2000);

        // Find and click "Create new action" button
        const actionButtons = await session.page.$$('div.space-y-1 div');
        for (const button of actionButtons) {
          const text = await session.page.evaluate(el => el.textContent, button);
          if (text && (text.includes('Create new action') || text.includes('创建新操作'))) {
            await button.click();
            break;
          }
        }
        await session.page.waitForTimeout(2000);

        // Set action type
        if (action_type === "API") {
          // Select API option from the dropdown
          const selectElement = await session.page.$('select');
          if (selectElement) {
            await selectElement.select('0'); // Based on your flow using 0
          }

          // Enter schema if provided
          if (api_schema) {
            const schemaInput = await session.page.$('textarea[placeholder="Paste your OpenAPI schema here"]');
            if (schemaInput) {
              await schemaInput.click({ clickCount: 3 });
              await schemaInput.type(api_schema as string);
            }
          }

          // Set authentication type
          if (authentication_type !== "none") {
            const authSelect = await session.page.$('select[name="auth_type"]');
            if (authSelect) {
              await authSelect.select(authentication_type as string);
            }
          }
        } else if (action_type === "code_interpreter") {
          // Select Code Interpreter option
          const selectElement = await session.page.$('select');
          if (selectElement) {
            await selectElement.select('code_interpreter');
          }
        } else if (action_type === "browsing") {
          // Select Browsing option
          const selectElement = await session.page.$('select');
          if (selectElement) {
            await selectElement.select('browsing');
          }
        }

        // Close the action panel (using the X button as in your flow)
        const closeButtons = await session.page.$$('div.h-screen > div.grow > div.flex div.end-0 svg');
        if (closeButtons && closeButtons.length > 0) {
          await closeButtons[0].click();
        }
        await session.page.waitForTimeout(2000);

        session.lastAction = "action_added";

        return {
          result: {
            success: true,
            message: `Added ${action_type} action to GPT`,
            status: "action_added"
          }
        };
      }

      case "configure_gpt_settings": {
        const {
          session_id,
          web_browsing,
          code_interpreter,
          image_generation,
          privacy_mode
        } = parameters as ParsedJsonObject;

        const session = await ensureSession(session_id as string);

        // Make sure we're in the configuration page
        const configureButtons = await session.page.$$('[data-testid="gizmo-editor-configure-button"]');
        if (configureButtons && configureButtons.length > 0) {
          await configureButtons[0].click();
        }
        await session.page.waitForTimeout(2000);

        // Configure capabilities
        if (web_browsing !== undefined) {
          const browsingToggle = await session.page.$('input[name="web_browsing"]');
          if (browsingToggle) {
            const isChecked = await session.page.evaluate(el => el.checked, browsingToggle);
            if ((web_browsing && !isChecked) || (!web_browsing && isChecked)) {
              await browsingToggle.click();
            }
          }
        }

        if (code_interpreter !== undefined) {
          const codeToggle = await session.page.$('input[name="code_interpreter"]');
          if (codeToggle) {
            const isChecked = await session.page.evaluate(el => el.checked, codeToggle);
            if ((code_interpreter && !isChecked) || (!code_interpreter && isChecked)) {
              await codeToggle.click();
            }
          }
        }

        if (image_generation !== undefined) {
          const imageToggle = await session.page.$('input[name="image_generation"]');
          if (imageToggle) {
            const isChecked = await session.page.evaluate(el => el.checked, imageToggle);
            if ((image_generation && !isChecked) || (!image_generation && isChecked)) {
              await imageToggle.click();
            }
          }
        }

        // Set privacy mode if specified
        if (privacy_mode) {
          const privacyOptions = await session.page.$$('input[name="privacy"]');
          for (const option of privacyOptions) {
            const value = await session.page.evaluate(el => el.value, option);
            if (value === privacy_mode) {
              await option.click();
              break;
            }
          }
        }

        session.lastAction = "settings_configured";

        return {
          result: {
            success: true,
            message: "GPT settings configured",
            status: "configured"
          }
        };
      }

      case "upload_gpt_file": {
        const { session_id, file_path, file_type = "knowledge" } = parameters as ParsedJsonObject;
        const session = await ensureSession(session_id as string);

        if (!fs.existsSync(file_path as string)) {
          throw new McpError(`File not found: ${file_path}`);
        }

        // Make sure we're in the configuration page
        const configureButtons = await session.page.$$('[data-testid="gizmo-editor-configure-button"]');
        if (configureButtons && configureButtons.length > 0) {
          await configureButtons[0].click();
        }
        await session.page.waitForTimeout(2000);

        // Find and click the upload button based on file type
        let buttonSelector = '';

        if (file_type === "knowledge") {
          buttonSelector = '[data-testid="knowledge-upload-button"]';
        } else if (file_type === "image") {
          buttonSelector = '[data-testid="image-upload-button"]';
        } else {
          buttonSelector = 'input[type="file"]';
        }

        // Set up file chooser
        const [fileChooser] = await Promise.all([
          session.page.waitForFileChooser(),
          session.page.click(buttonSelector).catch(async () => {
            // Try alternative methods if selector doesn't work
            const uploadButtons = await session.page.$$('button');
            for (const button of uploadButtons) {
              const text = await session.page.evaluate(el => el.textContent, button);
              if (text && (text.includes('Upload') || text.includes('上传'))) {
                await button.click();
                break;
              }
            }
          })
        ]);

        // Upload the file
        await fileChooser.accept([file_path as string]);
        await session.page.waitForTimeout(5000); // Wait for upload to complete

        session.lastAction = "file_uploaded";

        return {
          result: {
            success: true,
            message: `File uploaded: ${path.basename(file_path as string)}`,
            file_type: file_type,
            status: "uploaded"
          }
        };
      }

      case "save_and_publish_gpt": {
        const { session_id } = parameters as ParsedJsonObject;
        const session = await ensureSession(session_id as string);

        // Click outside form area first (based on your flow)
        await session.page.click('div.h-screen > div.border-token-border-medium');
        await session.page.waitForTimeout(1000);

        // Click on the Create button
        const createButtons = await session.page.$$('div.border-token-border-medium > div:nth-of-type(2) div');
        if (createButtons && createButtons.length > 0) {
          await createButtons[0].click();
        }
        await session.page.waitForTimeout(2000);

        // Click on GPT Store button
        await session.page.click('#«ru4»');
        await session.page.waitForTimeout(2000);

        // Click on the Save button
        const saveButtons = await session.page.$$('[data-testid="modal-simple-share-gizmo"] div.grow > div.w-full > div > div div');
        for (const button of saveButtons) {
          const text = await session.page.evaluate(el => el.textContent, button);
          if (text && (text.includes('Save') || text.includes('保存'))) {
            await button.click();
            break;
          }
        }
        await session.page.waitForTimeout(5000); // Wait for save to complete

        // Click on View GPT button
        const viewButtons = await session.page.$$('[data-testid="modal-simple-share-published"] a');
        if (viewButtons && viewButtons.length > 0) {
          await viewButtons[0].click();
        }
        await session.page.waitForTimeout(3000);

        session.lastAction = "gpt_published";

        return {
          result: {
            success: true,
            message: "GPT saved and published successfully",
            status: "published"
          }
        };
      }

      case "test_gpt": {
        const { session_id, test_prompts = [] } = parameters as ParsedJsonObject;
        const session = await ensureSession(session_id as string);

        // Check if we're already on a GPT page
        const isGptPage = await session.page.evaluate(() => {
          return window.location.href.includes('/g/');
        });

        if (!isGptPage) {
          throw new McpError("Not on a GPT page. Please view the GPT first.");
        }

        const results = [];

        // Test each prompt if provided
        if (Array.isArray(test_prompts) && test_prompts.length > 0) {
          for (const prompt of test_prompts) {
            // Find input field
            const inputField = await session.page.$('div[contenteditable="true"]');
            if (inputField) {
              await inputField.click({ clickCount: 3 });
              await inputField.type(prompt as string);
              await session.page.keyboard.press('Enter');

              // Wait for response
              await session.page.waitForTimeout(5000);

              // Try to get response text
              const lastResponseSelector = '.group.w-full:last-child .markdown';
              await session.page.waitForSelector(lastResponseSelector, { timeout: 30000 }).catch(() => {});

              const responseText = await session.page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element ? element.textContent : "No response detected";
              }, lastResponseSelector);

              results.push({
                prompt,
                response: responseText
              });
            }
          }
        }

        session.lastAction = "gpt_tested";

        return {
          result: {
            success: true,
            message: "GPT tested with prompts",
            test_results: results.length > 0 ? results : "No prompts tested",
            status: "tested"
          }
        };
      }

      case "list_my_gpts": {
        const { session_id } = parameters as ParsedJsonObject;
        const session = await ensureSession(session_id as string);

        // Navigate to Explore GPTs page
        await session.page.goto('https://chatgpt.com/', { waitUntil: 'networkidle2' });

        // Click on "Explore GPTs" button
        await session.page.waitForSelector('[data-testid="explore-gpts-button"]');
        await session.page.click('[data-testid="explore-gpts-button"]');
        await session.page.waitForTimeout(2000);

        // Navigate to "My GPTs" section
        const myGptsButtons = await session.page.$$('button');
        for (const button of myGptsButtons) {
          const text = await session.page.evaluate(el => el.textContent, button);
          if (text && (text.includes('My GPT') || text.includes('我的 GPT'))) {
            await button.click();
            break;
          }
        }
        await session.page.waitForTimeout(2000);

        // Extract GPTs list
        const gptList = await session.page.evaluate(() => {
          const gptElements = document.querySelectorAll('a[href^="/g/"]');
          return Array.from(gptElements).map(element => {
            const nameElement = element.querySelector('div.text-ellipsis');
            return nameElement ? nameElement.textContent : 'Unknown GPT';
          });
        });

        return {
          result: {
            success: true,
            gpts: gptList,
            count: gptList.length,
            status: "listed"
          }
        };
      }

      case "take_screenshot": {
        const { session_id, output_path } = parameters as ParsedJsonObject;
        const session = await ensureSession(session_id as string);

        await session.page.screenshot({ path: output_path as string, fullPage: true });

        return {
          result: {
            success: true,
            message: `Screenshot saved to ${output_path}`,
            status: "screenshot_taken"
          }
        };
      }

      case "close_session": {
        const { session_id } = parameters as ParsedJsonObject;

        if (sessions[session_id as string]) {
          await sessions[session_id as string].browser.close();
          delete sessions[session_id as string];

          return {
            result: {
              success: true,
              message: `Session ${session_id} closed`,
              status: "closed"
            }
          };
        } else {
          throw new McpError(`Session not found: ${session_id}`);
        }
      }

      default:
        throw new McpError(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Error executing ${name}:`, error);
    return {
      result: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: "error"
      }
    };
  }
});

// Start the MCP server
const transport = new StdioServerTransport();
await server.connect(transport);
