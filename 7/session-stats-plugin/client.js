window.__ModuleLoader__.load({
  id: 'dsh-session-stats-panel',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /* ------------------------------------------------------------------ *
     * Constants (declarations only; the factory performs no side effects)
     * ------------------------------------------------------------------ */

    const ENDPOINT = '/session-stats/api/snapshot';
    const REFRESH_INTERVAL_MS = 20000;
    const SESSION_ROW_LIMIT = 200;
    const PANEL_LABEL = '用量统计';

    const WINDOWS = [
      { id: 'all', label: '全部' },
      { id: '30d', label: '近30天' },
      { id: '7d', label: '近7天' },
      { id: 'today', label: '今天' },
    ];

    /* ------------------------------------------------------------------ *
     * Module-scope state (no work happens until `apply` runs)
     * ------------------------------------------------------------------ */

    let stylesInjected = false;

    /* ------------------------------------------------------------------ *
     * Defensive coercion helpers — every field of the snapshot is optional
     * ------------------------------------------------------------------ */

    function num(value, fallback) {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
      return Number.isFinite(fallback) ? fallback : 0;
    }

    function pickNum(value, fallback) {
      if (value === undefined || value === null) return num(fallback);
      return num(value, fallback);
    }

    function obj(value) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value;
      return {};
    }

    function arr(value) {
      return Array.isArray(value) ? value : [];
    }

    function str(value) {
      return typeof value === 'string' ? value : '';
    }

    function clamp(value, min, max) {
      const n = num(value);
      if (n < min) return min;
      if (n > max) return max;
      return n;
    }

    function messageOf(error) {
      if (error && typeof error.message === 'string' && error.message !== '') return error.message;
      return str(error) || '请求失败';
    }

    function pad2(value) {
      return ('0' + String(num(value))).slice(-2);
    }

    function trimFraction(text) {
      if (typeof text !== 'string' || text.indexOf('.') === -1) return text;
      const trimmed = text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
      return trimmed === '' ? '0' : trimmed;
    }

    function formatInt(value) {
      const rounded = Math.round(num(value));
      const sign = rounded < 0 ? '-' : '';
      const digits = String(Math.abs(rounded));
      return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function formatCompact(value) {
      const n = num(value);
      const abs = Math.abs(n);
      if (abs >= 1e8) return trimFraction((n / 1e8).toFixed(2)) + ' 亿';
      if (abs >= 1e4) return trimFraction((n / 1e4).toFixed(1)) + ' 万';
      return formatInt(n);
    }

    function formatPercent(value, digits) {
      const n = num(value);
      const places = Number.isFinite(digits) ? digits : 1;
      return trimFraction(n.toFixed(places)) + '%';
    }

    function currencySymbol(currency) {
      const code = str(currency).trim().toUpperCase();
      if (code === 'CNY' || code === 'RMB') return '¥';
      if (code === 'USD') return '$';
      if (code === 'EUR') return '€';
      if (code === 'JPY') return '¥';
      if (code === '') return '¥';
      return code + ' ';
    }

    function formatCost(value, currency) {
      const n = num(value);
      const sign = n < 0 ? '-' : '';
      const abs = Math.abs(n);
      let digits = 2;
      if (abs < 0.01) digits = 5;
      else if (abs < 1) digits = 3;
      return sign + currencySymbol(currency) + trimFraction(abs.toFixed(digits));
    }

    function formatBytes(value) {
      let size = Math.abs(num(value));
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let unit = 0;
      while (size >= 1024 && unit < units.length - 1) {
        size = size / 1024;
        unit += 1;
      }
      const digits = unit === 0 ? 0 : size >= 100 ? 0 : 1;
      return trimFraction(size.toFixed(digits)) + ' ' + units[unit];
    }

    function formatDuration(seconds) {
      const total = Math.max(0, Math.round(num(seconds)));
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const secs = total % 60;
      if (hours > 0) return hours + ' 小时 ' + minutes + ' 分';
      if (minutes > 0) return minutes + ' 分 ' + secs + ' 秒';
      return secs + ' 秒';
    }

    function formatClock(value) {
      const ms = num(value);
      if (ms <= 0) return '—';
      const date = new Date(ms);
      const timestamp = date.getTime();
      if (!Number.isFinite(timestamp)) return '—';
      return pad2(date.getHours()) + ':' + pad2(date.getMinutes()) + ':' + pad2(date.getSeconds());
    }

    function shortId(id) {
      const text = str(id);
      if (text === '') return '未命名会话';
      return text.length > 12 ? text.slice(0, 8) : text;
    }

    function stampedAt(payload) {
      const generated = pickNum(payload && payload.generatedAt, 0);
      return generated > 0 ? generated : Date.now();
    }

    function sessionTitle(row) {
      const title = str(row.title).trim();
      if (title !== '') return title;
      return shortId(row.id);
    }

    function shortDay(key) {
      const text = str(key);
      if (text.length >= 10) return text.slice(5);
      return text;
    }

    function windowLabelOf(id) {
      for (const entry of WINDOWS) {
        if (entry.id === id) return entry.label;
      }
      return '全部';
    }

    /* ------------------------------------------------------------------ *
     * One stylesheet string — colors come only from theme tokens
     * ------------------------------------------------------------------ */

    const PAGE_CSS = `
.ssp-page {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.45;
}
.ssp-header,
.ssp-body {
  box-sizing: border-box;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
}
.ssp-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 20px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
}
.ssp-heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  margin-right: auto;
}
.ssp-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.ssp-subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ssp-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.ssp-seg {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
}
.ssp-seg-btn {
  appearance: none;
  margin: 0;
  padding: 7px 11px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.ssp-seg-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2));
  color: var(--dsw-alias-label-primary);
}
.ssp-seg-btn[aria-checked="true"] {
  background: var(--dsw-alias-bg-layer-1);
  border-color: var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}
.ssp-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.ssp-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2));
}
.ssp-btn[disabled] {
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  cursor: default;
}
.ssp-updated {
  font-size: 12px;
  color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary));
  white-space: nowrap;
}
.ssp-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 24px 32px;
}
.ssp-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.ssp-card {
  box-sizing: border-box;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
}
.ssp-kpi {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ssp-kpi-label {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}
.ssp-kpi-value {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.ssp-kpi-value[data-tone="error"] {
  color: var(--dsw-alias-state-error-primary);
}
.ssp-kpi-sub {
  font-size: 11px;
  line-height: 1.5;
  color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary));
  overflow-wrap: anywhere;
}
.ssp-budget {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ssp-budget-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary));
}
.ssp-budget-over {
  font-size: 11px;
  color: var(--dsw-alias-state-error-primary);
}
.ssp-progress {
  height: 6px;
  border-radius: 3px;
  background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2));
  overflow: hidden;
}
.ssp-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--dsw-alias-brand-primary);
}
.ssp-progress-fill[data-over="true"] {
  background: var(--dsw-alias-state-error-primary);
}
.ssp-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ssp-card-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}
.ssp-card-hint {
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary));
  text-align: right;
}
.ssp-timeline {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 150px;
  padding-top: 6px;
}
.ssp-timeline-slot {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  flex: 1 1 0;
  min-width: 2px;
  height: 100%;
}
.ssp-timeline-bar {
  width: 100%;
  min-height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--dsw-alias-brand-primary);
}
.ssp-axis {
  display: flex;
  gap: 3px;
  margin-top: 6px;
}
.ssp-axis-cell {
  flex: 1 1 0;
  min-width: 2px;
  font-size: 10px;
  color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary));
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
}
.ssp-timeline-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 11px;
  color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary));
}
.ssp-table-wrap {
  overflow-x: auto;
}
.ssp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.ssp-table th,
.ssp-table td {
  padding: 7px 10px;
  text-align: right;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  white-space: nowrap;
}
.ssp-table th:first-child,
.ssp-table td:first-child {
  text-align: left;
}
.ssp-table thead th {
  font-size: 11px;
  font-weight: 500;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}
.ssp-table tbody td {
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
.ssp-table tbody tr:hover td {
  background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2));
}
.ssp-table tbody tr:last-child td {
  border-bottom: 0;
}
.ssp-sort {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 11px;
  font-weight: inherit;
  cursor: pointer;
}
.ssp-sort:hover {
  color: var(--dsw-alias-label-secondary);
}
.ssp-sort[data-active="true"] {
  color: var(--dsw-alias-link, var(--dsw-alias-brand-primary));
}
.ssp-session-name {
  display: block;
  max-width: 340px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--dsw-alias-label-primary);
}
.ssp-session-meta {
  display: block;
  max-width: 340px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10.5px;
  color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary));
}
.ssp-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
  max-width: 240px;
  margin-left: auto;
}
.ssp-chip {
  display: inline-block;
  max-width: 150px;
  padding: 1px 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ssp-chip[data-warn="true"] {
  border-color: var(--dsw-alias-state-warn-primary);
  color: var(--dsw-alias-state-warn-label, var(--dsw-alias-state-warn-primary));
}
.ssp-table-foot {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
.ssp-models {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ssp-model {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.ssp-model-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}
.ssp-model-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-primary);
}
.ssp-model-value {
  white-space: nowrap;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  font-variant-numeric: tabular-nums;
}
.ssp-share {
  height: 6px;
  border-radius: 3px;
  background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2));
  overflow: hidden;
}
.ssp-share-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--dsw-alias-brand-primary);
}
.ssp-cpu-top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 22px;
}
.ssp-cpu-stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ssp-cpu-num {
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.ssp-cpu-label {
  font-size: 11px;
  color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary));
}
.ssp-cores {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18px, 1fr));
  gap: 3px;
  margin-top: 12px;
}
.ssp-core {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
}
.ssp-core-track {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 42px;
  border-radius: 3px;
  background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2));
  overflow: hidden;
}
.ssp-core-fill {
  width: 100%;
  min-height: 1px;
  border-radius: 3px 3px 0 0;
  background: var(--dsw-alias-brand-primary);
}
.ssp-core-fill[data-tone="warn"] {
  background: var(--dsw-alias-state-warn-primary);
}
.ssp-core-fill[data-tone="error"] {
  background: var(--dsw-alias-state-error-primary);
}
.ssp-core-label {
  font-size: 9px;
  color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary));
  font-variant-numeric: tabular-nums;
}
.ssp-cpu-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.ssp-cpu-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}
.ssp-cpu-row b {
  font-weight: 500;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
.ssp-lower {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.ssp-lower-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.ssp-state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px;
  border: 1px dashed var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font-size: 12.5px;
  text-align: center;
}
.ssp-state[data-tone="error"] {
  border-color: var(--dsw-alias-state-error-primary);
  color: var(--dsw-alias-state-error-primary);
}
.ssp-state[data-tone="muted"] {
  color: var(--dsw-alias-label-caption, var(--dsw-alias-label-secondary));
}
.ssp-skeleton {
  height: 104px;
  border-radius: 12px;
  background: var(--dsw-alias-bg-skeleton, var(--dsw-alias-bg-layer-2));
}
.ssp-skeletons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ssp-warnings {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--dsw-alias-state-warn-label, var(--dsw-alias-state-warn-primary));
}
.ssp-computing {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary));
}
@media (max-width: 920px) {
  .ssp-lower {
    grid-template-columns: minmax(0, 1fr);
  }
  .ssp-header,
  .ssp-body {
    padding-left: 16px;
    padding-right: 16px;
  }
}
`;

    /* ------------------------------------------------------------------ *
     * Sidebar glyph: 16 px bar-chart in currentColor
     * ------------------------------------------------------------------ */

    function PanelIcon(props) {
      const requested = num(props && props.size, 16);
      const size = requested > 0 ? Math.min(requested, 24) : 16;
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block', pointerEvents: 'none' },
        },
        h('rect', { x: 1.5, y: 9, width: 3, height: 5.5, rx: 1, fill: 'currentColor' }),
        h('rect', { x: 6.5, y: 5.5, width: 3, height: 9, rx: 1, fill: 'currentColor' }),
        h('rect', { x: 11.5, y: 2, width: 3, height: 12.5, rx: 1, fill: 'currentColor' })
      );
    }

    /* ------------------------------------------------------------------ *
     * Network
     * ------------------------------------------------------------------ */

    function describeHttpError(status) {
      if (status === 403) return '统计接口拒绝访问（403）';
      if (status === 404) return '统计接口不存在（404），请确认插件已加载';
      if (status === 405) return '统计接口不接受该请求（405）';
      if (status >= 500) return '统计接口内部错误（' + status + '）';
      return '统计接口返回 HTTP ' + status;
    }

    function fetchSnapshot(windowId, signal) {
      if (typeof fetch !== 'function') return Promise.reject(new Error('当前环境不支持 fetch'));
      const url = ENDPOINT + '?window=' + encodeURIComponent(windowId);
      return fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
        signal: signal,
      }).then(function (response) {
        if (!response || response.ok !== true) {
          throw new Error(describeHttpError(response ? response.status : 0));
        }
        return response.json();
      }).then(function (payload) {
        if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error('统计接口返回的数据格式不正确');
        }
        if (payload.ok === false) {
          throw new Error(str(payload.error) || str(payload.message) || '统计接口返回失败');
        }
        return payload;
      });
    }

    /* ------------------------------------------------------------------ *
     * Presentation helpers
     * ------------------------------------------------------------------ */

    function kpiCard(key, label, value, foot, extra) {
      return h(
        'div',
        { className: 'ssp-card ssp-kpi', key: key },
        h('div', { className: 'ssp-kpi-label' }, label),
        h('div', { className: 'ssp-kpi-value', 'data-tone': extra && extra.tone ? extra.tone : undefined }, value),
        extra && extra.content ? extra.content : null,
        foot ? h('div', { className: 'ssp-kpi-sub' }, foot) : null
      );
    }

    function sectionCard(key, title, hint, children) {
      return h(
        'section',
        { className: 'ssp-card ssp-section', key: key },
        h(
          'div',
          { className: 'ssp-card-title' },
          title,
          hint ? h('span', { className: 'ssp-card-hint' }, hint) : null
        ),
        children
      );
    }

    function stateLine(key, text, tone, action) {
      return h(
        'div',
        { className: 'ssp-state', 'data-tone': tone || undefined, key: key },
        h('span', null, text),
        action || null
      );
    }

    function retryButton(key, label, onRetry) {
      return h(
        'button',
        { className: 'ssp-btn', type: 'button', key: key, onClick: onRetry },
        label
      );
    }

    /* ------------------------------------------------------------------ *
     * Timeline section
     * ------------------------------------------------------------------ */

    function timelineBars(windowId, data) {
      const timeline = obj(data.timeline);
      const points = arr(timeline.points);
      const hours = arr(data.hours);
      if (windowId === 'today') {
        return hours.map(function (value, index) {
          const tokens = Math.max(0, num(value));
          const label = pad2(index) + ' 时';
          return {
            key: label,
            label: String(index),
            tokens: tokens,
            tooltip: label + ' · ' + formatCompact(tokens) + ' token',
          };
        });
      }
      return points.map(function (point, index) {
        const record = obj(point);
        const key = str(record.key) || '#' + String(index);
        const tokens = Math.max(0, num(record.tokens));
        const calls = Math.max(0, num(record.calls));
        return {
          key: key,
          label: shortDay(key),
          tokens: tokens,
          tooltip: shortDay(key) + ' · ' + formatCompact(tokens) + ' token · ' + formatInt(calls) + ' 次调用',
        };
      });
    }

    function TimelineSection(props) {
      const windowId = props.windowId;
      const data = props.data;
      const bars = timelineBars(windowId, data);
      const totals = obj(data.totals);
      let maxTokens = 0;
      let sumTokens = 0;
      let peakIndex = -1;
      bars.forEach(function (bar, index) {
        sumTokens += bar.tokens;
        if (bar.tokens > maxTokens) {
          maxTokens = bar.tokens;
          peakIndex = index;
        }
      });
      const fallbackTotal = Math.max(0, num(totals.tokens));
      const totalTokens = sumTokens > 0 ? sumTokens : fallbackTotal;
      const granularity = windowId === 'today' ? '按小时' : '按天';
      const hint = granularity + ' · 共 ' + formatCompact(totalTokens) + ' token';

      if (bars.length === 0) {
        return sectionCard('timeline', 'Token 时间线', granularity, stateLine('timeline-empty', '当前窗口内没有时间线数据。', 'muted'));
      }

      const step = Math.max(1, Math.ceil(bars.length / 10));
      const axisCells = bars.map(function (bar, index) {
        return h(
          'span',
          { className: 'ssp-axis-cell', key: 'axis-' + bar.key },
          index % step === 0 ? bar.label : ''
        );
      });
      const peak = peakIndex >= 0 && bars[peakIndex] ? bars[peakIndex] : null;
      const foot = peak && peak.tokens > 0
        ? [
            h('span', { key: 'peak' }, '峰值 ' + formatCompact(peak.tokens) + ' token（' + (windowId === 'today' ? peak.key : peak.label) + '）'),
            h('span', { key: 'calls' }, '共 ' + formatInt(num(totals.calls)) + ' 次模型调用'),
          ]
        : [h('span', { key: 'none' }, '暂无 token 消耗记录。')];

      return sectionCard(
        'timeline',
        'Token 时间线',
        hint,
        h(
          'div',
          null,
          h(
            'div',
            { className: 'ssp-timeline' },
            bars.map(function (bar) {
              const ratio = maxTokens > 0 ? bar.tokens / maxTokens : 0;
              const height = Math.round(ratio * 100);
              const opacity = ratio === 0 ? 0.12 : num(0.3 + ratio * 0.7, 0.3);
              return h(
                'div',
                { className: 'ssp-timeline-slot', key: 'bar-' + bar.key, title: bar.tooltip },
                h('div', {
                  className: 'ssp-timeline-bar',
                  style: { height: height + '%', opacity: opacity },
                })
              );
            })
          ),
          h('div', { className: 'ssp-axis' }, axisCells),
          h('div', { className: 'ssp-timeline-foot' }, foot)
        )
      );
    }

    /* ------------------------------------------------------------------ *
     * Sessions table
     * ------------------------------------------------------------------ */

    function SessionsSection(props) {
      const sessions = props.sessions;
      const sortDir = props.sortDir;
      const expanded = props.expanded;
      const onSort = props.onSort;
      const onToggleExpanded = props.onToggleExpanded;
      const sortHint = sortDir === 'asc' ? '按 token 升序' : sortDir === 'desc' ? '按 token 降序' : '按成本排序';
      const hint = '共 ' + formatInt(sessions.length) + ' 个会话 · ' + sortHint;

      if (sessions.length === 0) {
        return sectionCard('sessions', '会话用量', '暂无会话', stateLine('sessions-empty', '当前窗口内还没有会话产生模型调用。发起一次对话后再回来看看。', 'muted'));
      }

      const sorted = sessions.slice();
      if (sortDir === 'asc' || sortDir === 'desc') {
        sorted.sort(function (left, right) {
          const a = num(left && left.tokens);
          const b = num(right && right.tokens);
          if (a === b) return 0;
          return sortDir === 'asc' ? a - b : b - a;
        });
      }
      const visible = expanded ? sorted : sorted.slice(0, SESSION_ROW_LIMIT);
      const sortGlyph = sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : '⇅';

      const head = h(
        'thead',
        null,
        h(
          'tr',
          null,
          h('th', { scope: 'col' }, '会话'),
          h(
            'th',
            { scope: 'col' },
            h(
              'button',
              {
                className: 'ssp-sort',
                type: 'button',
                'data-active': sortDir === null ? 'false' : 'true',
                onClick: onSort,
                title: '点击切换 token 排序',
              },
              'Token',
              h('span', { 'aria-hidden': 'true' }, sortGlyph)
            )
          ),
          h('th', { scope: 'col' }, '成本'),
          h('th', { scope: 'col' }, '调用'),
          h('th', { scope: 'col' }, '模型')
        )
      );

      const rows = visible.map(function (row, index) {
        const record = obj(row);
        const key = str(record.id) || 'row-' + String(index);
        const title = sessionTitle(record);
        const cwd = str(record.cwd);
        const models = arr(record.models)
          .map(function (entry) {
            return str(obj(entry).model);
          })
          .filter(function (name) {
            return name !== '';
          });
        const chips = models.slice(0, 3).map(function (name, chipIndex) {
          return h('span', { className: 'ssp-chip', key: key + '-m' + String(chipIndex), title: name }, name);
        });
        if (models.length > 3) {
          chips.push(h('span', { className: 'ssp-chip', key: key + '-more' }, '+' + String(models.length - 3)));
        }
        if (record.unreadable === true) {
          chips.push(h('span', { className: 'ssp-chip', key: key + '-bad', 'data-warn': 'true' }, '无法读取'));
        }
        return h(
          'tr',
          { key: key },
          h(
            'td',
            null,
            h('span', { className: 'ssp-session-name', title: title }, title),
            h('span', { className: 'ssp-session-meta', title: cwd !== '' ? cwd : shortId(record.id) }, cwd !== '' ? cwd : shortId(record.id))
          ),
          h('td', { title: formatInt(record.tokens) + ' token' }, formatCompact(record.tokens)),
          h('td', null, formatCost(record.cost, props.currency)),
          h('td', null, formatInt(record.calls)),
          h(
            'td',
            null,
            chips.length > 0 ? h('div', { className: 'ssp-chips' }, chips) : h('span', { className: 'ssp-session-meta' }, '—')
          )
        );
      });

      const footer = sessions.length > SESSION_ROW_LIMIT
        ? h(
            'div',
            { className: 'ssp-table-foot' },
            retryButton('toggle-rows', expanded ? '收起（仅显示前 ' + String(SESSION_ROW_LIMIT) + ' 条）' : '显示全部（' + String(sessions.length) + ' 条）', onToggleExpanded)
          )
        : null;

      return sectionCard(
        'sessions',
        '会话用量',
        hint,
        h(
          'div',
          null,
          h(
            'div',
            { className: 'ssp-table-wrap' },
            h('table', { className: 'ssp-table' }, head, h('tbody', null, rows))
          ),
          footer
        )
      );
    }

    /* ------------------------------------------------------------------ *
     * Model distribution
     * ------------------------------------------------------------------ */

    function ModelsSection(props) {
      const models = props.models;
      const totals = obj(props.data.totals);
      const currency = str(totals.currency) || 'CNY';
      let sumTokens = 0;
      models.forEach(function (entry) {
        sumTokens += Math.max(0, num(obj(entry).tokens));
      });
      const base = sumTokens > 0 ? sumTokens : Math.max(0, num(totals.tokens));
      if (models.length === 0) {
        return sectionCard('models', '模型分布', '暂无模型', stateLine('models-empty', '当前窗口内没有可统计的模型调用。', 'muted'));
      }
      const rows = models.map(function (entry, index) {
        const record = obj(entry);
        const name = str(record.model) || '未标注模型';
        const tokens = Math.max(0, num(record.tokens));
        const share = base > 0 ? clamp(tokens / base, 0, 1) : 0;
        return h(
          'div',
          { className: 'ssp-model', key: 'model-' + String(index) + '-' + name },
          h(
            'div',
            { className: 'ssp-model-head' },
            h('span', { className: 'ssp-model-name', title: name }, name),
            h('span', { className: 'ssp-model-value' }, formatCompact(tokens) + ' · ' + formatPercent(share * 100, 1) + ' · ' + formatCost(record.cost, currency))
          ),
          h('div', { className: 'ssp-share' }, h('div', { className: 'ssp-share-fill', style: { width: Math.round(share * 100) + '%' } }))
        );
      });
      return sectionCard('models', '模型分布', '按 token 占比', h('div', { className: 'ssp-models' }, rows));
    }

    /* ------------------------------------------------------------------ *
     * CPU card
     * ------------------------------------------------------------------ */

    function CoreBar(props) {
      const core = obj(props.core);
      const index = pickNum(core.index, props.index);
      const busyRaw = core.busyPercent;
      const busy = busyRaw === null || busyRaw === undefined ? null : clamp(num(busyRaw), 0, 100);
      const height = busy === null ? 2 : Math.max(2, Math.round(busy));
      const tone = busy === null ? 'unknown' : busy >= 92 ? 'error' : busy >= 80 ? 'warn' : 'normal';
      const speed = num(core.speedMHz);
      const label = busy === null ? '—' : formatPercent(busy, 0);
      const tooltip = '核心 ' + String(index) + ' · ' + (busy === null ? '暂无采样' : formatPercent(busy, 1)) + (speed > 0 ? ' · ' + formatInt(speed) + ' MHz' : '');
      return h(
        'div',
        { className: 'ssp-core', title: tooltip },
        h(
          'div',
          { className: 'ssp-core-track' },
          h('div', {
            className: 'ssp-core-fill',
            'data-tone': tone === 'normal' || tone === 'unknown' ? undefined : tone,
            style: { height: height + '%', opacity: busy === null ? 0.25 : 1 },
          })
        ),
        h('span', { className: 'ssp-core-label' }, label)
      );
    }

    function CpuSection(props) {
      const cpu = obj(props.cpu);
      const process = obj(cpu.process);
      const system = obj(cpu.system);
      const perCore = arr(system.perCore);
      const cores = Math.max(0, num(cpu.cores));

      if (cpu.available === false) {
        return sectionCard(
          'cpu',
          'CPU 占用',
          '不可用',
          stateLine('cpu-empty', str(cpu.reason) || '当前环境无法读取 CPU 采样数据。', 'muted')
        );
      }

      const coreRows = perCore.map(function (entry, index) {
        return h(CoreBar, { core: entry, index: index, key: 'core-' + String(index) });
      });

      const rows = [
        ['进程 CPU', formatPercent(process.cpuPercent, 1)],
        ['用户 / 系统', formatDuration(num(process.cpuUserMs) / 1000) + ' / ' + formatDuration(num(process.cpuSystemMs) / 1000)],
        ['RSS 内存', formatBytes(process.rssBytes)],
        ['堆内存', formatBytes(process.heapUsedBytes) + ' / ' + formatBytes(process.heapTotalBytes)],
        ['运行时长', formatDuration(process.uptimeSec)],
        ['系统内存占用', formatPercent(num(system.memUsedRatio) * 100, 1)],
        ['1 / 5 / 15 分钟负载', trimFraction(num(system.load1).toFixed(2)) + ' / ' + trimFraction(num(system.load5).toFixed(2)) + ' / ' + trimFraction(num(system.load15).toFixed(2))],
      ];

      const cpuModel = str(cpu.model);
      const hint = (cores > 0 ? formatInt(cores) + ' 核' : '') + (cpuModel !== '' ? (cores > 0 ? ' · ' : '') + cpuModel : '');

      return sectionCard(
        'cpu',
        'CPU 占用',
        hint === '' ? '进程与全核' : hint,
        h(
          'div',
          null,
          h(
            'div',
            { className: 'ssp-cpu-top' },
            h('div', { className: 'ssp-cpu-stat' }, h('span', { className: 'ssp-cpu-num' }, formatPercent(process.cpuPercent, 1)), h('span', { className: 'ssp-cpu-label' }, '进程占用')),
            h('div', { className: 'ssp-cpu-stat' }, h('span', { className: 'ssp-cpu-num' }, formatPercent(system.coresBusyPercent, 1)), h('span', { className: 'ssp-cpu-label' }, '全核平均')),
            cores > 0 ? h('div', { className: 'ssp-cpu-stat' }, h('span', { className: 'ssp-cpu-num' }, formatInt(cores)), h('span', { className: 'ssp-cpu-label' }, '核心数')) : null
          ),
          coreRows.length > 0 ? h('div', { className: 'ssp-cores' }, coreRows) : stateLine('cpu-cores-empty', '暂无每核心采样数据。', 'muted'),
          h(
            'div',
            { className: 'ssp-cpu-rows' },
            rows.map(function (row) {
              return h('div', { className: 'ssp-cpu-row', key: 'cpu-row-' + row[0] }, h('span', null, row[0]), h('b', null, row[1]));
            })
          )
        )
      );
    }

    /* ------------------------------------------------------------------ *
     * The page
     * ------------------------------------------------------------------ */

    function useSnapshot(windowId) {
      const [view, setView] = React.useState({ phase: 'idle', payload: null, error: '', updatedAt: 0 });
      const [refreshKey, setRefreshKey] = React.useState(0);
      const requestRef = React.useRef(0);

      React.useEffect(function () {
        let disposed = false;
        let controller = null;
        let intervalId = null;

        function request() {
          requestRef.current += 1;
          const ticket = requestRef.current;
          if (controller !== null) {
            try {
              controller.abort();
            } catch (ignored) {
              // the previous request already finished
            }
            controller = null;
          }
          let localController = null;
          if (typeof AbortController === 'function') {
            localController = new AbortController();
            controller = localController;
          }
          setView(function (previous) {
            return { phase: 'loading', payload: previous.payload, error: '', updatedAt: previous.updatedAt };
          });
          fetchSnapshot(windowId, localController ? localController.signal : undefined).then(
            function (payload) {
              if (disposed || ticket !== requestRef.current) return;
              if (controller === localController) controller = null;
              setView({
                phase: 'ready',
                payload: payload,
                error: '',
                updatedAt: stampedAt(payload),
              });
            },
            function (error) {
              if (disposed || ticket !== requestRef.current) return;
              if (controller === localController) controller = null;
              if (error && error.name === 'AbortError') return;
              setView(function (previous) {
                return {
                  phase: 'error',
                  payload: previous.payload,
                  error: messageOf(error),
                  updatedAt: previous.updatedAt,
                };
              });
            }
          );
        }

        request();
        intervalId = setInterval(request, REFRESH_INTERVAL_MS);
        return function () {
          disposed = true;
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          if (controller !== null) {
            try {
              controller.abort();
            } catch (ignored) {
              // already settled
            }
            controller = null;
          }
        };
      }, [windowId, refreshKey]);

      return {
        view: view,
        refresh: function () {
          setRefreshKey(function (value) {
            return value + 1;
          });
        },
      };
    }

    function Page() {
      const [windowId, setWindowId] = React.useState('all');
      const [sortDir, setSortDir] = React.useState(null);
      const [expanded, setExpanded] = React.useState(false);
      const snapshot = useSnapshot(windowId);

      const view = snapshot.view;
      const payload = view.payload;
      const data = obj(payload && payload.data);
      const totals = obj(data.totals);
      const budget = obj(data.budget);
      const cpu = obj(data.cpu);
      const models = arr(data.models);
      const sessions = arr(data.sessions);
      const warnings = arr(data.warnings).filter(function (entry) {
        return typeof entry === 'string' && entry.trim() !== '';
      });
      const computing = payload !== null && payload.computing === true;
      const loading = view.phase === 'loading' || view.phase === 'idle';
      const firstLoad = loading && payload === null;
      const failed = view.phase === 'error';
      const currency = str(totals.currency) || str(budget.currency) || 'CNY';

      const usageTokens = Math.max(0, num(totals.tokens));
      const sessionCount = pickNum(totals.sessions, sessions.length);
      const budgetAmount = Math.max(0, num(budget.amount));
      const budgetSpent = pickNum(budget.spent, totals.cost);
      const budgetRemaining = pickNum(budget.remaining, budgetAmount - budgetSpent);
      const budgetRatio = budgetAmount > 0 ? Math.max(0, num(budget.usedRatio, budgetSpent / budgetAmount)) : 0;
      const overBudget = budget.overBudget === true || (budgetAmount > 0 && budgetSpent > budgetAmount);
      const budgetPeriod = str(budget.period) === 'day' ? '每日预算' : '每月预算';
      const processInfo = obj(cpu.process);
      const systemInfo = obj(cpu.system);
      const cpuAvailable = cpu.available !== false;

      const nowText = firstLoad
        ? '读取中…'
        : loading
        ? '刷新中…'
        : failed && !payload
        ? '读取失败'
        : '更新于 ' + formatClock(view.updatedAt);

      const budgetExtra = {
        tone: overBudget ? 'error' : undefined,
        content: h(
          'div',
          { className: 'ssp-budget', key: 'budget-extra' },
          h(
            'div',
            { className: 'ssp-budget-top' },
            h('span', null, budgetAmount > 0 ? '已用 ' + formatPercent(budgetRatio * 100, 1) : '未配置预算'),
            h('span', null, budgetAmount > 0 ? '预算 ' + formatCost(budgetAmount, currency) : '')
          ),
          h(
            'div',
            { className: 'ssp-progress', role: 'progressbar', 'aria-valuenow': Math.round(clamp(budgetRatio, 0, 1) * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 },
            h('div', { className: 'ssp-progress-fill', 'data-over': overBudget ? 'true' : 'false', style: { width: Math.round(clamp(budgetRatio, 0, 1) * 100) + '%' } })
          ),
          h('div', { className: 'ssp-budget-top' }, h('span', null, budgetPeriod), overBudget ? h('span', { className: 'ssp-budget-over' }, '已超预算 ' + formatCost(budgetSpent - budgetAmount, currency)) : null)
        ),
      };

      const windowButtons = WINDOWS.map(function (entry) {
        const active = entry.id === windowId;
        return h(
          'button',
          {
            key: entry.id,
            className: 'ssp-seg-btn',
            type: 'button',
            role: 'radio',
            'aria-checked': active ? 'true' : 'false',
            onClick: function () {
              setWindowId(entry.id);
              setExpanded(false);
            },
          },
          entry.label
        );
      });

      const header = h(
        'header',
        { className: 'ssp-header', key: 'header' },
        h(
          'div',
          { className: 'ssp-heading' },
          h('h1', { className: 'ssp-title' }, '会话用量统计'),
          h(
            'p',
            { className: 'ssp-subtitle' },
            '统计范围：' + windowLabelOf(windowId) + ' · 本地真实会话日志',
            computing ? h('span', { className: 'ssp-computing' }, ' · 计算中…') : null
          )
        ),
        h(
          'div',
          { className: 'ssp-controls' },
          h('div', { className: 'ssp-seg', role: 'radiogroup', 'aria-label': '统计窗口' }, windowButtons),
          h(
            'button',
            {
              className: 'ssp-btn',
              type: 'button',
              onClick: snapshot.refresh,
              'aria-busy': loading ? 'true' : 'false',
            },
            loading ? '刷新中' : '刷新'
          ),
          h('span', { className: 'ssp-updated' }, nowText)
        )
      );

      if (firstLoad) {
        return h(
          'div',
          { className: 'ssp-page' },
          stylesInjected ? null : h('style', { key: 'ssp-style' }, PAGE_CSS),
          header,
          h(
            'div',
            { className: 'ssp-body' },
            h(
              'div',
              { className: 'ssp-skeletons' },
              h('div', { className: 'ssp-skeleton', key: 'sk-1' }),
              h('div', { className: 'ssp-skeleton', key: 'sk-2' }),
              h('div', { className: 'ssp-skeleton', key: 'sk-3' })
            )
          )
        );
      }

      const kpiGrid = h(
        'div',
        { className: 'ssp-kpis', key: 'kpis' },
        kpiCard('tokens', '总 token 消耗', formatCompact(usageTokens), '输入 ' + formatCompact(totals.input) + ' · 输出 ' + formatCompact(totals.output) + ' · 缓存 ' + formatCompact(num(totals.cacheRead) + num(totals.cacheWrite))),
        kpiCard('sessions', '会话数量', formatInt(sessionCount), '活跃 ' + formatInt(totals.activeDays) + ' 天'),
        kpiCard('cost', '估算成本', formatCost(totals.cost, currency), '调用 ' + formatInt(totals.calls) + ' 次 · 按配置价格估算'),
        kpiCard('budget', '预算剩余', budgetAmount > 0 ? formatCost(budgetRemaining, currency) : '未设置预算', budgetAmount > 0 ? '预算 ' + formatCost(budgetAmount, currency) + ' · ' + (str(budget.period) === 'day' ? '按日' : '按月') : '在插件配置中设置 budget.amount 后显示', budgetExtra),
        kpiCard(
          'cpu',
          'CPU 占用',
          cpuAvailable ? formatPercent(processInfo.cpuPercent, 1) : '不可用',
          cpuAvailable
            ? '进程占用 · 全核 ' + formatPercent(systemInfo.coresBusyPercent, 1) + (num(cpu.cores) > 0 ? ' · ' + formatInt(cpu.cores) + ' 核' : '')
            : str(cpu.reason) || '无法读取 CPU 采样'
        )
      );

      const body = h(
        'div',
        { className: 'ssp-body' },
        warnings.length > 0
          ? h(
              'ul',
              { className: 'ssp-warnings', key: 'warnings' },
              warnings.slice(0, 3).map(function (warning, index) {
                return h('li', { key: 'warn-' + String(index) }, '· ' + warning);
              })
            )
          : null,
        failed
          ? stateLine('error', '读取统计快照失败：' + (view.error || '未知错误'), 'error', retryButton('retry', '重试', snapshot.refresh))
          : null,
        computing && !failed
          ? stateLine('computing', '正在计算会话用量，稍后自动刷新…', 'muted')
          : null,
        kpiGrid,
        TimelineSection({ windowId: windowId, data: data }),
        h(
          'div',
          { className: 'ssp-lower', key: 'lower' },
          SessionsSection({
            sessions: sessions,
            sortDir: sortDir,
            expanded: expanded,
            currency: currency,
            onSort: function () {
              setSortDir(function (current) {
                if (current === null) return 'desc';
                return current === 'desc' ? 'asc' : 'desc';
              });
            },
            onToggleExpanded: function () {
              setExpanded(function (value) {
                return !value;
              });
            },
          }),
          h(
            'div',
            { className: 'ssp-lower-side' },
            ModelsSection({ models: models, data: data }),
            CpuSection({ cpu: cpu })
          )
        )
      );

      return h(
        'div',
        { className: 'ssp-page' },
        stylesInjected ? null : h('style', { key: 'ssp-style' }, PAGE_CSS),
        header,
        body
      );
    }

    /* ------------------------------------------------------------------ *
     * Plugin definition
     * ------------------------------------------------------------------ */

    return {
      inject: ['slots'],
      apply(ctx) {
        try {
          const styles = typeof ctx.get === 'function' ? ctx.get('styles') : undefined;
          if (styles && typeof styles.insert === 'function') {
            ctx.effect(function () {
              try {
                const dispose = styles.insert(PAGE_CSS);
                stylesInjected = true;
                return typeof dispose === 'function' ? dispose : undefined;
              } catch (error) {
                stylesInjected = false;
                return undefined;
              }
            }, 'dsh-session-stats-panel: stylesheet');
          }
        } catch (error) {
          stylesInjected = false;
        }

        ctx.effect(function () {
          return ctx.slots.inject('sidebar.panellist', function () {
            return ctx.slots.register(
              {
                name: 'sidebar.panellist',
                id: 'session-stats',
                order: 30,
                label: function () {
                  return PANEL_LABEL;
                },
              },
              PanelIcon
            );
          });
        }, 'dsh-session-stats-panel: sidebar entry');

        ctx.effect(function () {
          return ctx.slots.inject('main', function () {
            return ctx.slots.register(
              {
                name: 'main',
                key: 'session-stats',
              },
              Page
            );
          });
        }, 'dsh-session-stats-panel: main page');
      },
    };
  },
});
