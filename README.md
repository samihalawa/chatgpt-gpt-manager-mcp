# ChatGPT GPT Manager

An MCP (Model Context Protocol) server for creating, managing, and testing custom GPTs on ChatGPT.

## Features

- Initialize browser sessions for ChatGPT
- Create new custom GPTs with specified names and instructions
- Test custom GPTs with specific prompts
- Capture screenshots of the process
- Work with multiple GPTs simultaneously

## Installation

### Using NPM

```bash
npm install -g chatgpt-gpt-manager
```

### Using Docker

```bash
docker pull samihalawa/chatgpt-gpt-manager
docker run -p 8080:8080 -v $(pwd)/temp:/app/temp samihalawa/chatgpt-gpt-manager
```

### Using Smithery

```bash
npx @smithery/cli run chatgpt-gpt-manager
```

## Usage

### Starting the Server

```bash
npx chatgpt-gpt-manager
```

The server will start and be available on the specified port (default is 8080).

### MCP Functions

The server provides the following MCP functions:

#### browser_initialize

Initialize a browser session for ChatGPT automation.

```json
{
  "function": "browser_initialize",
  "arguments": {}
}
```

#### create_gpt

Create a new custom GPT on ChatGPT.

```json
{
  "function": "create_gpt",
  "arguments": {
    "name": "My Test GPT",
    "instructions": "You are a helpful assistant that provides information about planets."
  }
}
```

Optional parameters:
- `options`: Additional options for GPT creation

#### test_gpt

Test a custom GPT with a specific prompt.

```json
{
  "function": "test_gpt",
  "arguments": {
    "gptId": "g-abc123def456",
    "prompt": "Tell me about Mars."
  }
}
```

#### browser_close

Close the browser and release resources.

```json
{
  "function": "browser_close",
  "arguments": {}
}
```

## Configuration

The server accepts the following environment variables:

- `HEADLESS`: Set to "true" to run the browser in headless mode (default: false)
- `DEBUG`: Set to "true" to enable debug logging (default: false)
- `SCREENSHOT_DIR`: Directory to store screenshots (default: "./temp")
- `MAX_CONCURRENT_SESSIONS`: Maximum number of concurrent browser sessions (default: 3)

## Important Notes

- This tool requires you to be logged in to ChatGPT. If not logged in, the browser window will open for manual login.
- Custom GPT creation process might change as OpenAI updates the ChatGPT interface.
- It is recommended to run with `HEADLESS=false` initially to see the process and ensure everything works correctly.

## License

MIT
