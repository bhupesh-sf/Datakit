#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="datakit/app"
VERSION="0.3.92"
LATEST_TAG="datakit/app:latest"
VERSION_TAG="datakit/app:$VERSION"

echo -e "${BLUE}🐳 Building DataKit Docker Image${NC}"
echo "=================================="

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: dist/ folder not found${NC}"
    echo -e "${YELLOW}💡 Please run 'npm run build' first to create the dist folder and bring is here${NC}"
    exit 1
fi

# Check if dist folder has content
if [ -z "$(ls -A dist)" ]; then
    echo -e "${RED}❌ Error: dist/ folder is empty${NC}"
    echo -e "${YELLOW}💡 Please run 'npm run build' first to build your React app${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found dist/ folder with built React app${NC}"

# Build the Docker image
echo -e "${BLUE}🔨 Building Docker image...${NC}"
# For local use, build for current platform and load into Docker
docker buildx build --load -t $VERSION_TAG -t $LATEST_TAG .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker image built successfully!${NC}"
    echo ""
    echo -e "${BLUE}📦 Image Details:${NC}"
    docker images $IMAGE_NAME
    echo ""
    echo -e "${BLUE}🚀 To run the container:${NC}"
    echo -e "${YELLOW}  docker run -p 8080:80 $LATEST_TAG${NC}"
    echo ""
    echo -e "${BLUE}🐙 Or with docker-compose:${NC}"
    echo -e "${YELLOW}  docker-compose up${NC}"
    echo ""
    echo -e "${BLUE}🌐 Access DataKit at:${NC}"
    echo -e "${YELLOW}  http://localhost:8080${NC}"
else
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi