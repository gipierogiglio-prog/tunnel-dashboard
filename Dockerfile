# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Build backend
FROM node:22-alpine AS backend-builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 3: Runtime
FROM node:22-alpine

WORKDIR /app

# Install SSH client
RUN apk add --no-cache openssh-client

# Copy backend
COPY --from=backend-builder /app/node_modules ./node_modules
COPY package.json server.js db.js ssh.js cloudflare.js config.js ./

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create data dir
RUN mkdir -p /app/data

EXPOSE 3011

CMD ["node", "server.js"]
