FROM node:18-slim
WORKDIR /app

COPY api/package*.json ./
RUN npm install --omit=dev

COPY api/ ./api/
COPY web/ ./web/
COPY mobile/app/ ./mobile/app/

EXPOSE 8080
CMD ["node", "api/src/index.js"]
