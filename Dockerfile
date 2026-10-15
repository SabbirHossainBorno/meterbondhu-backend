FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs server.js ./
COPY --chown=nodejs:nodejs src/ ./src/

RUN mkdir -p logs && chown -R nodejs:nodejs logs

USER nodejs

EXPOSE 7788

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD node -e "require('http').get('http://localhost:7788/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]