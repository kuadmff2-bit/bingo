# Bingo Fácil

Plataforma completa para criação, gestão, sorteio, conferência e relatórios de bingos.

## Stack

- Backend: Node.js + Express + Prisma + SQLite
- Frontend: React + Vite
- Autenticação: JWT com hash seguro em bcrypt
- Segurança: helmet, CORS, rate limiting, validação de entrada
- Banco: SQLite para desenvolvimento local, pronto para migrar para PostgreSQL/MySQL

## Estrutura principal

- `backend/` – API e regras de negócio
- `frontend/` – painel web e páginas públicas
- `docs/` – documentação complementares

## Início rápido

1. Copie o arquivo `.env.example` para `.env` na raiz do projeto e ajuste os valores.
2. Instale as dependências:
   - `npm install --prefix backend`
   - `npm install --prefix frontend`
3. Gere o cliente Prisma:
   - `npx prisma --prefix backend generate`
4. Rode as migrações:
   - `npx prisma --prefix backend migrate dev --name init`
5. Inicie os serviços:
   - `npm --prefix backend run dev`
   - `npm --prefix frontend run dev`

## Usuário administrador padrão

O seed inicial cria um usuário admin com:

- e-mail: `admin@bingofacil.local`
- senha: `Admin@123`

## Funcionalidades implementadas

- cadastro e login com autenticação JWT
- dashboard de métricas
- criação de bingos e prêmios
- geração de cartelas
- sorteio com histórico e controles
- conferência de cartela com QR Code
- página pública do evento
- painel administrativo
- logs de auditoria
- documentação e exemplos de ambiente

## Deploy

- Backend em container/VM com variável `PORT`
- Frontend em Vercel/Netlify/servlet estático
- Banco em PostgreSQL em produção, mantendo a mesma estrutura Prisma

## Segurança

- nunca armazenar senhas em texto puro
- validação de entradas no backend
- autenticação com JWT
- headers de segurança
- rate limiting
- CORS configurado

## Observações

Este projeto foi estruturado para evoluir como produto comercial real, com expansão para planos, múltiplos organizadores e integrações futuras.
