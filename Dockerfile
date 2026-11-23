# EstuLanches — imagem de produção em múltiplos estágios.
# Node 22 LTS (o Node 20 saiu de suporte em abril/2026). Alpine mantém a imagem pequena.

# Estágio 1: instala todas as dependências (inclui as de desenvolvimento, usadas nos testes).
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Estágio 2 (perfil "test" do Compose): código + dependências de desenvolvimento para rodar o Jest.
FROM dependencies AS test
COPY . .
CMD ["npm", "run", "test:integration"]

# Estágio 3: imagem final, somente com o necessário para executar a aplicação.
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node src ./src
COPY --chown=node:node init.sql ./init.sql
COPY --chown=node:node public ./public
# Usuário sem privilégios: o processo da aplicação não roda como root.
USER node
EXPOSE 3000
# Considera saudável apenas se a API responder E conseguir consultar o banco (/health).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
