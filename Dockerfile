# Multi-stage production build for Unutma AI Backend
FROM node:20-slim AS builder
WORKDIR /app

# Copy dependency specifications
COPY package.json package-lock.json* bun.lock* ./
RUN npm install

# Copy source code
COPY . .

# Build web frontend and compiled CJS server
RUN npm run build

# Production runtime image
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package.json ./
RUN npm install --omit=dev

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
