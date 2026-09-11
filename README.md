# Bingo Fácil — Cloudflare

Versão preparada para publicar no Cloudflare Pages.

## Arquitetura de produção

- Frontend: React + Vite (Cloudflare Pages)
- API: Cloudflare Pages Functions (`functions/api/[[path]].js`)
- Banco: Cloudflare D1, binding obrigatório com o nome `DB`
- Autenticação: JWT HMAC-SHA256 e senhas derivadas com PBKDF2-SHA256
- Banco inicializado automaticamente pela API no primeiro acesso

O backend antigo em Express/Prisma/SQLite não é usado no deploy Cloudflare, pois SQLite local e um servidor Express persistente não são compatíveis com o runtime do Pages Functions.

## Publicar no Cloudflare Pages

1. Conecte este repositório ao Cloudflare Pages.
2. Em **Build settings** use:
   - Framework preset: `None` ou `Vite`
   - Build command: `npm run build`
   - Build output directory: `frontend/dist`
   - Root directory: `/` (raiz do repositório)
3. Crie um banco **D1** no painel do Cloudflare.
4. No projeto Pages, abra **Settings > Bindings > Add > D1 database** e vincule o banco usando exatamente o nome de variável `DB`.
5. Em **Settings > Variables and Secrets**, configure:
   - `JWT_SECRET`: segredo aleatório com no mínimo 32 caracteres.
   - `ADMIN_EMAIL`: e-mail do primeiro administrador.
   - `ADMIN_PASSWORD`: senha forte com no mínimo 10 caracteres.
   - `ADMIN_NAME`: nome do administrador (opcional).
   - `ORGANIZATION_NAME`: nome da organização (opcional).
   - `ALLOW_PUBLIC_REGISTRATION`: mantenha `false` se não quiser cadastro público.
6. Faça um novo deploy após configurar o D1 e as variáveis.

Na primeira chamada à API, as tabelas são criadas automaticamente e, se `ADMIN_EMAIL` e `ADMIN_PASSWORD` estiverem configurados, o usuário administrador também é criado automaticamente.

## Rotas principais

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/bingos/dashboard`
- `GET /api/bingos`
- `POST /api/bingos`
- `POST /api/cards/generate`
- `GET /api/cards/verify/:qrCodeValue`
- `GET /api/public/bingo/:slug`
- `GET /api/admin/overview`

## Desenvolvimento local do frontend

```bash
cd frontend
npm ci
npm run dev
```

Para testar as Pages Functions localmente, use o Wrangler/Cloudflare Pages com um binding D1 local.

## Segurança

- `.env` e arquivos locais sensíveis permanecem ignorados pelo Git.
- Não coloque `JWT_SECRET`, senha do administrador, tokens ou IDs privados diretamente no código.
- O formulário de login não contém mais credenciais padrão predefinidas.
- Cadastro público vem desativado por padrão.
- A aplicação inclui headers de segurança para o conteúdo estático e para a API.
