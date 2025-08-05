# Etap 1: Budowanie aplikacji (builder)
FROM node:18-alpine AS builder

# Przywrócone ARG, aby wstrzyknąć zmienne podczas budowania
ARG DATABASE_URL
ARG RESEND_API_KEY
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL

WORKDIR /app

# Kopiowanie i instalacja zależności
COPY package.json package-lock.json ./
RUN npm ci

# Kopiowanie schematu i generowanie klienta Prisma
COPY prisma ./prisma/
RUN npx prisma generate

# Kopiowanie reszty kodu i budowanie
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Etap 2: Uruchomienie produkcyjne (runner)
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Kopiowanie zależności produkcyjnych
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

# Kopiowanie zbudowanej aplikacji i potrzebnych plików
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Utworzenie dedykowanego użytkownika i grupy
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Kopiujemy i ustawiamy nasz skrypt startowy
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

EXPOSE 3000
ENV PORT=3000

# Ta komenda zostanie przekazana do naszego skryptu entrypoint.sh
CMD ["npm", "run", "start"]