/**
 * `dsh-session-stats-panel` — Host half.
 *
 * Reads real session logs through `ctx.sessionQuery`, folds token usage with
 * `stats.js`, prices it against the plugin's configured price table, and serves
 * one aggregate snapshot to the Client page. CPU usage comes from `cpu.js`.
 *
 * Route surface (prefix `/session-stats`):
 *   GET|HEAD /session-stats/api/snapshot?window=all|30d|7d|today[&refresh=1]
 *   GET|HEAD /session-stats/api/whoami
 *
 * Every resource is registered inside one `ctx.effect`, so unloading the row
 * disposes all routes and the sampling timer.
 */

import { createCpuSampler } from './cpu.js';
import { dayKey, foldHourBuckets, foldSessionEvents } from './stats.js';

const PACKAGE_NAME = 'dsh-session-stats-panel';
const ROUTE_PREFIX = '/session-stats';
const SNAPSHOT_PATH = `${ROUTE_PREFIX}/api/snapshot`;
const WHOAMI_PATH = `${ROUTE_PREFIX}/api/whoami`;

const SNAPSHOT_TTL_MS = 15 * 1000;
const READ_CONCURRENCY = 4;
const SAMPLE_INTERVAL_MS = 2000;
const MAX_TEXT = 240;
const UNKNOWN_MODEL = '未标注模型';

const WINDOWS = new Set(['all', '30d', '7d', 'today']);
const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_PRICE = { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1 };
const DEFAULT_BUDGET = { amount: 50, currency: 'CNY', period: 'month' };

/* ------------------------------------------------------------------------- *
 * Small helpers
 * ------------------------------------------------------------------------- */

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegative(value) {
  return Math.max(0, finite(value));
}

function clampText(value, limit = MAX_TEXT) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

function messageOf(error) {
  return String((error && error.message) || error);
}

function report(ctx, message, error) {
  const detail = error === undefined ? '' : `: ${messageOf(error)}`;
  try {
    ctx.logger?.warn?.(`${PACKAGE_NAME}: ${message}${detail}`);
  } catch {
    // logging is best effort
  }
}

function modelIdOf(model) {
  return typeof model === 'string' && model.trim() !== '' ? model : UNKNOWN_MODEL;
}

/* ------------------------------------------------------------------------- *
 * Config
 * ------------------------------------------------------------------------- */

function priceEntryOf(raw) {
  if (raw === null || typeof raw !== 'object') return null;
  const source = raw;
  return {
    input: nonNegative(source.input),
    output: nonNegative(source.output),
    cacheRead: nonNegative(source.cacheRead ?? source.cache_read),
    cacheWrite: nonNegative(source.cacheWrite ?? source.cache_write),
  };
}

function resolveConfig(config) {
  const source = config !== null && typeof config === 'object' ? config : {};
  const defaultPrice = priceEntryOf(source.defaultPrice) ?? DEFAULT_PRICE;
  const prices = new Map();
  const rows = source.prices;
  if (rows !== null && typeof rows === 'object' && !Array.isArray(rows)) {
    for (const [model, entry] of Object.entries(rows)) {
      const priced = priceEntryOf(entry);
      if (model !== '' && priced !== null) prices.set(model, priced);
    }
  }
  const rawBudget = source.budget !== null && typeof source.budget === 'object' ? source.budget : {};
  const currency = typeof rawBudget.currency === 'string' ? rawBudget.currency.trim() : '';
  return {
    defaultPrice,
    prices,
    budget: {
      amount: nonNegative(rawBudget.amount ?? DEFAULT_BUDGET.amount),
      currency: currency === '' ? DEFAULT_BUDGET.currency : clampText(currency, 8),
      period: rawBudget.period === 'day' ? 'day' : 'month',
    },
  };
}

/** Price one call's buckets. Prices are currency units per 1,000,000 tokens. */
function costOf(settings, model, buckets) {
  const price = (typeof model === 'string' && settings.prices.get(model)) || settings.defaultPrice;
  const cost = (
    nonNegative(buckets.input) * nonNegative(price.input) +
    nonNegative(buckets.output) * nonNegative(price.output) +
    nonNegative(buckets.cacheRead) * nonNegative(price.cacheRead) +
    nonNegative(buckets.cacheWrite) * nonNegative(price.cacheWrite)
  ) / 1e6;
  return Number.isFinite(cost) ? cost : 0;
}

/* ------------------------------------------------------------------------- *
 * Windows and periods
 * ------------------------------------------------------------------------- */

function startOfDay(timeMs) {
  const date = new Date(timeMs);
  if (!Number.isFinite(date.getTime())) return 0;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfMonth(timeMs) {
  const date = new Date(startOfDay(timeMs));
  if (!Number.isFinite(date.getTime())) return 0;
  date.setDate(1);
  return date.getTime();
}

function nextMonthStart(timeMs) {
  const date = new Date(startOfMonth(timeMs));
  date.setMonth(date.getMonth() + 1);
  return date.getTime();
}

/**
 * Resolve a window id to half-open epoch bounds. `all` has no bounds; the
 * rolling windows end at tomorrow's local midnight so "today" is complete.
 */
function windowBounds(id, nowMs) {
  const today = startOfDay(nowMs);
  if (id === 'today') return { from: today, to: today + DAY_MS };
  if (id === '7d') return { from: today - 6 * DAY_MS, to: today + DAY_MS };
  if (id === '30d') return { from: today - 29 * DAY_MS, to: today + DAY_MS };
  return { from: null, to: null };
}

function inBounds(timeMs, bounds) {
  if (!Number.isFinite(timeMs)) return false;
  if (bounds.from !== null && timeMs < bounds.from) return false;
  if (bounds.to !== null && timeMs >= bounds.to) return false;
  return true;
}

/* ------------------------------------------------------------------------- *
 * Session log reads
 * ------------------------------------------------------------------------- */

function releaseObservation(observation) {
  if (observation === null || observation === undefined) return;
  try {
    if (typeof observation.dispose === 'function') observation.dispose();
    else if (Symbol.dispose in observation) observation[Symbol.dispose]();
  } catch {
    // releasing a lease is best effort
  }
}

function eventsOf(value) {
  return Array.isArray(value) ? value : null;
}

/**
 * Own events of one session, read without promoting it to a live Agent.
 *
 * A forked session's log carries its parent's events verbatim as an inherited
 * prefix (`inheritedEventCount`). Counting that prefix again would bill the
 * same model calls twice across the corpus, so only events at or after
 * `inheritedEventCount` are returned.
 */
async function readSessionEvents(query, sessionId) {
  if (query === null || typeof query !== 'object') return null;
  let events = null;
  let inherited = 0;
  if (typeof query.observeSession === 'function') {
    const observation = await query.observeSession(sessionId, { projectionMode: 'none' });
    try {
      events = eventsOf(observation?.events);
      inherited = nonNegative(observation?.inheritedEventCount);
    } finally {
      releaseObservation(observation);
    }
  } else if (typeof query.readSession === 'function') {
    const snapshot = await query.readSession(sessionId);
    events = eventsOf(snapshot?.events);
    inherited = nonNegative(snapshot?.inheritedEventCount);
  }
  if (events === null) return null;
  const own = inherited > 0 ? events.slice(Math.min(Math.floor(inherited), events.length)) : events;
  return own.length === 0 ? null : own;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const take = () => (cursor < items.length ? cursor++ : -1);
  const run = async () => {
    for (let index = take(); index !== -1; index = take()) {
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, run));
  return results;
}

/* ------------------------------------------------------------------------- *
 * Aggregation
 * ------------------------------------------------------------------------- */

function timelineOf(calls, bounds, granularity) {
  if (granularity === 'hour') {
    const hours = foldHourBuckets(calls);
    return hours.map((tokens, hour) => ({
      key: String(hour).padStart(2, '0'),
      label: `${String(hour).padStart(2, '0')}:00`,
      tokens,
      cost: 0,
      calls: 0,
      sessions: 0,
    }));
  }
  const cells = new Map();
  for (const call of calls) {
    const key = dayKey(call.time);
    if (key === null) continue;
    let cell = cells.get(key);
    if (cell === undefined) {
      cell = { key, tokens: 0, cost: 0, calls: 0, sessions: new Set() };
      cells.set(key, cell);
    }
    cell.tokens += nonNegative(call.tokens);
    cell.cost += nonNegative(call.cost);
    cell.calls += 1;
    cell.sessions.add(call.sessionId);
  }
  const points = [...cells.values()]
    .sort((left, right) => (left.key < right.key ? -1 : 1))
    .map((cell) => ({
      key: cell.key,
      label: cell.key,
      tokens: cell.tokens,
      cost: cell.cost,
      calls: cell.calls,
      sessions: cell.sessions.size,
    }));
  if (bounds.from === null) return points;

  // A window keeps its own shape: one point per day, gaps filled with zero.
  const byKey = new Map(points.map((point) => [point.key, point]));
  const out = [];
  const endKey = dayKey(Math.max(bounds.from, bounds.to - DAY_MS)) ?? dayKey(Date.now());
  for (let time = startOfDay(bounds.from); ; time += DAY_MS) {
    const key = dayKey(time);
    if (key === null) break;
    out.push(byKey.get(key) ?? { key, label: key, tokens: 0, cost: 0, calls: 0, sessions: 0 });
    if (endKey !== null && key >= endKey) break;
  }
  return out;
}

function modelsOf(calls, settings) {
  const byModel = new Map();
  for (const call of calls) {
    const id = modelIdOf(call.model);
    let cell = byModel.get(id);
    if (cell === undefined) {
      cell = { model: id, tokens: 0, cost: 0, calls: 0, input: 0, output: 0 };
      byModel.set(id, cell);
    }
    cell.tokens += nonNegative(call.tokens);
    cell.cost += nonNegative(call.cost);
    cell.calls += 1;
    cell.input += nonNegative(call.input);
    cell.output += nonNegative(call.output);
  }
  return [...byModel.values()].sort((left, right) => right.tokens - left.tokens).slice(0, 12);
}

/**
 * Budget is measured over the whole corpus, not the selected window: the period
 * spend is "everything charged since the period start".
 */
function budgetOf(settings, calls, nowMs) {
  const { amount, currency, period } = settings.budget;
  const periodStart = period === 'day' ? startOfDay(nowMs) : startOfMonth(nowMs);
  const periodEnd = period === 'day' ? periodStart + DAY_MS : nextMonthStart(nowMs);
  let spent = 0;
  for (const call of calls) {
    if (!inBounds(call.time, { from: periodStart, to: periodEnd })) continue;
    spent += nonNegative(call.cost);
  }
  const remaining = amount - spent;
  const usedRatio = amount > 0 ? spent / amount : 0;
  return {
    amount,
    currency,
    period,
    periodStart,
    periodEnd,
    spent,
    remaining,
    usedRatio: Number.isFinite(usedRatio) ? usedRatio : 0,
    overBudget: amount > 0 && spent > amount,
  };
}

function totalsOf(calls) {
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let tokens = 0;
  let cost = 0;
  const activeDays = new Set();
  const sessionIds = new Set();
  for (const call of calls) {
    input += nonNegative(call.input);
    output += nonNegative(call.output);
    cacheRead += nonNegative(call.cacheRead);
    cacheWrite += nonNegative(call.cacheWrite);
    tokens += nonNegative(call.tokens);
    cost += nonNegative(call.cost);
    const day = dayKey(call.time);
    if (day !== null) activeDays.add(day);
    sessionIds.add(call.sessionId);
  }
  return {
    tokens,
    input,
    output,
    cacheRead,
    cacheWrite,
    calls: calls.length,
    sessions: sessionIds.size,
    activeDays: activeDays.size,
    cost,
  };
}

/* ------------------------------------------------------------------------- *
 * Corpus fold with a revision cache
 * ------------------------------------------------------------------------- */

function createCorpusReader(ctx, settings) {
  const folded = new Map(); // sessionId -> { revision, calls, header, unreadable }
  let lastKey = null;

  async function revisionIndex() {
    const index = new Map();
    const persistence = ctx.get('sessionPersistence');
    if (persistence !== undefined && typeof persistence.list === 'function') {
      try {
        const snapshots = await persistence.list();
        if (Array.isArray(snapshots)) {
          for (const snapshot of snapshots) {
            const id = snapshot?.header?.id;
            if (typeof id !== 'string') continue;
            index.set(id, {
              revision: `${String(snapshot.revision ?? '')}:${finite(snapshot.eventCount)}`,
              header: snapshot.header,
            });
          }
        }
      } catch (error) {
        report(ctx, 'failed to list persisted sessions', error);
      }
    }
    return index;
  }

  function changeKey(id, revision, live) {
    return `${id}:${revision}${live ? ':live' : ''}`;
  }

  /** Fold the whole corpus, reusing per-session folds while their revision holds. */
  async function read() {
    const query = ctx.get('sessionQuery');
    if (query === null || query === undefined) {
      return { calls: [], sessions: [], warnings: ['会话查询服务不可用，无法读取会话日志'] };
    }
    const warnings = [];
    const index = await revisionIndex();

    let records;
    try {
      records = await query.listSessions();
    } catch (error) {
      report(ctx, 'failed to list sessions', error);
      return { calls: [], sessions: [], warnings: ['会话列表读取失败'] };
    }
    const ids = Array.isArray(records)
      ? records
          .map((record) => (typeof record?.header?.id === 'string' ? record.header.id : typeof record?.id === 'string' ? record.id : null))
          .filter((id) => id !== null)
      : [];

    const titles = new Map();
    if (ids.length > 0 && typeof query.readTitleSnapshots === 'function') {
      try {
        const answer = await query.readTitleSnapshots(ids);
        if (Array.isArray(answer)) {
          for (const row of answer) {
            const title = row?.value?.title?.title;
            const id = row?.sessionId;
            if (row?.status === 'fulfilled' && typeof id === 'string' && typeof title === 'string' && title !== '') {
              titles.set(id, clampText(title, 160));
            }
          }
        }
      } catch (error) {
        report(ctx, 'failed to read session titles', error);
      }
    }

    const key = ids
      .map((id) => changeKey(id, index.get(id)?.revision ?? 'persisted', false))
      .sort()
      .join('|');

    let readFailures = 0;
    let firstFailure = null;
    const sessions = await mapWithConcurrency(ids, READ_CONCURRENCY, async (id) => {
      const revision = index.get(id)?.revision ?? 'persisted';
      const held = folded.get(id);
      if (held !== undefined && held.revision === revision) {
        return { id, calls: held.calls, header: held.header, unreadable: held.unreadable };
      }
      let events;
      try {
        events = await readSessionEvents(query, id);
      } catch (error) {
        readFailures += 1;
        firstFailure = firstFailure ?? `${id}: ${messageOf(error)}`;
        events = null;
      }
      if (events === null) {
        readFailures += 1;
        const header = index.get(id)?.header ?? { id, createdAt: 0, cwd: '' };
        const entry = { id, calls: [], header, unreadable: true };
        folded.set(id, { revision, calls: [], header, unreadable: true });
        return entry;
      }
      const fold = foldSessionEvents(events);
      const calls = fold.calls.map((call) => ({ ...call, sessionId: id, cost: costOf(settings, call.model, call) }));
      const header = index.get(id)?.header ?? { id, createdAt: finite(events[0]?.time, 0), cwd: '' };
      const entry = { id, calls, header, unreadable: false };
      folded.set(id, { revision, calls, header, unreadable: false });
      return entry;
    });

    if (readFailures > 0) {
      warnings.push(`${readFailures} 个会话日志无法读取${firstFailure === null ? '' : `（首个：${clampText(firstFailure, 120)}）`}`);
    }

    // Drop folds for sessions that no longer exist so the cache cannot grow forever.
    const present = new Set(ids);
    for (const id of [...folded.keys()]) if (!present.has(id)) folded.delete(id);
    lastKey = key;

    const allCalls = [];
    for (const session of sessions) allCalls.push(...session.calls);
    allCalls.sort((left, right) => left.time - right.time);

    return {
      calls: allCalls,
      sessions: sessions.map((session) => ({
        id: session.id,
        title: titles.get(session.id) ?? '',
        cwd: clampText(session.header?.cwd ?? '', 200),
        createdAt: finite(session.header?.createdAt),
        calls: session.calls,
        unreadable: session.unreadable,
      })),
      warnings,
    };
  }

  return { read, changeKey };
}

/* ------------------------------------------------------------------------- *
 * Snapshot
 * ------------------------------------------------------------------------- */

function emptyData(settings, sampler, warnings) {
  return {
    totals: {
      tokens: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0,
      calls: 0, sessions: 0, activeDays: 0, cost: 0, currency: settings.budget.currency,
    },
    budget: budgetOf(settings, [], Date.now()),
    timeline: { granularity: 'day', points: [] },
    hours: new Array(24).fill(0),
    models: [],
    sessions: [],
    cpu: sampler.snapshot(),
    warnings,
  };
}

function createSnapshotService(ctx, settings, sampler) {
  const corpus = createCorpusReader(ctx, settings);
  let cached = null; // { at, window, value }
  let pending = null;

  function build(windowId, read) {
    const bounds = windowBounds(windowId, Date.now());
    const calledInWindow = read.calls.filter((call) => inBounds(call.time, bounds));
    const granularity = windowId === 'today' ? 'hour' : 'day';
    const totals = totalsOf(calledInWindow);
    totals.currency = settings.budget.currency;

    const sessions = [];
    for (const session of read.sessions) {
      if (session.unreadable) {
        sessions.push({
          id: session.id, title: session.title, cwd: session.cwd, createdAt: session.createdAt,
          updatedAt: session.createdAt, tokens: 0, input: 0, output: 0, cacheRead: 0,
          cacheWrite: 0, calls: 0, cost: 0, models: [], unreadable: true,
        });
        continue;
      }
      if (session.calls.length === 0) {
        // A session with no model call still exists: it is listed with zero
        // usage rather than dropped, so the table and the KPI agree.
        if (windowId !== 'all') continue;
        sessions.push({
          id: session.id, title: session.title, cwd: session.cwd, createdAt: session.createdAt,
          updatedAt: session.createdAt, tokens: 0, input: 0, output: 0, cacheRead: 0,
          cacheWrite: 0, calls: 0, cost: 0, models: [], unreadable: false,
        });
        continue;
      }
      const windowed = session.calls.filter((call) => inBounds(call.time, bounds));
      if (windowed.length === 0 && windowId !== 'all') continue;
      const stats = totalsOf(windowed);
      const models = new Map();
      let lastCallAt = session.createdAt;
      for (const call of session.calls) if (call.time > lastCallAt) lastCallAt = call.time;
      for (const call of windowed) {
        const id = modelIdOf(call.model);
        models.set(id, (models.get(id) ?? 0) + nonNegative(call.tokens));
      }
      sessions.push({
        id: session.id,
        title: session.title,
        cwd: session.cwd,
        createdAt: session.createdAt,
        updatedAt: lastCallAt,
        tokens: stats.tokens,
        input: stats.input,
        output: stats.output,
        cacheRead: stats.cacheRead,
        cacheWrite: stats.cacheWrite,
        calls: windowed.length,
        cost: stats.cost,
        models: [...models.entries()]
          .map(([model, tokens]) => ({ model, tokens }))
          .sort((left, right) => right.tokens - left.tokens)
          .slice(0, 4),
        unreadable: false,
      });
    }
    sessions.sort((left, right) => (right.cost !== left.cost ? right.cost - left.cost : right.tokens - left.tokens));

    // The KPI counts exactly the rows the table shows, so the two never disagree.
    totals.sessions = sessions.length;

    return {
      ok: true,
      generatedAt: Date.now(),
      computing: false,
      window: windowId,
      data: {
        totals,
        budget: budgetOf(settings, read.calls, Date.now()),
        timeline: { granularity, points: timelineOf(calledInWindow, bounds, granularity) },
        hours: foldHourBuckets(calledInWindow),
        models: modelsOf(calledInWindow, settings),
        sessions,
        cpu: sampler.snapshot(),
        warnings: read.warnings,
      },
    };
  }

  async function snapshot(windowId, force) {
    const wanted = WINDOWS.has(windowId) ? windowId : 'all';
    const now = Date.now();
    if (!force && cached !== null && cached.window === wanted && now - cached.at < SNAPSHOT_TTL_MS) {
      return cached.value;
    }
    if (pending !== null) return pending;
    pending = corpus.read().then(
      (read) => {
        const value = build(wanted, read);
        cached = { at: Date.now(), window: wanted, value };
        pending = null;
        return value;
      },
      (error) => {
        report(ctx, 'snapshot computation failed', error);
        pending = null;
        const value = {
          ok: false,
          error: clampText(messageOf(error), 200),
          window: wanted,
          data: emptyData(settings, sampler, [clampText(messageOf(error), 200)]),
        };
        return value;
      },
    );
    return pending;
  }

  return { snapshot };
}

/* ------------------------------------------------------------------------- *
 * HTTP
 * ------------------------------------------------------------------------- */

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.byteLength),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function isLoopbackPeer(address) {
  if (typeof address !== 'string') return false;
  const plain = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
  return plain === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(plain);
}

/**
 * Same-origin fence (`Connection.requestRejection` when the Host exposes it,
 * otherwise the loopback/Host/Origin check the shipped route pattern uses).
 */
function refusalOf(ctx, req) {
  const connection = ctx.get('connection');
  if (typeof connection?.requestRejection === 'function') {
    const refused = connection.requestRejection(req);
    if (refused !== undefined) return refused;
  }
  if (!isLoopbackPeer(req.socket?.remoteAddress)) return 403;
  const host = req.headers.host;
  if (host !== undefined) {
    if (!URL.canParse(`http://${host}`)) return 403;
    const name = new URL(`http://${host}`).hostname;
    if (name !== 'localhost' && name !== '[::1]' && !/^127\.\d+\.\d+\.\d+$/.test(name)) return 403;
  }
  const site = req.headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return 403;
  const origin = req.headers.origin;
  if (origin === undefined) return undefined;
  if (!URL.canParse(origin)) return 403;
  return new URL(origin).host === host ? undefined : 403;
}

function methodRefused(req, res, methods) {
  if (req.method !== undefined && methods.includes(req.method)) return false;
  res.writeHead(405, { allow: methods.join(', ') });
  res.end();
  return true;
}

function fenceRefused(ctx, req, res) {
  const refused = refusalOf(ctx, req);
  if (refused === undefined) return false;
  sendJson(res, refused, { ok: false, error: refused === 401 ? 'unauthorized' : 'forbidden' });
  return true;
}

/* ------------------------------------------------------------------------- *
 * Plugin
 * ------------------------------------------------------------------------- */

/**
 * `ctx.interval` is the timer service's mixin, so `timer` must be declared:
 * reaching for it without inject throws, exactly as the install diagnostic
 * reported ("cannot get property \"timer\" without inject"). `webServer`,
 * `sessionQuery` and `sessionPersistence` stay optional reads through
 * `ctx.get`, so the plugin degrades instead of failing to mount in profiles
 * that lack them.
 */
export const inject = ['timer'];

export function apply(ctx, config = {}) {
  const settings = resolveConfig(config);
  const sampler = createCpuSampler({ intervalMs: SAMPLE_INTERVAL_MS });
  sampler.start();
  const snapshots = createSnapshotService(ctx, settings, sampler);

  ctx.effect(() => {
    const disposers = [];
    const stopSampling = ctx.interval(() => {
      try {
        sampler.sample();
      } catch (error) {
        report(ctx, 'cpu sampling failed', error);
      }
    }, SAMPLE_INTERVAL_MS);
    if (typeof stopSampling === 'function') disposers.push(stopSampling);

    const server = ctx.get('webServer');
    if (server === undefined || server === null || typeof server.register !== 'function') {
      report(ctx, 'no web server: statistics routes were not registered');
      return () => {
        if (typeof stopSampling === 'function') stopSampling();
        sampler.stop();
      };
    }

    try {
      const dispose = server.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: (req, res) => {
          if (methodRefused(req, res, ['GET', 'HEAD'])) return;
          if (fenceRefused(ctx, req, res)) return;
          const url = new URL(req.url ?? '/', 'http://local');
          if (url.pathname === WHOAMI_PATH) {
            sendJson(res, 200, { ok: true, package: PACKAGE_NAME });
            return;
          }
          if (url.pathname !== SNAPSHOT_PATH) {
            sendJson(res, 404, { ok: false, error: 'not found' });
            return;
          }
          const windowId = url.searchParams.get('window') ?? 'all';
          const force = url.searchParams.get('refresh') === '1';
          void snapshots.snapshot(windowId, force).then(
            (value) => sendJson(res, 200, value),
            (error) => sendJson(res, 500, { ok: false, error: clampText(messageOf(error), 200) }),
          );
        },
      });
      if (typeof dispose === 'function') disposers.push(dispose);
    } catch (error) {
      report(ctx, 'snapshot route unavailable', error);
    }

    return () => {
      if (typeof stopSampling === 'function') stopSampling();
      sampler.stop();
      for (const dispose of disposers) {
        try {
          dispose();
        } catch {
          // route disposal is best effort
        }
      }
    };
  }, `${PACKAGE_NAME}: statistics`);
}
