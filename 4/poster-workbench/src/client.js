/**
 * Poster workbench — a Conversation View that draws a poster over the official
 * fluid-noise shader and lets the reader edit its title, text, and colors.
 *
 * src/client.js is a build template: scripts/build-client.mjs substitutes the
 * font-stylesheet and GLSL placeholders below and writes ../client.js.
 */
window.__ModuleLoader__.load({
  id: '@local/poster-workbench',
  factory(require) {
    'use strict'
    const React = require('react')
    const h = React.createElement

    /** Self-contained Host Grotesk @font-face rules (data-URL WOFF2), injected by the view. */
    const FONTS_CSS = __FONTS_CSS__
    /** WebGL2 fragment shader: the official fluid pattern with uniform colors. */
    const FRAGMENT_SOURCE = __FRAGMENT_GLSL__

    const NS = 'poster-workbench'
    const STORAGE_KEY = 'poster-workbench.poster.v1'
    const DEFAULT_TITLE = 'Everything is a plugin'
    const DEFAULT_BODY = ''

    const FAMILY =
      '"Host Grotesk Poster", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

    const PALETTES = [
      { id: 'deep', name: 'paletteDeep', colors: ['#000000', '#000000', '#204a7e', '#cec8bb', '#000000'] },
      { id: 'dusk', name: 'paletteDusk', colors: ['#05060a', '#0d1230', '#2b3f8f', '#e0b8a8', '#000000'] },
      { id: 'moss', name: 'paletteMoss', colors: ['#040705', '#0a1410', '#1f4436', '#d8cba4', '#000000'] },
    ]

    const DICT = {
      zh: {
        tab: '海报',
        edit: '编辑海报',
        close: '完成',
        title: '标题',
        body: '文字',
        colors: '配色',
        palette: '预设',
        reset: '恢复默认配色',
        titlePlaceholder: '输入海报标题',
        bodyPlaceholder: '输入海报文字，留空则只显示标题',
        paletteDeep: '深海',
        paletteDusk: '暮色',
        paletteMoss: '苔原',
        swatch: '颜色',
      },
      en: {
        tab: 'Poster',
        edit: 'Edit poster',
        close: 'Done',
        title: 'Title',
        body: 'Text',
        colors: 'Colors',
        palette: 'Presets',
        reset: 'Reset colors',
        titlePlaceholder: 'Poster title',
        bodyPlaceholder: 'Poster text; leave empty to show only the title',
        paletteDeep: 'Deep sea',
        paletteDusk: 'Dusk',
        paletteMoss: 'Tundra',
        swatch: 'Color',
      },
    }

    const VERTEX_SOURCE = '#version 300 es\nin vec4 a_position;\nvoid main() { gl_Position = a_position; }\n'

    const HEX = /^#[0-9a-f]{6}$/i

    function hexToRgb(hex) {
      const value = parseInt(hex.slice(1), 16)
      return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
    }

    function relativeLuminance(rgb) {
      const channel = (value) => {
        const v = value / 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      }
      return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
    }

    /** Ink that stays readable over the palette's mid tone. */
    function inkFor(colors) {
      const a = hexToRgb(colors[2])
      const b = hexToRgb(colors[3])
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
      return relativeLuminance(mid) > 0.48 ? '#10151b' : '#f7f4ec'
    }

    function fallbackGradient(colors) {
      return 'radial-gradient(120% 100% at 76% 30%, ' + colors[3] + ' 0%, ' + colors[2] + ' 48%, ' + colors[0] + ' 100%)'
    }

    function defaultPoster() {
      return { title: DEFAULT_TITLE, body: DEFAULT_BODY, colors: PALETTES[0].colors.slice() }
    }

    function readStored() {
      let raw = null
      try {
        raw = window.localStorage.getItem(STORAGE_KEY)
      } catch (error) {
        return null
      }
      if (raw === null) return null
      try {
        const data = JSON.parse(raw)
        if (data === null || typeof data !== 'object') return null
        const colors = Array.isArray(data.colors) && data.colors.length === 5 ? data.colors : null
        if (colors === null || colors.some((color) => typeof color !== 'string' || !HEX.test(color))) return null
        return {
          title: typeof data.title === 'string' ? data.title : DEFAULT_TITLE,
          body: typeof data.body === 'string' ? data.body : DEFAULT_BODY,
          colors: colors.slice(),
        }
      } catch (error) {
        return null
      }
    }

    function writeStored(poster) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(poster))
      } catch (error) {
        /* Storage is best effort; the poster still works for this page life. */
      }
    }

    function compileShader(gl, type, source, label) {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('[poster-workbench] ' + label + ' shader failed to compile: ' + (gl.getShaderInfoLog(shader) || ''))
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    /** Draws the fluid background; colors update live without rebuilding the program. */
    function FluidBackground(props) {
      const canvasRef = React.useRef(null)
      const colorsRef = React.useRef(props.colors)
      const redrawRef = React.useRef(null)
      colorsRef.current = props.colors

      React.useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return undefined
        const gl = canvas.getContext('webgl2', {
          alpha: false,
          premultipliedAlpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          powerPreference: 'low-power',
        })
        if (!gl) {
          console.error('[poster-workbench] WebGL2 is unavailable; showing the static palette gradient.')
          return undefined
        }

        const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE, 'vertex')
        const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE, 'fragment')
        const program = gl.createProgram()
        if (!vertex || !fragment || !program) {
          if (vertex) gl.deleteShader(vertex)
          if (fragment) gl.deleteShader(fragment)
          if (program) gl.deleteProgram(program)
          return undefined
        }
        gl.attachShader(program, vertex)
        gl.attachShader(program, fragment)
        gl.linkProgram(program)
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          console.error('[poster-workbench] shader program failed to link: ' + (gl.getProgramInfoLog(program) || ''))
          return undefined
        }
        gl.deleteShader(vertex)
        gl.deleteShader(fragment)

        gl.useProgram(program)
        const buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
        const position = gl.getAttribLocation(program, 'a_position')
        gl.enableVertexAttribArray(position)
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

        const loops = [1, 2, 3, 4].map((n) => gl.getUniformLocation(program, 'u_loop' + n))
        const uResolution = gl.getUniformLocation(program, 'u_resolution')
        const uGrain = gl.getUniformLocation(program, 'u_grainResolution')
        const colorLocations = [1, 2, 3, 4, 5].map((n) => gl.getUniformLocation(program, 'u_color' + n))

        gl.uniform1f(gl.getUniformLocation(program, 'u_scale'), 1.19)
        gl.uniform2f(gl.getUniformLocation(program, 'u_offset'), -1.24, -0.48)
        gl.uniform1f(gl.getUniformLocation(program, 'u_grain'), 0.005)
        gl.uniform1f(gl.getUniformLocation(program, 'u_vignette'), 0.38)
        gl.uniform1f(gl.getUniformLocation(program, 'u_bloomThreshold'), 0.61)
        gl.uniform1f(gl.getUniformLocation(program, 'u_bloomRange'), 0.18)
        gl.uniform1f(gl.getUniformLocation(program, 'u_bloomStrength'), 0.4)
        gl.uniform1f(gl.getUniformLocation(program, 'u_colorMix'), 1.0)
        const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches
        gl.uniform1f(gl.getUniformLocation(program, 'u_lightCore'), coarsePointer ? 0 : 0.14)
        gl.uniform1f(gl.getUniformLocation(program, 'u_lightHalo'), coarsePointer ? 0 : 0.2)
        gl.uniform2f(gl.getUniformLocation(program, 'u_lightPos'), 0.89, 0.46)

        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
        const TAU = Math.PI * 2
        // The reference pattern runs one loop in 3.0–4.2 s; a poster wants a
        // slow crawl instead, so each layer takes many seconds to close its loop.
        const PERIODS = [3000, 3300, 3900, 4200]
        const LOOP_SECONDS = [16, 18, 21, 24]
        const RADII = [0.0102, 0.0085, 0.0068, 0.00595]
        const radii = RADII.map((radius, index) => (radius * PERIODS[index]) / TAU)
        const MOTION = [1.0, 0.9, 0.8, 0.7]

        let raf = 0
        let disposed = false
        let visible = true
        let lastTime = 0

        function resize() {
          const width = Math.max(1, Math.round(canvas.clientWidth || 1))
          const height = Math.max(1, Math.round(canvas.clientHeight || 1))
          const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
          const scale = Math.min(1, 1400 / width, Math.sqrt(1e6 / (width * height)))
          const drawWidth = Math.max(1, Math.floor(width * dpr * scale))
          const drawHeight = Math.max(1, Math.floor(height * dpr * scale))
          if (drawWidth !== canvas.width) canvas.width = drawWidth
          if (drawHeight !== canvas.height) canvas.height = drawHeight
          gl.viewport(0, 0, drawWidth, drawHeight)
          gl.uniform2f(uResolution, drawWidth, drawHeight)
          gl.uniform2f(uGrain, width, height)
        }

        const phase = [0, 0, 0, 0]

        function draw(now) {
          const reduced = motionQuery.matches
          let seconds = 0
          if (!reduced) {
            if (lastTime === 0) lastTime = now
            seconds = Math.min(Math.max(now - lastTime, 0), 120) / 1000
            lastTime = now
          }
          for (let index = 0; index < 4; index += 1) {
            if (seconds > 0) {
              phase[index] = (phase[index] + (seconds * MOTION[index]) / LOOP_SECONDS[index]) % 1
            }
            const angle = phase[index] * TAU
            // Each iteration walks a small circle, so the field keeps warping instead of snapping back.
            gl.uniform2f(loops[index], radii[index] * Math.sin(angle), radii[index] * (1 - Math.cos(angle)))
          }
          const colors = colorsRef.current
          for (let index = 0; index < 5; index += 1) {
            const rgb = hexToRgb(colors[index])
            gl.uniform3f(colorLocations[index], rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
          }
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        }

        function tick(now) {
          raf = 0
          if (disposed) return
          if (document.hidden || !visible) {
            lastTime = 0
            return
          }
          draw(now)
          if (!motionQuery.matches) raf = window.requestAnimationFrame(tick)
        }

        function kick() {
          if (disposed) return
          if (raf !== 0) return
          if (document.hidden || !visible) return
          lastTime = 0
          raf = window.requestAnimationFrame(tick)
        }
        redrawRef.current = kick

        resize()
        const resizer = new window.ResizeObserver(() => {
          resize()
          kick()
        })
        resizer.observe(canvas)
        const intersector = new window.IntersectionObserver((entries) => {
          const entry = entries[0]
          visible = entry !== undefined ? entry.isIntersecting : true
          if (visible) kick()
        })
        intersector.observe(canvas)

        const onVisibility = () => {
          if (document.hidden) {
            if (raf !== 0) window.cancelAnimationFrame(raf)
            raf = 0
            lastTime = 0
          } else {
            kick()
          }
        }
        const onMotionPreference = () => kick()
        const onContextLost = (event) => {
          event.preventDefault()
          if (raf !== 0) window.cancelAnimationFrame(raf)
          raf = 0
          console.error('[poster-workbench] WebGL context lost; the palette gradient remains visible.')
        }
        document.addEventListener('visibilitychange', onVisibility)
        canvas.addEventListener('webglcontextlost', onContextLost)
        if (typeof motionQuery.addEventListener === 'function') motionQuery.addEventListener('change', onMotionPreference)
        kick()

        return () => {
          disposed = true
          if (raf !== 0) window.cancelAnimationFrame(raf)
          raf = 0
          redrawRef.current = null
          resizer.disconnect()
          intersector.disconnect()
          document.removeEventListener('visibilitychange', onVisibility)
          canvas.removeEventListener('webglcontextlost', onContextLost)
          if (typeof motionQuery.removeEventListener === 'function') {
            motionQuery.removeEventListener('change', onMotionPreference)
          }
          gl.deleteBuffer(buffer)
          gl.deleteProgram(program)
          const lose = gl.getExtension('WEBGL_lose_context')
          if (lose) lose.loseContext()
        }
      }, [])

      React.useEffect(() => {
        if (redrawRef.current) redrawRef.current()
      }, [props.colors])

      return h('canvas', { ref: canvasRef, className: 'pw-canvas', 'aria-hidden': true })
    }

    function editIcon() {
      return h(
        'svg',
        { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true, focusable: false },
        h('path', {
          d: 'M4 20h4l10-10-4-4-10 10v4z',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        h('path', { d: 'M14.5 5.5l4 4', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }),
      )
    }

    function Editor(props) {
      const t = props.t
      const poster = props.poster
      const setPoster = props.setPoster
      const titleRef = React.useRef(null)

      React.useEffect(() => {
        const field = titleRef.current
        if (!field) return
        field.focus()
        if (typeof field.select === 'function') field.select()
      }, [])

      const patch = (next) => setPoster((previous) => Object.assign({}, previous, next))
      const setColor = (index, value) =>
        setPoster((previous) => {
          const colors = previous.colors.slice()
          colors[index] = value
          return Object.assign({}, previous, { colors })
        })
      const setPalette = (colors) => patch({ colors: colors.slice() })

      return h(
        'aside',
        { className: 'pw-sheet', role: 'region', 'aria-label': t('edit') },
        h(
          'div',
          { className: 'pw-sheet-head' },
          h('span', { className: 'pw-sheet-title' }, t('edit')),
          h('button', { type: 'button', className: 'pw-done', onClick: props.onClose }, t('close')),
        ),
        h(
          'label',
          { className: 'pw-field' },
          h('span', { className: 'pw-label' }, t('title')),
          h('input', {
            ref: titleRef,
            className: 'pw-input',
            type: 'text',
            value: poster.title,
            maxLength: 90,
            spellCheck: false,
            placeholder: t('titlePlaceholder'),
            onChange: (event) => patch({ title: event.target.value }),
          }),
        ),
        h(
          'label',
          { className: 'pw-field' },
          h('span', { className: 'pw-label' }, t('body')),
          h('textarea', {
            className: 'pw-area',
            rows: 4,
            value: poster.body,
            maxLength: 400,
            spellCheck: false,
            placeholder: t('bodyPlaceholder'),
            onChange: (event) => patch({ body: event.target.value }),
          }),
        ),
        h(
          'div',
          { className: 'pw-field' },
          h('span', { className: 'pw-label' }, t('palette')),
          h(
            'div',
            { className: 'pw-palettes' },
            PALETTES.map((palette) =>
              h(
                'button',
                {
                  key: palette.id,
                  type: 'button',
                  className: 'pw-palette',
                  title: t(palette.name),
                  'aria-label': t(palette.name),
                  onClick: () => setPalette(palette.colors),
                },
                palette.colors.map((color, index) =>
                  h('span', { key: index, style: { background: color } }),
                ),
              ),
            ),
          ),
        ),
        h(
          'div',
          { className: 'pw-field' },
          h('span', { className: 'pw-label' }, t('colors')),
          h(
            'div',
            { className: 'pw-swatches' },
            poster.colors.map((color, index) =>
              h(
                'label',
                { key: index, className: 'pw-swatch', title: t('swatch') + ' ' + (index + 1) },
                h('input', {
                  type: 'color',
                  value: color,
                  'aria-label': t('swatch') + ' ' + (index + 1),
                  onChange: (event) => setColor(index, event.target.value),
                }),
              ),
            ),
          ),
        ),
        h(
          'button',
          { type: 'button', className: 'pw-reset', onClick: () => setPalette(PALETTES[0].colors) },
          t('reset'),
        ),
      )
    }

    function PosterWorkbench(props) {
      const t = props.pwTranslate
      const [poster, setPoster] = React.useState(() => readStored() || defaultPoster())
      const [editing, setEditing] = React.useState(false)

      React.useEffect(() => {
        writeStored(poster)
      }, [poster])

      React.useEffect(() => {
        if (!editing) return undefined
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setEditing(false)
          }
        }
        // The sheet is inside a scrollport owned by the shell; capture on the
        // window so Escape closes it before any shell-level Escape handler.
        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
      }, [editing])

      const ink = React.useMemo(() => inkFor(poster.colors), [poster.colors])
      const title = poster.title.trim()
      const body = poster.body.trim()

      return h(
        'div',
        { className: 'pw-root', style: { fontFamily: FAMILY } },
        h('style', { key: 'pw-style' }, FONTS_CSS + STYLE),
        h('div', { className: 'pw-backdrop', style: { background: fallbackGradient(poster.colors) }, 'aria-hidden': true }),
        h(FluidBackground, { colors: poster.colors }),
        h('div', { className: 'pw-veil', 'aria-hidden': true }),
        h(
          'div',
          { className: 'pw-copy', style: { color: ink } },
          title === '' ? null : h('h1', { className: 'pw-title' }, title),
          body === '' ? null : h('p', { className: 'pw-body' }, body),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'pw-edit',
            onClick: () => setEditing(true),
            'aria-label': t('edit'),
            title: t('edit'),
          },
          editIcon(),
        ),
        editing ? h(Editor, { t: t, poster: poster, setPoster: setPoster, onClose: () => setEditing(false) }) : null,
      )
    }

    const STYLE = [
      '.pw-root{position:relative;width:100%;height:100%;min-height:min(66vh,700px);overflow:hidden;',
      'isolation:isolate;box-sizing:border-box;',
      'font-family:' + FAMILY + ';-webkit-font-smoothing:antialiased;}',
      '.pw-backdrop{position:absolute;inset:0;}',
      '.pw-canvas{position:absolute;inset:0;display:block;width:100%;height:100%;}',
      '.pw-veil{position:absolute;inset:0;pointer-events:none;',
      'background:linear-gradient(104deg,rgba(4,6,10,.30) 0%,rgba(4,6,10,.13) 38%,rgba(4,6,10,0) 62%),',
      'radial-gradient(125% 95% at 50% 46%,rgba(0,0,0,0) 34%,rgba(0,0,0,.26) 100%);}',
      '.pw-copy{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;',
      'gap:clamp(10px,1.5vh,20px);padding:clamp(28px,5.6vw,96px);padding-bottom:clamp(64px,12vh,140px);',
      'pointer-events:none;}',
      '.pw-title{margin:0;font-family:inherit;font-weight:500;font-size:clamp(38px,6.1vw,92px);line-height:1.03;',
      'letter-spacing:-.035em;max-width:22ch;text-wrap:balance;}',
      '.pw-body{margin:0;max-width:40ch;font-size:clamp(14px,1.15vw,19px);line-height:1.66;font-weight:400;',
      'opacity:.78;white-space:pre-wrap;}',
      '.pw-edit{position:absolute;right:clamp(14px,2.2vw,28px);top:clamp(14px,2.4vh,26px);width:40px;height:40px;',
      'display:grid;place-items:center;padding:0;border:1px solid rgba(255,255,255,.2);border-radius:999px;',
      'background:rgba(10,12,16,.44);color:#f5f2ea;cursor:pointer;backdrop-filter:blur(10px);opacity:.62;',
      'transition:opacity .18s ease,transform .18s ease,background .18s ease;}',
      '.pw-edit:hover,.pw-edit:focus-visible{opacity:1;background:rgba(10,12,16,.64);transform:translateY(-1px);}',
      '.pw-edit:focus-visible{outline:2px solid rgba(255,255,255,.6);outline-offset:2px;}',
      '.pw-sheet{position:absolute;top:0;right:0;bottom:0;width:min(338px,100%);display:flex;flex-direction:column;',
      'gap:15px;padding:18px 18px 22px;overflow-y:auto;box-sizing:border-box;',
      'background:var(--dsw-alias-bg-overlay,#14161c);color:var(--dsw-alias-label-primary,#f4f1ea);',
      'border-left:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.34));',
      'box-shadow:-24px 0 60px rgba(0,0,0,.28);font-size:13px;}',
      '.pw-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px;}',
      '.pw-sheet-title{font-size:13.5px;font-weight:500;}',
      '.pw-done{border:0;border-radius:8px;padding:6px 12px;background:var(--dsw-alias-brand-primary,#4d6bfe);',
      'color:#fff;font:inherit;font-size:12.5px;cursor:pointer;}',
      '.pw-done:focus-visible{outline:2px solid var(--dsw-alias-label-primary,#fff);outline-offset:2px;}',
      '.pw-field{display:flex;flex-direction:column;gap:6px;}',
      '.pw-label{font-size:11.5px;letter-spacing:.02em;color:var(--dsw-alias-label-secondary,#9aa4b2);}',
      '.pw-input,.pw-area{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;',
      'border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.34));',
      'background:var(--dsw-alias-bg-layer-2,#1b1e26);color:inherit;font:inherit;font-size:13px;line-height:1.5;}',
      '.pw-area{min-height:86px;resize:vertical;}',
      '.pw-input:focus,.pw-area:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#4d6bfe);}',
      '.pw-palettes{display:flex;gap:8px;}',
      '.pw-palette{display:flex;padding:0;width:44px;height:26px;border-radius:7px;overflow:hidden;cursor:pointer;',
      'border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.34));background:none;}',
      '.pw-palette span{flex:1;height:100%;}',
      '.pw-palette:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:2px;}',
      '.pw-swatches{display:flex;gap:9px;flex-wrap:wrap;}',
      '.pw-swatch{display:block;line-height:0;}',
      '.pw-swatch input{width:34px;height:26px;padding:0;border-radius:6px;background:none;cursor:pointer;',
      'border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.34));}',
      '.pw-swatch input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:2px;}',
      '.pw-reset{align-self:flex-start;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.34));',
      'background:none;color:var(--dsw-alias-label-secondary,#9aa4b2);border-radius:8px;padding:6px 10px;',
      'font:inherit;font-size:12px;cursor:pointer;}',
      '.pw-reset:hover{color:var(--dsw-alias-label-primary,#f4f1ea);}',
      '@media (max-width:640px){.pw-sheet{top:auto;left:0;right:0;bottom:0;width:auto;max-height:78%;',
      'border-left:0;border-top:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.34));',
      'border-radius:16px 16px 0 0;}.pw-copy{padding-bottom:112px;}}',
    ].join('')

    /** Bundled copy used when the locale service is unavailable. */
    function localDictionary(key) {
      let zh = false
      try {
        const tags = [].concat(window.navigator.languages || [], window.navigator.language || [])
        zh = tags.some((tag) => typeof tag === 'string' && tag.toLowerCase().indexOf('zh') === 0)
      } catch (error) {
        zh = false
      }
      const dict = zh ? DICT.zh : DICT.en
      if (dict[key] !== undefined) return dict[key]
      return DICT.en[key] !== undefined ? DICT.en[key] : key
    }

    function apply(ctx) {
      let bound = null
      const locale = ctx.get('locale')
      if (locale && typeof locale.register === 'function') {
        for (const id of ['zh', 'en']) {
          ctx.effect(() => {
            try {
              return locale.register(NS, id, DICT[id])
            } catch (error) {
              console.error('[poster-workbench] could not register the ' + id + ' dictionary', error)
              return undefined
            }
          }, 'poster-workbench: ' + id + ' dictionary')
        }
        if (typeof locale.bind === 'function') {
          try {
            bound = locale.bind(NS)
          } catch (error) {
            console.error('[poster-workbench] could not bind the locale namespace', error)
            bound = null
          }
        }
      }

      function translate(key) {
        if (typeof bound === 'function') {
          try {
            const text = bound(key)
            // A missing dictionary entry renders the key itself; keep the bundled copy then.
            if (typeof text === 'string' && text !== '' && text !== key) return text
          } catch (error) {
            /* Fall through to the bundled copy. */
          }
        }
        return localDictionary(key)
      }

      ctx.slots.inject('conversation.view', () =>
        ctx.slots.register(
          {
            name: 'conversation.view',
            id: 'poster-workbench',
            order: 60,
            label: () => translate('tab'),
          },
          (slotProps) => h(PosterWorkbench, Object.assign({}, slotProps, { pwTranslate: translate })),
        ),
      )
    }

    return { inject: ['slots'], apply }
  },
})
