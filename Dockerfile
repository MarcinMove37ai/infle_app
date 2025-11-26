# Etap 1: Budowanie aplikacji (builder)
FROM node:18-slim AS builder

# 👇 DODANA SEKCJA: Instalacja OpenSSL dla buildera (naprawia błąd Prisma)
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# --- Argumenty build-time z Railway ---
ARG DATABASE_URL
ARG RESEND_API_KEY
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG ENCRYPTION_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_FB_PIXEL_ID

# Reszta bez zmian...
COPY package.json package-lock.json ./
COPY prisma ./prisma/
# ...

# Instalacja zależności
RUN npm ci

# Kopiowanie reszty kodu aplikacji
COPY . .

# 🔥 KLUCZOWY KROK: Przepisanie ARG na ENV
# Next.js potrzebuje tych zmiennych jako ENV w momencie wykonywania "npm run build",
# aby umieścić je na stałe w kodzie JavaScript przeglądarki.
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_FB_PIXEL_ID=$NEXT_PUBLIC_FB_PIXEL_ID

# Wyłączenie telemetrii i budowanie aplikacji
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Etap 2: Uruchomienie produkcyjne (runner)
FROM node:18-slim

# Instalacja niezbędnych zależności dla Chromium i gosu (dla Puppeteera/generowania PDF)
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
    gosu \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Ważne dla Puppeteera w Dockerze
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Kopiowanie package files z etapu builder
COPY --from=builder /app/package*.json ./

# Kopiowanie schema Prisma PRZED instalacją npm
COPY --from=builder /app/prisma ./prisma/

# Instalacja zależności produkcyjnych (bez devDependencies)
RUN npm ci --omit=dev

# Generowanie Prisma Client w runtime stage
RUN npx prisma generate

# Rozpakowanie Chromium (wymagane dla @sparticuz/chromium)
RUN node -e "require('@sparticuz/chromium')"

# Kopiowanie zbudowanej aplikacji (.next) i plików publicznych
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Utworzenie dedykowanego użytkownika i grupy dla bezpieczeństwa
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --home /app nextjs

# Nadanie uprawnień użytkownikowi nextjs
RUN chown -R nextjs:nodejs /app

# Kopiujemy i ustawiamy skrypt startowy
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Ustawienie użytkownika
ENTRYPOINT ["/entrypoint.sh"]

EXPOSE 3000
ENV PORT=3000

# Uruchamiamy Next.js bezpośrednio!!
CMD ["node_modules/.bin/next", "start"]