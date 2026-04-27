FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
# Встановлюємо всі залежності
RUN npm install
# Додатково встановлюємо nodemon глобально для надійності
RUN npm install -g nodemon
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]