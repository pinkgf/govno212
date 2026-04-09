# Используем официальный образ Node.js версии 22
FROM node:22-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости (используем npm install вместо npm ci)
RUN npm install --omit=dev && npm cache clean --force

# Устанавливаем PM2 глобально
RUN npm install -g pm2

# Копируем все файлы проекта
COPY . .

# Создаем папку для загрузок
RUN mkdir -p uploads && chmod 777 uploads

# Создаем пользователя node и даем права
RUN chown -R node:node /app
USER node

# Открываем порт
EXPOSE 3000

# Запускаем приложение через PM2
CMD ["pm2-runtime", "start", "server.js", "--name", "technicum"]
