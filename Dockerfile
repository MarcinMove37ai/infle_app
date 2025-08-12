# Etap 1: Budowanie aplikacji (builder)
FROM node:18-slim AS builder

# Argumenty build-time do przekazania zmiennych środowiskowych z Railway
ARG DATABASE_URL
ARG RESEND_API_KEY
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL

WORKDIR /app

# Kopiowanie package files i schema PRZED npm ci
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Instalacja zależności
RUN npm ci

# Kopiowanie reszty kodu i budowanie
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Etap 2: Uruchomienie produkcyjne (runner)
FROM node:18-slim

# Instalacja niezbędnych zależności dla Chromium (Debian/Ubuntu)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Kopiowanie package files
COPY --from=builder /app/package*.json ./

# Kopiowanie schema Prisma PRZED instalacją npm
COPY --from=builder /app/prisma ./prisma/

# Instalacja zależności produkcyjnych
RUN npm ci --omit=dev

# 🔥 TUTAJ JEST KLUCZ: Generowanie Prisma Client w runtime stage
RUN npx prisma generate

# Rozpakowanie Chromium podczas build (kluczowe dla działania w kontenerze)
RUN node -e "require('@sparticuz/chromium')"

# Kopiowanie zbudowanej aplikacji i potrzebnych plików
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Utworzenie dedykowanego użytkownika i grupy
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Nadanie uprawnień użytkownikowi nextjs
RUN chown -R nextjs:nodejs /app

# Kopiujemy i ustawiamy nasz skrypt startowy
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

EXPOSE 3000
ENV PORT=3000

# Ta komenda zostanie przekazana do naszego skryptu entrypoint.sh
CMD ["npm", "run", "start"]