#!/bin/bash

# Deployment script for ChatGPT GPT Manager MCP
# This script handles publishing to NPM and building Docker images

# Configuration
PACKAGE_NAME="chatgpt-gpt-manager"
VERSION=$(node -e "console.log(require('../package.json').version)")
DOCKER_USER="samihalawa"
DOCKER_IMAGE="$DOCKER_USER/$PACKAGE_NAME"
DOCKER_TAG="$VERSION"
DOCKER_LATEST="latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Function to print status messages
print_status() {
  echo -e "${GREEN}==>${NC} $1"
}

print_error() {
  echo -e "${RED}ERROR:${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}WARNING:${NC} $1"
}

# Build the project before deploying
build_project() {
  print_status "Building project..."
  npm run build
  if [ $? -ne 0 ]; then
    print_error "Build failed. Aborting deployment."
    exit 1
  fi
}

# Deploy to NPM
deploy_npm() {
  print_status "Deploying to NPM as v$VERSION..."
  
  # Check if already published
  npm view $PACKAGE_NAME@$VERSION &> /dev/null
  if [ $? -eq 0 ]; then
    print_warning "Version $VERSION is already published on NPM. Skipping."
    return 1
  fi
  
  # Publish to NPM
  npm publish
  if [ $? -eq 0 ]; then
    print_status "Successfully published to NPM as v$VERSION"
    return 0
  else
    print_error "Failed to publish to NPM"
    return 1
  fi
}

# Deploy to Docker Hub
deploy_docker() {
  print_status "Building Docker image as $DOCKER_IMAGE:$DOCKER_TAG..."
  
  # Build Docker image
  docker build -t "$DOCKER_IMAGE:$DOCKER_TAG" -t "$DOCKER_IMAGE:$DOCKER_LATEST" .
  if [ $? -ne 0 ]; then
    print_error "Docker build failed"
    return 1
  fi
  
  # Push to Docker Hub
  print_status "Pushing to Docker Hub..."
  docker push "$DOCKER_IMAGE:$DOCKER_TAG"
  docker push "$DOCKER_IMAGE:$DOCKER_LATEST"
  
  if [ $? -eq 0 ]; then
    print_status "Successfully pushed to Docker Hub"
    return 0
  else
    print_error "Failed to push to Docker Hub"
    return 1
  fi
}

# Check command line arguments
if [ $# -eq 0 ]; then
  echo "Usage: $0 [npm|docker|all]"
  exit 1
fi

# Main deployment logic
build_project

case "$1" in
  npm)
    deploy_npm
    ;;
  docker)
    deploy_docker
    ;;
  all)
    deploy_npm
    deploy_docker
    ;;
  *)
    print_error "Unknown deployment target: $1"
    echo "Usage: $0 [npm|docker|all]"
    exit 1
    ;;
esac

print_status "Deployment completed!"