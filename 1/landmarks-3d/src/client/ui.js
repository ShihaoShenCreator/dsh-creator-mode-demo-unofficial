/**
 * Client UI: sidebar icon, main panel, WebGL stage and controls.
 * Plain `createElement` calls only — the bundle has no JSX transform.
 *
 * The panel receives `props.services`, a narrow face over the plugin's optional
 * Client services (locale for copy, theme for the palette, and event
 * subscriptions for both). Every service is optional: a missing one degrades
 * copy or palette, never rendering.
 */
import { LandmarkRenderer } from '../view/renderer.js';
import { unit } from '../view/math.js';
import { listLandmarks, loadModel } from './models.js';

const PALETTES = {
  light: {
    skyTop: '#e2e9f1',
    skyBottom: '#f8f5ef',
    discInner: [0.88, 0.86, 0.83],
    discOuter: [0.80, 0.79, 0.76],
    shadow: 0.17,
    sky: [0.63, 0.69, 0.79],
    bounce: [0.35, 0.33, 0.31],
  },
  dark: {
    skyTop: '#0c121d',
    skyBottom: '#1c2636',
    discInner: [0.14, 0.17, 0.22],
    discOuter: [0.07, 0.09, 0.13],
    shadow: 0.36,
    sky: [0.18, 0.22, 0.30],
    bounce: [0.05, 0.06, 0.08],
  },
};

const CSS = `
.lm-root {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 20px 16px;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  background: var(--dsw-alias-bg-base);
}
.lm-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.lm-title { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: .01em; }
.lm-sub { margin: 3px 0 0; font-size: 12.5px; color: var(--dsw-alias-label-secondary); }
.lm-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.lm-btn {
  appearance: none; display: inline-flex; align-items: center; gap: 6px;
  height: 30px; padding: 0 11px; border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-size: 12.5px; font-family: inherit; cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
.lm-btn:hover { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l2); }
.lm-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.lm-btn[aria-pressed='true'] { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.lm-body {
  flex: 1 1 auto; min-height: 0;
  display: grid; grid-template-columns: 216px minmax(0, 1fr); gap: 12px;
}
.lm-list { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; padding-right: 2px; }
.lm-item {
  appearance: none; text-align: left; display: block; width: 100%;
  padding: 9px 11px; border-radius: 10px; font-family: inherit;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1); color: inherit; cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
.lm-item:hover { background: var(--dsw-alias-bg-layer-2); }
.lm-item:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.lm-item[aria-current='true'] { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-2); }
.lm-item-name { font-size: 13.5px; font-weight: 600; }
.lm-item-place { margin-top: 1px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.lm-stage-wrap { position: relative; min-height: 0; display: flex; }
.lm-stage {
  position: relative; flex: 1 1 auto; min-height: 260px; border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l1); overflow: hidden;
  background: linear-gradient(180deg, var(--lm-sky-top) 0%, var(--lm-sky-bottom) 100%);
}
.lm-canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: grab; }
.lm-canvas:active { cursor: grabbing; }
.lm-info {
  position: absolute; left: 12px; bottom: 12px; max-width: min(370px, 64%);
  padding: 10px 12px; border-radius: 10px;
  background: color-mix(in srgb, var(--dsw-alias-bg-overlay) 84%, transparent);
  border: 1px solid var(--dsw-alias-border-l1);
  pointer-events: none;
}
.lm-info-name { font-size: 14px; font-weight: 600; }
.lm-info-place { font-size: 11.5px; color: var(--dsw-alias-label-secondary); margin-top: 1px; }
.lm-info-blurb { margin: 6px 0 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
.lm-stats { position: absolute; right: 12px; top: 12px; display: flex; gap: 6px; pointer-events: none; }
.lm-chip {
  padding: 3px 8px; border-radius: 999px; font-size: 11px; font-variant-numeric: tabular-nums;
  background: color-mix(in srgb, var(--dsw-alias-bg-overlay) 84%, transparent);
  border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary);
}
.lm-hint {
  position: absolute; left: 12px; top: 12px; max-width: 55%;
  font-size: 11px; color: var(--dsw-alias-label-secondary);
  background: color-mix(in srgb, var(--dsw-alias-bg-overlay) 78%, transparent);
  border-radius: 999px; padding: 3px 10px; pointer-events: none; white-space: nowrap;
}
.lm-fallback {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  flex-direction: column; gap: 8px; text-align: center; padding: 24px;
  font-size: 12.5px; color: var(--dsw-alias-label-secondary);
}
@media (max-width: 760px) {
  .lm-body { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
  .lm-list { flex-direction: row; overflow-x: auto; }
  .lm-item { min-width: 130px; }
  .lm-info { display: none; }
}
@media (prefers-reduced-motion: reduce) { .lm-btn, .lm-item { transition: none; } }
`;

/* ----------------------------------------------------------------- icons */

function glyph(React, path, extras) {
  return React.createElement(
    'svg',
    { width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
    React.createElement('path', { d: path, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', ...extras }),
  );
}

/* ------------------------------------------------------------ components */

/**
 * A crash boundary around the panel body.
 *
 * A throwing component blanks its slot entry and logs `slot entry crashed`,
 * leaving the user with an empty panel and no explanation. Catching the error
 * here keeps the surrounding shell intact and shows the failure instead.
 */
function withBoundary(React, Component, renderError) {
  class Boundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }
    componentDidCatch(error) {
      this.setState({ error: String((error && error.message) || error) });
    }
    render() {
      if (this.state.error) return renderError(this.state.error, this.props);
      return React.createElement(Component, this.props);
    }
  }
  Boundary.displayName = 'LandmarkBoundary';
  return Boundary;
}

export function createLandmarkUi(React) {
  const h = React.createElement;

  function SidebarIcon({ size }) {
    const px = typeof size === 'number' && size > 0 ? size : 16;
    return h(
      'svg',
      { width: px, height: px, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true', style: { display: 'block' } },
      h('path', { d: 'M2.9 13.5h10.2', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
      h('path', { d: 'M4.3 13.5 6.1 5.2h3.8l1.8 8.3z', stroke: 'currentColor', strokeWidth: 1.2, strokeLinejoin: 'round' }),
      h('path', { d: 'M6 8.8h4M6.7 11.1h2.6', stroke: 'currentColor', strokeWidth: 1.1, strokeLinecap: 'round' }),
      h('path', { d: 'M8 1.6v2.2', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
    );
  }

  function Stage(props) {
    const { entry, palette, t, autoRotate, resetSignal, onMetrics, metrics } = props;
    const hostRef = React.useRef(null);
    const canvasRef = React.useRef(null);
    const rendererRef = React.useRef(null);
    const drawRef = React.useRef(null);
    const paintRef = React.useRef(null);
    const stateRef = React.useRef({ yaw: 0.72, pitch: 0.30, zoom: 1, dragging: false, lastX: 0, lastY: 0 });
    const [failure, setFailure] = React.useState(null);

    // Renderer lifetime: created with the canvas, disposed with the stage.
    React.useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return undefined;
      let renderer;
      try {
        renderer = new LandmarkRenderer(canvas, { onLost: () => setFailure('lost') });
      } catch (err) {
        setFailure(String((err && err.message) || err));
        return undefined;
      }
      rendererRef.current = renderer;
      // Size and first paint happen once the renderer exists.
      const host = hostRef.current;
      if (host) {
        const rect = host.getBoundingClientRect();
        renderer.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 2.5));
      }
      paintRef.current?.();
      return () => {
        rendererRef.current = null;
        renderer.dispose();
      };
    }, []);

    // Model upload whenever the selection changes.
    React.useEffect(() => {
      const renderer = rendererRef.current;
      if (!renderer || !entry) return;
      let tris;
      try {
        tris = loadModel(entry.id);
        setFailure(null);
      } catch (err) {
        setFailure(String((err && err.message) || err));
        return;
      }
      const metrics = renderer.setModel(tris);
      if (metrics) onMetrics({ ...metrics, triangles: tris.length });
      paintRef.current?.();
    }, [entry, onMetrics]);

    // Size tracking: a ResizeObserver on the stage keeps the drawing buffer
    // in step with the panel layout, grid resizes and sidebar toggles included.
    React.useEffect(() => {
      const host = hostRef.current;
      if (!host) return undefined;
      const apply = () => {
        const rect = host.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        if (rendererRef.current) rendererRef.current.resize(rect.width, rect.height, dpr);
        paintRef.current?.();
      };
      apply();
      if (typeof ResizeObserver === 'function') {
        const ro = new ResizeObserver(apply);
        ro.observe(host);
        return () => ro.disconnect();
      }
      window.addEventListener('resize', apply);
      return () => window.removeEventListener('resize', apply);
    }, []);

    // One paint routine, rebuilt when the palette changes. It reads the live
    // camera state, so pointer edits never need a React re-render.
    React.useEffect(() => {
      const draw = () => {
        const renderer = rendererRef.current;
        if (!renderer || !renderer.metrics) return;
        const s = stateRef.current;
        const pal = PALETTES[palette === 'dark' ? 'dark' : 'light'];
        // The sun tracks the camera azimuth so the lit side always faces the
        // viewer's upper left, whatever the orbit angle.
        const cp = Math.cos(0.62);
        const sun = unit([Math.sin(s.yaw + 0.62) * cp, Math.sin(0.62), Math.cos(s.yaw + 0.62) * cp]);
        renderer.draw(
          {
            yaw: s.yaw,
            pitch: Math.max(-0.12, Math.min(1.1, s.pitch)),
            zoom: s.zoom,
            target: [0, renderer.metrics.height * 0.42, 0],
          },
          {
            sun,
            sky: pal.sky,
            bounce: pal.bounce,
            discInner: pal.discInner,
            discOuter: pal.discOuter,
            shadow: pal.shadow,
          },
        );
      };
      drawRef.current = draw;
      paintRef.current = draw;
      draw();
      return () => {
        drawRef.current = null;
        paintRef.current = null;
      };
    }, [palette, entry]);

    // Auto-rotation drives its own animation frame and stops when disabled.
    React.useEffect(() => {
      if (!autoRotate) return undefined;
      let raf = 0;
      let last = 0;
      const loop = (now) => {
        const s = stateRef.current;
        const dt = last ? Math.min(64, now - last) : 16;
        last = now;
        if (!s.dragging) s.yaw += dt * 0.00032;
        drawRef.current?.();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }, [autoRotate]);

    // Reset on demand: camera returns to the opening view and repaints.
    React.useEffect(() => {
      if (!resetSignal) return;
      stateRef.current.yaw = 0.72;
      stateRef.current.pitch = 0.30;
      stateRef.current.zoom = 1;
      paintRef.current?.();
    }, [resetSignal]);

    const onDown = React.useCallback((ev) => {
      const s = stateRef.current;
      s.dragging = true;
      s.lastX = ev.clientX;
      s.lastY = ev.clientY;
      try {
        ev.currentTarget.setPointerCapture(ev.pointerId);
      } catch {
        /* capture is optional */
      }
    }, []);
    const onMove = React.useCallback((ev) => {
      const s = stateRef.current;
      if (!s.dragging) return;
      s.yaw += (ev.clientX - s.lastX) * 0.0075;
      s.pitch = Math.max(-0.12, Math.min(1.1, s.pitch + (ev.clientY - s.lastY) * 0.005));
      s.lastX = ev.clientX;
      s.lastY = ev.clientY;
      paintRef.current?.();
    }, []);
    const onUp = React.useCallback(() => {
      stateRef.current.dragging = false;
    }, []);
    const onDblClick = React.useCallback(() => {
      const s = stateRef.current;
      s.yaw = 0.72;
      s.pitch = 0.30;
      s.zoom = 1;
      paintRef.current?.();
    }, []);

    // React attaches wheel listeners passively, so `preventDefault` there is
    // ignored and the panel scrolls while the user zooms. A native non-passive
    // listener on the canvas is the only way to claim the gesture locally.
    React.useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return undefined;
      const onWheelNative = (ev) => {
        ev.preventDefault();
        const s = stateRef.current;
        s.zoom = Math.max(0.5, Math.min(2.6, s.zoom * Math.exp((ev.deltaY || 0) * 0.0012)));
        paintRef.current?.();
      };
      canvas.addEventListener('wheel', onWheelNative, { passive: false });
      return () => canvas.removeEventListener('wheel', onWheelNative);
    }, []);

    return h(
      'div',
      { className: 'lm-stage', ref: hostRef },
      h('canvas', {
        className: 'lm-canvas',
        ref: canvasRef,
        role: 'img',
        'aria-label': entry ? `${t(entry.titleKey, entry.title)} — ${t(entry.placeKey, entry.place)}` : t('panel.title'),
        onPointerDown: onDown,
        onPointerMove: onMove,
        onPointerUp: onUp,
        onPointerCancel: onUp,
        onDoubleClick: onDblClick,
      }),
      entry ? h('div', { className: 'lm-hint' }, t('panel.hint')) : null,
      metrics
        ? h(
            'div',
            { className: 'lm-stats' },
            h('span', { className: 'lm-chip' }, `${metrics.triangles} ${t('panel.triangles')}`),
            h('span', { className: 'lm-chip' }, `${Math.round(metrics.height)} m ${t('panel.height')}`),
          )
        : null,
      failure
        ? h('div', { className: 'lm-fallback' }, h('strong', null, t('panel.error')), h('span', null, failure))
        : null,
      entry
        ? h(
            'div',
            { className: 'lm-info' },
            h('div', { className: 'lm-info-name' }, t(entry.titleKey, entry.title)),
            h('div', { className: 'lm-info-place' }, t(entry.placeKey, entry.place)),
            h('p', { className: 'lm-info-blurb' }, t(entry.blurbKey, entry.blurb)),
          )
        : null,
    );
  }

  function MainPanel(props) {
    const services = props.services ?? makeServices(null);
    const t = useTranslate(React, services.get('locale'));
    const palette = usePalette(React, services);
    const models = listLandmarks();
    const [selected, setSelected] = React.useState(models[0].id);
    const [autoRotate, setAutoRotate] = React.useState(true);
    const [resetSignal, setResetSignal] = React.useState(0);
    const [metrics, setMetrics] = React.useState(null);
    const onMetrics = React.useCallback((m) => setMetrics(m), []);
    const entry = models.find((m) => m.id === selected) ?? models[0];

    // Re-render on locale switch: the revision bump re-runs the translate.
    useLocaleRevision(React, services);

    const pal = PALETTES[palette];
    return h(
      'div',
      {
        className: 'lm-root',
        style: { '--lm-sky-top': pal.skyTop, '--lm-sky-bottom': pal.skyBottom },
      },
      h('style', null, CSS),
      h(
        'header',
        { className: 'lm-head' },
        h(
          'div',
          null,
          h('h1', { className: 'lm-title' }, t('panel.title')),
          h('p', { className: 'lm-sub' }, t('panel.subtitle')),
        ),
        h(
          'div',
          { className: 'lm-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'lm-btn',
              'aria-pressed': autoRotate ? 'true' : 'false',
              onClick: () => setAutoRotate((v) => !v),
            },
            glyph(React, 'M2.6 8a5.4 5.4 0 0 1 9.5-3.5M13.4 8a5.4 5.4 0 0 1-9.5 3.5'),
            glyph(React, 'M12.9 1.9v3h-3M3.1 14.1v-3h3'),
            t('panel.rotate'),
          ),
          h(
            'button',
            { type: 'button', className: 'lm-btn', onClick: () => setResetSignal((v) => v + 1) },
            glyph(React, 'M8 3.2a4.8 4.8 0 1 1-4.4 2.9M2.4 3.4v3.1h3.1'),
            t('panel.reset'),
          ),
        ),
      ),
      h(
        'div',
        { className: 'lm-body' },
        h(
          'nav',
          { className: 'lm-list', 'aria-label': t('panel.title') },
          models.map((m) =>
            h(
              'button',
              {
                key: m.id,
                type: 'button',
                className: 'lm-item',
                'aria-current': m.id === selected ? 'true' : 'false',
                onClick: () => setSelected(m.id),
              },
              h('div', { className: 'lm-item-name' }, t(m.titleKey, m.title)),
              h('div', { className: 'lm-item-place' }, t(m.placeKey, m.place)),
            ),
          ),
        ),
        h(
          'div',
          { className: 'lm-stage-wrap' },
          h(Stage, { entry, palette, t, autoRotate, resetSignal, onMetrics, metrics }),
        ),
      ),
    );
  }

  /**
   * Fallback rendered if the panel body throws. It keeps the shell alive and
   * shows the failure instead of leaving an empty, unexplained slot.
   */
  function renderPanelError(error, props) {
    const t = props.services
      ? makeTranslate(props.services.get('locale'))
      : (key, fallback) => fallback ?? key;
    return h(
      'div',
      { className: 'lm-root' },
      h('style', null, CSS),
      h(
        'div',
        { className: 'lm-fallback', style: { position: 'static', flex: 1 } },
        h('strong', null, t('panel.error')),
        h('span', null, String(error)),
      ),
    );
  }

  return {
    MainPanel: withBoundary(React, MainPanel, renderPanelError),
    SidebarIcon,
  };
}

/* -------------------------------------------------------------- service */

/**
 * A narrow face over the optional Client services. The plugin builds one in
 * `apply` from its own context, so `get` and `subscribe` stay bound to the
 * plugin's fibre rather than to a React component's lifetime.
 */
export function makeServices(ctx) {
  const lookup = (name) => {
    try {
      return ctx && typeof ctx.get === 'function' ? ctx.get(name) : undefined;
    } catch {
      return undefined;
    }
  };
  return {
    get: lookup,
    subscribe(event, fn) {
      try {
        if (!ctx || typeof ctx.on !== 'function') return undefined;
        return ctx.on(event, fn);
      } catch {
        return undefined;
      }
    },
  };
}

/**
 * Bind the plugin's dictionary. Falls back to the passed fallback string when
 * the key is missing or the locale service is absent, so the page is readable
 * even if registration lost a race.
 */
export function makeTranslate(locale) {
  let bound = null;
  if (locale && typeof locale.bind === 'function') {
    try {
      bound = locale.bind('landmarks3d');
    } catch {
      bound = null;
    }
  }
  return (key, fallback) => {
    if (!bound) return typeof fallback === 'string' ? fallback : key;
    try {
      const value = bound(key);
      return typeof value === 'string' && value !== key ? value : typeof fallback === 'string' ? fallback : key;
    } catch {
      return typeof fallback === 'string' ? fallback : key;
    }
  };
}

function useTranslate(React, locale) {
  return React.useMemo(() => makeTranslate(locale), [locale]);
}

/** Re-render whenever the locale service publishes a revision bump. */
function useLocaleRevision(React, services) {
  const [, force] = React.useReducer((v) => v + 1, 0);
  React.useEffect(() => {
    const unsubscribe = services.subscribe('locale/change', () => force());
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [services]);
  return null;
}

/** Current theme palette, re-read whenever the theme event fires. */
function usePalette(React, services) {
  const read = React.useCallback(() => {
    try {
      const theme = services.get('theme');
      const snap = theme && typeof theme.getTheme === 'function' ? theme.getTheme() : null;
      const def = snap && (snap.active ?? snap);
      return def && def.colorScheme === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }, [services]);
  const [palette, setPalette] = React.useState(read);
  React.useEffect(() => {
    setPalette(read());
  }, [read]);
  React.useEffect(() => {
    let unsubscribe;
    try {
      unsubscribe = services.subscribe ? services.subscribe('theme/change', () => setPalette(read())) : undefined;
    } catch {
      unsubscribe = undefined;
    }
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [services, read]);
  return palette;
}
