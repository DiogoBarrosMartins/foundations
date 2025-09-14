# build stage
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl libssl-dev

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN npx prisma generate
RUN yarn build

# runtime stage
FROM node:20-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl libssl-dev

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/yarn.lock ./yarn.lock
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 10000

# aplica migrations e arranca app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]