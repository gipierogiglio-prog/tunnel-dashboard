require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const ssh = require('./ssh');
const cf = require('./cloudflare');
const { parseConfig, generateConfig, mergeRoutesWithConfig } = require('./config');

const app = express();
const PORT = process.env.PORT || 3011;

// ─── Middleware ───

app.use(cors());
app.use(express.json());

// Simple auth middleware
const AUTH_USER = process.env.AUTH_USERNAME || 'admin';
const AUTH_PASS = process.env.AUTH_PASSWORD || 'admin123';

app.use('/api', (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const b64 = auth.replace('Basic ', '');
  const decoded = Buffer.from(b64, 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');
  if (user !== AUTH_USER || pass !== AUTH_PASS) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  next();
});

// ─── API Routes ───

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Tunnels ───

app.get('/api/tunnels', async (req, res) => {
  try {
    const statuses = await ssh.getAllTunnelStatuses();
    const tunnels = [
      { id: 'uk', name: 'devgiglio-uk', domain: 'devgiglio.uk', status: statuses.uk || 'unknown' },
      { id: 'com', name: 'devgiglio-com', domain: 'devgiglio.com', status: statuses.com || 'unknown' },
      { id: 'rex', name: 'rendafixaexplicada', domain: 'rendafixaexplicada.com', status: statuses.rex || 'unknown' },
    ];

    // Get route counts
    for (const t of tunnels) {
      try {
        const config = await ssh.readConfigYml(t.id);
        const rules = parseConfig(config);
        t.routeCount = rules.filter(r => r.service !== 'http_status:404').length;
      } catch {
        t.routeCount = 0;
      }
    }

    res.json(tunnels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tunnels/:id', async (req, res) => {
  const { id } = req.params;
  if (!['uk', 'com', 'rex'].includes(id)) {
    return res.status(400).json({ error: 'Invalid tunnel ID. Use: uk, com, or rex' });
  }

  try {
    const status = await ssh.getTunnelStatus(id);
    const config = await ssh.readConfigYml(id);
    const rules = parseConfig(config);

    res.json({
      id,
      domain: cf.DOMAIN_MAP[id],
      target: cf.TUNNEL_TARGET[id],
      status,
      routes: rules.filter(r => r.service !== 'http_status:404'),
      catchAll: rules.find(r => r.service === 'http_status:404'),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Routes (CRUD via DB + config.yml sync) ───

app.get('/api/tunnels/:id/routes', async (req, res) => {
  const { id } = req.params;
  try {
    // Get routes from DB
    const dbRoutes = db.getRoutesByTunnel(id);

    // Try to get current config for comparison
    try {
      const config = await ssh.readConfigYml(id);
      const enriched = mergeRoutesWithConfig(config, dbRoutes);
      return res.json(enriched);
    } catch {
      // If SSH fails, return DB routes as-is
      return res.json(dbRoutes);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/routes', (req, res) => {
  const { tunnelId, hostname, path, service } = req.body;
  if (!tunnelId || !hostname || !service) {
    return res.status(400).json({ error: 'tunnelId, hostname, and service are required' });
  }
  if (!['uk', 'com', 'rex'].includes(tunnelId)) {
    return res.status(400).json({ error: 'Invalid tunnelId. Use: uk, com, or rex' });
  }

  try {
    const route = db.createRoute({ tunnelId, hostname, path, service });
    res.status(201).json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/routes/:id', (req, res) => {
  const { id } = req.params;
  const { hostname, path, service } = req.body;

  try {
    const route = db.updateRoute(id, { hostname, path, service });
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/routes/:id', (req, res) => {
  const { id } = req.params;
  try {
    const result = db.deleteRoute(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Apply Changes ───

app.post('/api/apply', async (req, res) => {
  try {
    const applyRecord = db.createApplyHistory({
      status: 'in_progress',
      message: 'Applying changes...',
    });

    res.json({ id: applyRecord.id, status: 'in_progress' });

    // Process asynchronously
    const results = {};
    const errors = [];

    for (const tunnelId of ['uk', 'com', 'rex']) {
      try {
        const routes = db.getRoutesByTunnel(tunnelId);
        const target = cf.TUNNEL_TARGET[tunnelId];

        // Generate new config
        const newConfig = generateConfig(tunnelId, routes, target);

        // Write config to VPS
        await ssh.writeConfigYml(tunnelId, newConfig);

        // Restart tunnel
        const restart = await ssh.restartTunnel(tunnelId);
        results[tunnelId] = { success: true, restart };
      } catch (err) {
        errors.push({ tunnel: tunnelId, error: err.message });
        results[tunnelId] = { success: false, error: err.message };
      }
    }

    const overallStatus = errors.length === 3 ? 'failed' : 'success';
    const message = errors.length === 0
      ? 'All tunnels updated successfully'
      : `Applied with ${errors.length} error(s)`;

    db.createApplyHistory({
      status: overallStatus,
      message,
      details: { results, errors },
    });

    // Update the initial in_progress record
    // (in a real app we'd update but for now it's fine)

  } catch (err) {
    db.createApplyHistory({
      status: 'failed',
      message: err.message,
    });
  }
});

app.get('/api/apply/status', (req, res) => {
  const last = db.getLastApplyStatus();
  const history = db.getApplyHistory(5);
  res.json({ last, history });
});

// ─── DNS ───

app.get('/api/dns/:zone', async (req, res) => {
  const { zone } = req.params;
  if (!['uk', 'com', 'rex'].includes(zone)) {
    return res.status(400).json({ error: 'Invalid zone. Use: uk, com, or rex' });
  }

  try {
    const records = await cf.listDnsRecords(zone);
    // Only return CNAME + A records for cleaner view
    const filtered = records.filter(r => r.type === 'CNAME' || r.type === 'A');
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dns/:zone', async (req, res) => {
  const { zone } = req.params;
  const { subdomain } = req.body;

  if (!subdomain) {
    return res.status(400).json({ error: 'subdomain is required' });
  }

  try {
    const record = await cf.upsertCname(zone, subdomain);
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/dns/:zone/:recordId', async (req, res) => {
  const { zone, recordId } = req.params;
  try {
    await cf.deleteDnsRecord(zone, recordId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Logs ───

app.get('/api/logs/:tunnel', async (req, res) => {
  const { tunnel } = req.params;
  if (!['uk', 'com', 'rex'].includes(tunnel)) {
    return res.status(400).json({ error: 'Invalid tunnel. Use: uk, com, or rex' });
  }

  try {
    const logs = await ssh.getTunnelLogs(tunnel, 50);
    res.json({ tunnel, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Serve Frontend (production) ───

const frontendDist = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ─── Start ───

async function start() {
  await db.initDb();
  console.log('📦 SQLite database initialized');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Tunnel Dashboard API running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

module.exports = app;
