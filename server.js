/**
 * LynxCom Platform Server & REST API Engine
 * Handles Multi-Page clean URL routing, JSON database persistence,
 * Lead capture API, and Secure Back-Office Authentication (Login + Security Code/PIN).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname);
const DB_PATH = path.join(ROOT, 'data', 'db.json');

// Active admin sessions in memory: token -> { user, createdAt, expiresAt }
const activeSessions = new Map();

// Helper: Read DB atomically
function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading DB, returning defaults:', err);
    return { admin: {}, leads: [], stats: {} };
  }
}

// Helper: Write DB atomically
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing DB:', err);
    return false;
  }
}

// MIME Types Map
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=UTF-8',
  '.txt': 'text/plain; charset=UTF-8',
  '.csv': 'text/csv; charset=UTF-8'
};

// Helper: Parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Helper: Check Auth Token
function isAuthenticated(req) {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['cookie']) {
    const cookies = req.headers['cookie'].split(';');
    for (let c of cookies) {
      const [k, v] = c.trim().split('=');
      if (k === 'lynx_session') token = v;
    }
  }

  if (!token || !activeSessions.has(token)) return false;

  const session = activeSessions.get(token);
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return false;
  }
  return session;
}

// Main HTTP Request Handler
const server = http.createServer(async (req, res) => {
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const urlParts = req.url.split('?');
  const pathname = urlParts[0];

  // Global Security & CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ============================================================================
  // REST API ROUTES
  // ============================================================================

  // 1. POST /api/contact - Public lead capture
  if (pathname === '/api/contact' && req.method === 'POST') {
    try {
      const data = await parseBody(req);
      const name = (data.name || '').trim();
      const company = (data.company || '').trim();
      const phone = (data.phone || '').trim();
      const email = (data.email || '').trim();
      const objective = (data.objective || 'autre').trim();
      const message = (data.message || '').trim();
      const budget = (data.budget || '5 000 TND').trim();

      if (!name || !phone || !email) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Nom, téléphone et email sont obligatoires.' }));
        return;
      }

      const db = readDB();
      const nextNum = db.leads.length ? (Math.max(...db.leads.map(l => parseInt(l.id.replace('LC-', ''), 10) || 1000)) + 1) : 1001;
      const leadId = `LC-${nextNum}`;

      const objectiveLabels = {
        seo: "SEO & Référencement Google",
        ads: "Campagnes Google & Meta Ads",
        leads: "Génération de Leads B2B",
        ecommerce: "E-Commerce & Ventes",
        branding: "Branding & Contenu UGC"
      };

      const newLead = {
        id: leadId,
        name,
        company: company || 'Particulier / Indépendant',
        phone,
        email,
        objective,
        objectiveLabel: objectiveLabels[objective] || "Conseil Marketing",
        budget,
        message,
        status: "nouveau",
        notes: "",
        createdAt: new Date().toISOString(),
        ip: clientIP
      };

      db.leads.unshift(newLead);
      writeDB(db);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        leadId,
        message: 'Demande enregistrée avec succès. Notre équipe à Tunis vous contactera sous 2 heures.'
      }));
      return;
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur interne lors de la soumission.' }));
      return;
    }
  }

  // 2. POST /api/auth/login - Admin Login with Password AND Security Code (PIN)
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const data = await parseBody(req);
      const username = (data.username || '').trim();
      const password = (data.password || '').trim();
      const securityCode = (data.securityCode || '').trim();

      const db = readDB();
      const admin = db.admin;

      // Verification of Username, Password and Security Code (PIN)
      const validUser = (username === admin.username || username === admin.email);
      const validPass = (password === admin.password);
      const validCode = (securityCode === admin.securityCode);

      if (!validUser || !validPass || !validCode) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: !validCode && (validUser && validPass)
            ? 'Code de sécurité (PIN) incorrect.'
            : 'Identifiants ou code de sécurité invalides.'
        }));
        return;
      }

      // Generate random secure token
      const token = crypto.randomBytes(32).toString('hex');
      activeSessions.set(token, {
        user: { name: admin.name, username: admin.username, role: admin.role },
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
      });

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': `lynx_session=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`
      });
      res.end(JSON.stringify({
        success: true,
        token,
        user: { name: admin.name, username: admin.username, role: admin.role }
      }));
      return;
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur serveur.' }));
      return;
    }
  }

  // 3. GET /api/auth/check - Check current session
  if (pathname === '/api/auth/check' && req.method === 'GET') {
    const session = isAuthenticated(req);
    if (!session) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ authenticated: false }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authenticated: true, user: session.user }));
    return;
  }

  // 4. POST /api/auth/logout - Logout
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      activeSessions.delete(authHeader.substring(7).trim());
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'lynx_session=; HttpOnly; Path=/; Max-Age=0'
    });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // 5. GET /api/admin/leads - Fetch all leads (Auth required)
  if (pathname === '/api/admin/leads' && req.method === 'GET') {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Non autorisé' }));
      return;
    }
    const db = readDB();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ leads: db.leads }));
    return;
  }

  // 6. PATCH /api/admin/leads/:id - Update lead status or notes (Auth required)
  if (pathname.startsWith('/api/admin/leads/') && req.method === 'PATCH') {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Non autorisé' }));
      return;
    }
    const leadId = pathname.replace('/api/admin/leads/', '').trim();
    const data = await parseBody(req);
    const db = readDB();
    const lead = db.leads.find(l => l.id === leadId);

    if (!lead) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Lead non trouvé.' }));
      return;
    }

    if (data.status) lead.status = data.status;
    if (data.notes !== undefined) lead.notes = data.notes;
    lead.updatedAt = new Date().toISOString();

    writeDB(db);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, lead }));
    return;
  }

  // 7. DELETE /api/admin/leads/:id - Delete lead (Auth required)
  if (pathname.startsWith('/api/admin/leads/') && req.method === 'DELETE') {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Non autorisé' }));
      return;
    }
    const leadId = pathname.replace('/api/admin/leads/', '').trim();
    const db = readDB();
    const index = db.leads.findIndex(l => l.id === leadId);

    if (index === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Lead non trouvé.' }));
      return;
    }

    db.leads.splice(index, 1);
    writeDB(db);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Prospect supprimé.' }));
    return;
  }

  // 8. GET /api/admin/stats - Overview analytics metrics (Auth required)
  if (pathname === '/api/admin/stats' && req.method === 'GET') {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Non autorisé' }));
      return;
    }
    const db = readDB();
    const totalLeads = db.leads.length;
    const newLeads = db.leads.filter(l => l.status === 'nouveau').length;
    const inProgress = db.leads.filter(l => l.status === 'en_cours').length;
    const converted = db.leads.filter(l => l.status === 'converti').length;

    // Approximate pipeline value sum in TND
    let pipelineTND = 0;
    db.leads.forEach(l => {
      const match = (l.budget || '').match(/\d[\d\s]*/);
      if (match) {
        pipelineTND += parseInt(match[0].replace(/\s/g, ''), 10) || 5000;
      }
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalLeads,
      newLeads,
      inProgress,
      converted,
      pipelineTND,
      conversionRate: totalLeads ? Math.round((converted / totalLeads) * 100) : 0
    }));
    return;
  }

  // 9. GET /api/admin/export - Export leads to CSV (Auth required)
  if (pathname === '/api/admin/export' && req.method === 'GET') {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Non autorisé' }));
      return;
    }
    const db = readDB();
    let csv = '\uFEFF'; // UTF-8 BOM for Excel
    csv += 'ID,Date,Nom,Entreprise,Téléphone,Email,Objectif,Budget,Statut,Notes\n';

    db.leads.forEach(l => {
      const row = [
        `"${l.id}"`,
        `"${new Date(l.createdAt).toLocaleDateString('fr-TN')}"`,
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.company || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.objectiveLabel || '').replace(/"/g, '""')}"`,
        `"${(l.budget || '').replace(/"/g, '""')}"`,
        `"${l.status}"`,
        `"${(l.notes || '').replace(/"/g, '""')}"`
      ];
      csv += row.join(',') + '\n';
    });

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=UTF-8',
      'Content-Disposition': 'attachment; filename="leads-lynxcom.csv"'
    });
    res.end(csv);
    return;
  }

  // ============================================================================
  // MULTI-PAGE CLEAN URL ROUTING & STATIC FILE SERVING
  // ============================================================================

  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  safePath = safePath.replace(/\\/g, '/');
  if (safePath === '/' || safePath === '') safePath = '/index.html';

  // Multi-page clean URL maps
  const cleanRouteMap = {
    '/expertise': '/expertise.html',
    '/etudes-de-cas': '/etudes-de-cas.html',
    '/technologie': '/technologie.html',
    '/ressources': '/ressources.html',
    '/a-propos': '/a-propos.html',
    '/contact': '/contact.html',
    '/admin': '/admin/index.html',
    '/admin/': '/admin/index.html',
    '/backoffice': '/admin/index.html',
    '/backoffice/': '/admin/index.html'
  };

  if (cleanRouteMap[safePath]) {
    safePath = cleanRouteMap[safePath];
  }

  let filePath = path.join(ROOT, safePath);

  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch (e) {}

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="fr-TN">
        <head>
          <meta charset="UTF-8">
          <title>404 - Page Non Trouvée | LynxCom</title>
          <link rel="stylesheet" href="/css/style.css">
          <style>
            body { display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; }
            .box-404 { max-width: 500px; padding: 40px; }
            h1 { font-size: 80px; font-weight: 900; margin: 0; color: #0B0F19; }
            p { font-size: 18px; color: #64748B; margin-bottom: 24px; }
          </style>
        </head>
        <body>
          <div class="box-404">
            <h1>404</h1>
            <h2>Page introuvable</h2>
            <p>La page que vous recherchez n'existe pas ou a été déplacée.</p>
            <a href="/" class="btn-pill-yellow">Retour à l'Accueil</a>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`LynxCom Platform live at http://localhost:${PORT}/`);
  console.log(`Back-Office login at http://localhost:${PORT}/admin`);
});
