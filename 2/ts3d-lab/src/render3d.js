/**
 * Tiny software 3D renderer on Canvas 2D + orbit controls.
 *
 * Coordinates are right-handed: +X right, +Y up, +Z toward the viewer.
 * The camera orbits a `target` on a sphere given by (yaw, pitch, distance):
 *
 *   eye = target + distance * [ cos(pitch) sin(yaw), sin(pitch), cos(pitch) cos(yaw) ]
 *
 * `yaw` rotates around the Y axis (0 = looking from +Z), `pitch` is the
 * elevation above the horizontal plane (clamped by the orbit controller).
 *
 * A frame is composed by the caller in this exact order:
 *
 *   renderer.setSize(cssWidth, cssHeight, devicePixelRatio)
 *   renderer.setCamera({ yaw, pitch, distance, target })
 *   renderer.begin()
 *   ... renderer.box / bar / beam / dot / quad / text ...
 *   renderer.end()
 *
 * `end()` clears nothing (begin does), depth-sorts every queued primitive so
 * far things paint first, and paints labels in that same pass so a label is
 * occluded by nearer geometry exactly like a filled face.
 *
 * The module has no side effects at import time; it never touches the DOM
 * outside the canvas it is given.
 */

const DEFAULT_FOV = 45
const NEAR = 0.05
const MIN_LABEL = 9
const MAX_LABEL = 30
const MAX_LABEL_CHARS = 40

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}

function point3(p) {
  return Array.isArray(p) && isNum(p[0]) && isNum(p[1]) && isNum(p[2]) ? p : null
}

function vecNormalize(v) {
  const len = Math.hypot(v[0], v[1], v[2])
  if (len === 0 || !Number.isFinite(len)) return [0, 0, 1]
  return [v[0] / len, v[1] / len, v[2] / len]
}

function vecCross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function vecDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function vecSub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
  ctx.lineTo(x + radius, y + h)
  ctx.arcTo(x, y + h, x, y + h - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

function ellipsize(text) {
  const flat = String(text).split('\n')[0]
  return flat.length > MAX_LABEL_CHARS ? flat.slice(0, MAX_LABEL_CHARS - 1) + '…' : flat
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d')
  let width = 0
  let height = 0
  let dpr = 1
  let disposed = false

  const camera = {
    yaw: 0.6,
    pitch: 0.32,
    distance: 12,
    target: [0, 0, 0],
    fov: DEFAULT_FOV,
  }

  /* Reused draw queue; each entry is a plain object we recycle. */
  const queue = []
  const scratch = []
  let queueCount = 0
  for (let i = 0; i < 512; i++) queue.push({ depth: 0, kind: '', data: null, order: 0 })
  let sequence = 0

  let eye = [0, 0, 0]
  let basisRight = [1, 0, 0]
  let basisUp = [0, 1, 0]
  let basisForward = [0, 0, 1]
  let focal = 1
  let cameraDirty = true

  function refreshCamera() {
    if (!cameraDirty) return
    const cp = Math.cos(camera.pitch)
    const sp = Math.sin(camera.pitch)
    const cy = Math.cos(camera.yaw)
    const sy = Math.sin(camera.yaw)
    eye = [
      camera.target[0] + camera.distance * cp * sy,
      camera.target[1] + camera.distance * sp,
      camera.target[2] + camera.distance * cp * cy,
    ]
    basisForward = vecNormalize(vecSub(camera.target, eye))
    basisRight = vecNormalize(vecCross([0, 1, 0], basisForward))
    if (!Number.isFinite(basisRight[0]) || Math.hypot(basisRight[0], basisRight[1], basisRight[2]) < 1e-6) {
      basisRight = [1, 0, 0]
    }
    basisRight = vecNormalize(basisRight)
    basisUp = vecNormalize(vecCross(basisForward, basisRight))
    const fovRad = (camera.fov * Math.PI) / 180
    focal = (height / 2) / Math.tan(fovRad / 2)
    cameraDirty = false
  }

  function allocate() {
    if (queueCount < queue.length) return queue[queueCount++]
    const entry = { depth: 0, kind: '', data: null, order: 0 }
    queue.push(entry)
    queueCount += 1
    return entry
  }

  function push(depth, kind, data) {
    const entry = allocate()
    entry.depth = Number.isFinite(depth) ? depth : -1e9
    entry.kind = kind
    entry.data = data
    entry.order = sequence++
  }

  function makeVertex(point) {
    const p = point3(point)
    if (p === null) return null
    const v = vecSub(p, eye)
    const x = vecDot(v, basisRight)
    const y = vecDot(v, basisUp)
    const z = vecDot(v, basisForward)
    if (!(z > NEAR)) {
      return { x: NaN, y: NaN, depth: z, scale: 0, raw: p }
    }
    const scale = focal / z
    return {
      x: width / 2 + x * scale,
      y: height / 2 - y * scale,
      depth: z,
      scale,
      raw: p,
    }
  }

  function project(point) {
    refreshCamera()
    const vertex = makeVertex(point)
    if (vertex === null || !Number.isFinite(vertex.x)) {
      return { x: NaN, y: NaN, depth: -1, scale: 0 }
    }
    return { x: vertex.x, y: vertex.y, depth: vertex.depth, scale: vertex.scale }
  }

  /** Faces of an axis-aligned box: [corner indices in CCW order seen from outside]. */
  const BOX_CORNERS = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
  ]
  const BOX_FACES = [
    [4, 5, 6, 7], // +Z
    [1, 0, 3, 2], // -Z
    [5, 1, 2, 6], // +X
    [0, 4, 7, 3], // -X
    [7, 6, 2, 3], // +Y
    [0, 1, 5, 4], // -Y
  ]
  const BOX_EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ]

  function box(options) {
    refreshCamera()
    const center = point3(options.center)
    const size = options.size
    if (center === null || !Array.isArray(size) || !isNum(size[0]) || !isNum(size[1]) || !isNum(size[2])) return
    const opts = {
      color: options.color ?? '#6ea8ff',
      opacity: isNum(options.opacity) ? clamp(options.opacity, 0, 1) : 0.9,
      wire: options.wire === true,
      wireColor: options.wireColor ?? options.color ?? '#6ea8ff',
      label: options.label,
      labelColor: options.labelColor ?? '#f2f5ff',
      labelSize: isNum(options.labelSize) ? options.labelSize : 12,
      labelAnchor: options.labelAnchor ?? 'center',
      labelPlate: options.labelPlate === true,
    }
    const verts = new Array(8)
    for (let i = 0; i < 8; i++) {
      const c = BOX_CORNERS[i]
      verts[i] = makeVertex([
        center[0] + c[0] * size[0] / 2,
        center[1] + c[1] * size[1] / 2,
        center[2] + c[2] * size[2] / 2,
      ])
    }
    if (verts.some((v) => v === null)) return

    let visible = 0
    for (const face of BOX_FACES) {
      const pts = [verts[face[0]], verts[face[1]], verts[face[2]], verts[face[3]]]
      if (pts.some((p) => !Number.isFinite(p.x))) continue
      /* Screen-space signed area: positive winding faces the camera. */
      let area = 0
      for (let i = 0; i < 4; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % 4]
        area += a.x * b.y - b.x * a.y
      }
      if (area <= 0) continue
      visible += 1
      const depth = (pts[0].depth + pts[1].depth + pts[2].depth + pts[3].depth) / 4
      push(depth, 'poly', { pts, color: opts.color, opacity: opts.opacity })
    }
    if (visible === 0 && opts.wire) visible = 1

    if (opts.wire) {
      for (const [a, b] of BOX_EDGES) {
        const va = verts[a]
        const vb = verts[b]
        if (!Number.isFinite(va.x) || !Number.isFinite(vb.x)) continue
        push(Math.min(va.depth, vb.depth) - 0.001, 'line', {
          x1: va.x, y1: va.y, x2: vb.x, y2: vb.y,
          color: opts.wireColor, width: 1, opacity: clamp(opts.opacity + 0.1, 0, 1),
        })
      }
    }
    if (opts.label !== undefined && opts.label !== null) {
      const labelPoint = options.labelPosition
        ? makeVertex(options.labelPosition)
        : makeVertex([center[0], center[1] + size[1] / 2 + 0.35, center[2]])
      if (labelPoint !== null && Number.isFinite(labelPoint.x)) {
        push(labelPoint.depth - 0.02, 'text', {
          x: labelPoint.x, y: labelPoint.y,
          text: ellipsize(opts.label), color: opts.labelColor,
          size: opts.labelSize, anchor: opts.labelAnchor,
          scale: labelPoint.scale, weight: options.labelWeight ?? 600,
          plate: opts.labelPlate,
        })
      }
    }
  }

  function bar(options) {
    const base = point3(options.base)
    if (base === null) return
    const heightValue = isNum(options.height) ? options.height : 0
    const widthValue = isNum(options.width) ? options.width : 0.4
    const depthValue = isNum(options.depth) ? options.depth : widthValue
    box({
      center: [base[0], base[1] + heightValue / 2, base[2]],
      size: [widthValue, heightValue, depthValue],
      color: options.color,
      opacity: options.opacity,
      wire: options.wire,
      wireColor: options.wireColor,
      label: options.label,
      labelColor: options.labelColor,
      labelSize: options.labelSize,
      labelPosition: [base[0], base[1] + heightValue + 0.28, base[2]],
      labelPlate: options.labelPlate,
    })
  }

  function beam(options) {
    refreshCamera()
    const a = makeVertex(options.from)
    const b = makeVertex(options.to)
    if (a === null || b === null) return
    if (!Number.isFinite(a.x) || !Number.isFinite(b.x)) return
    const widthValue = isNum(options.width) ? options.width : 1.5
    const opacity = isNum(options.opacity) ? clamp(options.opacity, 0, 1) : 0.8
    /* Use the nearer endpoint so a beam is not hidden behind its own tail. */
    const depth = Math.min(a.depth, b.depth)
    push(depth, 'beam', {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      color: options.color ?? '#8fb7ff',
      width: widthValue, opacity,
      arrow: options.arrow === true,
      dash: options.dash === true,
    })
  }

  function dot(options) {
    refreshCamera()
    const vertex = makeVertex(options.center)
    if (vertex === null || !Number.isFinite(vertex.x)) return
    const radius = isNum(options.radius) ? options.radius : 4
    const scale = Math.max(0.05, vertex.scale / (focal / Math.max(1, camera.distance)))
    push(vertex.depth, 'dot', {
      x: vertex.x, y: vertex.y,
      r: Math.max(0.6, radius * scale),
      color: options.color ?? '#ffffff',
      opacity: isNum(options.opacity) ? clamp(options.opacity, 0, 1) : 1,
      stroke: options.stroke ?? null,
      strokeWidth: isNum(options.strokeWidth) ? options.strokeWidth : 1,
    })
  }

  function quad(options) {
    refreshCamera()
    const points = options.points
    if (!Array.isArray(points) || points.length < 3) return
    const verts = []
    for (const p of points) {
      const v = makeVertex(p)
      if (v === null || !Number.isFinite(v.x)) return
      verts.push(v)
    }
    let depth = 0
    for (const v of verts) depth += v.depth
    depth /= verts.length
    push(depth, 'poly', {
      pts: verts,
      color: options.color ?? '#22406e',
      opacity: isNum(options.opacity) ? clamp(options.opacity, 0, 1) : 0.5,
      stroke: options.stroke ?? null,
      strokeWidth: isNum(options.strokeWidth) ? options.strokeWidth : 1,
    })
  }

  function text(options) {
    refreshCamera()
    const vertex = makeVertex(options.position)
    if (vertex === null || !Number.isFinite(vertex.x)) return
    const size = isNum(options.size) ? options.size : 12
    push(vertex.depth - 0.01, 'text', {
      x: vertex.x, y: vertex.y,
      text: ellipsize(options.text ?? ''),
      color: options.color ?? '#e8eeff',
      size, anchor: options.anchor ?? 'center',
      scale: vertex.scale,
      weight: options.weight ?? 500,
      baseline: options.baseline,
      plate: options.plate === true,
    })
  }

  /* ------------------------------------------------------------------ *
   * Painting
   * ------------------------------------------------------------------ */

  function paintPoly(data) {
    const pts = data.pts
    ctx.save()
    ctx.globalAlpha = data.opacity
    ctx.fillStyle = data.color
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath()
    ctx.fill()
    if (data.stroke) {
      ctx.globalAlpha = Math.min(1, data.opacity + 0.2)
      ctx.strokeStyle = data.stroke
      ctx.lineWidth = data.strokeWidth
      ctx.stroke()
    }
    ctx.restore()
  }

  function paintLine(data) {
    ctx.save()
    ctx.globalAlpha = data.opacity
    ctx.strokeStyle = data.color
    ctx.lineWidth = data.width
    ctx.beginPath()
    ctx.moveTo(data.x1, data.y1)
    ctx.lineTo(data.x2, data.y2)
    ctx.stroke()
    ctx.restore()
  }

  function paintBeam(data) {
    ctx.save()
    ctx.globalAlpha = data.opacity
    ctx.strokeStyle = data.color
    ctx.lineWidth = data.width
    if (data.dash) ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(data.x1, data.y1)
    ctx.lineTo(data.x2, data.y2)
    ctx.stroke()
    ctx.setLineDash([])
    if (data.arrow) {
      const angle = Math.atan2(data.y2 - data.y1, data.x2 - data.x1)
      const head = Math.max(5, data.width * 2.2)
      ctx.beginPath()
      ctx.moveTo(data.x2, data.y2)
      ctx.lineTo(data.x2 - head * Math.cos(angle - 0.4), data.y2 - head * Math.sin(angle - 0.4))
      ctx.lineTo(data.x2 - head * Math.cos(angle + 0.4), data.y2 - head * Math.sin(angle + 0.4))
      ctx.closePath()
      ctx.fillStyle = data.color
      ctx.fill()
    }
    ctx.restore()
  }

  function paintDot(data) {
    ctx.save()
    ctx.globalAlpha = data.opacity
    ctx.beginPath()
    ctx.arc(data.x, data.y, data.r, 0, Math.PI * 2)
    ctx.fillStyle = data.color
    ctx.fill()
    if (data.stroke) {
      ctx.strokeStyle = data.stroke
      ctx.lineWidth = data.strokeWidth
      ctx.stroke()
    }
    ctx.restore()
  }

  function paintText(data) {
    if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return
    const size = clamp(data.size * (0.55 + 0.45 * clamp(data.scale, 0.2, 1.6)), MIN_LABEL, MAX_LABEL)
    ctx.save()
    ctx.font = `${data.weight} ${Math.round(size)}px ui-sans-serif, -apple-system, "Segoe UI", sans-serif`
    ctx.textBaseline = data.baseline ?? 'middle'
    ctx.textAlign = data.anchor === 'left' ? 'left' : data.anchor === 'right' ? 'right' : 'center'
    const metrics = ctx.measureText(data.text)
    let x = clamp(data.x, 6, Math.max(6, width - 6))
    let y = clamp(data.y, size, Math.max(size, height - 6))

    if (data.plate) {
      const padX = 6
      const padY = 4
      const w = metrics.width + padX * 2
      const h = size + padY * 2
      const left = data.anchor === 'left' ? x : data.anchor === 'right' ? x - w : x - w / 2
      ctx.globalAlpha = 1
      ctx.fillStyle = 'rgba(10, 14, 24, 0.62)'
      roundRect(ctx, left, y - h / 2, w, h, 5)
      ctx.fill()
      x = left + padX + (data.anchor === 'left' ? 0 : 0)
      if (data.anchor !== 'left') {
        ctx.textAlign = 'left'
        x = left + padX
      }
    }
    ctx.fillStyle = data.color
    ctx.fillText(data.text, x, y)
    ctx.restore()
  }

  function paint(entry) {
    switch (entry.kind) {
      case 'poly': paintPoly(entry.data); break
      case 'line': paintLine(entry.data); break
      case 'beam': paintBeam(entry.data); break
      case 'dot': paintDot(entry.data); break
      case 'text': paintText(entry.data); break
      default: break
    }
  }

  function sortQueue() {
    scratch.length = 0
    for (let i = 0; i < queueCount; i++) scratch.push(queue[i])
    scratch.sort((a, b) => (b.depth - a.depth) || (a.order - b.order))
    return scratch
  }

  return {
    setSize(cssWidth, cssHeight, ratio) {
      const w = isNum(cssWidth) && cssWidth > 0 ? Math.round(cssWidth) : 0
      const h = isNum(cssHeight) && cssHeight > 0 ? Math.round(cssHeight) : 0
      const r = isNum(ratio) && ratio > 0 ? Math.min(3, ratio) : 1
      width = w
      height = h
      dpr = r
      if (w === 0 || h === 0) {
        canvas.width = 0
        canvas.height = 0
        return { width: w, height: h }
      }
      canvas.width = Math.round(w * r)
      canvas.height = Math.round(h * r)
      if (canvas.style !== undefined) {
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }
      ctx.setTransform(r, 0, 0, r, 0, 0)
      cameraDirty = true
      return { width: w, height: h }
    },
    setCamera(patch) {
      if (!patch || typeof patch !== 'object') return
      if (isNum(patch.yaw)) camera.yaw = patch.yaw
      if (isNum(patch.pitch)) camera.pitch = clamp(patch.pitch, -1.5, 1.5)
      if (isNum(patch.distance)) camera.distance = clamp(patch.distance, 0.5, 200)
      if (isNum(patch.fov)) camera.fov = clamp(patch.fov, 10, 100)
      if (Array.isArray(patch.target) && patch.target.length === 3 && patch.target.every(isNum)) {
        camera.target = [patch.target[0], patch.target[1], patch.target[2]]
      }
      cameraDirty = true
    },
    getCamera() {
      return {
        yaw: camera.yaw, pitch: camera.pitch, distance: camera.distance,
        target: [camera.target[0], camera.target[1], camera.target[2]], fov: camera.fov,
      }
    },
    begin() {
      if (disposed || width === 0 || height === 0) {
        queueCount = 0
        return
      }
      ctx.clearRect(0, 0, width, height)
      queueCount = 0
      sequence = 0
      refreshCamera()
    },
    project,
    box,
    bar,
    beam,
    dot,
    quad,
    text,
    end() {
      if (disposed || width === 0 || height === 0 || queueCount === 0) {
        queueCount = 0
        return
      }
      const active = sortQueue()
      for (let i = 0; i < active.length; i++) paint(active[i])
      queueCount = 0
    },
    dispose() {
      disposed = true
      queueCount = 0
    },
  }
}

/** Orbit controller: drag rotates, wheel/pinch zooms. */
export function attachOrbit(renderer, canvas, options = {}) {
  const home = {
    yaw: isNum(options.yaw) ? options.yaw : 0.62,
    pitch: isNum(options.pitch) ? options.pitch : 0.34,
    distance: isNum(options.distance) ? options.distance : 12,
    target: Array.isArray(options.target) && options.target.length === 3 ? options.target.slice() : [0, 0, 0],
  }
  let yaw = home.yaw
  let pitch = home.pitch
  let distance = home.distance
  let target = home.target.slice()
  const minDistance = isNum(options.minDistance) ? options.minDistance : 3.2
  const maxDistance = isNum(options.maxDistance) ? options.maxDistance : 26
  let dragging = false
  let lastX = 0
  let lastY = 0
  let pointerId = null
  const pointers = new Map()
  let pinchStart = 0
  let pinchStartDistance = distance
  let disposed = false

  const emit = () => {
    if (typeof options.onChange === 'function') options.onChange()
  }

  const apply = () => {
    renderer.setCamera({ yaw, pitch, distance, target })
  }

  const onPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0 && event.pointerType === 'mouse') return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size === 1) {
      dragging = true
      pointerId = event.pointerId
      lastX = event.clientX
      lastY = event.clientY
      if (typeof canvas.setPointerCapture === 'function') {
        try { canvas.setPointerCapture(event.pointerId) } catch { /* ignore */ }
      }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y)
      pinchStartDistance = distance
    }
    event.preventDefault()
  }

  const onPointerMove = (event) => {
    if (disposed) return
    const tracked = pointers.get(event.pointerId)
    if (!tracked) return
    tracked.x = event.clientX
    tracked.y = event.clientY
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const spread = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinchStart > 0 && spread > 0) {
        distance = clamp(pinchStartDistance * (pinchStart / spread), minDistance, maxDistance)
        apply()
        emit()
      }
      event.preventDefault()
      return
    }
    if (!dragging || event.pointerId !== pointerId) return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY
    yaw -= dx * 0.0075
    pitch = clamp(pitch + dy * 0.006, -1.35, 1.35)
    apply()
    emit()
    event.preventDefault()
  }

  const release = (event) => {
    pointers.delete(event.pointerId)
    if (pointers.size === 0) {
      dragging = false
      pointerId = null
    }
    if (typeof canvas.releasePointerCapture === 'function') {
      try { canvas.releasePointerCapture(event.pointerId) } catch { /* ignore */ }
    }
  }

  const onPointerUp = (event) => release(event)
  const onPointerCancel = (event) => release(event)
  const onWheel = (event) => {
    event.preventDefault()
    const delta = event.deltaY
    const factor = Math.exp((isNum(delta) ? delta : 0) * 0.0012)
    distance = clamp(distance * factor, minDistance, maxDistance)
    apply()
    emit()
  }

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false })
  canvas.addEventListener('pointermove', onPointerMove, { passive: false })
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerCancel)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.style.touchAction = 'none'
  canvas.style.cursor = 'grab'
  apply()

  return {
    reset() {
      yaw = home.yaw
      pitch = home.pitch
      distance = home.distance
      target = home.target.slice()
      apply()
      emit()
    },
    /**
     * Re-target the camera's focus WITHOUT changing the user's orbit angles or
     * zoom, used when the panel steps to a new stage. Returns the controller.
     */
    retarget(nextTarget, nextDistance) {
      if (Array.isArray(nextTarget) && nextTarget.length === 3 && nextTarget.every(isNum)) {
        target = [nextTarget[0], nextTarget[1], nextTarget[2]]
        home.target = target.slice()
      }
      if (isNum(nextDistance)) {
        distance = clamp(nextDistance, minDistance, maxDistance)
        home.distance = distance
      }
      apply()
      emit()
    },
    isDragging() { return dragging },
    dispose() {
      disposed = true
      pointers.clear()
      dragging = false
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
      canvas.removeEventListener('wheel', onWheel)
    },
  }
}
