#!/usr/bin/env bash
set -e

# ChatGPT GPT Manager
# All-in-one deployment script

echo "🚀 ChatGPT GPT Manager Deployment Tool"
echo "====================================="

# Parse command-line arguments
VERSION=""
TAG="latest"
ACTION=""

print_usage() {
  echo "Usage: ./scripts/mcp-deploy.sh [options] [command]"
  echo ""
  echo "Commands:"
  echo "  npm                 Build and publish to npm registry"
  echo "  docker              Build and publish Docker image"
  echo "  all                 Do all of the above"
  echo ""
  echo "Options:"
  echo "  -v, --version VER   Set version number"
  echo "  -t, --tag TAG       Set Docker tag (default: latest)"
  echo "  -h, --help          Show this help message"
}

# Parse options
while [[ "$#" -gt 0 ]]; do
  case $1 in
    npm|docker|all) ACTION="$1" ;;
    -v|--version) VERSION="$2"; shift ;;
    -t|--tag) TAG="$2"; shift ;;
    -h|--help) print_usage; exit 0 ;;
    *) echo "Unknown parameter: $1"; print_usage; exit 1 ;;
  esac
  shift
done

if [ -z "$ACTION" ]; then
  echo "❌ Error: No command specified"
  print_usage
  exit 1
fi

# Clean and build
clean_and_build() {
  echo "🧹 Cleaning previous builds..."
  rm -rf dist
  
  echo "📦 Installing dependencies..."
  npm install
  
  echo "🔨 Building TypeScript..."
  npm run build
  
  if [ ! -z "$VERSION" ]; then
    echo "🔖 Setting version to $VERSION..."
    npm version $VERSION --no-git-tag-version
  fi
}

# NPM publish function
publish_npm() {
  echo "📦 Publishing to npm..."
  npm publish
  echo "✅ Published to npm successfully!"
}

# Docker publish function
publish_docker() {
  echo "🐳 Building and publishing Docker image..."
  docker build -t samihalawa/chatgpt-gpt-manager:$TAG .
  docker push samihalawa/chatgpt-gpt-manager:$TAG
  
  if [[ $TAG =~ ^v?[0-9]+\.[0-9]+\.[0-9]+ ]] && [ "$TAG" != "latest" ]; then
    docker tag samihalawa/chatgpt-gpt-manager:$TAG samihalawa/chatgpt-gpt-manager:latest
    docker push samihalawa/chatgpt-gpt-manager:latest
  fi
  
  echo "✅ Published to Docker Hub successfully!"
}

# Main execution
clean_and_build

case $ACTION in
  npm)
    publish_npm
    ;;
  docker)
    publish_docker
    ;;
  all)
    publish_npm
    publish_docker
    ;;
esac

echo "🎉 Deployment completed successfully!"