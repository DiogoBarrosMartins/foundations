# build stage
FROM node:20-slim AS builder
WORKDIR /app

# libs mínimas; openssl runtime é suficiente (dev headers não são precisos)
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
# gera prisma client durante o build
RUN npx prisma generate
RUN yarn build

# runtime stage
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# copia só o necessário
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/yarn.lock ./yarn.lock
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# IMPORTANTE: inclui prisma/schema + migrations
COPY --from=builder /app/prisma ./prisma

# opcional: segurança
# USER node

EXPOSE 10000

# aplica migrations e arranca a app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
