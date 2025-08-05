# Etap 1: Budowanie aplikacji (builder)
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Etap 2: Uruchomienie produkcyjne
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Instalacja tylko zależności produkcyjnych
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

# WAŻNE: Kontener uruchomi ten skrypt jako domyślny użytkownik `root`
ENTRYPOINT ["/entrypoint.sh"]

EXPOSE 3000
ENV PORT=3000

# Ta komenda zostanie przekazana jako argument do skryptu entrypoint.sh
CMD ["npm", "run", "start"]