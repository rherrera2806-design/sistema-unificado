FROM node:18-slim
WORKDIR /app

COPY api/package*.json ./
RUN npm install --omit=dev

COPY api/src/ ./src/
COPY web/public/ ./public/

EXPOSE 8080
CMD ["node", "src/index.js"]
