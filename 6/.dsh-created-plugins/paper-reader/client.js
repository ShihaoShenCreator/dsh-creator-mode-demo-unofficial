window.__ModuleLoader__.load({
  id: '@local/paper-reader',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const useState = React.useState
    const useEffect = React.useEffect
    const useRef = React.useRef
    const useMemo = React.useMemo

    let createPortal
    try {
      createPortal = require('react-dom').createPortal
    } catch {
      createPortal = undefined
    }

    const ID = '@local/paper-reader'
    const KIND = 'paper-reader'
    const NS = 'paperReader'

    /* ------------------------------------------------------------------ *
     * Copy. Registered under one namespace: the prompt templates exist in
     * every built-in locale so a passage inserted into the composer is
     * written in the same language as the interface.
     * ------------------------------------------------------------------ */

    const zh = {
      'tab.title': '论文',
      'guide.title': '论文阅读器',
      'guide.description': '阅读 PDF 并做标注',
      'empty.title': '还没有打开论文',
      'empty.body': '上传一篇 PDF 在这里阅读，或选择已添加的论文。',
      'empty.upload': '上传论文',
      'empty.open': '打开',
      'empty.remove': '移除',
      'empty.emptyList': '还没有上传过论文。',
      'loading': '正在渲染文档…',
      'loadFailed': '这篇文档无法渲染。',
      'retry': '重试',
      'menu.highlight': '高亮',
      'menu.note': '添加笔记',
      'menu.ask': '在会话中提问',
      'menu.copy': '复制',
      'note.placeholder': '为这段文字写一条笔记',
      'note.save': '保存笔记',
      'note.cancel': '取消',
      'note.title': '笔记',
      'note.delete': '删除笔记',
      'annotations.title': '高亮与笔记',
      'annotations.empty': '在文档中选中文字即可添加高亮或笔记。',
      'annotations.count': '{count} 条标注',
      'ask.template': '关于论文《{title}》，请解释这段话：\n\n{quote}\n\n',
      'ask.templateNoTitle': '请解释我正在阅读的论文中的这段话：\n\n{quote}\n\n',
      'ask.notice': '已把这段话发送到输入框。',
      'ask.unavailable': '当前无法使用会话输入框。',
      'page.of': '第 {page} 页，共 {total} 页',
      'zoom.in': '放大',
      'zoom.out': '缩小',
      'zoom.fit': '适应宽度',
      'upload.failed': '上传失败。',
      'upload.reading': '正在读取文件…',
    }

    const en = {
      'tab.title': 'Papers',
      'guide.title': 'Paper reader',
      'guide.description': 'Read PDFs and annotate them',
      'empty.title': 'No paper open',
      'empty.body': 'Upload a PDF to read it here, or pick one you already added.',
      'empty.upload': 'Upload paper',
      'empty.open': 'Open',
      'empty.remove': 'Remove',
      'empty.emptyList': 'No uploaded papers yet.',
      'loading': 'Rendering document…',
      'loadFailed': 'This document could not be rendered.',
      'retry': 'Retry',
      'menu.highlight': 'Highlight',
      'menu.note': 'Add note',
      'menu.ask': 'Ask in chat',
      'menu.copy': 'Copy',
      'note.placeholder': 'Write a note for this passage',
      'note.save': 'Save note',
      'note.cancel': 'Cancel',
      'note.title': 'Note',
      'note.delete': 'Delete note',
      'annotations.title': 'Highlights and notes',
      'annotations.empty': 'Select text in the document to add a highlight or note.',
      'annotations.count': '{count} annotations',
      'ask.template': 'In the paper “{title}”, please explain this passage:\n\n{quote}\n\n',
      'ask.templateNoTitle': 'Please explain this passage from the paper I am reading:\n\n{quote}\n\n',
      'ask.notice': 'Sent the passage to the chat composer.',
      'ask.unavailable': 'The chat composer is not available right now.',
      'page.of': 'Page {page} of {total}',
      'zoom.in': 'Zoom in',
      'zoom.out': 'Zoom out',
      'zoom.fit': 'Fit width',
      'upload.failed': 'Upload failed.',
      'upload.reading': 'Reading file…',
    }

    /* Prompt templates only, for the remaining built-in locales, so the
     * inserted question follows the interface language everywhere. */
    const askOnly = {
      ja: {
        'ask.template': '論文「{title}」について、この一節を説明してください：\n\n{quote}\n\n',
        'ask.templateNoTitle': 'いま読んでいる論文のこの一節を説明してください：\n\n{quote}\n\n',
      },
      de: {
        'ask.template': 'Erkläre bitte diese Passage aus dem Paper „{title}“:\n\n{quote}\n\n',
        'ask.templateNoTitle': 'Erkläre bitte diese Passage aus dem Paper, das ich gerade lese:\n\n{quote}\n\n',
      },
      es: {
        'ask.template': 'En el artículo «{title}», explica este pasaje:\n\n{quote}\n\n',
        'ask.templateNoTitle': 'Explica este pasaje del artículo que estoy leyendo:\n\n{quote}\n\n',
      },
      fr: {
        'ask.template': "Dans l'article « {title} », explique ce passage :\n\n{quote}\n\n",
        'ask.templateNoTitle': "Explique ce passage de l'article que je lis :\n\n{quote}\n\n",
      },
      ru: {
        'ask.template': 'В статье «{title}» объясни, пожалуйста, этот фрагмент:\n\n{quote}\n\n',
        'ask.templateNoTitle': 'Объясни, пожалуйста, этот фрагмент из статьи, которую я читаю:\n\n{quote}\n\n',
      },
      pt: {
        'ask.template': 'No artigo “{title}”, explique esta passagem:\n\n{quote}\n\n',
        'ask.templateNoTitle': 'Explique esta passagem do artigo que estou lendo:\n\n{quote}\n\n',
      },
    }

    /* ------------------------------------------------------------------ *
     * Styles (prefixed; only theme tokens are used for chrome).
     * ------------------------------------------------------------------ */

    const CSS = `
.pr-root{display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary)}
.pr-bar{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;min-width:0}
.pr-bar__title{font:var(--dsw-font-xs-13);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}
.pr-btn{appearance:none;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;padding:3px 7px;font:var(--dsw-font-xs-13);cursor:pointer;line-height:1.5;white-space:nowrap}
.pr-btn:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.pr-btn[aria-pressed=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.pr-btn:disabled{opacity:.5;cursor:default}
.pr-body{display:flex;min-height:0;flex:1}
.pr-main{flex:1;min-width:0;display:flex;flex-direction:column}
.pr-scroll{flex:1;min-height:0;overflow:auto;background:var(--dsw-alias-bg-base);position:relative}
.pr-pages{display:flex;flex-direction:column;align-items:center;gap:12px;padding:12px}
.pr-page{position:relative;flex:none;box-shadow:0 1px 4px rgba(0,0,0,.18);background:#fff;border-radius:2px;overflow:hidden}
.pr-page--placeholder{background:var(--dsw-alias-bg-layer-2)}
.pr-canvas{display:block;position:absolute;inset:0}
.pr-hl{position:absolute;inset:0;pointer-events:none;z-index:1}
.pr-hl__mark{position:absolute;background:rgba(255,196,0,.38);border-radius:2px;pointer-events:none}
.pr-hl__mark--active{background:rgba(255,140,0,.5)}
.pr-hl__mark--note{box-shadow:inset 0 -2px 0 rgba(47,111,208,.85)}
.pr-text{position:absolute;inset:0;overflow:clip;z-index:2}
.pr-text .pr-textLayer{position:absolute;inset:0;overflow:clip;text-align:initial;letter-spacing:normal;word-spacing:normal;text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;caret-color:canvastext;--text-scale-factor:calc(var(--total-scale-factor) * var(--min-font-size));--min-font-size-inv:calc(1 / var(--min-font-size));line-height:1}
.pr-text .pr-textLayer[data-main-rotation="90"]{transform:rotate(90deg) translateY(-100%)}
.pr-text .pr-textLayer[data-main-rotation="180"]{transform:rotate(180deg) translate(-100%,-100%)}
.pr-text .pr-textLayer[data-main-rotation="270"]{transform:rotate(270deg) translate(-100%)}
.pr-text .pr-textLayer :is(span,br){color:transparent;white-space:pre;cursor:text;transform-origin:0 0;user-select:text;position:absolute}
.pr-text .pr-textLayer > :not(.markedContent),.pr-text .pr-textLayer .markedContent span:not(.markedContent){z-index:1;--font-height:0;--scale-x:1;--rotate:0deg;font-size:calc(var(--text-scale-factor) * var(--font-height));transform:rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv))}
.pr-text .pr-textLayer .markedContent{display:contents}
.pr-text .pr-textLayer ::selection{background:rgba(68,136,255,.35);color:transparent}
.pr-text .pr-textLayer br::selection{background:transparent}
.pr-text .pr-textLayer .endOfContent{display:block;position:absolute;inset:100% 0 0;z-index:0;cursor:default;user-select:none}
.pr-text .pr-textLayer.selecting .endOfContent{top:0}
.pr-menu{position:fixed;z-index:2147483000;display:flex;gap:2px;padding:4px;border-radius:10px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);box-shadow:0 8px 24px rgba(0,0,0,.22)}
.pr-menu__item{appearance:none;border:none;background:transparent;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xs-13);padding:5px 10px;border-radius:7px;cursor:pointer;white-space:nowrap}
.pr-menu__item:hover{background:var(--dsw-alias-bg-layer-1)}
.pr-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;padding:24px;text-align:center;overflow:auto}
.pr-empty__title{font:var(--dsw-font-sm-14);margin:0}
.pr-empty__body{font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-secondary);margin:0;max-width:34em}
.pr-list{display:flex;flex-direction:column;gap:4px;width:100%;max-width:34rem;margin-top:8px}
.pr-list__row{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);text-align:left}
.pr-list__name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--dsw-font-xs-13)}
.pr-list__meta{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13);flex:none}
.pr-status{display:flex;align-items:center;justify-content:center;gap:8px;padding:18px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13)}
.pr-annot{width:250px;flex:none;border-left:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;min-height:0}
.pr-annot__head{display:flex;align-items:center;justify-content:space-between;padding:8px;border-bottom:1px solid var(--dsw-alias-border-l1);font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-secondary);flex:none}
.pr-annot__list{overflow:auto;padding:6px;display:flex;flex-direction:column;gap:6px}
.pr-annot__card{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:7px 8px;background:var(--dsw-alias-bg-layer-1);cursor:pointer;text-align:left}
.pr-annot__card:hover{border-color:var(--dsw-alias-border-l2)}
.pr-annot__quote{font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-primary);margin:0 0 4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.pr-annot__note{font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-secondary);margin:0;white-space:pre-wrap}
.pr-annot__meta{display:flex;justify-content:space-between;gap:8px;margin-top:4px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13)}
.pr-annot__empty{padding:10px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13)}
.pr-dialog{position:fixed;z-index:2147483001;width:min(360px,calc(100vw - 32px));display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);box-shadow:0 12px 32px rgba(0,0,0,.28)}
.pr-dialog__quote{font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-secondary);margin:0;max-height:5.6em;overflow:auto}
.pr-dialog__area{width:100%;box-sizing:border-box;min-height:84px;resize:vertical;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:var(--dsw-font-xs-13);padding:8px}
.pr-dialog__row{display:flex;justify-content:flex-end;gap:6px}
.pr-dialog__primary{background:var(--dsw-alias-brand-primary);color:#fff;border-color:transparent}
.pr-dialog__primary:hover{background:var(--dsw-alias-brand-primary);color:#fff;opacity:.9}
.pr-file{display:none}
.pr-statusLine{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13)}
`

    /* ------------------------------------------------------------------ *
     * pdf.js loader: same-origin, offline, module worker.
     * ------------------------------------------------------------------ */

    function assetsBase() {
      return new URL('paper-reader/vendor/pdfjs/', document.baseURI).href
    }

    function apiUrl(path) {
      return new URL(`api/paper-reader.${path}`, document.baseURI).href
    }

    let pdfjsPromise
    function loadPdfjs() {
      if (pdfjsPromise === undefined) {
        const base = assetsBase()
        pdfjsPromise = import(`${base}build/pdf.min.mjs`).then((mod) => {
          const lib = typeof mod.getDocument === 'function' ? mod : globalThis.pdfjsLib
          if (lib === undefined) throw new Error('pdf.js did not expose getDocument')
          lib.GlobalWorkerOptions.workerSrc = `${base}build/pdf.worker.min.mjs`
          return lib
        })
      }
      return pdfjsPromise
    }

    /* ------------------------------------------------------------------ *
     * The rendering surface: faithful page canvases + pdf.js text layers,
     * lazy rendering, zoom, selection geometry and highlight painting.
     * ------------------------------------------------------------------ */

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

    class PaperSurface {
      constructor({ scroll, pages, onReady, onSelection, onPageChange, onAnnotationClick }) {
        this.scroll = scroll
        this.pages = pages
        this.onReady = onReady ?? (() => {})
        this.onSelection = onSelection ?? (() => {})
        this.onPageChange = onPageChange ?? (() => {})
        this.onAnnotationClick = onAnnotationClick
        this.doc = undefined
        this.pdfjs = undefined
        this.scaleMode = 'fit'
        this.fixedScale = 1.25
        this.zoom = 1
        this.records = []
        this.annotations = []
        this.loaded = false
        this.destroyed = false
        this.observer = undefined
        this.renderChain = Promise.resolve()
        this.resizeObserver = undefined
        this.fitWidth = 0
        this.pageNumber = 1
      }

      async load({ url, annotations }) {
        this.annotations = annotations ?? []
        this.pdfjs = await loadPdfjs()
        const base = assetsBase()
        this.doc = await this.pdfjs.getDocument({
          url,
          cMapUrl: `${base}cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${base}standard_fonts/`,
          wasmUrl: `${base}wasm/`,
          iccUrl: `${base}iccs/`,
          isEvalSupported: false,
          disableStream: false,
        }).promise
        if (this.destroyed) return
        this.loaded = true
        await this.buildLayout()
        this.onReady({ pages: this.doc.numPages })
      }

      /** Width available for a page, honouring the 12px inset. */
      measure() {
        const width = this.scroll.clientWidth - 24
        return Math.max(160, width)
      }

      async firstViewport(scale) {
        const page = await this.doc.getPage(1)
        return page.getViewport({ scale })
      }

      async buildLayout() {
        if (this.doc === undefined) return
        const probe = await this.firstViewport(1)
        const available = this.measure()
        this.fitWidth = available / probe.width
        const scale = this.scaleMode === 'fit' ? this.fitWidth : this.fixedScale
        this.zoom = scale
        const count = this.doc.numPages
        this.pages.replaceChildren()
        this.records = []
        const placeholderHeight = Math.round(probe.height * scale)
        for (let index = 0; index < count; index += 1) {
          const el = document.createElement('div')
          el.className = 'pr-page pr-page--placeholder'
          el.dataset.page = `${index + 1}`
          el.style.width = `${Math.round(probe.width * scale)}px`
          el.style.height = `${placeholderHeight}px`
          this.pages.append(el)
          this.records.push({ el, index, rendered: false, task: undefined, textLayer: undefined, highlight: undefined })
        }
        this.observe()
        this.paintHighlights()
        if (this.onClick === undefined) this.attachClickHandler()
      }

      observe() {
        this.observer?.disconnect()
        if (typeof IntersectionObserver !== 'function') {
          for (const record of this.records) this.scheduleRender(record)
          return
        }
        this.observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue
              const record = this.records.find((candidate) => candidate.el === entry.target)
              if (record !== undefined) this.scheduleRender(record)
            }
          },
          { root: this.scroll, rootMargin: '600px 0px' },
        )
        for (const record of this.records) this.observer.observe(record.el)
      }

      /** A plain click on an existing highlight opens its annotation, when the
       * click did not produce a text selection (so selecting across a highlight
       * still selects). */
      attachClickHandler() {
        this.onClick = (event) => {
          if (this.onAnnotationClick === undefined) return
          const selection = window.getSelection()
          if (selection !== null && selection !== undefined && !selection.isCollapsed) return
          const annotation = this.annotationAtPoint(event.clientX, event.clientY)
          if (annotation === undefined) return
          event.preventDefault()
          this.onAnnotationClick(annotation)
        }
        this.pages.addEventListener('click', this.onClick)
      }

      /** Render one page record; also prepares the text layer. */
      scheduleRender(record) {
        if (record.rendered || record.pending || this.doc === undefined) return
        record.pending = true
        this.renderChain = this.renderChain
          .then(() => this.renderPage(record))
          .catch((error) => {
            console.error('paper-reader: page render failed', error)
          })
          .finally(() => {
            record.pending = false
          })
      }

      async renderPage(record) {
        if (this.destroyed || record.rendered) return
        const page = await this.doc.getPage(record.index + 1)
        if (this.destroyed) return
        const viewport = page.getViewport({ scale: this.zoom })
        const ratio = window.devicePixelRatio || 1
        const canvas = document.createElement('canvas')
        canvas.className = 'pr-canvas'
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        const context = canvas.getContext('2d', { alpha: false })
        const task = page.render({
          canvasContext: context,
          canvas,
          viewport,
          transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null,
        })
        record.task = task
        try {
          await task.promise
        } catch (error) {
          if (error?.name !== 'RenderingCancelledException') throw error
          return
        }
        if (this.destroyed) return

        const textContainer = document.createElement('div')
        textContainer.className = 'pr-text'
        const textLayerDiv = document.createElement('div')
        textLayerDiv.className = 'pr-textLayer'
        textContainer.append(textLayerDiv)
        const highlightLayer = document.createElement('div')
        highlightLayer.className = 'pr-hl'

        record.el.replaceChildren(canvas, highlightLayer, textContainer)
        record.el.classList.remove('pr-page--placeholder')
        record.el.style.width = `${Math.floor(viewport.width)}px`
        record.el.style.height = `${Math.floor(viewport.height)}px`
        record.el.style.setProperty('--total-scale-factor', `${viewport.scale * viewport.userUnit}`)
        record.el.style.setProperty('--scale-round-x', '1px')
        record.el.style.setProperty('--scale-round-y', '1px')

        const textLayer = new this.pdfjs.TextLayer({
          textContentSource: page.streamTextContent(),
          container: textLayerDiv,
          viewport,
        })
        record.textLayer = textLayer
        record.highlight = highlightLayer
        record.rendered = true
        this.drawHighlights(record)
        try {
          await textLayer.render()
        } catch (error) {
          console.error('paper-reader: text layer failed', error)
        }
      }

      setScale(next) {
        if (next === 'fit') {
          this.scaleMode = 'fit'
        } else {
          this.scaleMode = 'fixed'
          this.fixedScale = clamp(Number(next), 0.25, 4)
        }
        return this.relayout()
      }

      async relayout() {
        if (this.doc === undefined) return
        const anchor = this.currentPage()
        for (const record of this.records) {
          record.task?.cancel?.()
          record.textLayer?.cancel?.()
        }
        await this.buildLayout()
        const target = this.records[anchor - 1]
        if (target !== undefined) this.scroll.scrollTop = target.el.offsetTop - 12
      }

      currentPage() {
        const top = this.scroll.scrollTop + 24
        let best = 1
        for (const record of this.records) {
          if (record.el.offsetTop <= top) best = record.index + 1
        }
        return best
      }

      /** Normalized rects for the current selection, page by page. */
      selection() {
        const selection = window.getSelection()
        if (selection === null || selection === undefined || selection.isCollapsed || selection.rangeCount === 0) return undefined
        const range = selection.getRangeAt(0)
        if (!this.pages.contains(range.commonAncestorContainer)) return undefined
        const text = selection.toString().replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim()
        if (text === '') return undefined
        const rects = []
        let first
        for (const rect of range.getClientRects()) {
          if (rect.width < 1 || rect.height < 1) continue
          const record = this.recordAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
          if (record === undefined) continue
          const box = record.el.getBoundingClientRect()
          const normalized = {
            page: record.index + 1,
            x: (rect.left - box.left) / box.width,
            y: (rect.top - box.top) / box.height,
            w: rect.width / box.width,
            h: rect.height / box.height,
          }
          rects.push(normalized)
          if (first === undefined) first = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
        }
        if (rects.length === 0 || first === undefined) return undefined
        const anchor = { left: first.left, top: first.top, right: first.right, bottom: first.bottom }
        return { text, rects, anchor, page: rects[0].page }
      }

      recordAtPoint(x, y) {
        for (const record of this.records) {
          const box = record.el.getBoundingClientRect()
          if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return record
        }
        return undefined
      }

      clearSelection() {
        window.getSelection()?.removeAllRanges()
      }

      setAnnotations(annotations) {
        this.annotations = annotations ?? []
        this.paintHighlights()
      }

      paintHighlights() {
        for (const record of this.records) this.drawHighlights(record)
      }

      drawHighlights(record) {
        const layer = record.highlight
        if (layer === undefined) return
        layer.replaceChildren()
        for (const annotation of this.annotations) {
          if (annotation.page !== record.index + 1) continue
          for (const rect of annotation.rects ?? []) {
            const mark = document.createElement('div')
            mark.className = annotation.note ? 'pr-hl__mark pr-hl__mark--note' : 'pr-hl__mark'
            mark.style.left = `${rect.x * 100}%`
            mark.style.top = `${rect.y * 100}%`
            mark.style.width = `${rect.w * 100}%`
            mark.style.height = `${rect.h * 100}%`
            mark.dataset.annotation = annotation.id
            layer.append(mark)
          }
        }
      }

      /**
       * The annotation under a point, if any. Hit-testing is done here rather
       * than with clickable mark elements because the mark layer sits under the
       * text layer, and the text layer must keep receiving every pointer event
       * so selection keeps working across the whole page.
       */
      annotationAtPoint(clientX, clientY) {
        for (const record of this.records) {
          const box = record.el.getBoundingClientRect()
          const x = (clientX - box.left) / box.width
          const y = (clientY - box.top) / box.height
          if (x < 0 || x > 1 || y < 0 || y > 1) continue
          for (const annotation of this.annotations) {
            if (annotation.page !== record.index + 1) continue
            for (const rect of annotation.rects ?? []) {
              if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return annotation
            }
          }
        }
        return undefined
      }

      gotoPage(pageNumber) {
        const record = this.records[clamp(pageNumber, 1, this.records.length) - 1]
        if (record === undefined) return
        this.scroll.scrollTo({ top: Math.max(0, record.el.offsetTop - 12), behavior: 'smooth' })
        record.el.animate?.(
          [
            { boxShadow: '0 0 0 2px rgba(47,111,208,.9)' },
            { boxShadow: '0 0 0 2px rgba(47,111,208,0)' },
          ],
          { duration: 1200, easing: 'ease-out' },
        )
      }

      gotoAnnotation(annotation) {
        this.gotoPage(annotation.page)
        const record = this.records[annotation.page - 1]
        if (record === undefined || record.highlight === undefined) return
        for (const mark of record.highlight.querySelectorAll('[data-annotation]')) {
          if (mark.dataset.annotation === annotation.id) mark.classList.add('pr-hl__mark--active')
        }
        setTimeout(() => {
          for (const mark of record.highlight?.querySelectorAll('.pr-hl__mark--active') ?? []) {
            mark.classList.remove('pr-hl__mark--active')
          }
        }, 1600)
      }

      handleScroll() {
        const page = this.currentPage()
        if (page !== this.pageNumber) {
          this.pageNumber = page
          this.onPageChange(page)
        }
      }

      destroy() {
        this.destroyed = true
        this.observer?.disconnect()
        this.observer = undefined
        this.resizeObserver?.disconnect()
        if (this.onClick !== undefined) {
          this.pages.removeEventListener('click', this.onClick)
          this.onClick = undefined
        }
        for (const record of this.records) {
          record.task?.cancel?.()
          record.textLayer?.cancel?.()
        }
        this.records = []
        const doc = this.doc
        this.doc = undefined
        doc?.destroy?.().catch(() => {})
        this.pages.replaceChildren()
      }
    }

    /* ------------------------------------------------------------------ *
     * Composer bridge.
     *
     * `inputActions` is a per-Session standard prop. The right Sidebar seat
     * publishes it too, but a compact composer control is the seat this
     * feature needs for a guaranteed live handle, so one registered
     * `conversation.input.right` entry publishes the newest `inputActions`
     * here and the reader falls back to it when its own props lack one.
     * ------------------------------------------------------------------ */

    const composerBus = {
      bySession: new Map(),
      put(sessionId, actions) {
        if (typeof sessionId !== 'string' || actions === undefined) return
        this.bySession.set(sessionId, actions)
      },
      take(sessionId) {
        return typeof sessionId === 'string' ? this.bySession.get(sessionId) : undefined
      },
      drop(sessionId) {
        this.bySession.delete(sessionId)
      },
    }

    function ComposerBridge(props) {
      const { sessionId, inputActions } = props
      useEffect(() => {
        if (sessionId === undefined || inputActions === undefined) return undefined
        composerBus.put(sessionId, inputActions)
        return () => composerBus.drop(sessionId)
      }, [sessionId, inputActions])
      return null
    }

    /* ------------------------------------------------------------------ *
     * Host transport.
     * ------------------------------------------------------------------ */

    async function listPapers() {
      try {
        const response = await fetch(apiUrl('papers'), { credentials: 'same-origin', cache: 'no-store' })
        if (!response.ok) return []
        const payload = await response.json()
        return Array.isArray(payload?.papers) ? payload.papers : []
      } catch {
        return []
      }
    }

    async function uploadPaper(file) {
      const response = await fetch(apiUrl('papers'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/pdf',
          'x-paper-title': encodeURIComponent(file.name ?? 'paper.pdf'),
        },
        body: file,
      })
      if (!response.ok) throw new Error(await response.text())
      return response.json()
    }

    async function removePaper(id) {
      const url = new URL(apiUrl('papers'))
      url.searchParams.set('id', id)
      await fetch(url.href, { method: 'DELETE', credentials: 'same-origin' }).catch(() => {})
    }

    async function loadAnnotations(paperId) {
      try {
        const url = new URL(apiUrl('annotations'))
        url.searchParams.set('paperId', paperId)
        const response = await fetch(url.href, { credentials: 'same-origin', cache: 'no-store' })
        if (!response.ok) return []
        const payload = await response.json()
        return Array.isArray(payload?.items) ? payload.items : []
      } catch {
        return []
      }
    }

    async function saveAnnotations(paperId, items) {
      await fetch(apiUrl('annotations'), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paperId, items }),
      })
    }

    function paperFileUrl(id) {
      const url = new URL(apiUrl('file'))
      url.searchParams.set('id', id)
      return url.href
    }

    /* ------------------------------------------------------------------ *
     * Small presentational pieces.
     * ------------------------------------------------------------------ */

    function PaperGlyph({ size = 16, className }) {
      return h(
        'svg',
        {
          viewBox: '0 0 64 64',
          width: size,
          height: size,
          className,
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('path', {
          d: 'M14 6h24l12 12v40a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 4,
          strokeLinejoin: 'round',
        }),
        h('path', { d: 'M38 6v8a4 4 0 0 0 4 4h8', fill: 'none', stroke: 'currentColor', strokeWidth: 4 }),
      )
    }

    function formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes <= 0) return ''
      const units = ['B', 'KB', 'MB', 'GB']
      let value = bytes
      let unit = 0
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024
        unit += 1
      }
      return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
    }

    /* ------------------------------------------------------------------ *
     * The tab body.
     * ------------------------------------------------------------------ */

    function PaperReaderTab(props) {
      const { useTabInfo, t, inputActions } = props
      const { tab } = useTabInfo()
      const navigation = tab.navigation
      const revision = navigation.revision

      const [papers, setPapers] = useState([])
      const [paperId, setPaperId] = useState(navigation.params?.paperId)
      const [paperTitle, setPaperTitle] = useState(navigation.params?.paperTitle ?? '')
      const [annotations, setAnnotations] = useState([])
      const [status, setStatus] = useState('idle') // idle | loading | ready | failed
      const [errorText, setErrorText] = useState('')
      const [selecting, setSelecting] = useState(undefined)
      const [noteDraft, setNoteDraft] = useState(undefined)
      const [page, setPage] = useState(1)
      const [total, setTotal] = useState(0)
      const [zoomLabel, setZoomLabel] = useState('100')
      const [showAnnotations, setShowAnnotations] = useState(false)
      const [notice, setNotice] = useState('')
      const [busy, setBusy] = useState(false)
      const [reloadToken, setReloadToken] = useState(0)
      const [activeAnnotation, setActiveAnnotation] = useState(undefined)

      const scrollRef = useRef(null)
      const pagesRef = useRef(null)
      const surfaceRef = useRef(undefined)
      const fileRef = useRef(undefined)
      const annotationsRef = useRef([])
      annotationsRef.current = annotations

      useEffect(() => {
        if (document.querySelector('style[data-plugin-css="' + ID + '/paper-reader.css"]') !== null) return
        const tag = document.createElement('style')
        tag.dataset.plugin = ID
        tag.dataset.pluginCss = `${ID}/paper-reader.css`
        tag.textContent = CSS
        document.head.append(tag)
      }, [])

      const refreshPapers = async () => {
        const list = await listPapers()
        setPapers(list)
        return list
      }

      useEffect(() => {
        refreshPapers()
      }, [])

      // Adopt a paper named by the tab's navigation (guide-open or programmatic).
      useEffect(() => {
        const requested = navigation.params?.paperId
        if (typeof requested === 'string' && requested !== '') {
          setPaperId(requested)
          if (typeof navigation.params?.paperTitle === 'string') setPaperTitle(navigation.params.paperTitle)
        }
      }, [revision])

      // Build and drive the surface for the open paper.
      useEffect(() => {
        if (paperId === undefined || paperId === '' || scrollRef.current === null || pagesRef.current === null) return
        let cancelled = false
        setStatus('loading')
        setErrorText('')
        setTotal(0)
        setPage(1)
        const surface = new PaperSurface({
          scroll: scrollRef.current,
          pages: pagesRef.current,
          onReady: ({ pages: count }) => {
            if (cancelled) return
            setTotal(count)
            setStatus('ready')
            const current = surfaceRef.current
            if (current !== undefined) setZoomLabel(`${Math.round(current.zoom * 100)}`)
          },
          onPageChange: (next) => {
            if (!cancelled) setPage(next)
          },
          onAnnotationClick: (annotation) => {
            setActiveAnnotation(annotation)
            setNoteDraft({ info: { text: annotation.quote, anchor: undefined }, editing: annotation })
          },
        })
        surfaceRef.current = surface
        surface
          .load({ url: paperFileUrl(paperId), annotations: annotationsRef.current })
          .catch((error) => {
            if (cancelled) return
            setStatus('failed')
            setErrorText(error instanceof Error ? error.message : String(error))
          })
        const onResize = () => {
          if (surface.scaleMode === 'fit') surface.relayout().catch(() => {})
        }
        if (typeof ResizeObserver === 'function') {
          surface.resizeObserver = new ResizeObserver(onResize)
          surface.resizeObserver.observe(scrollRef.current)
        }
        return () => {
          cancelled = true
          surface.destroy()
          surfaceRef.current = undefined
        }
      }, [paperId, reloadToken])

      // Annotations belong to the open paper; reload when it changes.
      useEffect(() => {
        if (paperId === undefined) {
          setAnnotations([])
          return
        }
        let cancelled = false
        loadAnnotations(paperId).then((items) => {
          if (cancelled) return
          setAnnotations(items)
          surfaceRef.current?.setAnnotations(items)
        })
        return () => {
          cancelled = true
        }
      }, [paperId])

      // Selection tracking: the floating menu needs the live selection.
      useEffect(() => {
        const onSelectionChange = () => {
          const surface = surfaceRef.current
          if (surface === undefined || surface.records.length === 0) return
          const info = surface.selection()
          setSelecting((previous) => {
            if (info === undefined) return undefined
            if (previous !== undefined && previous.text === info.text) return previous
            return info
          })
        }
        document.addEventListener('selectionchange', onSelectionChange)
        return () => document.removeEventListener('selectionchange', onSelectionChange)
      }, [])

      useEffect(() => {
        const scroll = scrollRef.current
        if (scroll === null) return
        const handler = () => {
          surfaceRef.current?.handleScroll()
          if (selecting !== undefined) setSelecting(undefined)
        }
        scroll.addEventListener('scroll', handler, { passive: true })
        return () => scroll.removeEventListener('scroll', handler)
      }, [selecting])

      const persist = async (items) => {
        setAnnotations(items)
        surfaceRef.current?.setAnnotations(items)
        if (paperId !== undefined) await saveAnnotations(paperId, items).catch(() => {})
      }

      const addAnnotation = async ({ quote, rects, page: pageNumber, note }) => {
        const item = {
          id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          page: pageNumber,
          quote,
          rects,
          note: note ?? '',
          createdAt: Date.now(),
        }
        await persist([...annotationsRef.current, item])
        return item
      }

      const copyText = async (text) => {
        try {
          await navigator.clipboard.writeText(text)
          setNotice(t('ask.notice'))
        } catch {
          setNotice('')
        }
        setTimeout(() => setNotice(''), 2000)
      }

      /** Insert the passage question into the composer, in the interface language. */
      const askInChat = (info) => {
        const title = paperTitle
        const prompt = title
          ? t('ask.template', { title, quote: info.text })
          : t('ask.templateNoTitle', { quote: info.text })
        let inserted = false
        // The seat's own prop first, then the composer-bridge handle, which a
        // compact registered control publishes for this Session.
        const actions =
          inputActions !== undefined && typeof inputActions.captureInsertion === 'function'
            ? inputActions
            : composerBus.take(props.sessionId)
        if (actions !== undefined && typeof actions.captureInsertion === 'function') {
          const span = actions.captureInsertion()
          inserted = actions.insertText(prompt, span) === true
          if (!inserted && typeof actions.setDraft === 'function') {
            const existing = typeof props.useInput === 'function' ? props.useInput((state) => state?.draft ?? '') : ''
            actions.setDraft(existing !== '' ? `${existing}\n\n${prompt}` : prompt)
            inserted = true
          }
        }
        if (inserted) {
          setNotice(t('ask.notice'))
        } else {
          setNotice(t('ask.unavailable'))
        }
        setTimeout(() => setNotice(''), 2600)
        surfaceRef.current?.clearSelection()
        setSelecting(undefined)
      }

      const openPaper = (paper) => {
        setPaperId(paper.id)
        setPaperTitle(paper.title)
        setAnnotations([])
        setPage(1)
      }

      const chooseFile = () => fileRef.current?.click()

      const onFile = async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file === undefined) return
        setBusy(true)
        try {
          const stored = await uploadPaper(file)
          await refreshPapers()
          openPaper(stored)
        } catch {
          setNotice(t('upload.failed'))
          setTimeout(() => setNotice(''), 2600)
        } finally {
          setBusy(false)
        }
      }

      const removeFromList = async (paper) => {
        await removePaper(paper.id)
        if (paperId === paper.id) {
          setPaperId(undefined)
          setPaperTitle('')
          setAnnotations([])
        }
        await refreshPapers()
      }

      const zoomBy = (delta) => {
        const surface = surfaceRef.current
        if (surface === undefined) return
        const next = clamp(surface.zoom + delta, 0.25, 4)
        surface.setScale(next)
        setZoomLabel(`${Math.round(next * 100)}`)
      }

      const fitWidth = () => {
        surfaceRef.current?.setScale('fit')
        setTimeout(() => {
          const surface = surfaceRef.current
          if (surface !== undefined) setZoomLabel(`${Math.round(surface.zoom * 100)}`)
        }, 80)
      }

      const hasPaper = typeof paperId === 'string' && paperId !== ''

      const toolbar = hasPaper
        ? h(
            'div',
            { className: 'pr-bar' },
            h('span', { className: 'pr-bar__title', title: paperTitle }, paperTitle || t('tab.title')),
            h(
              'button',
              { type: 'button', className: 'pr-btn', onClick: () => zoomBy(-0.1), 'aria-label': t('zoom.out'), title: t('zoom.out') },
              '−',
            ),
            h('span', { className: 'pr-statusLine' }, `${zoomLabel}%`),
            h(
              'button',
              { type: 'button', className: 'pr-btn', onClick: () => zoomBy(0.1), 'aria-label': t('zoom.in'), title: t('zoom.in') },
              '+',
            ),
            h('button', { type: 'button', className: 'pr-btn', onClick: fitWidth }, t('zoom.fit')),
            total > 0
              ? h('span', { className: 'pr-statusLine' }, t('page.of', { page, total }))
              : null,
            h(
              'button',
              {
                type: 'button',
                className: 'pr-btn',
                'aria-pressed': showAnnotations,
                onClick: () => setShowAnnotations((value) => !value),
              },
              t('annotations.title'),
            ),
            h('button', { type: 'button', className: 'pr-btn', onClick: chooseFile }, t('empty.upload')),
          )
        : null

      const menu =
        selecting !== undefined
          ? h(SelectionMenu, {
              info: selecting,
              t,
              onHighlight: async () => {
                await addAnnotation({ quote: selecting.text, rects: selecting.rects, page: selecting.page })
                surfaceRef.current?.clearSelection()
                setSelecting(undefined)
              },
              onNote: () => {
                setNoteDraft({ info: selecting })
                setSelecting(undefined)
              },
              onAsk: () => askInChat(selecting),
              onCopy: () => copyText(selecting.text),
            })
          : null

      const dialog =
        noteDraft !== undefined
          ? h(NoteDialog, {
              t,
              info: noteDraft.info,
              initialText: noteDraft.editing?.note ?? '',
              onCancel: () => {
                setNoteDraft(undefined)
                setActiveAnnotation(undefined)
              },
              onSave: async (text) => {
                if (noteDraft.editing !== undefined) {
                  const target = noteDraft.editing
                  const next = annotationsRef.current.map((item) =>
                    item.id === target.id ? { ...item, note: text } : item,
                  )
                  await persist(next)
                } else {
                  await addAnnotation({
                    quote: noteDraft.info.text,
                    rects: noteDraft.info.rects,
                    page: noteDraft.info.page,
                    note: text,
                  })
                }
                setNoteDraft(undefined)
                setActiveAnnotation(undefined)
                surfaceRef.current?.clearSelection()
              },
            })
          : null

      const annotationPanel =
        showAnnotations && hasPaper
          ? h(AnnotationsPanel, {
              t,
              items: annotations,
              onJump: (annotation) => surfaceRef.current?.gotoAnnotation(annotation),
              onDelete: async (annotation) => {
                await persist(annotationsRef.current.filter((item) => item.id !== annotation.id))
              },
            })
          : null

      return h(
        'div',
        { className: 'pr-root' },
        h('input', {
          ref: fileRef,
          className: 'pr-file',
          type: 'file',
          accept: 'application/pdf',
          onChange: onFile,
        }),
        toolbar,
        notice !== '' ? h('div', { className: 'pr-status' }, notice) : null,
        h(
          'div',
          { className: 'pr-body' },
          h(
            'div',
            { className: 'pr-main' },
            h(
              'div',
              { className: 'pr-scroll', ref: scrollRef },
              hasPaper
                ? h('div', { className: 'pr-pages', ref: pagesRef })
                : h(PaperList, {
                    t,
                    papers,
                    busy,
                    onOpen: openPaper,
                    onUpload: chooseFile,
                    onRemove: removeFromList,
                  }),
              hasPaper && status === 'loading'
                ? h('div', { className: 'pr-status' }, t('loading'))
                : null,
              hasPaper && status === 'failed'
                ? h(
                    'div',
                    { className: 'pr-empty' },
                    h('p', { className: 'pr-empty__title' }, t('loadFailed')),
                    errorText !== '' ? h('p', { className: 'pr-empty__body' }, errorText) : null,
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'pr-btn',
                        onClick: () => {
                          setStatus('loading')
                          setReloadToken((value) => value + 1)
                        },
                      },
                      t('retry'),
                    ),
                  )
                : null,
            ),
            menu,
            dialog,
          ),
          annotationPanel,
        ),
      )
    }

    function PaperList({ t, papers, busy, onOpen, onUpload, onRemove }) {
      return h(
        'div',
        { className: 'pr-empty' },
        h(PaperGlyph, { size: 40, className: undefined }),
        h('p', { className: 'pr-empty__title' }, t('empty.title')),
        h('p', { className: 'pr-empty__body' }, t('empty.body')),
        h(
          'button',
          { type: 'button', className: 'pr-btn', onClick: onUpload, disabled: busy },
          busy ? t('upload.reading') : t('empty.upload'),
        ),
        papers.length === 0
          ? h('p', { className: 'pr-empty__body' }, t('empty.emptyList'))
          : h(
              'div',
              { className: 'pr-list' },
              papers.map((paper) =>
                h(
                  'div',
                  { className: 'pr-list__row', key: paper.id },
                  h('span', { className: 'pr-list__name', title: paper.title }, paper.title),
                  h('span', { className: 'pr-list__meta' }, formatBytes(paper.bytes)),
                  h('button', { type: 'button', className: 'pr-btn', onClick: () => onOpen(paper) }, t('empty.open')),
                  h('button', { type: 'button', className: 'pr-btn', onClick: () => onRemove(paper) }, t('empty.remove')),
                ),
              ),
            ),
      )
    }

    function SelectionMenu({ info, t, onHighlight, onNote, onAsk, onCopy }) {
      const width = 300
      const left = clamp(info.anchor.left, 8, Math.max(8, window.innerWidth - width - 8))
      const top = info.anchor.top - 44
      const position = top < 8 ? { left, top: info.anchor.bottom + 8 } : { left, top }
      const menu = h(
        'div',
        { className: 'pr-menu', style: position, role: 'toolbar' },
        h(
          'button',
          { type: 'button', className: 'pr-menu__item', onPointerDown: (event) => event.preventDefault(), onClick: onHighlight },
          t('menu.highlight'),
        ),
        h(
          'button',
          { type: 'button', className: 'pr-menu__item', onPointerDown: (event) => event.preventDefault(), onClick: onNote },
          t('menu.note'),
        ),
        h(
          'button',
          { type: 'button', className: 'pr-menu__item', onPointerDown: (event) => event.preventDefault(), onClick: onAsk },
          t('menu.ask'),
        ),
        h(
          'button',
          { type: 'button', className: 'pr-menu__item', onPointerDown: (event) => event.preventDefault(), onClick: onCopy },
          t('menu.copy'),
        ),
      )
      return createPortal !== undefined ? createPortal(menu, document.body) : menu
    }

    function NoteDialog({ t, info, initialText, onCancel, onSave }) {
      const [text, setText] = useState(initialText ?? '')
      const anchor = info.anchor
      const style =
        anchor === undefined
          ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
          : {
              left: clamp(anchor.left, 8, Math.max(8, window.innerWidth - 384)),
              top: Math.min(anchor.bottom + 10, Math.max(8, window.innerHeight - 220)),
            }
      const dialog = h(
        'div',
        {
          className: 'pr-dialog',
          style,
          role: 'dialog',
          'aria-label': t('note.title'),
        },
        h('p', { className: 'pr-dialog__quote' }, info.text),
        h('textarea', {
          className: 'pr-dialog__area',
          autoFocus: true,
          value: text,
          placeholder: t('note.placeholder'),
          onChange: (event) => setText(event.target.value),
          onKeyDown: (event) => {
            if (event.key === 'Escape') onCancel()
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onSave(text.trim())
          },
        }),
        h(
          'div',
          { className: 'pr-dialog__row' },
          h('button', { type: 'button', className: 'pr-btn', onClick: onCancel }, t('note.cancel')),
          h(
            'button',
            { type: 'button', className: 'pr-btn pr-dialog__primary', onClick: () => onSave(text.trim()) },
            t('note.save'),
          ),
        ),
      )
      return createPortal !== undefined ? createPortal(dialog, document.body) : dialog
    }

    function AnnotationsPanel({ t, items, onJump, onDelete }) {
      return h(
        'aside',
        { className: 'pr-annot' },
        h(
          'div',
          { className: 'pr-annot__head' },
          h('span', null, t('annotations.count', { count: items.length })),
        ),
        items.length === 0
          ? h('div', { className: 'pr-annot__empty' }, t('annotations.empty'))
          : h(
              'div',
              { className: 'pr-annot__list' },
              items.map((item) =>
                h(
                  'div',
                  {
                    className: 'pr-annot__card',
                    key: item.id,
                    role: 'button',
                    tabIndex: 0,
                    onClick: () => onJump(item),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') onJump(item)
                    },
                  },
                  h('p', { className: 'pr-annot__quote' }, item.quote),
                  item.note !== '' ? h('p', { className: 'pr-annot__note' }, item.note) : null,
                  h(
                    'div',
                    { className: 'pr-annot__meta' },
                    h('span', null, `p.${item.page}`),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'pr-btn',
                        onClick: (event) => {
                          event.stopPropagation()
                          onDelete(item)
                        },
                      },
                      t('note.delete'),
                    ),
                  ),
                ),
              ),
            ),
      )
    }

    function PaperTitle({ useTabInfo, t }) {
      const { tab } = useTabInfo()
      const title = tab.navigation?.params?.paperTitle
      return h(
        'span',
        { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 } },
        h(PaperGlyph, { size: 16 }),
        h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, title || t('tab.title')),
      )
    }

    /* ------------------------------------------------------------------ *
     * Plugin body.
     * ------------------------------------------------------------------ */

    const inject = ['slots', 'locale', 'sidebarRightTabs']

    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(NS, { zh, en }),
        'paper-reader: dictionaries',
      )
      for (const [locale, dict] of Object.entries(askOnly)) {
        ctx.effect(() => ctx.locale.register(NS, locale, dict), `paper-reader: ${locale} prompt copy`)
      }

      const t = ctx.locale.bind(NS)

      ctx.effect(
        () =>
          ctx.sidebarRightTabs.register({
            id: ID,
            kind: KIND,
            priority: 'extension',
            title: () => t('tab.title'),
            guide: [
              {
                id: 'reader',
                order: 18,
                title: () => t('guide.title'),
                description: () => t('guide.description'),
                icon: PaperGlyph,
              },
            ],
            keepMounted: true,
          }),
        'paper-reader: tab type',
      )

      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register({ name: 'sidebar.right.pane.tab', key: ID, locale: NS }, PaperReaderTab),
          ),
        'paper-reader: tab body',
      )

      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab.title', () =>
            ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: ID, locale: NS }, PaperTitle),
          ),
        'paper-reader: tab title',
      )

      // A zero-size control exactly so the composer publishes its live
      // `inputActions` handle for "Ask in chat"; it renders nothing visible.
      ctx.effect(
        () =>
          ctx.slots.inject('conversation.input.right', () =>
            ctx.slots.register({ name: 'conversation.input.right', id: `${ID}/composer-bridge`, order: 900 }, ComposerBridge),
          ),
        'paper-reader: composer bridge',
      )
    }

    return { inject, apply }
  },
})
