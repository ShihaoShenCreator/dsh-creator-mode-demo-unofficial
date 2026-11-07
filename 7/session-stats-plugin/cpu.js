// dsh-session-stats-panel — cpu.js
// Pure CPU sampler built on node:os and process only. It never starts timers:
// index.js owns the interval and calls sample().
import os from 'node:os';
import process from 'node:process';

const DEFAULT_INTERVAL_MS = 2000;
const UNKNOWN_MODEL = 'unknown';

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function coreList() {
  try {
    const cpus = os.cpus();
    return Array.isArray(cpus) ? cpus : [];
  } catch {
    return [];
  }
}

function ticksOf(cpu) {
  const times = cpu?.times;
  const user = finite(times?.user) + finite(times?.nice);
  const system = finite(times?.sys) + finite(times?.irq);
  const idle = finite(times?.idle);
  return { total: user + system + idle, idle };
}

function systemInfo() {
  const cpus = coreList();
  if (cpus.length === 0) {
    return {
      available: false,
      reason: 'os.cpus() returned no cores',
      cores: 0,
      model: UNKNOWN_MODEL,
      speedMHz: 0,
      perCore: [],
      ticks: [],
    };
  }
  const first = cpus[0] ?? {};
  const model = typeof first.model === 'string' && first.model !== '' ? first.model : UNKNOWN_MODEL;
  const perCore = [];
  const ticks = [];
  for (let index = 0; index < cpus.length; index += 1) {
    const cpu = cpus[index] ?? {};
    const coreModel = typeof cpu.model === 'string' && cpu.model !== '' ? cpu.model : UNKNOWN_MODEL;
    perCore.push({ index, model: coreModel, speedMHz: finite(cpu.speed) });
    ticks.push(ticksOf(cpu));
  }
  return {
    available: true,
    reason: null,
    cores: cpus.length,
    model,
    speedMHz: finite(first.speed),
    perCore,
    ticks,
  };
}

function memoryInfo() {
  let total = 0;
  let free = 0;
  try {
    total = Math.max(0, finite(os.totalmem()));
    free = Math.max(0, finite(os.freemem()));
  } catch {
    total = 0;
    free = 0;
  }
  const used = total > 0 ? Math.max(0, total - free) : 0;
  const memUsedRatio = total > 0 ? Math.min(1, Math.max(0, used / total)) : 0;
  return { memTotalBytes: total, memFreeBytes: free, memUsedRatio };
}

function loadAverages() {
  try {
    const loads = os.loadavg();
    if (!Array.isArray(loads) || loads.length < 3) {
      return { load1: null, load5: null, load15: null };
    }
    const pick = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
    return { load1: pick(loads[0]), load5: pick(loads[1]), load15: pick(loads[2]) };
  } catch {
    return { load1: null, load5: null, load15: null };
  }
}

function readProcessUsage() {
  try {
    const usage = process.cpuUsage();
    if (usage === null || typeof usage !== 'object') return { user: 0, system: 0 };
    return { user: Math.max(0, finite(usage.user)), system: Math.max(0, finite(usage.system)) };
  } catch {
    return { user: 0, system: 0 };
  }
}

function processInfo() {
  let memory = {};
  try {
    const measured = process.memoryUsage();
    if (measured !== null && typeof measured === 'object') memory = measured;
  } catch {
    memory = {};
  }
  let uptimeSec = 0;
  try {
    uptimeSec = Math.max(0, finite(process.uptime()));
  } catch {
    uptimeSec = 0;
  }
  const usage = readProcessUsage();
  return {
    usage,
    cpuUserMs: usage.user / 1000,
    cpuSystemMs: usage.system / 1000,
    rssBytes: finite(memory.rss),
    heapUsedBytes: finite(memory.heapUsed),
    heapTotalBytes: finite(memory.heapTotal),
    externalBytes: finite(memory.external),
    uptimeSec,
    pid: finite(process.pid),
  };
}

function snapshotOf({ system, processData, sampledAt, intervalMs, busyList, coresBusyPercent, cpuPercent }) {
  const memory = memoryInfo();
  const perCore = system.perCore.map((core, index) => ({
    index: core.index,
    model: core.model,
    speedMHz: core.speedMHz,
    busyPercent: index < busyList.length ? busyList[index] : null,
  }));
  const snapshot = {
    available: system.available,
    sampledAt: finite(sampledAt),
    intervalMs: finite(intervalMs, DEFAULT_INTERVAL_MS),
    cores: finite(system.cores),
    model: system.model,
    speedMHz: finite(system.speedMHz),
    process: {
      cpuPercent: finite(cpuPercent),
      cpuUserMs: processData.cpuUserMs,
      cpuSystemMs: processData.cpuSystemMs,
      rssBytes: processData.rssBytes,
      heapUsedBytes: processData.heapUsedBytes,
      heapTotalBytes: processData.heapTotalBytes,
      externalBytes: processData.externalBytes,
      uptimeSec: processData.uptimeSec,
      pid: processData.pid,
    },
    system: {
      ...loadAverages(),
      ...memory,
      coresBusyPercent: finite(coresBusyPercent),
      perCore,
    },
  };
  if (!system.available) snapshot.reason = system.reason;
  return snapshot;
}

function makeBaseline(clock) {
  const system = systemInfo();
  const processData = processInfo();
  return {
    ticks: system.ticks,
    usage: processData.usage,
    wallMs: clock(),
    system,
    process: processData,
  };
}

/**
 * Create a CPU sampler.
 *
 * `start()` records the os.cpus() tick baseline, process.cpuUsage() and wall
 * clock; it is idempotent and records a baseline immediately. `sample()` diffs
 * against the previous baseline (taking one first if none exists) and stores the
 * fresh snapshot. `stop()` drops the baseline but keeps the last snapshot. No
 * timers are created here. `snapshot()` never throws.
 *
 * @param {{ intervalMs?: number, now?: () => number }} [options]
 * @returns {{
 *   start: () => void,
 *   sample: () => void,
 *   stop: () => void,
 *   snapshot: () => {
 *     available: boolean,
 *     sampledAt: number,
 *     intervalMs: number,
 *     cores: number,
 *     model: string,
 *     speedMHz: number,
 *     process: { cpuPercent: number, cpuUserMs: number, cpuSystemMs: number, rssBytes: number,
 *                heapUsedBytes: number, heapTotalBytes: number, externalBytes: number,
 *                uptimeSec: number, pid: number },
 *     system: { load1: number|null, load5: number|null, load15: number|null,
 *               memTotalBytes: number, memFreeBytes: number, memUsedRatio: number,
 *               coresBusyPercent: number,
 *               perCore: Array<{ index: number, model: string, speedMHz: number, busyPercent: number|null }> }
 *   }
 * }}
 */
export function createCpuSampler(options = {}) {
  const requested = finite(options?.intervalMs, DEFAULT_INTERVAL_MS);
  const intervalMs = requested > 0 ? requested : DEFAULT_INTERVAL_MS;
  const now = typeof options?.now === 'function' ? options.now : () => Date.now();

  let baseline = null;
  let last = null;
  let running = false;

  function clock() {
    const value = Number(now());
    return Number.isFinite(value) ? value : Date.now();
  }

  function snapshotFromBaseline(source) {
    return snapshotOf({
      system: source.system,
      processData: source.process,
      sampledAt: source.wallMs,
      intervalMs,
      busyList: source.system.perCore.map(() => null),
      coresBusyPercent: 0,
      cpuPercent: 0,
    });
  }

  function start() {
    if (running) return;
    running = true;
    baseline = makeBaseline(clock);
  }

  function stop() {
    running = false;
    baseline = null;
  }

  function busyPercent(previousTicks, currentTicks, firstSample) {
    if (firstSample) return null;
    if (previousTicks === null || typeof previousTicks !== 'object') return null;
    if (currentTicks === null || typeof currentTicks !== 'object') return null;
    const total = currentTicks.total - previousTicks.total;
    const idle = currentTicks.idle - previousTicks.idle;
    // No tick delta (first sample, or sampled twice within the tick resolution):
    // no busy time was observed, so perCore stays null and coresBusyPercent 0.
    if (!Number.isFinite(total) || total <= 0) return null;
    const busy = 1 - idle / total;
    return clampPercent(busy * 100);
  }

  function sample() {
    try {
      const previous = baseline;
      const hadBaseline = previous !== null;
      const source = hadBaseline ? previous : makeBaseline(clock);
      const system = systemInfo();
      const processData = processInfo();
      const wallMs = clock();
      const elapsedMs = wallMs - source.wallMs;

      // process.cpuUsage() is MICROSECONDS; the wall clock here is MILLISECONDS.
      // Convert the window to microseconds before dividing, so one saturated
      // core reads ~100 (a process across N cores may exceed 100; no clamp).
      const elapsedUs = elapsedMs * 1000;
      const userDelta = Math.max(0, processData.usage.user - finite(source.usage?.user));
      const systemDelta = Math.max(0, processData.usage.system - finite(source.usage?.system));
      const cpuPercent = elapsedUs > 0 ? ((userDelta + systemDelta) / elapsedUs) * 100 : 0;

      const busyList = [];
      let busySum = 0;
      let busyCount = 0;
      for (let index = 0; index < system.perCore.length; index += 1) {
        const value = hadBaseline ? busyPercent(source.ticks[index], system.ticks[index]) : null;
        busyList.push(value);
        if (value !== null) {
          busySum += value;
          busyCount += 1;
        }
      }
      const coresBusyPercent = busyCount > 0 ? clampPercent(busySum / busyCount) : 0;

      last = snapshotOf({
        system,
        processData,
        sampledAt: wallMs,
        intervalMs,
        busyList,
        coresBusyPercent,
        cpuPercent,
      });
      baseline = {
        ticks: system.ticks,
        usage: processData.usage,
        wallMs,
        system,
        process: processData,
      };
      return last;
    } catch {
      // Never throw: keep the previous snapshot or synthesize a baseline one.
      if (last !== null) return last;
      const fallback = makeBaseline(clock);
      last = snapshotFromBaseline(fallback);
      return last;
    }
  }

  function snapshot() {
    try {
      if (last !== null) {
        return {
          ...last,
          process: { ...last.process },
          system: { ...last.system, perCore: last.system.perCore.map((core) => ({ ...core })) },
        };
      }
      const source = baseline ?? makeBaseline(clock);
      return snapshotFromBaseline(source);
    } catch {
      return snapshotFromBaseline(makeBaseline(() => Date.now()));
    }
  }

  return { start, sample, stop, snapshot };
}
