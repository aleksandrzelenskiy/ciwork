# ---------- base ----------
FROM node:20-alpine AS base

RUN echo "https://mirror.yandex.ru/mirrors/alpine/latest-stable/main" > /etc/apk/repositories \
    && echo "https://mirror.yandex.ru/mirrors/alpine/latest-stable/community" >> /etc/apk/repositories \
    && apk update \
    && apk add --no-cache ttf-dejavu ffmpeg

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

ARG MONGODB_URI
ENV MONGODB_URI=$MONGODB_URI

RUN npm run build

# ---------- runner ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# ставим только prod зависимости
COPY package*.json ./
RUN npm ci --omit=dev

# копируем только артефакты
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.* ./

# НЕ копируем .env* внутрь образа

# запускаем не от root
USER node

EXPOSE 3000
CMD ["npm", "run", "start"]
