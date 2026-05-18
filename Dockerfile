# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar solo package files para cache de capas
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --only=production

# ─── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Crear usuario no-root por seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copiar dependencias del stage anterior
COPY --from=builder /app/node_modules ./node_modules

# Copiar código fuente y migraciones
COPY package*.json ./
COPY knexfile.js ./
COPY migrations ./migrations
COPY src ./src

# Variables de entorno de producción
ENV NODE_ENV=production
ENV PORT=3000

# Cambiar a usuario no-root
USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "src/server.js"]
