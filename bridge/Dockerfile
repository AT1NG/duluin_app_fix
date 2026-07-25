FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY firestore_waha_bridge.js .
CMD ["node", "firestore_waha_bridge.js"]
