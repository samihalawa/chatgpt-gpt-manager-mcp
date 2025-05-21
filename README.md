# ChatGPT Custom GPT Manager

An MCP (Model Context Protocol) server that helps you create, manage, and test custom GPTs on ChatGPT.

<div align="center">
  <img src="https://cdn.jsdelivr.net/gh/samihalawa/chatgpt-gpt-manager@main/publicresources/banner.svg" alt="ChatGPT GPT Manager Banner" width="800"/>
</div>

## Features

- 🤖 Create custom GPTs automatically
- 🧪 Test custom GPTs with prompts
- 📊 Capture test results and screenshots
- 🔄 Manage multiple GPTs efficiently
- 🚀 Compatible with any Claude client supporting MCP

## Installation

### Using Smithery (Recommended)

```bash
npx @smithery/cli install chatgpt-gpt-manager --client claude
```

### Using NPM

```bash
npm install -g chatgpt-gpt-manager
```

### Using Docker

```bash
docker pull samihalawa/chatgpt-gpt-manager
docker run -p 8080:8080 -v $(pwd)/temp:/app/temp samihalawa/chatgpt-gpt-manager
```

## Usage

### With Claude

1. Start the MCP server:
   ```bash
   npx @smithery/cli run chatgpt-gpt-manager
   ```

2. Configure Claude to use this MCP server
3. Use the following tools in your Claude prompts:

- `browser_initialize`: Start browser session
- `create_gpt`: Create a new custom GPT
- `test_gpt`: Test a GPT with prompts
- `browser_close`: Close the browser session

### Example

```
Create a new custom GPT for me called "Recipe Assistant" that can suggest
recipes based on available ingredients.
```

Claude will use the MCP server to automate the creation process.

## Configuration

You can configure the server with the following options:

```bash
# Run in headless mode
npx @smithery/cli run chatgpt-gpt-manager --config '{"headless":true}'

# Enable debug logging
npx @smithery/cli run chatgpt-gpt-manager --config '{"debugMode":true}'

# Specify screenshot directory
npx @smithery/cli run chatgpt-gpt-manager --config '{"screenshotDir":"./screenshots"}'
```

## License

MIT
