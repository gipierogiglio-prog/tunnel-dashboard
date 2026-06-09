const API_BASE = '/api';
const CREDENTIALS = btoa('admin:admin123');

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Basic ${CREDENTIALS}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function getTunnels() {
  return request('GET', '/tunnels');
}

export async function getTunnelDetail(id) {
  return request('GET', `/tunnels/${id}`);
}

export async function getRoutes(tunnelId) {
  return request('GET', `/tunnels/${tunnelId}/routes`);
}

export async function createRoute(data) {
  return request('POST', '/routes', data);
}

export async function updateRoute(id, data) {
  return request('PUT', `/routes/${id}`, data);
}

export async function deleteRoute(id) {
  return request('DELETE', `/routes/${id}`);
}

export async function applyChanges() {
  return request('POST', '/apply');
}

export async function getApplyStatus() {
  return request('GET', '/apply/status');
}

export async function getDnsRecords(zone) {
  return request('GET', `/dns/${zone}`);
}

export async function upsertCname(zone, subdomain) {
  return request('POST', `/dns/${zone}`, { subdomain });
}

export async function deleteDnsRecord(zone, recordId) {
  return request('DELETE', `/dns/${zone}/${recordId}`);
}

export async function getLogs(tunnel) {
  return request('GET', `/logs/${tunnel}`);
}

export async function getHealth() {
  return request('GET', '/health');
}
