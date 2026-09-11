# Bingo Fácil — Cloudflare

Aplicação de gestão de bingos preparada para Cloudflare Pages + Pages Functions + D1.

## O que funciona

- login do administrador com senha derivada em PBKDF2 e JWT HMAC-SHA256
- proteção contra tentativas repetidas de login
- criação e listagem de bingos
- formatos de cartela de 75 e 90 bolas
- geração de cartelas numeradas com números reais, código de validação e identificador para QR Code
- geração em lotes de até 400 cartelas respeitando os limites de consultas do D1
- registro de venda de cartela e cálculo de receita
- cadastro de prêmios
- sorteio de números sem repetição e reinício de sorteio
- página pública do evento em `/evento/:slug`, atualizada automaticamente durante o sorteio
- validação pública de cartela pela API
- dashboard de métricas
- auditoria das principais ações
- workflow do GitHub Actions para validar sintaxe e build a cada atualização da `main`

## Arquitetura

- **Frontend:** React + Vite
- **Hospedagem:** Cloudflare Pages
- **API:** Pages Functions em `functions/api/[[path]].js`
- **Banco:** Cloudflare D1 com binding obrigatório `DB`
- **Node do build:** fixado em `22.16.0` por `.node-version`

O backend antigo em Express + Prisma + SQLite não é usado na produção Cloudflare. Ele dependia de servidor Node persistente e arquivo SQLite local, que não são adequados ao runtime do Pages Functions.

## Publicar no Cloudflare Pages

1. Conecte o repositório ao Cloudflare Pages.
2. Em **Build settings** configure:
   - Framework preset: `None` ou `Vite`
   - Build command: `npm run build`
   - Build output directory: `frontend/dist`
   - Root directory: `/`
3. Crie um banco **D1**.
4. No projeto Pages, abra **Settings > Bindings > Add > D1 database**.
5. Vincule o banco usando exatamente o nome de variável `DB`.
6. Em **Settings > Variables and Secrets**, configure:
   - `JWT_SECRET`: segredo aleatório com pelo menos 32 caracteres
   - `ADMIN_EMAIL`: e-mail do administrador inicial
   - `ADMIN_PASSWORD`: senha forte com pelo menos 10 caracteres
   - `ADMIN_NAME`: nome do administrador (opcional)
   - `ORGANIZATION_NAME`: nome da organização (opcional)
   - `ALLOW_PUBLIC_REGISTRATION`: `false` recomendado
7. Faça um novo deploy após salvar bindings e variáveis.

A API aplica o schema do D1 automaticamente quando necessário e mantém uma versão de schema na tabela `app_meta` para não repetir a criação das tabelas em todo cold start.

## Rotas principais

### Autenticação
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Bingos
- `GET /api/bingos/dashboard`
- `GET /api/bingos`
- `POST /api/bingos`
- `POST /api/bingos/:id/prizes`
- `GET /api/bingos/:id/draw`
- `POST /api/bingos/:id/draw`
- `POST /api/bingos/:id/draw/reset`

### Cartelas e vendas
- `POST /api/cards/generate`
- `GET /api/cards?bingoId=...`
- `POST /api/cards/sell`
- `GET /api/cards/verify/:codigo`

### Público
- `GET /api/public/bingo/:slug`
- página pública: `/evento/:slug`

### Sistema
- `GET /api/health`
- `GET /api/setup/status`
- `GET /api/admin/overview`

## Desenvolvimento

```bash
npm install --prefix frontend
npm run build --prefix frontend
```

Para testar Pages Functions localmente, use Wrangler/Pages com um binding D1 local chamado `DB`.

## Segurança

- `.env`, `.dev.vars`, banco local e dependências ficam fora do Git.
- Nenhuma senha real ou `JWT_SECRET` fica no código.
- Cadastro público vem desativado por padrão.
- Login possui bloqueio temporário após várias tentativas incorretas.
- A API usa consultas preparadas no D1.
- O frontend inclui CSP e outros headers defensivos.
