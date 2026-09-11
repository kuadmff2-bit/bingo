const encoder = new TextEncoder();
const decoder = new TextDecoder();
let schemaPromise;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'organizer',
  is_active INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS bingos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  organizer TEXT,
  event_date TEXT,
  start_time TEXT,
  location TEXT,
  image_url TEXT,
  total_cards INTEGER NOT NULL DEFAULT 0,
  card_price REAL NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT '75',
  status TEXT NOT NULL DEFAULT 'draft',
  public_slug TEXT NOT NULL UNIQUE,
  observations TEXT,
  contact_info TEXT,
  organization_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS prizes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  value REAL,
  image_url TEXT,
  position INTEGER NOT NULL,
  win_type TEXT NOT NULL,
  bingo_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bingo_id) REFERENCES bingos(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  card_number INTEGER NOT NULL,
  validation_code TEXT NOT NULL UNIQUE,
  qr_code_value TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available',
  buyer_name TEXT,
  buyer_phone TEXT,
  seller_name TEXT,
  paid_value REAL,
  payment_method TEXT,
  sold_at TEXT,
  bingo_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bingo_id) REFERENCES bingos(id) ON DELETE CASCADE,
  UNIQUE (bingo_id, card_number)
);
CREATE TABLE IF NOT EXISTS sellers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  received INTEGER NOT NULL DEFAULT 0,
  sold INTEGER NOT NULL DEFAULT 0,
  returned INTEGER NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  buyer_name TEXT,
  buyer_phone TEXT,
  seller_id TEXT,
  card_id TEXT NOT NULL,
  user_id TEXT,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sold',
  notes TEXT,
  sold_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id),
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_bingos_org ON bingos(organization_id);
CREATE INDEX IF NOT EXISTS idx_cards_bingo ON cards(bingo_id);
CREATE INDEX IF NOT EXISTS idx_sales_card ON sales(card_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
`;

function securityHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    ...extra,
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: securityHeaders(extraHeaders) });
}

function base64url(bytes) {
  let binary = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signToken(payload, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64url(encoder.encode(JSON.stringify({ ...payload, iat: now, exp: now + 60 * 60 * 24 * 7 })));
  const unsigned = `${header}.${body}`;
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(unsigned));
  return `${unsigned}.${base64url(signature)}`;
}

async function verifyToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid token');
  const unsigned = `${parts[0]}.${parts[1]}`;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromBase64url(parts[2]), encoder.encode(unsigned));
  if (!ok) throw new Error('invalid token');
  const payload = JSON.parse(decoder.decode(fromBase64url(parts[1])));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) throw new Error('expired token');
  return payload;
}

async function hashPassword(password) {
  const iterations = 120000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return `pbkdf2$${iterations}$${base64url(salt)}$${base64url(bits)}`;
}

async function verifyPassword(password, stored) {
  const [kind, iterText, saltText, hashText] = String(stored || '').split('$');
  if (kind !== 'pbkdf2') return false;
  const iterations = Number(iterText);
  if (!Number.isSafeInteger(iterations) || iterations < 10000) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64url(saltText), iterations }, key, 256));
  const expected = fromBase64url(hashText);
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i += 1) diff |= bits[i] ^ expected[i];
  return diff === 0;
}

function slugify(value) {
  return String(value || 'bingo')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'bingo';
}

function validEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

async function readBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw Object.assign(new Error('Envie os dados em JSON.'), { status: 415 });
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 1024 * 1024) throw Object.assign(new Error('Requisição muito grande.'), { status: 413 });
  try {
    return await request.json();
  } catch {
    throw Object.assign(new Error('JSON inválido.'), { status: 400 });
  }
}

async function ensureSchema(env) {
  if (!env.DB) throw Object.assign(new Error('Banco D1 não configurado. Adicione um binding D1 chamado DB no Cloudflare.'), { status: 503 });
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await env.DB.exec(SCHEMA);
      if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
        const email = String(env.ADMIN_EMAIL).trim().toLowerCase();
        if (validEmail(email) && String(env.ADMIN_PASSWORD).length >= 10) {
          const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
          if (!existing) {
            const userId = crypto.randomUUID();
            const orgId = crypto.randomUUID();
            const passwordHash = await hashPassword(String(env.ADMIN_PASSWORD));
            await env.DB.batch([
              env.DB.prepare('INSERT INTO users (id, name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, 1)')
                .bind(userId, env.ADMIN_NAME || 'Administrador', email, passwordHash, 'admin'),
              env.DB.prepare('INSERT INTO organizations (id, name, slug, owner_id) VALUES (?, ?, ?, ?)')
                .bind(orgId, env.ORGANIZATION_NAME || 'Organização Bingo Fácil', `org-${userId.slice(0, 8)}`, userId),
              env.DB.prepare('INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
                .bind(crypto.randomUUID(), userId, 'seed:admin_created', 'user', userId, 'Administrador inicial criado pelo Cloudflare'),
            ]);
          }
        }
      }
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

async function currentUser(request, env) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) throw Object.assign(new Error('Sessão inválida.'), { status: 401 });
  const secret = env.JWT_SECRET;
  if (!secret || String(secret).length < 32) throw Object.assign(new Error('JWT_SECRET não configurado com segurança.'), { status: 503 });
  const payload = await verifyToken(auth.slice(7), secret).catch(() => { throw Object.assign(new Error('Sessão expirada ou inválida.'), { status: 401 }); });
  const user = await env.DB.prepare('SELECT id, name, email, role, is_active FROM users WHERE id = ?').bind(payload.userId).first();
  if (!user || !user.is_active) throw Object.assign(new Error('Usuário não autorizado.'), { status: 401 });
  return user;
}

function requireRole(user, ...roles) {
  if (!roles.includes(user.role)) throw Object.assign(new Error('Você não possui permissão para esta ação.'), { status: 403 });
}

async function audit(env, userId, action, entityType, entityId, details, request) {
  const ip = request.headers.get('CF-Connecting-IP') || null;
  await env.DB.prepare('INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId || null, action, entityType, entityId || null, details || null, ip).run();
}

async function routeApi(request, env) {
  await ensureSchema(env);
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '');
  const method = request.method.toUpperCase();

  if (method === 'GET' && path === 'health') {
    return json({ ok: true, service: 'bingo-facil-cloudflare-api', timestamp: new Date().toISOString() });
  }

  if (method === 'GET' && path === 'setup/status') {
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first();
    return json({ initialized: Number(count?.count || 0) > 0, adminEnvironmentConfigured: Boolean(env.ADMIN_EMAIL && env.ADMIN_PASSWORD) });
  }

  if (method === 'POST' && path === 'auth/register') {
    if (String(env.ALLOW_PUBLIC_REGISTRATION || '').toLowerCase() !== 'true') {
      return json({ message: 'Cadastro público desativado.' }, 403);
    }
    const body = await readBody(request);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = body.phone ? String(body.phone).trim().slice(0, 40) : null;
    const password = String(body.password || '');
    if (name.length < 2 || !validEmail(email) || password.length < 10 || password !== body.confirmPassword) {
      return json({ message: 'Dados inválidos. Use nome, e-mail válido e senha de pelo menos 10 caracteres.' }, 400);
    }
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return json({ message: 'E-mail já cadastrado.' }, 409);
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(userId, name, email, phone, passwordHash, 'organizer'),
      env.DB.prepare('INSERT INTO organizations (id, name, slug, owner_id) VALUES (?, ?, ?, ?)')
        .bind(orgId, `Organização de ${name}`, `org-${userId.slice(0, 8)}`, userId),
    ]);
    await audit(env, userId, 'user_registered', 'user', userId, 'Cadastro realizado no sistema', request);
    if (!env.JWT_SECRET || String(env.JWT_SECRET).length < 32) return json({ message: 'JWT_SECRET não configurado com segurança.' }, 503);
    const token = await signToken({ userId, role: 'organizer' }, env.JWT_SECRET);
    return json({ token, user: { id: userId, name, email, role: 'organizer' } }, 201);
  }

  if (method === 'POST' && path === 'auth/login') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!validEmail(email) || !password) return json({ message: 'Credenciais inválidas.' }, 401);
    const user = await env.DB.prepare('SELECT id, name, email, password_hash, role, is_active, failed_attempts FROM users WHERE email = ?').bind(email).first();
    if (!user || !user.is_active) return json({ message: 'Credenciais inválidas.' }, 401);
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      await env.DB.prepare('UPDATE users SET failed_attempts = failed_attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run();
      return json({ message: 'Credenciais inválidas.' }, 401);
    }
    if (!env.JWT_SECRET || String(env.JWT_SECRET).length < 32) return json({ message: 'JWT_SECRET não configurado com segurança.' }, 503);
    await env.DB.prepare('UPDATE users SET failed_attempts = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run();
    const token = await signToken({ userId: user.id, role: user.role }, env.JWT_SECRET);
    return json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }

  if (method === 'GET' && path === 'auth/me') {
    const user = await currentUser(request, env);
    return json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }

  if (method === 'POST' && path === 'auth/logout') {
    await currentUser(request, env);
    return json({ message: 'Logout realizado com sucesso.' });
  }

  if (method === 'GET' && path === 'bingos/dashboard') {
    const user = await currentUser(request, env);
    const org = await env.DB.prepare('SELECT id FROM organizations WHERE owner_id = ? LIMIT 1').bind(user.id).first();
    if (!org) return json({ message: 'Organização não encontrada.' }, 404);
    const [total, active, closed, totalCards, soldCards, revenue, participants] = await env.DB.batch([
      env.DB.prepare('SELECT COUNT(*) AS count FROM bingos WHERE organization_id = ?').bind(org.id),
      env.DB.prepare("SELECT COUNT(*) AS count FROM bingos WHERE organization_id = ? AND status = 'active'").bind(org.id),
      env.DB.prepare("SELECT COUNT(*) AS count FROM bingos WHERE organization_id = ? AND status = 'closed'").bind(org.id),
      env.DB.prepare('SELECT COUNT(*) AS count FROM cards c JOIN bingos b ON b.id = c.bingo_id WHERE b.organization_id = ?').bind(org.id),
      env.DB.prepare("SELECT COUNT(*) AS count FROM cards c JOIN bingos b ON b.id = c.bingo_id WHERE b.organization_id = ? AND c.status = 'sold'").bind(org.id),
      env.DB.prepare('SELECT COALESCE(SUM(s.amount),0) AS total FROM sales s JOIN cards c ON c.id = s.card_id JOIN bingos b ON b.id = c.bingo_id WHERE b.organization_id = ?').bind(org.id),
      env.DB.prepare("SELECT COUNT(DISTINCT COALESCE(NULLIF(s.buyer_phone,''), s.id)) AS count FROM sales s JOIN cards c ON c.id = s.card_id JOIN bingos b ON b.id = c.bingo_id WHERE b.organization_id = ?").bind(org.id),
    ]);
    const val = (r, key = 'count') => Number(r.results?.[0]?.[key] || 0);
    return json({ stats: {
      totalBingos: val(total), activeBingos: val(active), closedBingos: val(closed),
      totalCards: val(totalCards), soldCards: val(soldCards),
      availableCards: Math.max(val(totalCards) - val(soldCards), 0),
      estimatedRevenue: val(revenue, 'total'), participants: val(participants),
    } });
  }

  if (method === 'GET' && path === 'bingos') {
    const user = await currentUser(request, env);
    const result = await env.DB.prepare(`SELECT b.*, 
      (SELECT COUNT(*) FROM cards c WHERE c.bingo_id = b.id) AS cards_count,
      (SELECT COUNT(*) FROM prizes p WHERE p.bingo_id = b.id) AS prizes_count
      FROM bingos b JOIN organizations o ON o.id = b.organization_id
      WHERE o.owner_id = ? ORDER BY b.created_at DESC`).bind(user.id).all();
    return json({ bingos: result.results || [] });
  }

  if (method === 'POST' && path === 'bingos') {
    const user = await currentUser(request, env);
    const body = await readBody(request);
    const name = String(body.name || '').trim().slice(0, 120);
    const totalCards = Number(body.totalCards);
    const cardPrice = Number(body.cardPrice);
    if (!name || !Number.isInteger(totalCards) || totalCards < 1 || !Number.isFinite(cardPrice) || cardPrice < 0) {
      return json({ message: 'Dados inválidos.' }, 400);
    }
    const org = await env.DB.prepare('SELECT id FROM organizations WHERE owner_id = ? LIMIT 1').bind(user.id).first();
    if (!org) return json({ message: 'Organização não encontrada.' }, 404);
    const id = crypto.randomUUID();
    const publicSlug = `${slugify(name)}-${Date.now().toString(36)}`;
    await env.DB.prepare(`INSERT INTO bingos
      (id,name,description,organizer,event_date,start_time,location,image_url,total_cards,card_price,type,status,public_slug,observations,contact_info,organization_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, name, body.description || null, body.organizer || null, body.eventDate || null, body.startTime || null,
        body.location || null, body.imageUrl || null, totalCards, cardPrice, ['75','90'].includes(String(body.type)) ? String(body.type) : '75',
        ['draft','active','closed'].includes(String(body.status)) ? String(body.status) : 'draft', publicSlug,
        body.observations || null, body.contactInfo || null, org.id).run();
    await audit(env, user.id, 'bingo_created', 'bingo', id, `Criação do bingo ${name}`, request);
    const bingo = await env.DB.prepare('SELECT * FROM bingos WHERE id = ?').bind(id).first();
    return json({ bingo }, 201);
  }

  const prizeMatch = path.match(/^bingos\/([^/]+)\/prizes$/);
  if (method === 'POST' && prizeMatch) {
    const user = await currentUser(request, env);
    const bingoId = decodeURIComponent(prizeMatch[1]);
    const bingo = await env.DB.prepare('SELECT b.id FROM bingos b JOIN organizations o ON o.id=b.organization_id WHERE b.id=? AND o.owner_id=?').bind(bingoId, user.id).first();
    if (!bingo) return json({ message: 'Bingo não encontrado.' }, 404);
    const body = await readBody(request);
    if (!Array.isArray(body) || body.length > 100) return json({ message: 'Lista de prêmios inválida.' }, 400);
    const statements = body.map((p, index) => env.DB.prepare('INSERT INTO prizes (id,name,description,value,image_url,position,win_type,bingo_id) VALUES (?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), String(p.name || `Prêmio ${index + 1}`).slice(0,120), p.description || null,
        p.value == null ? null : Number(p.value), p.imageUrl || null, Number(p.position || index + 1), String(p.winType || 'full_card').slice(0,40), bingoId));
    if (statements.length) await env.DB.batch(statements);
    return json({ prizes: body.length }, 201);
  }

  if (method === 'POST' && path === 'cards/generate') {
    const user = await currentUser(request, env);
    const body = await readBody(request);
    const bingoId = String(body.bingoId || '');
    const quantity = Math.min(Math.max(Number(body.quantity || 1), 1), 500);
    if (!bingoId || !Number.isInteger(quantity)) return json({ message: 'Dados inválidos.' }, 400);
    const bingo = await env.DB.prepare('SELECT b.id FROM bingos b JOIN organizations o ON o.id=b.organization_id WHERE b.id=? AND o.owner_id=?').bind(bingoId, user.id).first();
    if (!bingo) return json({ message: 'Bingo não encontrado.' }, 404);
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM cards WHERE bingo_id = ?').bind(bingoId).first();
    const existing = Number(count?.count || 0);
    const cards = [];
    const statements = [];
    for (let i = 0; i < quantity; i += 1) {
      const card = {
        id: crypto.randomUUID(), bingoId, cardNumber: existing + i + 1,
        validationCode: crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase(),
        qrCodeValue: crypto.randomUUID(), status: 'available', sellerName: 'Sistema',
      };
      cards.push(card);
      statements.push(env.DB.prepare('INSERT INTO cards (id,card_number,validation_code,qr_code_value,status,seller_name,bingo_id) VALUES (?,?,?,?,?,?,?)')
        .bind(card.id, card.cardNumber, card.validationCode, card.qrCodeValue, card.status, card.sellerName, bingoId));
    }
    if (statements.length) await env.DB.batch(statements);
    return json({ created: cards.length, cards }, 201);
  }

  const verifyMatch = path.match(/^cards\/verify\/([^/]+)$/);
  if (method === 'GET' && verifyMatch) {
    await currentUser(request, env);
    const qr = decodeURIComponent(verifyMatch[1]);
    const card = await env.DB.prepare('SELECT c.id,c.card_number,c.validation_code,c.status,b.name AS bingo_name FROM cards c JOIN bingos b ON b.id=c.bingo_id WHERE c.qr_code_value=?').bind(qr).first();
    if (!card) return json({ valid: false, message: 'Cartela não encontrada.' }, 404);
    return json({ valid: true, card: { id: card.id, number: card.card_number, validationCode: card.validation_code, status: card.status, bingo: card.bingo_name } });
  }

  const publicMatch = path.match(/^public\/bingo\/([^/]+)$/);
  if (method === 'GET' && publicMatch) {
    const slug = decodeURIComponent(publicMatch[1]);
    const bingo = await env.DB.prepare('SELECT * FROM bingos WHERE public_slug = ?').bind(slug).first();
    if (!bingo) return json({ message: 'Evento não encontrado.' }, 404);
    const prizes = await env.DB.prepare('SELECT * FROM prizes WHERE bingo_id = ? ORDER BY position ASC').bind(bingo.id).all();
    return json({ bingo: { ...bingo, prizes: prizes.results || [] } });
  }

  if (method === 'GET' && path === 'admin/overview') {
    const user = await currentUser(request, env);
    requireRole(user, 'admin');
    const [users, bingos, revenue, logs] = await env.DB.batch([
      env.DB.prepare('SELECT COUNT(*) AS count FROM users'),
      env.DB.prepare('SELECT COUNT(*) AS count FROM bingos'),
      env.DB.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM sales'),
      env.DB.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20'),
    ]);
    return json({
      users: Number(users.results?.[0]?.count || 0),
      bingos: Number(bingos.results?.[0]?.count || 0),
      revenue: Number(revenue.results?.[0]?.total || 0),
      recentLogs: logs.results || [],
    });
  }

  return json({ message: 'Rota não encontrada.' }, 404);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': new URL(request.url).origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
    } });
  }

  try {
    const response = await routeApi(request, env);
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', new URL(request.url).origin);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    console.error('API error', error);
    return json({ message: error?.message || 'Não foi possível concluir esta operação.' }, Number(error?.status || 500));
  }
}
