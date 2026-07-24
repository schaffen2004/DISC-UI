# =========================================
# Stage 1: Build the application
# =========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Enable build optimizations
ENV NODE_ENV=production

# Copy package files for installing dependencies
COPY package.json package-lock.json* ./

# Install dependencies including devDependencies (needed to build)
# Disable strict engine checking so npm will build with Node 20 even if TanStack recommends Node 22
RUN npm config set engine-strict false
RUN npm ci --include=dev

# Copy source code files
COPY . .

# Pass build-time environment variables for Vite/Vinxi to inline
# Note: Vite/Vinxi inlines VITE_* environment variables into the client bundle at build-time.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build the TanStack Start application (outputs to .output directory)
# Force Nitro to build for Node.js standalone server
ENV NITRO_PRESET=node-server
RUN npm run build

# =========================================
# Stage 2: Production runner
# =========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set container environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy built application and essential runtime configuration
COPY --from=builder /app/.output /app/.output
COPY --from=builder /app/package.json ./package.json

# Expose the port TanStack Start will listen on
EXPOSE 3000

# Start the TanStack Start SSR server
CMD ["node", ".output/server/index.mjs"]
