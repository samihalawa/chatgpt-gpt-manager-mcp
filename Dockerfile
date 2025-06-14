# Production Dockerfile for ChatGPT GPT Manager MCP Server
FROM node:18-slim

# Install dependencies for Puppeteer and Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    chromium \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies without running scripts
RUN npm ci --ignore-scripts

# Copy TypeScript config and source files
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Create screenshot directory with proper permissions
RUN mkdir -p /app/temp && chmod -R 755 /app/temp

# Create non-root user for security
RUN groupadd -r gptmanager && useradd -r -g gptmanager gptmanager && \
    chown -R gptmanager:gptmanager /app

# Switch to non-root user
USER gptmanager

# Environment variables
ENV NODE_ENV=production \
    HEADLESS=true \
    MCP_TRANSPORT=stdio \
    SCREENSHOT_DIR=/app/temp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Volume for screenshots
VOLUME ["/app/temp"]

# Start the MCP server
CMD ["node", "dist/index.js"]