# Etapa 1: build
FROM node:20-slim AS builder
WORKDIR /app

# Copiar apenas os manifests primeiro (melhor caching)
COPY package*.json ./
RUN npm ci

# Copiar código fonte
COPY . .

# Compilar NestJS
RUN npm run build

# Gerar cliente Prisma
RUN npx prisma generate


# Etapa 2: runtime
FROM node:20-slim
WORKDIR /app

# Copiar apenas o necessário do builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Se usares .env no container (opcional)
# COPY --from=builder /app/.env ./

# Expor a porta do NestJS
EXPOSE 3000

CMD ["node", "dist/src/main.js"]
