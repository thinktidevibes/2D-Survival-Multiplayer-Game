# Build stage (using node:22-alpine as the base image)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files (from the project root) and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the entire project (including client, public, src, tsconfig, vite config, etc.) so that vite build can find all files
COPY . .

# Run the production build (using the "build" script from package.json)
RUN npm run build

# Production stage (using node:22-alpine as the base image)
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the built assets from the builder stage
COPY --from=builder /app/dist ./dist

# Install serve package for production serving
RUN npm install -g serve

# Expose port 80
EXPOSE 80

# Start the server using serve
CMD ["serve", "-s", "dist", "-l", "80"] 