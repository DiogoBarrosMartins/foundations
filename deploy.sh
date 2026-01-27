#!/bin/bash

# Foundations Game - Deploy Script
# Usage: ./deploy.sh [environment]

ENV=${1:-production}
echo "🚀 Deploying Foundations API to $ENV"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker found${NC}"

    # Build and run with Docker
    echo "🏗️  Building Docker image..."
    docker build -t foundations-api .

    echo "🐳 Running container..."
    docker run -d \
        --name foundations-api \
        -p 3000:3000 \
        --env-file .env.$ENV \
        foundations-api

    echo -e "${GREEN}✓ Deploy completed!${NC}"
    echo "🌐 API available at: http://localhost:3000"
    echo "📚 Swagger docs at: http://localhost:3000/docs"

else
    echo -e "${YELLOW}⚠️  Docker not found, deploying with npm...${NC}"

    # Traditional deploy
    echo "📦 Installing dependencies..."
    npm ci

    echo "🏗️  Building application..."
    npm run build

    echo "🗄️  Running migrations..."
    npm run db:migrate

    echo "🚀 Starting server..."
    npm run start:prod &

    echo -e "${GREEN}✓ Deploy completed!${NC}"
    echo "🌐 API available at: http://localhost:3000"
fi

# Health check
echo "🔍 Running health check..."
sleep 5
if curl -f http://localhost:3000/health &>/dev/null; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
else
    echo -e "${RED}❌ Health check failed!${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Deploy successful!${NC}"