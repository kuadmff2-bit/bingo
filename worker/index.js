import { onRequest as handleApi } from '../functions/api/[[path]].js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
});

const safeError = (error) => {
  const message = String(error?.message || error?.cause?.message || 'Erro desconhecido');
  return message.replace(/https?:\/\/\S+/g, '[url]').slice(0, 600);
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      const checks = {
        dbBinding: Boolean(env.DB),
        adminEmail: Boolean(env.ADMIN_EMAIL),
        adminPassword: Boolean(env.ADMIN_PASSWORD && String(env.ADMIN_PASSWORD).length >= 10),
        jwtSecret: Boolean(env.JWT_SECRET && String(env.JWT_SECRET).length >= 32),
      };

      if (!env.DB) {
        return json({ ok: false, stage: 'binding', checks, message: 'O binding D1 DB não chegou ao Worker ativo.' }, 503);
      }

      try {
        const ping = await env.DB.prepare('SELECT 1 AS ok').first();
        checks.dbQuery = Number(ping?.ok) === 1;
      } catch (error) {
        return json({ ok: false, stage: 'db-query', checks, error: safeError(error) }, 500);
      }

      try {
        const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name").all();
        checks.tables = (tables.results || []).map((row) => row.name);
      } catch (error) {
        return json({ ok: false, stage: 'db-schema-read', checks, error: safeError(error) }, 500);
      }

      const upstream = await handleApi({
        request,
        env,
        waitUntil: ctx.waitUntil.bind(ctx),
        next: () => env.ASSETS.fetch(request),
      });

      if (upstream.ok) return upstream;

      let upstreamBody = null;
      try { upstreamBody = await upstream.clone().json(); } catch {}

      return json({
        ok: false,
        stage: 'api-initialization',
        checks,
        upstreamStatus: upstream.status,
        upstream: upstreamBody,
        message: 'O D1 responde, mas a inicialização da API ainda falhou. Veja os Logs do Worker para a exceção exata.'
      }, upstream.status || 500);
    }

    if (url.pathname.startsWith('/api/')) {
      return handleApi({
        request,
        env,
        waitUntil: ctx.waitUntil.bind(ctx),
        next: () => env.ASSETS.fetch(request),
      });
    }

    return env.ASSETS.fetch(request);
  },
};
