# Базовый образ Node.js (20, Alpine)
FROM node:20-alpine AS base

# Устанавливаем необходимые шрифты и ffmpeg
RUN echo "https://mirror.yandex.ru/mirrors/alpine/latest-stable/main" > /etc/apk/repositories
RUN apk update && apk add --no-cache ttf-dejavu ffmpeg

# ---------- deps ----------
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---------- build ----------
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- runner ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.* ./
COPY --from=build /app/.env.production ./.env

EXPOSE 3000
CMD ["npm", "run", "start"]
