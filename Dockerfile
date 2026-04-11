FROM node:22-alpine

WORKDIR /app

# Instala dependências do backend
COPY package*.json ./
RUN npm install

# Copia prisma e gera client
COPY prisma ./prisma
RUN npx prisma generate

# Instala e builda o frontend
COPY frontend/package*.json ./frontend/
RUN npm --prefix frontend install

COPY frontend ./frontend
RUN npm --prefix frontend run build

# Copia o resto do código
COPY . .

EXPOSE 8080

CMD ["sh", "-c", "npx prisma db push && npx tsx src/server.ts"]
