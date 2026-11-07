window.__ModuleLoader__.load({
  id: '@local/dsh-skin-studio',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /* SKINS:BEGIN
     * Pure skin data. `pair(light, dark)` is the token shape the theme service
     * validates; `default` (id `original`) carries no tokens and leaves the
     * active palette untouched.
     */
    function pair(light, dark) {
      return { light, dark };
    }

    const SKINS = [
      {
        id: 'original',
        tokens: null,
      },
      {
        id: 'pixel',
        tokens: {
          '--dsw-alias-bg-base': pair('#f4ead0', '#14120b'),
          '--dsw-alias-bg-layer-1': pair('#fbf4e1', '#1c1911'),
          '--dsw-alias-bg-layer-2': pair('#ece0c2', '#262217'),
          '--dsw-alias-bg-layer-3': pair('#e4d6b0', '#2b2619'),
          '--dsw-alias-bg-overlay': pair('#fbf4e1', '#1c1911'),
          '--dsw-alias-bg-module-platform': pair('#e7d9b6', '#2b2619'),
          '--dsw-specific-sidebar-fill': pair('#e9dcba', '#1a1710'),
          '--dsw-specific-menu': pair('#fbf4e1', '#1c1911'),
          '--dsw-alias-border-l1': pair('#d5c8a2', '#3a3424'),
          '--dsw-alias-border-l2': pair('#bfae84', '#4c432c'),
          '--dsw-alias-border-l3': pair('#9c8a60', '#5f5538'),
          '--dsw-alias-border-l4': pair('#7a6a44', '#776a46'),
          '--dsw-alias-label-primary': pair('#1e1a10', '#f6ecc6'),
          '--dsw-alias-label-secondary': pair('#453c20', '#d0c29a'),
          '--dsw-alias-label-tertiary': pair('#5d5330', '#a89a72'),
          '--dsw-alias-label-caption': pair('#6d6139', '#857852'),
          '--dsw-alias-brand-primary': pair('#a8380d', '#ff7a3d'),
          '--dsw-alias-brand-text': pair('#fff6df', '#1a1508'),
          '--dsw-focus-ring-color': pair('#a8380d', '#ff7a3d'),
          '--dsw-alias-interactive-bg-hover': pair('rgba(30, 26, 16, 0.10)', 'rgba(246, 236, 198, 0.10)'),
          '--dsw-alias-interactive-bg-active': pair('rgba(30, 26, 16, 0.18)', 'rgba(246, 236, 198, 0.18)'),
          '--dsw-alias-button-primary-fill': pair('#a8380d', '#d44a12'),
          '--dsw-alias-button-primary-hover': pair('#8c2d08', '#b33c0c'),
          '--dsw-alias-markdown-code-block': pair('#e8dcb8', '#241f14'),
          '--dsw-alias-markdown-inline-code': pair('#ded0a8', '#2c2618'),
          '--dsw-alias-link': pair('#93320a', '#ff9a63'),
          '--dsw-alias-state-error-primary': pair('#a81f1f', '#ff6b6b'),
          '--dsw-alias-state-idle-primary': pair('#6a5c34', '#8d7f5c'),
          '--dsw-alias-state-success-primary': pair('#2c6b34', '#7fd68a'),
          '--dsw-alias-state-warn-primary': pair('#8f6410', '#ffd166'),
          '--dsw-radius-xs': pair('0px', '0px'),
          '--dsw-radius-sm': pair('0px', '0px'),
          '--dsw-radius-md': pair('0px', '0px'),
          '--dsw-radius-lg': pair('0px', '0px'),
          '--dsw-radius-xl': pair('0px', '0px'),
          '--dsw-radius-panel': pair('0px', '0px'),
          '--dsw-shadow-lv1': pair('2px 2px 0 rgba(30, 26, 16, 0.38)', '2px 2px 0 rgba(0, 0, 0, 0.6)'),
          '--dsw-shadow-lv2': pair('4px 4px 0 rgba(30, 26, 16, 0.34)', '4px 4px 0 rgba(0, 0, 0, 0.58)'),
          '--dsw-shadow-lv3': pair('6px 6px 0 rgba(30, 26, 16, 0.30)', '6px 6px 0 rgba(0, 0, 0, 0.55)'),
          '--dsw-font-family': pair(
            'ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace',
            'ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace',
          ),
        },
      },
      {
        id: 'aurora',
        tokens: {
          '--dsw-alias-bg-base': pair('#f3f5ff', '#0a0e1e'),
          '--dsw-alias-bg-layer-1': pair('#ffffff', '#121830'),
          '--dsw-alias-bg-layer-2': pair('#eef1fb', '#1a2140'),
          '--dsw-alias-bg-layer-3': pair('#e6eafa', '#212a4f'),
          '--dsw-alias-bg-overlay': pair('#ffffff', '#121830'),
          '--dsw-alias-bg-module-platform': pair('#e8ecfa', '#1b2344'),
          '--dsw-specific-sidebar-fill': pair('#eaeefb', '#0f1428'),
          '--dsw-specific-menu': pair('#ffffff', '#121830'),
          '--dsw-alias-border-l1': pair('#d9ddf0', '#2b3560'),
          '--dsw-alias-border-l2': pair('#c5cbe6', '#3a4678'),
          '--dsw-alias-border-l3': pair('#aab2d5', '#4c5a92'),
          '--dsw-alias-border-l4': pair('#8a91b5', '#6474ae'),
          '--dsw-alias-label-primary': pair('#121830', '#eef1ff'),
          '--dsw-alias-label-secondary': pair('#3a4258', '#c0c8ee'),
          '--dsw-alias-label-tertiary': pair('#566081', '#9aa3cf'),
          '--dsw-alias-label-caption': pair('#6b7495', '#7a83b0'),
          '--dsw-alias-brand-primary': pair('#3f5bd9', '#7f8bff'),
          '--dsw-alias-brand-text': pair('#ffffff', '#0c1130'),
          '--dsw-focus-ring-color': pair('#3f5bd9', '#7f8bff'),
          '--dsw-alias-interactive-bg-hover': pair('rgba(63, 91, 217, 0.10)', 'rgba(127, 139, 255, 0.14)'),
          '--dsw-alias-interactive-bg-active': pair('rgba(63, 91, 217, 0.18)', 'rgba(127, 139, 255, 0.24)'),
          '--dsw-alias-button-primary-fill': pair('#3f5bd9', '#5b67e8'),
          '--dsw-alias-button-primary-hover': pair('#3249b0', '#4a55cf'),
          '--dsw-alias-markdown-code-block': pair('#f0f3ff', '#151c38'),
          '--dsw-alias-markdown-inline-code': pair('#e6ebff', '#1d2547'),
          '--dsw-alias-link': pair('#3f5bd9', '#8f9bff'),
          '--dsw-alias-state-error-primary': pair('#c22b3f', '#ff7a9c'),
          '--dsw-alias-state-idle-primary': pair('#6b7495', '#7d86b5'),
          '--dsw-alias-state-success-primary': pair('#16785a', '#6be3b0'),
          '--dsw-alias-state-warn-primary': pair('#a06a10', '#ffcf70'),
          '--dsw-shadow-lv1': pair('0 2px 8px rgba(38, 48, 105, 0.10)', '0 2px 10px rgba(0, 0, 0, 0.45)'),
          '--dsw-shadow-lv2': pair('0 6px 20px rgba(38, 48, 105, 0.14)', '0 6px 22px rgba(0, 0, 0, 0.5)'),
        },
      },
      {
        id: 'paper',
        tokens: {
          '--dsw-alias-bg-base': pair('#fbf7ef', '#1a1713'),
          '--dsw-alias-bg-layer-1': pair('#fffdf8', '#221e19'),
          '--dsw-alias-bg-layer-2': pair('#f3ece0', '#2b2621'),
          '--dsw-alias-bg-layer-3': pair('#ede5d7', '#302a24'),
          '--dsw-alias-bg-overlay': pair('#fffdf8', '#221e19'),
          '--dsw-alias-bg-module-platform': pair('#efe7d9', '#302a24'),
          '--dsw-specific-sidebar-fill': pair('#f5efe3', '#1e1a16'),
          '--dsw-specific-menu': pair('#fffdf8', '#221e19'),
          '--dsw-alias-border-l1': pair('#e0d6c4', '#3a332b'),
          '--dsw-alias-border-l2': pair('#cdc0aa', '#4b4238'),
          '--dsw-alias-border-l3': pair('#b3a48b', '#5d5347'),
          '--dsw-alias-border-l4': pair('#96866a', '#73685a'),
          '--dsw-alias-label-primary': pair('#241d16', '#f0e7da'),
          '--dsw-alias-label-secondary': pair('#4a3f33', '#cfc2b0'),
          '--dsw-alias-label-tertiary': pair('#6b5c48', '#ab9c87'),
          '--dsw-alias-label-caption': pair('#83725b', '#8b7c69'),
          '--dsw-alias-brand-primary': pair('#8a5a3b', '#d59a6b'),
          '--dsw-alias-brand-text': pair('#fff8ee', '#221407'),
          '--dsw-focus-ring-color': pair('#8a5a3b', '#d59a6b'),
          '--dsw-alias-interactive-bg-hover': pair('rgba(36, 29, 22, 0.08)', 'rgba(240, 231, 218, 0.10)'),
          '--dsw-alias-interactive-bg-active': pair('rgba(36, 29, 22, 0.15)', 'rgba(240, 231, 218, 0.18)'),
          '--dsw-alias-button-primary-fill': pair('#8a5a3b', '#b8794b'),
          '--dsw-alias-button-primary-hover': pair('#74472c', '#9d6138'),
          '--dsw-alias-markdown-code-block': pair('#f2ebdf', '#26211c'),
          '--dsw-alias-markdown-inline-code': pair('#ebdfcc', '#2e2822'),
          '--dsw-alias-link': pair('#7a4a2b', '#d59a6b'),
          '--dsw-alias-state-error-primary': pair('#a83226', '#ff8a7a'),
          '--dsw-alias-state-idle-primary': pair('#6b5c48', '#8e8170'),
          '--dsw-alias-state-success-primary': pair('#3f6b3a', '#8fd0a0'),
          '--dsw-alias-state-warn-primary': pair('#8f6a1a', '#ffce7a'),
          '--dsw-font-family': pair(
            'ui-serif, Georgia, "Songti SC", "Noto Serif CJK SC", "SimSun", serif',
            'ui-serif, Georgia, "Songti SC", "Noto Serif CJK SC", "SimSun", serif',
          ),
        },
      },
      {
        id: 'neon',
        tokens: {
          '--dsw-alias-bg-base': pair('#f7f5ff', '#06060a'),
          '--dsw-alias-bg-layer-1': pair('#ffffff', '#0d0d15'),
          '--dsw-alias-bg-layer-2': pair('#efecff', '#15151f'),
          '--dsw-alias-bg-layer-3': pair('#e7e3ff', '#1b1b29'),
          '--dsw-alias-bg-overlay': pair('#ffffff', '#0d0d15'),
          '--dsw-alias-bg-module-platform': pair('#e9e5fb', '#17172a'),
          '--dsw-specific-sidebar-fill': pair('#f0edff', '#0a0a12'),
          '--dsw-specific-menu': pair('#ffffff', '#0d0d15'),
          '--dsw-alias-border-l1': pair('#dcd6f2', '#262640'),
          '--dsw-alias-border-l2': pair('#c9c2ea', '#35354f'),
          '--dsw-alias-border-l3': pair('#a99fe0', '#4d4c6f'),
          '--dsw-alias-border-l4': pair('#8b7fd0', '#6d6a9b'),
          '--dsw-alias-label-primary': pair('#191231', '#f2f0ff'),
          '--dsw-alias-label-secondary': pair('#443a6b', '#c9c4ff'),
          '--dsw-alias-label-tertiary': pair('#655a8f', '#9d97d6'),
          '--dsw-alias-label-caption': pair('#7f76a8', '#7c76b0'),
          '--dsw-alias-brand-primary': pair('#08616f', '#ff3ea5'),
          '--dsw-alias-brand-text': pair('#ffffff', '#14000d'),
          '--dsw-focus-ring-color': pair('#0b7d94', '#ff3ea5'),
          '--dsw-alias-interactive-bg-hover': pair('rgba(11, 125, 148, 0.10)', 'rgba(255, 62, 165, 0.14)'),
          '--dsw-alias-interactive-bg-active': pair('rgba(11, 125, 148, 0.18)', 'rgba(255, 62, 165, 0.24)'),
          '--dsw-alias-button-primary-fill': pair('#0b7d94', '#ff3ea5'),
          '--dsw-alias-button-primary-hover': pair('#096379', '#d92b87'),
          '--dsw-alias-markdown-code-block': pair('#ede9ff', '#10101c'),
          '--dsw-alias-markdown-inline-code': pair('#e6e0ff', '#181829'),
          '--dsw-alias-link': pair('#a3106f', '#6ef2ff'),
          '--dsw-alias-state-error-primary': pair('#c2223c', '#ff5c8a'),
          '--dsw-alias-state-idle-primary': pair('#6e6693', '#8b86c0'),
          '--dsw-alias-state-success-primary': pair('#0f7d5f', '#64ffc8'),
          '--dsw-alias-state-warn-primary': pair('#946a08', '#ffe066'),
          '--dsw-shadow-lv1': pair('0 0 0 1px rgba(11, 125, 148, 0.18)', '0 0 12px rgba(255, 62, 165, 0.35)'),
          '--dsw-shadow-lv2': pair('0 0 0 1px rgba(11, 125, 148, 0.25)', '0 0 22px rgba(255, 62, 165, 0.45)'),
        },
      },
    ];

    const SKIN_IDS = ['original', 'pixel', 'aurora', 'paper', 'neon'];
    /* SKINS:END */

    const SOURCE = '@local/dsh-skin-studio';
    const STORAGE_KEY = 'dsh-skin-studio.selection';
    const NS = 'skinStudio';
    const PANEL_ID = 'skins';
    const DEFAULT_SKIN = 'original';

    /** Localized copy; zh is the key-set source of truth. */
    const zh = {
      'sidebar.label': '视觉风格',
      'panel.title': '视觉风格工作室',
      'panel.subtitle': '为整个界面挑选一种视觉风格，立即生效并记住你的选择。',
      'panel.current': '使用中',
      'panel.apply': '使用',
      'panel.originalNote': '跟随你当前的浅色 / 深色配色',
      'panel.note': '风格叠加在当前主题之上，浅色与深色各有一套配色；选择「原版」可恢复默认外观。',
      'panel.back': '返回会话',
      'panel.failed': '未能应用该风格',
      'skin.original.name': '原版',
      'skin.original.desc': '保持当前的默认配色与字体。',
      'skin.pixel.name': '像素风',
      'skin.pixel.desc': '米黄纸面、硬朗黑影、零圆角与等宽字母，像一台老式掌机。',
      'skin.aurora.name': '极光',
      'skin.aurora.desc': '深空蓝紫的冷色渐变感，安静而通透。',
      'skin.paper.name': '纸墨',
      'skin.paper.desc': '暖白纸面、衬线字体与墨棕点缀，适合长文阅读。',
      'skin.neon.name': '霓虹',
      'skin.neon.desc': '暗底高饱和，洋红与青蓝互相点亮。',
    };

    /** English copy, checked complete against the zh key set. */
    const en = {
      'sidebar.label': 'Skins',
      'panel.title': 'Skin studio',
      'panel.subtitle': 'Pick a visual style for the whole app; it applies immediately and is remembered.',
      'panel.current': 'In use',
      'panel.apply': 'Use',
      'panel.originalNote': 'Follows your current light or dark palette',
      'panel.note': 'A style layers over the active theme and ships a palette for both color schemes. Choose Original to return to the default look.',
      'panel.back': 'Back to conversation',
      'panel.failed': 'Could not apply this skin',
      'skin.original.name': 'Original',
      'skin.original.desc': 'Keeps the default palette and typography.',
      'skin.pixel.name': 'Pixel',
      'skin.pixel.desc': 'Cream paper, hard black offsets, square corners, and monospaced letters.',
      'skin.aurora.name': 'Aurora',
      'skin.aurora.desc': 'Cool deep blue-violet tones with a soft, airy glow.',
      'skin.paper.name': 'Paper and ink',
      'skin.paper.desc': 'Warm paper, serif type, and sepia accents for long reading.',
      'skin.neon.name': 'Neon',
      'skin.neon.desc': 'Dark surfaces with magenta and cyan lighting each other up.',
    };

    /* ---------- shared live state ---------- */

    const listeners = new Set();
    let snapshot = Object.freeze({ skinId: DEFAULT_SKIN, scheme: 'light' });

    const skinStore = {
      getSnapshot() {
        return snapshot;
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };

    function publish(patch) {
      const next = Object.freeze({ ...snapshot, ...patch });
      if (next.skinId === snapshot.skinId && next.scheme === snapshot.scheme) return;
      snapshot = next;
      for (const listener of [...listeners]) listener();
    }

    function skinById(id) {
      return SKINS.find((skin) => skin.id === id) || SKINS[0];
    }

    function readStoredSkin() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return SKIN_IDS.includes(raw) ? raw : DEFAULT_SKIN;
      } catch {
        return DEFAULT_SKIN;
      }
    }

    function writeStoredSkin(id) {
      try {
        window.localStorage.setItem(STORAGE_KEY, id);
      } catch {
        /* a browser without storage still switches for this page load */
      }
    }

    /* ---------- palette helpers for previews ---------- */

    const PREVIEW_TOKENS = {
      base: '--dsw-alias-bg-base',
      sidebar: '--dsw-specific-sidebar-fill',
      sidebarInk: '--dsw-alias-label-secondary',
      ink: '--dsw-alias-label-primary',
      accent: '--dsw-alias-brand-primary',
      border: '--dsw-alias-border-l2',
      radius: '--dsw-radius-md',
    };

    /** Resolve one preview color for a skin in a scheme, falling back to live host tokens. */
    function previewColor(skin, key, scheme) {
      const name = PREVIEW_TOKENS[key];
      const tokens = skin.tokens;
      if (tokens !== null && tokens[name] !== undefined) return tokens[name][scheme];
      return `var(${name})`;
    }

    /* ---------- the sidebar entry icon ---------- */

    function SkinIcon(props) {
      const size = typeof props.size === 'number' && props.size > 0 ? props.size : 16;
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-hidden': 'true',
          style: { display: 'block' },
        },
        h('rect', { x: 1.5, y: 2.5, width: 13, height: 11, rx: 1.6, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('rect', { x: 3.2, y: 5.2, width: 3.2, height: 6, fill: 'currentColor' }),
        h('rect', { x: 6.9, y: 5.2, width: 2.6, height: 6, fill: 'currentColor', opacity: 0.55 }),
        h('rect', { x: 10.1, y: 5.2, width: 2.6, height: 6, fill: 'currentColor', opacity: 0.25 }),
      );
    }

    /* ---------- the mini-app preview ---------- */

    function MiniApp(props) {
      const { skin, scheme } = props;
      const color = (key) => previewColor(skin, key, scheme);
      const isOriginal = skin.tokens === null;
      const radius = isOriginal ? 'var(--dsw-radius-md)' : color('radius');

      if (isOriginal) {
        return h(
          'div',
          {
            'aria-hidden': 'true',
            style: {
              position: 'relative',
              width: '100%',
              height: '104px',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px dashed var(--dsw-alias-border-l3)',
              borderRadius: radius,
              background:
                'repeating-linear-gradient(135deg, transparent 0 6px, var(--dsw-alias-interactive-bg-hover) 6px 12px)',
              color: 'var(--dsw-alias-label-secondary)',
              font: '600 22px/1 var(--dsw-font-family)',
              letterSpacing: '0.04em',
            },
          },
          'Aa',
        );
      }

      return h(
        'div',
        {
          'aria-hidden': 'true',
          style: {
            position: 'relative',
            width: '100%',
            height: '104px',
            boxSizing: 'border-box',
            overflow: 'hidden',
            borderRadius: radius,
            background: color('base'),
            border: `1.5px solid ${color('border')}`,
            display: 'flex',
          },
        },
        h(
          'div',
          {
            style: {
              width: '42px',
              flex: 'none',
              background: color('sidebar'),
              borderRight: `1px solid ${color('border')}`,
              padding: '8px 6px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
            },
          },
          [0, 1, 2].map((row) =>
            h('div', {
              key: `nav-${row}`,
              style: {
                height: '4px',
                borderRadius: '1px',
                background: color('sidebarInk'),
                opacity: row === 0 ? 0.9 : 0.45,
              },
            }),
          ),
        ),
        h(
          'div',
          {
            style: {
              flex: '1 1 auto',
              minWidth: 0,
              padding: '10px 10px 8px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '7px',
            },
          },
          h('div', { style: { height: '6px', width: '64%', borderRadius: '1px', background: color('ink'), opacity: 0.85 } }),
          h('div', { style: { height: '4px', width: '88%', borderRadius: '1px', background: color('ink'), opacity: 0.4 } }),
          h('div', { style: { height: '4px', width: '74%', borderRadius: '1px', background: color('ink'), opacity: 0.3 } }),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: 'auto' } },
            h('div', {
              style: {
                height: '14px',
                width: '34%',
                borderRadius: radius,
                background: color('accent'),
              },
            }),
            h('div', {
              style: {
                height: '14px',
                width: '22px',
                borderRadius: radius,
                border: `1.5px solid ${color('border')}`,
              },
            }),
          ),
        ),
      );
    }

    /* ---------- the page ---------- */

    /** Subscribe the page to the shared store; the same shape works for one or two values. */
    function useSkinState(store) {
      const [state, setState] = React.useState(() => store.getSnapshot());
      React.useEffect(() => {
        const unsubscribe = store.subscribe(() => {
          const next = store.getSnapshot();
          setState((previous) =>
            previous.skinId === next.skinId && previous.scheme === next.scheme ? previous : next,
          );
        });
        setState(store.getSnapshot());
        return unsubscribe;
      }, [store]);
      return state;
    }

    /** Actions the page calls; the plugin body fills them in `apply` before registering the page. */
    const actions = {
      applySkin: () => {},
      selectConversation: () => {},
    };

    /**
     * Top inset for a main-panel entry page: macOS and Windows reserve a window
     * chrome strip that entry pages must clear (the frame publishes it in px).
     */
    function frameTopPadding() {
      return 'calc(28px + var(--dsh-frame-top-clearance, 0px))';
    }

    function SkinStudioPage(props) {
      const t = props.t;
      const state = useSkinState(skinStore);
      const skinId = state.skinId;
      const scheme = state.scheme;
      const current = skinById(skinId);
      const [failure, setFailure] = React.useState(null);

      return h(
        'div',
        {
          style: {
            boxSizing: 'border-box',
            height: '100%',
            minHeight: 0,
            overflowY: 'auto',
            padding: '28px 24px 32px',
            paddingTop: frameTopPadding(),
            background: 'var(--dsw-alias-bg-base)',
            color: 'var(--dsw-alias-label-primary)',
          },
        },
        h(
          'div',
          { style: { maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' } },
          h(
            'header',
            { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
              h('h1', {
                style: { margin: 0, font: '600 20px/28px var(--dsw-font-family)', letterSpacing: '-0.01em' },
                children: t('panel.title'),
              }),
              h(
                'span',
                {
                  style: {
                    borderRadius: '999px',
                    padding: '2px 8px',
                    border: '1px solid var(--dsw-alias-border-l2)',
                    background: 'var(--dsw-alias-bg-layer-2)',
                    color: 'var(--dsw-alias-label-secondary)',
                    font: '500 11px/16px var(--dsw-font-family)',
                  },
                },
                `${t('panel.current')}: ${t(`skin.${current.id}.name`)}`,
              ),
            ),
            h('p', {
              style: {
                margin: 0,
                color: 'var(--dsw-alias-label-secondary)',
                font: '400 13px/20px var(--dsw-font-family)',
              },
              children: t('panel.subtitle'),
            }),
          ),
          h(
            'div',
            {
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))',
                gap: '12px',
              },
            },
            SKINS.map((skin) => {
              const selected = skin.id === skinId;
              return h(
                'button',
                {
                  key: skin.id,
                  type: 'button',
                  'aria-pressed': selected,
                  'aria-label': `${t(`skin.${skin.id}.name`)} — ${selected ? t('panel.current') : t('panel.apply')}`,
                  onClick: () => {
                    try {
                      actions.applySkin(skin.id);
                      setFailure(null);
                    } catch (error) {
                      setFailure(error instanceof Error ? error.message : String(error));
                    }
                  },
                  style: {
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '12px',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'var(--dsw-alias-label-primary)',
                    background: selected ? 'var(--dsw-alias-bg-layer-2)' : 'var(--dsw-alias-bg-layer-1)',
                    border: selected
                      ? '1.5px solid var(--dsw-alias-brand-primary)'
                      : '1px solid var(--dsw-alias-border-l2)',
                    borderRadius: 'var(--dsw-radius-lg)',
                    boxShadow: selected ? '0 0 0 1px var(--dsw-alias-brand-primary)' : 'none',
                    transition: 'background 120ms ease, border-color 120ms ease',
                  },
                },
                h(MiniApp, { skin, scheme }),
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' } },
                  h('span', {
                    style: { font: '600 14px/20px var(--dsw-font-family)' },
                    children: t(`skin.${skin.id}.name`),
                  }),
                  selected
                    ? h('span', {
                        style: {
                          marginLeft: 'auto',
                          font: '600 11px/16px var(--dsw-font-family)',
                          color: 'var(--dsw-alias-brand-primary)',
                        },
                        children: t('panel.current'),
                      })
                    : null,
                ),
                h('span', {
                  style: {
                    color: 'var(--dsw-alias-label-secondary)',
                    font: '400 12px/18px var(--dsw-font-family)',
                  },
                  children: t(`skin.${skin.id}.desc`),
                }),
                skin.id === 'original'
                  ? h('span', {
                      style: { color: 'var(--dsw-alias-label-tertiary)', font: '400 11px/16px var(--dsw-font-family)' },
                      children: t('panel.originalNote'),
                    })
                  : null,
              );
            }),
          ),
          h(
            'footer',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
                paddingTop: '4px',
                color: 'var(--dsw-alias-label-secondary)',
                font: '400 12px/18px var(--dsw-font-family)',
              },
            },
            h('p', { style: { margin: 0, flex: '1 1 240px' }, children: t('panel.note') }),
            failure === null
              ? null
              : h('p', {
                  role: 'status',
                  style: {
                    margin: 0,
                    flex: '1 1 240px',
                    color: 'var(--dsw-alias-state-error-primary)',
                    font: '400 12px/18px var(--dsw-font-family)',
                  },
                  children: `${t('panel.failed')}: ${failure}`,
                }),
            h(
              'button',
              {
                type: 'button',
                onClick: actions.selectConversation,
                style: {
                  font: '500 12px/18px var(--dsw-font-family)',
                  color: 'var(--dsw-alias-label-primary)',
                  background: 'var(--dsw-alias-bg-layer-2)',
                  border: '1px solid var(--dsw-alias-border-l2)',
                  borderRadius: 'var(--dsw-radius-md)',
                  padding: '5px 12px',
                  cursor: 'pointer',
                },
              },
              '\u2190 ' + t('panel.back'),
            ),
          ),
        ),
      );
    }

    /* ---------- plugin body ---------- */

    return {
      inject: ['slots', 'theme', 'locale'],
      apply(ctx) {
        ctx.effect(
          () =>
            ctx.locale.register(NS, { zh, en }),
          'skin-studio: dictionaries',
        );
        const t = ctx.locale.bind(NS);

        let currentOverride = null;

        function applySkin(id, persist = true) {
          const skin = SKIN_IDS.includes(id) ? skinById(id) : skinById(DEFAULT_SKIN);
          if (currentOverride !== null) {
            currentOverride();
            currentOverride = null;
          }
          if (skin.tokens !== null) {
            try {
              currentOverride = ctx.theme.overrideTokens(SOURCE, skin.tokens);
            } catch (error) {
              currentOverride = null;
              throw error;
            }
          }
          if (persist) writeStoredSkin(skin.id);
          publish({ skinId: skin.id });
        }

        ctx.effect(() => {
          try {
            applySkin(readStoredSkin(), false);
          } catch (error) {
            /* a rejected layer must not stop the page from mounting */
            window.console?.error?.('[skin-studio] could not apply the stored skin', error);
          }
          return () => {
            if (currentOverride !== null) {
              currentOverride();
              currentOverride = null;
            }
          };
        }, 'skin-studio: active skin layer');

        ctx.on('theme/change', (next) => {
          publish({ scheme: next.active.colorScheme });
        });
        publish({ scheme: ctx.theme.getTheme().active.colorScheme });

        actions.applySkin = applySkin;
        actions.selectConversation = () => {
          const layout = ctx.get('layout');
          if (layout !== undefined) layout.selectPanel(null);
        };

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 5,
              label: () => t('sidebar.label'),
            },
            SkinIcon,
          ),
        );

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
            },
            SkinStudioPage,
          ),
        );
      },
    };
  },
});
