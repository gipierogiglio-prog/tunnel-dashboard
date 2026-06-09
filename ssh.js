const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

function getSshConfig() {
  const keyPath = process.env.SSH_KEY || path.join(process.env.HOME || '/root', '.ssh/id_rsa');
  let privateKey;
  try {
    privateKey = fs.readFileSync(keyPath, 'utf8');
  } catch {
    // Try alternative locations
    const altPath = path.join('/home/node/.ssh/id_rsa');
    try {
      privateKey = fs.readFileSync(altPath, 'utf8');
    } catch {
      throw new Error(`SSH key not found at ${keyPath} or ${altPath}`);
    }
  }

  return {
    host: process.env.SSH_HOST || '173.249.60.169',
    port: parseInt(process.env.SSH_PORT || '22'),
    username: process.env.SSH_USER || 'root',
    privateKey,
    readyTimeout: 10000,
  };
}

function execCommand(command) {
  return new Promise((resolve, reject) => {
    const config = getSshConfig();
    const conn = new Client();

    let stdout = '';
    let stderr = '';
    let exitCode = -1;

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        stream.on('close', (code) => {
          exitCode = code;
          conn.end();
        });

        stream.on('data', (data) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      });
    });

    conn.on('error', reject);
    conn.on('close', () => {
      resolve({ stdout, stderr, exitCode });
    });

    conn.connect(config);
  });
}

// ─── Tunnel Status ───

async function getTunnelStatus(tunnelId) {
  const serviceName = `cloudflared-tunnel-${tunnelId}.service`;
  const result = await execCommand(`systemctl is-active ${serviceName}`);
  return result.stdout.trim();
}

async function getAllTunnelStatuses() {
  const ids = ['uk', 'com', 'rex'];
  const statuses = {};
  for (const id of ids) {
    try {
      const status = await getTunnelStatus(id);
      statuses[id] = status;
    } catch {
      statuses[id] = 'unknown';
    }
  }
  return statuses;
}

// ─── Config File Operations ───

async function readConfigYml(tunnelId) {
  const path = `/root/.cloudflared/tunnels/${tunnelId}/config.yml`;
  const result = await execCommand(`cat ${path}`);
  if (result.exitCode !== 0) {
    throw new Error(`Failed to read config for tunnel ${tunnelId}: ${result.stderr}`);
  }
  return result.stdout;
}

async function writeConfigYml(tunnelId, content) {
  const path = `/root/.cloudflared/tunnels/${tunnelId}/config.yml`;
  // Escape content for safe shell passing via base64
  const b64 = Buffer.from(content).toString('base64');
  const cmd = `echo '${b64}' | base64 -d > ${path}`;
  const result = await execCommand(cmd);
  if (result.exitCode !== 0) {
    throw new Error(`Failed to write config for tunnel ${tunnelId}: ${result.stderr}`);
  }
  return true;
}

async function restartTunnel(tunnelId) {
  const serviceName = `cloudflared-tunnel-${tunnelId}.service`;
  const result = await execCommand(`systemctl restart ${serviceName}`);
  if (result.exitCode !== 0) {
    throw new Error(`Failed to restart ${serviceName}: ${result.stderr}`);
  }

  // Give it a moment and check status
  await new Promise(resolve => setTimeout(resolve, 2000));
  const status = await getTunnelStatus(tunnelId);
  return { status, serviceName };
}

// ─── Logs ───

async function getTunnelLogs(tunnelId, lines = 50) {
  const serviceName = `cloudflared-tunnel-${tunnelId}.service`;
  const result = await execCommand(`journalctl -u ${serviceName} --no-pager -n ${lines}`);
  if (result.exitCode !== 0) {
    throw new Error(`Failed to get logs for ${serviceName}: ${result.stderr}`);
  }
  return result.stdout;
}

module.exports = {
  execCommand,
  getTunnelStatus,
  getAllTunnelStatuses,
  readConfigYml,
  writeConfigYml,
  restartTunnel,
  getTunnelLogs,
};
