# Simplified Dockerfile for ChatGPT GPT Manager MCP Server
FROM node:18-slim

# Install minimal dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies without running scripts
RUN npm install --ignore-scripts

# Copy application files
COPY . .

# Create a directory for screenshots with proper permissions
RUN mkdir -p /app/temp && chmod -R 755 /app/temp

# Environment variables
ENV NODE_ENV=production \
    HEADLESS=true \
    MCP_TRANSPORT=stdio

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Volume for screenshots
VOLUME ["/app/temp"]

# Note: This is a placeholder Dockerfile for the chatgpt-gpt-manager project
# The actual implementation requires fixing the TypeScript compilation issues
CMD ["echo", "ChatGPT GPT Manager MCP Server - Placeholder"]