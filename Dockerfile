# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install --ignore-scripts
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
