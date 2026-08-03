# deploy/openwa-gateway/Dockerfile
# Por que não Alpine: wwebjs requer Chromium com suporte a shared libs glibc
FROM node:22-slim

# Chromium e dependências mínimas para Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/

EXPOSE 3333
CMD ["node", "dist/index.js"]
