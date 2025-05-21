FROM node:18-slim

# Install required dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fontconfig \
    locales \
    libxss1 \
    libxtst6 \
    libnss3 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Puppeteer dependencies
RUN apt-get update && apt-get install -y \
    libgtk-3-0 \
    libasound2 \
    libxshmfence1 \
    libgbm1 \
    libnss3 \
    libxss1 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxtst6 \
    liblcms2-2 \
    libxcb-dri3-0 \
    libdrm2 \
    libgbm1 \
    libxshmfence1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application files
COPY . .

# Build TypeScript code
RUN npm run build

# Expose the MCP port
EXPOSE 8080

# Create a directory for screenshots
RUN mkdir -p /app/temp
VOLUME /app/temp

# Environment variables
ENV NODE_ENV=production
ENV HEADLESS=true

# Start the MCP server
CMD ["node", "dist/index.js"]
