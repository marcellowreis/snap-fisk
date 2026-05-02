FROM node:22-alpine

WORKDIR /app

# Copia tudo de uma vez (garante que mudanças no frontend trigam rebuild)
COPY . .

# Instala dependências do backend
RUN npm install

# Copia prisma e gera client
RUN npx prisma generate

# Instala e builda o frontend
RUN npm --prefix frontend install
RUN npm --prefix frontend run build

EXPOSE 8080

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx tsx prisma/seed.ts && npx tsx src/server.ts"]
