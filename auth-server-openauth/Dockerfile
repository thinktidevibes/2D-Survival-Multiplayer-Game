# Use Node.js with TypeScript support
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create directory for keys and data
# RUN mkdir -p /app/keys /app/data
# COPY /keys /app/keys

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4001

# Expose port
EXPOSE 4001

# The keys will be mounted at runtime
# VOLUME ["/app/keys"]

# Start the server using tsx (which handles TypeScript directly)
CMD ["npx", "tsx", "index.ts"] 