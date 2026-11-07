// dsh-session-stats-panel — stats.js
// Pure folds over session events. No I/O, no Cordis, no npm deps.
// The counting semantics mirror dsh-claude-style's proven
// `lib/host/usage-fold.js` (which is what this install's logs are billed on):
//   * only `assistant/message` and `assistant/attempt` count;
//   * usage is `event.data.usage` for a message, else the last
//     `{type:'chunk',chunk:{type:'usage',usage}}` in `data.stream`;
//   * the counted quantity is inputTokens+outputTokens+cacheReadTokens+
//     cacheWriteTokens (input is uncached input on this install, so
//     `usage.totalTokens` is never used);
//   * a later event for the same `data.turn`+`data.step` REPLACES the previous
//     one, and identical replacement buckets are skipped;
//   * `llm/retry-started` forgets the previous record when turn+step match, so
//     the retried `assistant/attempt` is not double counted.

const UNKNOWN_MODEL = 'unknown';

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function bucketsFrom(usage) {
  return {
    input: count(usage?.inputTokens),
    output: count(usage?.outputTokens),
    cacheRead: count(usage?.cacheReadTokens),
    cacheWrite: count(usage?.cacheWriteTokens),
  };
}

function bucketsEqual(left, right) {
  return (
    left.input === right.input &&
    left.output === right.output &&
    left.cacheRead === right.cacheRead &&
    left.cacheWrite === right.cacheWrite
  );
}

/** Tokens of one call: always the four-bucket sum, never `usage.totalTokens`. */
function tokenCountOf(record) {
  return (
    count(record?.input) + count(record?.output) + count(record?.cacheRead) + count(record?.cacheWrite)
  );
}

/**
 * Usage record of one event, or undefined when the event carries none.
 * Mirrors usage-fold.js: `data.usage` (even null) wins for a message, otherwise
 * the last usage chunk in `data.stream`.
 */
function usageOf(event) {
  const data = event?.data;
  if (data === null || data === undefined || typeof data !== 'object') return undefined;
  const type = event?.type;
  if (type === 'assistant/message' && data.usage !== undefined) return data.usage;
  if (type !== 'assistant/message' && type !== 'assistant/attempt') return undefined;
  const stream = data.stream;
  if (!Array.isArray(stream)) return undefined;
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record = stream[index];
    if (record === null || typeof record !== 'object') continue;
    if (record.type !== 'chunk') continue;
    const chunk = record.chunk;
    if (chunk === null || typeof chunk !== 'object') continue;
    if (chunk.type !== 'usage') continue;
    return chunk.usage;
  }
  return undefined;
}

/** `data.message.source.model` when it is a non-empty string, else null. */
function modelOf(event) {
  const model = event?.data?.message?.source?.model;
  return typeof model === 'string' && model !== '' ? model : null;
}

function emptyTotals() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, tokens: 0 };
}

function emptyModelCell(model) {
  return { model, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, tokens: 0, calls: 0 };
}

/**
 * Fold raw session events into counted calls, totals and per-model buckets.
 *
 * @param {ReadonlyArray<unknown>} events
 * @returns {{
 *   calls: Array<{time:number,input:number,output:number,cacheRead:number,cacheWrite:number,tokens:number,model:string|null}>,
 *   totals: {input:number,output:number,cacheRead:number,cacheWrite:number,tokens:number},
 *   byModel: Array<{model:string,input:number,output:number,cacheRead:number,cacheWrite:number,tokens:number,calls:number}>,
 *   firstCallAt: number|null,
 *   lastCallAt: number|null
 * }}
 */
export function foldSessionEvents(events) {
  const calls = [];
  const totals = emptyTotals();
  const models = new Map();
  let last = null; // { turn, step, buckets, call }

  function bumpModel(model, buckets, sign) {
    const key = model ?? UNKNOWN_MODEL;
    let cell = models.get(key);
    if (cell === undefined) {
      if (sign < 0) return;
      cell = emptyModelCell(key);
      models.set(key, cell);
    }
    cell.input += sign * buckets.input;
    cell.output += sign * buckets.output;
    cell.cacheRead += sign * buckets.cacheRead;
    cell.cacheWrite += sign * buckets.cacheWrite;
    cell.tokens = cell.input + cell.output + cell.cacheRead + cell.cacheWrite;
    cell.calls += sign;
    if (
      sign < 0 &&
      cell.calls === 0 &&
      cell.input === 0 &&
      cell.output === 0 &&
      cell.cacheRead === 0 &&
      cell.cacheWrite === 0
    ) {
      models.delete(key);
    }
  }

  function pushRecord(time, buckets, model) {
    const call = {
      time,
      input: buckets.input,
      output: buckets.output,
      cacheRead: buckets.cacheRead,
      cacheWrite: buckets.cacheWrite,
      tokens: buckets.input + buckets.output + buckets.cacheRead + buckets.cacheWrite,
      model,
    };
    calls.push(call);
    totals.input += buckets.input;
    totals.output += buckets.output;
    totals.cacheRead += buckets.cacheRead;
    totals.cacheWrite += buckets.cacheWrite;
    totals.tokens += call.tokens;
    bumpModel(model, buckets, 1);
    return { call, index: calls.length - 1 };
  }

  function replaceRecord(previous, time, buckets, model) {
    const index = previous.call === undefined ? -1 : calls.lastIndexOf(previous.call);
    const call = {
      time,
      input: buckets.input,
      output: buckets.output,
      cacheRead: buckets.cacheRead,
      cacheWrite: buckets.cacheWrite,
      tokens: buckets.input + buckets.output + buckets.cacheRead + buckets.cacheWrite,
      model,
    };
    if (index >= 0) {
      calls[index] = call;
    } else {
      calls.push(call);
    }
    totals.input += buckets.input - previous.buckets.input;
    totals.output += buckets.output - previous.buckets.output;
    totals.cacheRead += buckets.cacheRead - previous.buckets.cacheRead;
    totals.cacheWrite += buckets.cacheWrite - previous.buckets.cacheWrite;
    totals.tokens += call.tokens - (previous.call?.tokens ?? tokenCountOf(previous.buckets));
    bumpModel(previous.call?.model ?? previous.model ?? null, previous.buckets, -1);
    bumpModel(model, buckets, 1);
    return { call, index };
  }

  const list = Array.isArray(events) ? events : [];

  for (const event of list) {
    const type = event?.type;

    if (type === 'llm/retry-started') {
      const data = event?.data;
      if (last !== null && last.turn === data?.turn && last.step === data?.step) last = null;
      continue;
    }

    if (type !== 'assistant/message' && type !== 'assistant/attempt') continue;

    const usage = usageOf(event);
    if (usage === undefined) continue;

    const time = event?.time;
    if (typeof time !== 'number' || !Number.isFinite(time)) continue;
    if (dayKey(time) === null) continue;

    const buckets = bucketsFrom(usage);
    const model = modelOf(event);
    const turn = event?.data?.turn;
    const step = event?.data?.step;

    const previous = last;
    const replacing = previous !== null && previous.turn === turn && previous.step === step;
    if (replacing && bucketsEqual(previous.buckets, buckets)) continue;

    const record = replacing
      ? replaceRecord(previous, time, buckets, model)
      : pushRecord(time, buckets, model);
    last = { turn, step, buckets, model, call: record.call };
  }

  let firstCallAt = null;
  let lastCallAt = null;
  for (const call of calls) {
    if (firstCallAt === null || call.time < firstCallAt) firstCallAt = call.time;
    if (lastCallAt === null || call.time > lastCallAt) lastCallAt = call.time;
  }

  const byModel = Array.from(models.values(), (cell) => ({
    model: cell.model,
    input: cell.input,
    output: cell.output,
    cacheRead: cell.cacheRead,
    cacheWrite: cell.cacheWrite,
    tokens: cell.tokens,
    calls: cell.calls,
  }));
  byModel.sort((left, right) => {
    if (right.tokens !== left.tokens) return right.tokens - left.tokens;
    if (right.calls !== left.calls) return right.calls - left.calls;
    return left.model < right.model ? -1 : left.model > right.model ? 1 : 0;
  });

  return { calls, totals, byModel, firstCallAt, lastCallAt };
}

/** Local calendar day key 'YYYY-MM-DD', or null when the time is not valid epoch ms. */
export function dayKey(timeMs) {
  if (timeMs === null || timeMs === undefined || typeof timeMs === 'boolean') return null;
  const ms = Number(timeMs);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return null;
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local hour of day 0..23, or null when the time is not valid epoch ms. */
export function hourOf(timeMs) {
  if (timeMs === null || timeMs === undefined || typeof timeMs === 'boolean') return null;
  const ms = Number(timeMs);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return null;
  return date.getHours();
}

/** Tokens per local hour of day across the given calls, always 24 entries. */
export function foldHourBuckets(calls) {
  const hours = new Array(24).fill(0);
  for (const call of Array.isArray(calls) ? calls : []) {
    const hour = hourOf(call?.time);
    if (hour === null || hour < 0 || hour > 23) continue;
    hours[hour] += tokenCountOf(call);
  }
  return hours;
}

function flattenCalls(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const entry of input) {
    if (Array.isArray(entry)) out.push(...entry);
    else if (entry !== null && typeof entry === 'object' && Array.isArray(entry.calls)) out.push(...entry.calls);
    else out.push(entry);
  }
  return out;
}

/**
 * Merge one array of calls (or one array of calls per session) into a timeline.
 * `'day'` keys are 'YYYY-MM-DD' ascending; `'hour'` keys are 0..23 with all 24
 * entries present.
 *
 * @param {ReadonlyArray<unknown>} sessionsCalls
 * @param {'day'|'hour'} granularity
 * @returns {Array<{key:string|number,tokens:number,calls:number}>}
 */
export function mergeTimeline(sessionsCalls, granularity) {
  const calls = flattenCalls(sessionsCalls);
  if (granularity === 'hour') {
    const points = Array.from({ length: 24 }, (_, hour) => ({ key: hour, tokens: 0, calls: 0 }));
    for (const call of calls) {
      const hour = hourOf(call?.time);
      if (hour === null || hour < 0 || hour > 23) continue;
      points[hour].tokens += tokenCountOf(call);
      points[hour].calls += 1;
    }
    return points;
  }
  const days = new Map();
  for (const call of calls) {
    const key = dayKey(call?.time);
    if (key === null) continue;
    let point = days.get(key);
    if (point === undefined) {
      point = { key, tokens: 0, calls: 0 };
      days.set(key, point);
    }
    point.tokens += tokenCountOf(call);
    point.calls += 1;
  }
  return Array.from(days.values()).sort((left, right) =>
    left.key < right.key ? -1 : left.key > right.key ? 1 : 0,
  );
}
