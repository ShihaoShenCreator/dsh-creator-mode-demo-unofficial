/**
 * Client half of the Transformer 3D lab.
 *
 * One module factory registered through `window.__ModuleLoader__.load`. It
 * contributes two things to the Harness Web UI:
 *
 *   1. a `sidebar.panellist` entry whose id addresses the main panel, and
 *   2. the `main` panel keyed by that same id, which hosts the lab.
 *
 * The math engine, the canvas renderer and the scene builder are inlined by
 * `build.mjs`, so the installed bundle ships a single plain-JS file.
 */
window.__ModuleLoader__.load({
  id: '@local/transformer-3d-lab',
  factory(require) {
    'use strict'

    const React = require('react')
    const h = React.createElement

    // #region inlined:engine
    // #endregion inlined:engine
    // #region inlined:render3d
    // #endregion inlined:render3d
    // #region inlined:scene
    // #endregion inlined:scene

    const PANEL_KEY = 'transformer-3d-lab'
    const SIDEBAR_ORDER = 20

    const STRINGS = {
      zh: {
        title: 'Transformer 3D 实验台',
        subtitle: '一次前向传播，从词嵌入走到下一个词的预测',
        tabEntry: '实验台',
        prompt: '提示词',
        stage: '步骤',
        prev: '上一步',
        next: '下一步',
        restart: '重来',
        orbitHint: '拖拽旋转 · 滚轮缩放 · 双击复位',
        resetView: '复位视角',
        checkWeights: '再靠近一点',
        sumLabel: '之和',
        yourWeights: '你的权重',
        modelWeights: '模型权重',
        showModel: '看模型答案',
        hideModel: '藏起模型答案',
        verdictClose: '非常接近模型',
        verdictFair: '方向对了',
        verdictOff: '还差一点',
        pickToken: '选一个你押注的词',
        reveal: '揭晓',
        correct: '答对了',
        wrong: '猜错了',
        prize: '得分',
        betAgain: '再押一次',
      },
      en: {
        title: 'Transformer 3D lab',
        subtitle: 'One forward pass, from token embeddings to the predicted next token',
        tabEntry: 'Lab',
        prompt: 'Prompt',
        stage: 'Step',
        prev: 'Back',
        next: 'Next',
        restart: 'Restart',
        orbitHint: 'Drag to orbit · wheel to zoom · double-click to reset',
        resetView: 'Reset view',
        checkWeights: 'Get closer',
        sumLabel: 'sum',
        yourWeights: 'Your weights',
        modelWeights: 'Model weights',
        showModel: 'Show model answer',
        hideModel: 'Hide model answer',
        verdictClose: 'Very close to the model',
        verdictFair: 'Right direction',
        verdictOff: 'A little off',
        pickToken: 'Bet on one token',
        reveal: 'Reveal',
        correct: 'Correct',
        wrong: 'Missed',
        prize: 'Score',
        betAgain: 'Bet again',
      },
    }

    const STAGE_TEXT = {
      zh: {
        embed: ['词嵌入', '每个词变成一个 8 维向量；柱子的高低是数值大小，向上为正、向下为负。'],
        position: ['位置编码', '再叠加一组按位置变化的波，让同一个词在不同位置有不同的表示。'],
        qkv: ['查询 · 键 · 值', '每个位置投影出 Q（我要找什么）、K（我能提供什么）、V（我给出什么）。'],
        attention: ['注意力分数', '最后一个 “the” 作为查询，与各个位置做点积，分数决定它看向谁。'],
        softmax: ['权重归一化', '把分数变成和为 1 的权重。拖动滑杆，猜一猜模型的注意力分布。'],
        context: ['加权求和', '按权重把 V 加权求和并拼接，得到这个 “the” 读到的上下文。'],
        ffn: ['前馈网络', '8 维 → 16 个隐藏单元 → 8 维。第 0 号单元把“家具”维度写回残差流。'],
        predict: ['预测下一个词', '把残差投影回词表并 softmax，选一个词看模型押注什么。'],
        summary: ['整条链路', '词嵌入 → 位置 → Q/K/V → 注意力 → 上下文 → 前馈 → 词表概率。'],
      },
      en: {
        embed: ['Token embeddings', 'Each token becomes an 8-dim vector; bar height is magnitude, up positive, down negative.'],
        position: ['Positional encoding', 'A position-dependent wave is added, so the same word differs by position.'],
        qkv: ['Query, key, value', 'Each position projects a query (what I seek), a key (what I offer) and a value (what I hand over).'],
        attention: ['Attention scores', 'The final “the” as a query takes dot products with every position; the score decides where it looks.'],
        softmax: ['Normalize weights', 'Scores become weights summing to 1. Drag the sliders to guess the model’s distribution.'],
        context: ['Weighted sum', 'Values are weighted-summed and concatenated: the context this “the” reads.'],
        ffn: ['Feed-forward', '8 dims → 16 hidden units → 8 dims. Unit 0 writes furniture-ness into the residual stream.'],
        predict: ['Predict the next token', 'The residual is projected onto the vocabulary and softmaxed; bet on a token.'],
        summary: ['Whole pipeline', 'Embeddings → positions → Q/K/V → attention → context → feed-forward → vocabulary.'],
      },
    }

    const CANDIDATE_TOKENS = ['mat', 'rug', 'chair', 'the', 'cat', 'dog']

    /**
     * Insert the panel stylesheet as a package-owned <style> element. Static
     * bundle client modules only get `react` from the module table, so this
     * does not use the dynamic-client `styles` builtin. The returned disposer
     * removes the element, and the caller registers it inside `ctx.effect`.
     */
    function insertStyles(css) {
      try {
        const element = document.createElement('style')
        element.setAttribute('data-dsh-plugin-css', 'transformer-3d-lab')
        element.textContent = css
        document.head.appendChild(element)
        return () => {
          if (element.parentNode) element.parentNode.removeChild(element)
        }
      } catch (caught) {
        console.error('transformer-3d-lab: style insertion failed', caught)
        return () => {}
      }
    }

    const CSS = `
.dsh-ts3d-page {
  box-sizing: border-box; display: flex; flex-direction: column;
  width: 100%; height: 100%; min-height: 0;
  color: var(--dsw-alias-label-primary); font-family: inherit; overflow: hidden;
  /* Title-bar clearance. The shell pads the content area on Windows through
     --dsh-windows-titlebar-height, and paints no padding on macOS where the
     native traffic lights float above the content. The panel therefore owns
     its top inset, measured at runtime and passed in as --dsh-wts3d-top:
     the title row and the toolbar always start below the window buttons. */
  padding: var(--dsh-wts3d-top, 30px) 18px 14px;
  background: var(--dsw-alias-bg-base);
}
.dsh-ts3d-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; flex: 0 0 auto; min-width: 0;
}
.dsh-ts3d-heading { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.dsh-ts3d-title { font-size: 17px; line-height: 1.3; font-weight: 650; letter-spacing: -0.01em; }
.dsh-ts3d-subtitle { font-size: 12px; line-height: 1.4; color: var(--dsw-alias-label-secondary); }
.dsh-ts3d-headerActions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.dsh-ts3d-chip {
  appearance: none; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary); border-radius: 8px; padding: 5px 10px;
  font: inherit; font-size: 12px; line-height: 1.4; cursor: pointer; white-space: nowrap;
}
.dsh-ts3d-chip:hover { border-color: var(--dsw-alias-border-l2); }
.dsh-ts3d-chip[data-active="true"] { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.dsh-ts3d-chip:focus-visible, .dsh-ts3d-primary:focus-visible, .dsh-ts3d-secondary:focus-visible,
.dsh-ts3d-stageItem:focus-visible, .dsh-ts3d-slider:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px;
}
.dsh-ts3d-body { display: flex; flex: 1 1 auto; gap: 14px; min-height: 0; margin-top: 12px; }
.dsh-ts3d-stageWrap {
  position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; border-radius: 12px;
  overflow: hidden; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
}
.dsh-ts3d-body > .dsh-ts3d-stageWrap { min-height: 260px; }
.dsh-ts3d-canvas { display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; }
.dsh-ts3d-canvas:active { cursor: grabbing; }
.dsh-ts3d-overlayHint {
  position: absolute; left: 10px; bottom: 9px; margin: 0; padding: 3px 8px;
  font-size: 11px; line-height: 1.5; border-radius: 6px;
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-overlay);
  border: 1px solid var(--dsw-alias-border-l1); pointer-events: none; max-width: calc(100% - 20px);
}
.dsh-ts3d-inlineError {
  display: flex; align-items: center; justify-content: center; padding: 24px;
  text-align: center; font-size: 13px; color: var(--dsw-alias-state-error-primary);
}
.dsh-ts3d-side { display: flex; flex-direction: column; gap: 10px; width: 272px; flex: 0 0 auto; min-height: 0; overflow-y: auto; }
.dsh-ts3d-card {
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1); padding: 10px 11px; flex: 0 0 auto;
}
.dsh-ts3d-cardTitle {
  margin: 0 0 6px; font-size: 11px; letter-spacing: .05em; text-transform: uppercase;
  color: var(--dsw-alias-label-secondary); font-weight: 600;
}
.dsh-ts3d-stageList { display: flex; flex-direction: column; gap: 1px; margin: 0; padding: 0; list-style: none; }
.dsh-ts3d-stageItem {
  display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
  appearance: none; border: 0; background: transparent; color: inherit; font: inherit;
  font-size: 12px; line-height: 1.5; padding: 4px 7px; border-radius: 7px; cursor: pointer;
}
.dsh-ts3d-stageItem:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-ts3d-stageItem[data-active="true"] { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-brand-primary); font-weight: 600; }
.dsh-ts3d-stageItem[data-done="true"] .dsh-ts3d-stageIndex { color: var(--dsw-alias-state-success-primary); }
.dsh-ts3d-stageIndex { flex: 0 0 auto; width: 18px; font-size: 11px; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); }
.dsh-ts3d-stageName { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-ts3d-info { margin: 0; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.dsh-ts3d-readout { display: flex; flex-direction: column; gap: 5px; font-size: 12px; }
.dsh-ts3d-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; min-width: 0; }
.dsh-ts3d-rowKey { color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-ts3d-rowValue { font-variant-numeric: tabular-nums; text-align: right; flex: 0 0 auto; }
.dsh-ts3d-meterRow { display: grid; grid-template-columns: 58px 1fr 42px; align-items: center; gap: 7px; }
.dsh-ts3d-meterLabel { font-size: 11px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-ts3d-meterTrack { position: relative; height: 6px; border-radius: 3px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.dsh-ts3d-meterFill { position: absolute; top: 0; bottom: 0; left: 50%; border-radius: 3px; }
.dsh-ts3d-meterFill[data-sign="neg"] { transform: translateX(-100%); }
.dsh-ts3d-meterValue { font-size: 11px; font-variant-numeric: tabular-nums; text-align: right; }
.dsh-ts3d-sliderRow { display: grid; grid-template-columns: 48px 1fr 40px; align-items: center; gap: 8px; }
.dsh-ts3d-sliderLabel { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-ts3d-slider { width: 100%; margin: 0; accent-color: var(--dsw-alias-brand-primary); }
.dsh-ts3d-sliderValue { font-size: 11px; font-variant-numeric: tabular-nums; text-align: right; color: var(--dsw-alias-label-secondary); }
.dsh-ts3d-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex: 0 0 auto; margin-top: 12px; flex-wrap: wrap; }
.dsh-ts3d-nav { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; }
.dsh-ts3d-primary {
  appearance: none; border: 1px solid var(--dsw-alias-brand-primary); border-radius: 8px;
  background: var(--dsw-alias-brand-primary); color: #fff; font: inherit; font-size: 12px;
  line-height: 1.4; padding: 6px 14px; cursor: pointer;
}
.dsh-ts3d-primary:hover:not(:disabled) { filter: brightness(1.06); }
.dsh-ts3d-primary:disabled { opacity: .45; cursor: default; }
.dsh-ts3d-secondary {
  appearance: none; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
  background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px;
  line-height: 1.4; padding: 6px 12px; cursor: pointer;
}
.dsh-ts3d-secondary:hover:not(:disabled) { border-color: var(--dsw-alias-border-l2); }
.dsh-ts3d-secondary:disabled { opacity: .45; cursor: default; }
.dsh-ts3d-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.dsh-ts3d-badgeDot { width: 6px; height: 6px; border-radius: 3px; background: var(--dsw-alias-state-success-primary); }
.dsh-ts3d-verdict { font-size: 12px; line-height: 1.5; border-radius: 7px; padding: 6px 9px; border: 1px solid transparent; }
.dsh-ts3d-verdict[data-verdict="close"] { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
.dsh-ts3d-verdict[data-verdict="fair"] { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }
.dsh-ts3d-verdict[data-verdict="off"] { color: var(--dsw-alias-label-secondary); border-color: var(--dsw-alias-border-l1); }
.dsh-ts3d-icon { width: 16px; height: 16px; display: block; }
@media (max-width: 1020px) {
  .dsh-ts3d-body { flex-direction: column; }
  .dsh-ts3d-side { width: auto; flex: 0 1 auto; max-height: 46%; }
  .dsh-ts3d-stageWrap { min-height: 300px; }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-ts3d-page *, .dsh-ts3d-page *::before { animation-duration: .001ms !important; transition-duration: .001ms !important; }
}
`

    /* ------------------------------------------------------------------ *
     * Small helpers
     * ------------------------------------------------------------------ */

    function pickLanguage(ctx) {
      try {
        const locale = ctx.get('locale')
        if (locale && typeof locale.getLocale === 'function') {
          const snapshot = locale.getLocale()
          const active = snapshot && snapshot.active
          if (typeof active === 'string' && active.toLowerCase().indexOf('zh') === 0) return 'zh'
        }
      } catch (caught) { void caught }
      return 'en'
    }

    function useLanguage(ctx) {
      const [lang, setLang] = React.useState(() => pickLanguage(ctx))
      React.useEffect(() => {
        const locale = ctx.get('locale')
        if (!locale || typeof locale.subscribe !== 'function') return undefined
        let alive = true
        setLang(pickLanguage(ctx))
        const stop = locale.subscribe(() => { if (alive) setLang(pickLanguage(ctx)) })
        return () => { alive = false; if (typeof stop === 'function') stop() }
      }, [ctx])
      return lang
    }

    function readPlatform() {
      try {
        const declared = document.documentElement.getAttribute('data-platform')
        if (declared) return declared
        const ua = navigator.userAgent || ''
        if (/Macintosh|Mac OS X/i.test(ua)) return 'darwin'
        if (/Windows/i.test(ua)) return 'win32'
        return 'web'
      } catch (caught) {
        return 'web'
      }
    }

    /**
     * The panel's own top inset.
     *
     * macOS: the native traffic lights float over the content and the frame
     * paints no title-bar padding, so the panel must reserve the button
     * cluster's height itself (28 px buttons + a small margin). The value is
     * read at runtime — the shell's `--dsh-frame-top-clearance` when it is
     * exposed, else the Window Controls Overlay rect, else 34 px — and re-read
     * on resize so a fullscreen toggle cannot leave the title under the
     * buttons.
     *
     * Windows: the shell already pads the content area by
     * `--dsh-windows-titlebar-height`, so the panel adds only a small gap and
     * never stacks a second title-bar-sized block on top.
     */
    function useTopInset() {
      const [state, setState] = React.useState(() => {
        const platform = readPlatform()
        return { platform, inset: platform === 'darwin' ? 34 : 10 }
      })
      React.useEffect(() => {
        const measure = () => {
          const platform = readPlatform()
          if (platform !== 'darwin') {
            setState({ platform, inset: 10 })
            return
          }
          let inset = 34
          try {
            const css = getComputedStyle(document.documentElement)
            const declared = parseFloat(css.getPropertyValue('--dsh-frame-top-clearance'))
            if (Number.isFinite(declared) && declared > 0) inset = Math.max(inset, declared)
            const overlay = navigator.windowControlsOverlay
            if (overlay && typeof overlay.getTitlebarAreaRect === 'function') {
              const rect = overlay.getTitlebarAreaRect()
              if (rect && rect.height > 0) inset = Math.max(inset, Math.ceil(rect.height) + 8)
            }
          } catch (caught) { void caught }
          setState({ platform, inset })
        }
        measure()
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
      }, [])
      return state
    }

    function deterministicOrder(list) {
      const copy = list.slice()
      let seed = 7
      for (let i = copy.length - 1; i > 0; i--) {
        seed = (seed * 1103515245 + 12345) % 2147483648
        const j = seed % (i + 1)
        const swap = copy[i]
        copy[i] = copy[j]
        copy[j] = swap
      }
      return copy
    }

    function formatNumber(value) {
      if (!Number.isFinite(value)) return '—'
      return Math.abs(value) < 10 && value !== 0 ? value.toFixed(2) : value.toFixed(1)
    }

    function stageCopyFor(lang, stageId) {
      const table = STAGE_TEXT[lang] || STAGE_TEXT.en
      return table[stageId] || STAGE_TEXT.en[stageId] || ['', '']
    }

    /* ------------------------------------------------------------------ *
     * Icons
     * ------------------------------------------------------------------ */

    function LabIcon(props) {
      const size = props && typeof props.size === 'number' ? props.size : 16
      return h('svg', {
        className: 'dsh-ts3d-icon', width: size, height: size, viewBox: '0 0 24 24',
        'aria-hidden': true, focusable: 'false',
      },
      h('path', { d: 'M12 3 3.2 7.4 12 11.8 20.8 7.4 12 3Z', fill: 'currentColor', opacity: '0.95' }),
      h('path', { d: 'M3.2 11.4 12 15.8 20.8 11.4', stroke: 'currentColor', strokeWidth: '1.6', fill: 'none', opacity: '0.62' }),
      h('path', { d: 'M3.2 15.4 12 19.8 20.8 15.4', stroke: 'currentColor', strokeWidth: '1.6', fill: 'none', opacity: '0.36' }))
    }

    /* ------------------------------------------------------------------ *
     * Canvas bridge
     * ------------------------------------------------------------------ */

    function drawOp(renderer, op) {
      switch (op.kind) {
        case 'bar':
          renderer.bar({
            base: op.base, height: op.height, width: op.width, depth: op.depth,
            color: op.color, opacity: op.opacity, wire: op.wire, wireColor: op.wireColor,
            label: op.label, labelColor: op.labelColor, labelSize: op.labelSize,
          })
          break
        case 'box':
          renderer.box({
            center: op.center, size: op.size, color: op.color, opacity: op.opacity,
            wire: op.wire, wireColor: op.wireColor, label: op.label,
            labelColor: op.labelColor, labelSize: op.labelSize,
          })
          break
        case 'beam':
          renderer.beam({
            from: op.from, to: op.to, color: op.color, width: op.width,
            opacity: op.opacity, arrow: op.arrow,
          })
          break
        case 'dot':
          renderer.dot({ center: op.center, radius: op.radius, color: op.color, opacity: op.opacity })
          break
        case 'quad':
          renderer.quad({
            points: op.points, color: op.color, opacity: op.opacity,
            stroke: op.stroke, strokeWidth: op.strokeWidth,
          })
          break
        case 'text':
          renderer.text({
            position: op.position, text: op.text, color: op.color, size: op.size,
            anchor: op.anchor, weight: op.weight, baseline: op.baseline, plate: op.plate,
          })
          break
        default:
          break
      }
    }

    function StageCanvas(props) {
      const { stageIndex, trace, ui, strings } = props
      const wrapRef = React.useRef(null)
      const canvasRef = React.useRef(null)
      const rendererRef = React.useRef(null)
      const orbitRef = React.useRef(null)
      const resetRef = React.useRef(props.onResetAvailable)
      const cameraRef = React.useRef(STAGES[stageIndex].camera)
      const uiRef = React.useRef(ui)
      const drawRef = React.useRef(null)
      const [failure, setFailure] = React.useState('')

      uiRef.current = ui
      resetRef.current = props.onResetAvailable

      const draw = React.useCallback(() => {
        const renderer = rendererRef.current
        if (!renderer) return
        let scene
      try {
        scene = buildScene(trace, stageIndex, uiRef.current)
      } catch (caught) {
        setFailure(String(caught && caught.message ? caught.message : caught))
        return
      }
      renderer.setCamera(cameraRef.current)
      renderer.begin()
      for (let i = 0; i < scene.ops.length; i++) drawOp(renderer, scene.ops[i])
      renderer.end()
      }, [trace, stageIndex])

      drawRef.current = draw

      React.useEffect(() => {
        const canvas = canvasRef.current
        const wrap = wrapRef.current
        if (!canvas || !wrap) return undefined
        let renderer
        try {
          renderer = createRenderer(canvas)
        } catch (caught) {
          setFailure(String(caught && caught.message ? caught.message : caught))
          return undefined
        }
        rendererRef.current = renderer

        const measure = () => {
          renderer.setSize(wrap.clientWidth, wrap.clientHeight, window.devicePixelRatio || 1)
          drawRef.current()
        }
        measure()

        const orbit = attachOrbit(renderer, canvas, {
          yaw: cameraRef.current.yaw,
          pitch: cameraRef.current.pitch,
          distance: cameraRef.current.distance,
          target: cameraRef.current.target,
          minDistance: 4,
          maxDistance: 30,
          onChange: () => {
            cameraRef.current = renderer.getCamera()
            drawRef.current()
          },
        })
        orbitRef.current = orbit

        const releaseView = () => {
          if (orbitRef.current) orbitRef.current.reset()
          cameraRef.current = STAGES[stageIndex].camera
          drawRef.current()
        }
        if (typeof resetRef.current === 'function') resetRef.current(releaseView)

        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
        if (observer) observer.observe(wrap)
        const onWindowResize = () => measure()
        window.addEventListener('resize', onWindowResize)

        return () => {
          window.removeEventListener('resize', onWindowResize)
          if (observer) observer.disconnect()
          if (typeof resetRef.current === 'function') resetRef.current(null)
          if (orbitRef.current && typeof orbitRef.current.dispose === 'function') orbitRef.current.dispose()
          orbitRef.current = null
          if (rendererRef.current && typeof rendererRef.current.dispose === 'function') rendererRef.current.dispose()
          rendererRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      React.useEffect(() => {
        const nextCamera = STAGES[stageIndex].camera
        cameraRef.current = nextCamera
        if (orbitRef.current && typeof orbitRef.current.retarget === 'function') {
          /* Keep the player's orbit angles, move the focus to the new stage. */
          orbitRef.current.retarget(nextCamera.target, nextCamera.distance)
        } else if (rendererRef.current) {
          rendererRef.current.setCamera(nextCamera)
        }
        draw()
      }, [stageIndex, draw])

      React.useEffect(() => { draw() }, [ui, draw])

      const onDoubleClick = React.useCallback(() => {
        cameraRef.current = STAGES[stageIndex].camera
        if (orbitRef.current) orbitRef.current.reset()
        draw()
      }, [stageIndex, draw])

      return h('div', { className: 'dsh-ts3d-stageWrap', ref: wrapRef },
        h('canvas', {
          ref: canvasRef, className: 'dsh-ts3d-canvas', role: 'img',
          'aria-label': `3D stage: ${STAGES[stageIndex].id}`,
          onDoubleClick,
        }),
        h('p', { className: 'dsh-ts3d-overlayHint' }, strings.orbitHint),
        failure !== '' ? h('div', { className: 'dsh-ts3d-inlineError' }, failure) : null)
    }

    /* ------------------------------------------------------------------ *
     * Readouts and mini-games
     * ------------------------------------------------------------------ */

    function MeterRow(props) {
      const { label, value, color, max } = props
      const limit = max === undefined ? 1 : Math.max(1e-6, max)
      const ratio = Math.min(1, Math.abs(value) / limit)
      return h('div', { className: 'dsh-ts3d-meterRow' },
        h('span', { className: 'dsh-ts3d-meterLabel', title: label }, label),
        h('span', { className: 'dsh-ts3d-meterTrack' },
          h('span', {
            className: 'dsh-ts3d-meterFill',
            'data-sign': value < 0 ? 'neg' : 'pos',
            style: { width: `${ratio * 50}%`, background: color },
          })),
        h('span', { className: 'dsh-ts3d-meterValue' }, formatNumber(value)))
    }

    function SoftmaxGame(props) {
      const { trace, ui, setUi, strings, onScored } = props
      const modelRow = trace.attentionWeights[trace.tokens.length - 1]
      /* Until the player touches a slider the guess is flat: showing the model
         row as the starting point would hand them the answer. */
      const uniform = 1 / trace.tokens.length
      const guess = ui.weights || trace.tokens.map(() => uniform)
      const total = guess.reduce((acc, value) => acc + value, 0)
      const normalized = total > 0
        ? guess.map((value) => value / total)
        : guess.map(() => 1 / guess.length)
      const result = attentionGuessScore(trace, trace.tokens.length - 1, guess)
      const showModel = ui.showModel === true
      const submitted = ui.submitted === true

      return h('div', { className: 'dsh-ts3d-readout' },
        h('div', { className: 'dsh-ts3d-row' },
          h('span', { className: 'dsh-ts3d-rowKey' }, strings.yourWeights),
          h('span', { className: 'dsh-ts3d-rowValue' }, `${strings.sumLabel} ${(total * 100).toFixed(0)}%`)),
        trace.tokens.map((token, index) => h('div', { key: `w-${index}`, className: 'dsh-ts3d-sliderRow' },
          h('span', { className: 'dsh-ts3d-sliderLabel' }, token),
          h('input', {
            className: 'dsh-ts3d-slider', type: 'range', min: 0, max: 100, step: 1,
            value: Math.round((guess[index] || 0) * 100),
            'aria-label': `${strings.yourWeights} · ${token}`,
            onChange: (event) => {
              const next = guess.slice()
              next[index] = Number(event.currentTarget.value) / 100
              setUi((prev) => ({ ...prev, weights: next }))
            },
          }),
          h('span', { className: 'dsh-ts3d-sliderValue' }, `${(normalized[index] * 100).toFixed(0)}%`))),
        showModel
          ? h('div', { className: 'dsh-ts3d-readout', key: 'model' },
            h('div', { className: 'dsh-ts3d-row' },
              h('span', { className: 'dsh-ts3d-rowKey' }, strings.modelWeights),
              h('span', { className: 'dsh-ts3d-rowValue' }, '')),
            modelRow.map((weight, index) => h('div', { key: `m-${index}`, className: 'dsh-ts3d-row' },
              h('span', { className: 'dsh-ts3d-rowKey' }, trace.tokens[index]),
              h('span', { className: 'dsh-ts3d-rowValue' }, `${(weight * 100).toFixed(1)}%`))))
          : null,
        h('div', { className: 'dsh-ts3d-verdict', 'data-verdict': result.verdict },
          `${verdictText(strings, result.verdict)} · ${(result.score * 100).toFixed(0)}%`),
        h('div', { className: 'dsh-ts3d-nav' },
          h('button', {
            type: 'button', className: 'dsh-ts3d-secondary',
            onClick: () => setUi((prev) => ({ ...prev, showModel: prev.showModel !== true })),
          }, showModel ? strings.hideModel : strings.showModel),
          h('button', {
            type: 'button', className: 'dsh-ts3d-primary',
            onClick: () => {
              setUi((prev) => ({ ...prev, submitted: true }))
              onScored(Math.round(result.score * 100))
            },
          }, strings.checkWeights)),
        submitted && result.verdict === 'close'
          ? h('div', { className: 'dsh-ts3d-verdict', 'data-verdict': 'close' }, strings.verdictClose)
          : null)
    }

    function PredictGame(props) {
      const { trace, ui, setUi, strings, onScored } = props
      const revealed = ui.revealed === true
      const chosen = ui.choice
      const result = chosen === undefined ? null : nextTokenScore(trace, chosen)
      const topEntry = trace.distribution.find((entry) => entry.token === trace.top1)

      const tokenRow = h('div', { className: 'dsh-ts3d-nav' },
        deterministicOrder(CANDIDATE_TOKENS).map((token) => h('button', {
          key: token, type: 'button',
          className: chosen === token ? 'dsh-ts3d-primary' : 'dsh-ts3d-secondary',
          onClick: () => setUi((prev) => ({ ...prev, choice: token, revealed: false })),
        }, token)))

      const actionRow = h('div', { className: 'dsh-ts3d-nav' },
        h('button', {
          type: 'button', className: 'dsh-ts3d-primary', disabled: chosen === undefined,
          onClick: () => {
            setUi((prev) => ({ ...prev, revealed: true }))
            if (result && result.correct) onScored(1)
          },
        }, revealed ? strings.betAgain : strings.reveal))

      const verdict = result && revealed
        ? h('div', { className: 'dsh-ts3d-verdict', 'data-verdict': result.correct ? 'close' : 'off' },
          result.correct
            ? `${strings.correct} · ${result.top1} ${(result.chosenProb * 100).toFixed(1)}%`
            : `${strings.wrong} · ${strings.modelWeights}: ${result.top1} ${(topEntry.prob * 100).toFixed(1)}%`)
        : null

      return h('div', { className: 'dsh-ts3d-readout' },
        h('p', { className: 'dsh-ts3d-cardTitle', style: { margin: '0' } }, strings.pickToken),
        tokenRow,
        actionRow,
        verdict)
    }

    function verdictText(strings, verdict) {
      if (verdict === 'close') return strings.verdictClose
      if (verdict === 'fair') return strings.verdictFair
      return strings.verdictOff
    }

    function Inspector(props) {
      const { stageIndex, trace, ui, strings, setUi, setScore, lang } = props
      const stage = STAGES[stageIndex]
      const copy = stageCopyFor(lang, stage.id)
      const model = inspectorModel(trace, stageIndex, ui, null)
      const bars = model.bars || []
      const maxAbs = bars.length > 0 ? Math.max(...bars.map((bar) => Math.abs(bar.value)), 1e-6) : 1

      const scored = (value) => {
        setScore((prev) => ({ attention: Math.max(prev.attention, value), predict: prev.predict }))
      }

      return h('div', { className: 'dsh-ts3d-side' },
        h('div', { className: 'dsh-ts3d-card' },
          h('p', { className: 'dsh-ts3d-cardTitle' }, copy[0]),
          h('p', { className: 'dsh-ts3d-info' }, copy[1])),
        h('div', { className: 'dsh-ts3d-card dsh-ts3d-readout' },
          h('p', { className: 'dsh-ts3d-cardTitle' }, model.title),
          bars.length > 0
            ? bars.map((bar, index) => h(MeterRow, {
              key: `${bar.label}-${index}`, label: bar.label, value: bar.value, color: bar.color, max: maxAbs,
            }))
            : (model.rows || []).map((row, index) => h('div', { key: `${row[0]}-${index}`, className: 'dsh-ts3d-row' },
              h('span', { className: 'dsh-ts3d-rowKey' }, row[0]),
              h('span', { className: 'dsh-ts3d-rowValue' }, row[1]))),
          model.score !== undefined && model.score !== null && typeof model.score !== 'object'
            ? h('div', { className: 'dsh-ts3d-row' },
              h('span', { className: 'dsh-ts3d-rowKey' }, 'score'),
              h('span', { className: 'dsh-ts3d-rowValue' }, String(model.score)))
            : null),
        stage.miniGame === 'attention'
          ? h('div', { className: 'dsh-ts3d-card dsh-ts3d-readout' },
            h(SoftmaxGame, { trace, ui, setUi, strings, onScored: scored }))
          : null,
        stage.miniGame === 'predict'
          ? h('div', { className: 'dsh-ts3d-card dsh-ts3d-readout' },
            h(PredictGame, { trace, ui, setUi, strings, onScored: scored }))
          : null)
    }

    /* ------------------------------------------------------------------ *
     * Panel
     * ------------------------------------------------------------------ */

    /**
     * Build a panel component bound to the plugin context. Called once per
     * registration so the component identity is stable for React.
     */
    function makePanel(ctx) {
      function LabPanel() {
      const lang = useLanguage(ctx)
      const strings = STRINGS[lang] || STRINGS.en
      const { platform, inset } = useTopInset()
      const [promptIndex, setPromptIndex] = React.useState(0)
      const [stageIndex, setStageIndex] = React.useState(0)
      const [ui, setUi] = React.useState({ head: 0, showModel: false, revealed: false })
      const [score, setScore] = React.useState({ attention: 0, predict: 0 })
      const resetViewRef = React.useRef(null)
      const trace = React.useMemo(() => buildForward(PROMPTS[promptIndex]), [promptIndex])

      const stage = STAGES[stageIndex]
      const copy = stageCopyFor(lang, stage.id)
      const pageStyle = { '--dsh-wts3d-top': `${inset}px` }

      const gotoStage = (next) => {
        setStageIndex(Math.max(0, Math.min(STAGES.length - 1, next)))
        setUi((prev) => ({ ...prev, revealed: false }))
      }

      const onResetAvailable = React.useCallback((fn) => { resetViewRef.current = fn }, [])

      const promptRow = h('div', { className: 'dsh-ts3d-headerActions' },
        PROMPTS.map((tokens, index) => h('button', {
          key: `prompt-${index}`, type: 'button',
          className: 'dsh-ts3d-chip',
          'data-active': promptIndex === index ? 'true' : 'false',
          'aria-pressed': promptIndex === index ? 'true' : 'false',
          onClick: () => {
            setPromptIndex(index)
            setStageIndex(0)
            setUi({ head: 0, showModel: false, revealed: false })
            setScore({ attention: 0, predict: 0 })
          },
        }, tokens.join(' '))),
        h('button', {
          type: 'button', className: 'dsh-ts3d-chip',
          onClick: () => { if (resetViewRef.current) resetViewRef.current() },
        }, strings.resetView))

      return h('div', {
        className: 'dsh-ts3d-page', 'data-platform': platform, style: pageStyle,
      },
      h('header', { className: 'dsh-ts3d-header' },
        h('div', { className: 'dsh-ts3d-heading' },
          h('span', { className: 'dsh-ts3d-title' }, strings.title),
          h('span', { className: 'dsh-ts3d-subtitle' }, strings.subtitle)),
        promptRow),
      h('div', { className: 'dsh-ts3d-body' },
        h(StageCanvas, { stageIndex, trace, ui, strings, onResetAvailable }),
        h(Inspector, { stageIndex, trace, ui, strings, setUi, setScore, lang })),
      h('footer', { className: 'dsh-ts3d-footer' },
        h('div', { className: 'dsh-ts3d-nav' },
          h('button', {
            type: 'button', className: 'dsh-ts3d-secondary',
            disabled: stageIndex === 0,
            onClick: () => gotoStage(stageIndex - 1),
          }, strings.prev),
          h('button', {
            type: 'button', className: 'dsh-ts3d-primary',
            disabled: stageIndex === STAGES.length - 1,
            onClick: () => gotoStage(stageIndex + 1),
          }, strings.next),
          h('button', {
            type: 'button', className: 'dsh-ts3d-secondary',
            onClick: () => {
              gotoStage(0)
              setScore({ attention: 0, predict: 0 })
            },
          }, strings.restart)),
        h('span', { className: 'dsh-ts3d-badge' },
          h('span', { className: 'dsh-ts3d-badgeDot' }),
          `${strings.prize} ${score.attention + score.predict * 10} · ${stageIndex + 1}/${STAGES.length} · ${copy[0]}`)))
      }

      return LabPanel
    }

    /* ------------------------------------------------------------------ *
     * Plugin registration
     * ------------------------------------------------------------------ */

    return {
      inject: ['slots'],
      apply(ctx) {
        const disposeStyles = insertStyles(CSS)
        ctx.effect(() => () => { if (typeof disposeStyles === 'function') disposeStyles() }, 'transformer-3d-lab: styles')

        /* Sidebar entry: its id is the main-panel key the sidebar dispatches. */
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_KEY,
          order: SIDEBAR_ORDER,
          label: () => (STRINGS[pickLanguage(ctx)] || STRINGS.en).tabEntry,
        }, TransformerLabSidebarIcon))

        /* Central panel: no Session binding, keyed by the sidebar id. */
        const Panel = makePanel(ctx)
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_KEY,
        }, Panel))
      },
    }

    function TransformerLabSidebarIcon(props) {
      const size = props && typeof props.size === 'number' ? props.size : 16
      const active = props && props.active === true
      return h('span', {
        style: {
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: `${size}px`, height: `${size}px`,
          color: active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-primary)',
          opacity: active ? '1' : '0.75',
        },
      }, h(LabIcon, { size }))
    }
  },
})
