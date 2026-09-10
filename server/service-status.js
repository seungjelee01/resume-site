import { execFile } from 'node:child_process';
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

export async function loadServiceStatuses() {
  const [applicationStats, tunnelService] = await Promise.all([
    readProcessStats(process.pid),
    readUserService('cloudflared-resume.service'),
  ]);
  const tunnelStats = tunnelService.running ? await readProcessStats(tunnelService.pid) : null;

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
      status: tunnelService.running === null ? 'unknown' : tunnelService.running ? 'running' : 'stopped',
      pid: tunnelService.pid,
      cpu: tunnelStats?.cpu ?? null,
      memory: tunnelStats?.memory ?? null,
      uptime: tunnelStats?.uptime ?? null,
    },
  ];
}
