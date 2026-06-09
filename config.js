const yaml = require('js-yaml');

// ─── Parse config.yml → array of ingress rules ───

function parseConfig(ymlContent) {
  try {
    const doc = yaml.load(ymlContent);
    if (!doc || !doc.ingress) return [];

    return doc.ingress.map((rule, index) => ({
      index,
      hostname: rule.hostname || '',
      path: rule.path || '',
      service: rule.service || '',
    }));
  } catch (err) {
    throw new Error(`Failed to parse config.yml: ${err.message}`);
  }
}

// ─── Generate config.yml from array of rules ───

function generateConfig(tunnelId, rules, tunnelTarget) {
  // Build ingress array
  const ingress = rules.map(rule => {
    const entry = { service: rule.service };
    if (rule.hostname) entry.hostname = rule.hostname;
    if (rule.path) entry.path = rule.path;
    return entry;
  });

  // Add catch-all at the end (required by cloudflared)
  ingress.push({ service: 'http_status:404' });

  const doc = {
    tunnel: tunnelId,
    'credentials-file': `/root/.cloudflared/tunnels/${tunnelId}/credentials.json`,
    ingress,
  };

  return yaml.dump(doc, {
    indent: 2,
    lineWidth: -1,  // no line wrapping
    noRefs: true,
    quotingType: "'",
    forceQuotes: false,
  });
}

// ─── Merge DB routes with current config.yml ───
// Reads the config, extracts rules, merges with DB state

function mergeRoutesWithConfig(configYml, dbRoutes) {
  const currentRules = parseConfig(configYml);

  // Remove catch-all from current rules for comparison
  const cleanCurrent = currentRules.filter(r => r.service !== 'http_status:404');

  // Create a map of hostname+path → current service for existing routes
  const currentMap = {};
  for (const r of cleanCurrent) {
    const key = `${r.hostname}|${r.path}`;
    currentMap[key] = r.service;
  }

  // Check which DB routes already exist in config
  const result = [];
  for (const route of dbRoutes) {
    const key = `${route.hostname}|${route.path}`;
    if (currentMap[key]) {
      result.push({ ...route, inConfig: true, currentService: currentMap[key] });
    } else {
      result.push({ ...route, inConfig: false, currentService: null });
    }
  }

  return result;
}

module.exports = {
  parseConfig,
  generateConfig,
  mergeRoutesWithConfig,
};
