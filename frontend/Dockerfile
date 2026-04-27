# frontend/Dockerfile
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
# Обов'язково додайте --host для Vite в Docker
CMD ["npm", "run", "dev"]