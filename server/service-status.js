import { execFile } from 'node:child_process';
import { statfs } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function readProcessStats(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    const { stdout } = await execFileAsync('/usr/bin/ps', ['-p', String(pid), '-o', '%cpu=,rss=,etimes='], {
      timeout: 1500,
      maxBuffer: 4096,
    });
    const [cpu, rss, uptime] = stdout.trim().split(/\s+/).map(Number);
    if (![cpu, rss, uptime].every(Number.isFinite)) return null;
    return { cpu, memory: rss * 1024, uptime };
  } catch {
    return null;
  }
}

async function readNamedProcessStats(name) {
  if (name !== 'cloudflared') return null;
  try {
    const { stdout } = await execFileAsync('/usr/bin/ps', ['-C', name, '-o', 'pid=,%cpu=,rss=,etimes='], {
      timeout: 1500,
      maxBuffer: 4096,
    });
    const [pid, cpu, rss, uptime] = stdout.trim().split('\n')[0].trim().split(/\s+/).map(Number);
    if (![pid, cpu, rss, uptime].every(Number.isFinite) || pid <= 0) return null;
    return { pid, cpu, memory: rss * 1024, uptime };
  } catch {
    return null;
  }
}

async function readUserService(unit) {
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  const env = uid === null ? process.env : { ...process.env, XDG_RUNTIME_DIR: `/run/user/${uid}` };
  try {
    const { stdout } = await execFileAsync('/usr/bin/systemctl', [
      '--user',
      'show',
      unit,
      '--property=ActiveState',
      '--property=MainPID',
    ], { timeout: 1500, maxBuffer: 4096, env });
    const properties = Object.fromEntries(stdout.trim().split('\n').map((line) => line.split(/=(.*)/s).slice(0, 2)));
    const pid = Number(properties.MainPID);
    return {
      running: properties.ActiveState === 'active' && Number.isInteger(pid) && pid > 0,
      pid: Number.isInteger(pid) && pid > 0 ? pid : null,
    };
  } catch {
    return { running: null, pid: null };
  }
}

async function readSystemService(unit) {
  try {
    const { stdout } = await execFileAsync('/usr/bin/systemctl', [
      'show',
      unit,
      '--property=ActiveState',
      '--property=MainPID',
    ], { timeout: 1500, maxBuffer: 4096 });
    const properties = Object.fromEntries(stdout.trim().split('\n').map((line) => line.split(/=(.*)/s).slice(0, 2)));
    const pid = Number(properties.MainPID);
    return {
      running: properties.ActiveState === 'active' && Number.isInteger(pid) && pid > 0,
      pid: Number.isInteger(pid) && pid > 0 ? pid : null,
    };
  } catch {
    return { running: null, pid: null };
  }
}

export async function loadDiskStatus(target = '/') {
  try {
    const stats = await statfs(target);
    const total = Number(stats.blocks) * Number(stats.bsize);
    const available = Number(stats.bavail) * Number(stats.bsize);
    if (![total, available].every(Number.isFinite) || total <= 0 || available < 0) return null;
    const used = Math.max(0, total - available);
    return { total, used, available, percent: Math.min(100, used / total * 100) };
  } catch {
    return null;
  }
}

export async function loadServiceStatuses() {
  const [applicationStats, tunnelService, aiChatService] = await Promise.all([
    readProcessStats(process.pid),
    readUserService('cloudflared-resume.service'),
    readSystemService('ai-chat.service'),
  ]);
  const [tunnelStats, aiChatStats] = await Promise.all([
    tunnelService.running ? readProcessStats(tunnelService.pid) : readNamedProcessStats('cloudflared'),
    aiChatService.running ? readProcessStats(aiChatService.pid) : null,
  ]);
  const tunnelRunning = tunnelStats ? true : tunnelService.running;

  return [
    {
      name: 'Resume Website',
      status: 'running',
      pid: process.pid,
      cpu: applicationStats?.cpu ?? null,
      memory: applicationStats?.memory ?? process.memoryUsage().rss,
      uptime: applicationStats?.uptime ?? Math.floor(process.uptime()),
    },
    {
      name: 'Cloudflare Tunnel',
      status: tunnelRunning === null ? 'unknown' : tunnelRunning ? 'running' : 'stopped',
      pid: tunnelStats?.pid ?? tunnelService.pid,
      cpu: tunnelStats?.cpu ?? null,
      memory: tunnelStats?.memory ?? null,
      uptime: tunnelStats?.uptime ?? null,
    },
    {
      name: 'AI Chat',
      status: aiChatService.running === null ? 'unknown' : aiChatService.running ? 'running' : 'stopped',
      pid: aiChatStats?.pid ?? aiChatService.pid,
      cpu: aiChatStats?.cpu ?? null,
      memory: aiChatStats?.memory ?? null,
      uptime: aiChatStats?.uptime ?? null,
    },
  ];
}
