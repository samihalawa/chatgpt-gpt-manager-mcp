# ChatGPT Custom GPT Manager MCP

A Model Context Protocol (MCP) tool for creating, managing, and testing custom GPTs on ChatGPT.

## Features

- Create new custom GPTs with specified name, description, and instructions
- Add different types of actions (API, Code Interpreter, Browsing)
- Configure GPT settings (web browsing, code interpreter, image generation)
- Upload knowledge files to your GPT
- Save and publish custom GPTs
- Test GPTs with sample prompts
- List all your custom GPTs
- Take screenshots for documentation

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Build the project:
   ```
   npm run build
   ```

## Usage

This MCP tool can be used with Claude to help manage and test your ChatGPT custom GPTs. Here's a typical workflow:

### Example Usage Flow

1. Initialize a session:
   ```
   initialize_gpt_manager with session_id="my-gpt-session"
   ```

2. Log in to ChatGPT:
   ```
   login_to_chatgpt with session_id="my-gpt-session"
   ```
   (Follow the login prompts in the opened browser)

3. Create a new GPT:
   ```
   create_new_gpt with
     session_id="my-gpt-session",
     name="Web Browser Assistant",
     description="A GPT that helps with web browsing tasks",
     instructions="You are a helpful assistant that specializes in web browsing. Help users navigate websites, find information, and complete online tasks."
   ```

4. Configure GPT settings:
   ```
   configure_gpt_settings with
     session_id="my-gpt-session",
     web_browsing=true,
     code_interpreter=true,
     image_generation=false,
     privacy_mode="public"
   ```

5. Add an action:
   ```
   add_gpt_action with
     session_id="my-gpt-session",
     action_type="API",
     api_schema="{\"openapi\":\"3.0.0\",\"info\":{\"title\":\"Example API\",\"version\":\"1.0.0\"},\"paths\":{}}"
   ```

6. Upload knowledge (optional):
   ```
   upload_gpt_file with
     session_id="my-gpt-session",
     file_path="/path/to/knowledge.pdf",
     file_type="knowledge"
   ```

7. Save and publish the GPT:
   ```
   save_and_publish_gpt with session_id="my-gpt-session"
   ```

8. Test the GPT with prompts:
   ```
   test_gpt with
     session_id="my-gpt-session",
     test_prompts=["Help me with browser automation", "How do I navigate to a specific website?"]
   ```

9. List my GPTs:
   ```
   list_my_gpts with session_id="my-gpt-session"
   ```

10. Close the session when done:
    ```
    close_session with session_id="my-gpt-session"
    ```

## Implementation Notes

- This MCP uses Playwright for browser automation
- The tool adapts to the ChatGPT UI by using both dedicated selectors and text-based searching
- Screenshots are supported for debugging and documentation purposes
- Multiple GPT creation sessions can be managed concurrently

## Troubleshooting

- If selectors are not working, the tool attempts alternative approaches
- Users need to manually log in to ChatGPT due to authentication requirements
- For any issues, check the logs or take screenshots to diagnose problems

## License

MIT
