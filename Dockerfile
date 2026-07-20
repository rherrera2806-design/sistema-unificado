FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
RUN chown -R node:node /app
COPY --chown=node:node . .
USER node
EXPOSE 8080
CMD ["node", "server.js"]
