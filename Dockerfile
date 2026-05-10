# syntax=docker/dockerfile:1.6

# Stage 1: build the React frontend
FROM node:20-alpine AS frontend
WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/package-lock.json* ./
RUN npm install
COPY dashboard/ ./
RUN npm run build

# Stage 2: install backend deps (prod only)
FROM node:20-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

# Stage 3: runtime
FROM node:20-alpine
ENV NODE_ENV=production
ENV STATIC_DIR=/app/dashboard/dist
WORKDIR /app/backend
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/ ./
COPY --from=frontend /app/dashboard/dist /app/dashboard/dist
EXPOSE 8080
CMD ["node", "server.js"]
