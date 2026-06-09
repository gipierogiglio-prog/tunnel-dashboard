const https = require('https');

const CF_API = 'https://api.cloudflare.com/client/v4';

// Zone ID lookup
const ZONE_MAP = {
  uk: process.env.ZONE_UK || '8c5417878f88d14a648711efd68b56e4',
  com: process.env.ZONE_COM || '6f471aee05adb5c7ea5828048b00c734',
  rex: process.env.ZONE_REX || '51c0a7b9cbbca5c9923c212c7a75af00',
};

// Tunnel target mapping
const TUNNEL_TARGET = {
  uk: '2bed6578-dfb6-445f-a702-fd176421cb18.cfargotunnel.com',
  com: '67b8f4ee-b3e3-4f34-bb67-e16555840d96.cfargotunnel.com',
  rex: '2525935c-ce75-47d3-a78d-ad8d9d414c5c.cfargotunnel.com',
};

const DOMAIN_MAP = {
  uk: 'devgiglio.uk',
  com: 'devgiglio.com',
  rex: 'rendafixaexplicada.com',
};

function cfRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const token = process.env.CF_TOKEN;
    if (!token) {
      return reject(new Error('CF_TOKEN not set'));
    }

    const url = new URL(CF_API + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch {
          resolve({ success: false, errors: [{ message: data }] });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── DNS Records ───

async function listDnsRecords(zoneKey) {
  const zoneId = ZONE_MAP[zoneKey];
  if (!zoneId) throw new Error(`Unknown zone: ${zoneKey}`);

  const result = await cfRequest('GET', `/zones/${zoneId}/dns_records?per_page=100`);
  if (!result.success) {
    throw new Error(result.errors?.[0]?.message || 'Failed to list DNS records');
  }

  return result.result.map(r => ({
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    ttl: r.ttl,
    proxied: r.proxied,
    zoneName: r.zone_name,
    createdOn: r.created_on,
    modifiedOn: r.modified_on,
  }));
}

async function createDnsRecord(zoneKey, { type, name, content, ttl = 1, proxied = true }) {
  const zoneId = ZONE_MAP[zoneKey];
  if (!zoneId) throw new Error(`Unknown zone: ${zoneKey}`);

  const result = await cfRequest('POST', `/zones/${zoneId}/dns_records`, {
    type: type || 'CNAME',
    name,
    content,
    ttl,
    proxied,
  });

  if (!result.success) {
    throw new Error(result.errors?.[0]?.message || 'Failed to create DNS record');
  }

  return result.result;
}

async function updateDnsRecord(zoneKey, recordId, { type, name, content, ttl = 1, proxied = true }) {
  const zoneId = ZONE_MAP[zoneKey];
  if (!zoneId) throw new Error(`Unknown zone: ${zoneKey}`);

  const result = await cfRequest('PUT', `/zones/${zoneId}/dns_records/${recordId}`, {
    type: type || 'CNAME',
    name,
    content,
    ttl,
    proxied,
  });

  if (!result.success) {
    throw new Error(result.errors?.[0]?.message || 'Failed to update DNS record');
  }

  return result.result;
}

async function deleteDnsRecord(zoneKey, recordId) {
  const zoneId = ZONE_MAP[zoneKey];
  if (!zoneId) throw new Error(`Unknown zone: ${zoneKey}`);

  const result = await cfRequest('DELETE', `/zones/${zoneId}/dns_records/${recordId}`);

  if (!result.success) {
    throw new Error(result.errors?.[0]?.message || 'Failed to delete DNS record');
  }

  return true;
}

async function upsertCname(zoneKey, subdomain) {
  const zoneId = ZONE_MAP[zoneKey];
  const target = TUNNEL_TARGET[zoneKey];
  const domain = DOMAIN_MAP[zoneKey];
  if (!zoneId || !target) throw new Error(`Unknown zone: ${zoneKey}`);

  // Build the full name — Cloudflare handles zone appending
  const name = subdomain.endsWith(`.${domain}`) ? subdomain : `${subdomain}.${domain}`;

  // Check if record already exists
  const existing = await listDnsRecords(zoneKey);
  const match = existing.find(r => r.type === 'CNAME' && (r.name === name || r.name === subdomain));

  if (match) {
    return await updateDnsRecord(zoneKey, match.id, {
      type: 'CNAME',
      name: subdomain,
      content: target,
      ttl: 1,
      proxied: true,
    });
  } else {
    return await createDnsRecord(zoneKey, {
      type: 'CNAME',
      name: subdomain,
      content: target,
      ttl: 1,
      proxied: true,
    });
  }
}

module.exports = {
  listDnsRecords,
  createDnsRecord,
  updateDnsRecord,
  deleteDnsRecord,
  upsertCname,
  ZONE_MAP,
  TUNNEL_TARGET,
  DOMAIN_MAP,
};
