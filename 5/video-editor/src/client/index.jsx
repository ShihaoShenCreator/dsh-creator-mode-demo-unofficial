/**
 * Client entry for `@local/video-editor`.
 *
 * Registers exactly three slot contributions — the workbench View tab, the
 * View-tab More-menu opener row, and the composer-dock status strip — plus the
 * `videoEditor` locale dictionaries and the scoped stylesheet.
 *
 * Everything that touches the DOM, the network or React happens inside `apply`
 * (or inside a component/hook). The bundle's only top-level statement is the
 * loader handoff: no `document`, `window` or React access at materialization.
 *
 * Each registration declares the `videoEditor` locale namespace, so the
 * framework injects its `t` seat and re-renders the entry when the locale
 * revision moves. The closure-bound `t` is used as a fallback when the seat is
 * absent (unit-test contexts).
 */
import React from 'react'
import { installCopy } from './copy.js'
import { insertStyles } from './styles.js'
import { createDockPoller, isSessionId } from './api.js'
import { Workbench } from './Workbench.jsx'
import { FilmIcon } from './icons.jsx'

export const inject = ['slots', 'locale']

const NS = 'videoEditor'
const OPEN_EVENT = 'dsh-video-editor:open'
const VIEW_ID = 'video-editor'

/** Call `fn` defensively: a missing optional service must not break registration. */
function safe(fn, fallback) {
  try {
    return fn()
  } catch {
    return fallback
  }
}

/** Resolve the translate function from composed props, falling back to the closure binding. */
function translateOf(props, fallback) {
  return props !== null && props !== undefined && typeof props.t === 'function' ? props.t : fallback
}

/**
 * Tiny registry that lets the plugin-level `window` listener reach whichever
 * workbench is mounted. The listener itself lives in `apply`'s `ctx.effect`
 * scope, so it is removed on plugin unload.
 */
function createOpenBus() {
  const handlers = new Set()
  return {
    register(handler) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
    dispatch() {
      for (const handler of [...handlers]) {
        safe(handler)
      }
    },
    size() {
      return handlers.size
    },
  }
}

/** The View-tab More-menu opener row (`entries`, `onOpen`, `onDismiss`). */
function OpenerRow(props) {
  const t = translateOf(props, (key) => key)
  const onOpen = props.onOpen
  const onDismiss = props.onDismiss
  const activate = () => {
    safe(() => onOpen(VIEW_ID))
    safe(() => onDismiss())
  }
  return React.createElement(
    'button',
    {
      type: 'button',
      className: 've-opener-row',
      onClick: activate,
      title: t('opener.title'),
      'data-ve-opener': VIEW_ID,
    },
    React.createElement('span', { className: 've-opener-icon' }, React.createElement(FilmIcon, { size: 14 })),
    React.createElement(
      'span',
      { className: 've-opener-label' },
      React.createElement('span', { className: 've-opener-title' }, t('opener.title')),
      React.createElement('span', { className: 've-opener-detail' }, t('opener.detail')),
    ),
  )
}

/**
 * Composer-dock status strip.
 *
 * A quiet ambient row — film glyph, label, `· N 素材 · MM:SS`, hint — that
 * broadcasts the documented `dsh-video-editor:open` `CustomEvent` on click.
 */
function DockStatus(props) {
  const t = translateOf(props, (key) => key)
  const poller = props.poller
  const sessionId = props.sessionId
  const [snapshot, setSnapshot] = React.useState(null)

  React.useEffect(() => {
    if (poller === null || poller === undefined) return undefined
    if (!isSessionId(sessionId)) return undefined
    const off = poller.subscribe(sessionId, (next) => setSnapshot(next))
    return () => {
      safe(off)
    }
  }, [poller, sessionId])

  const count = snapshot === null ? null : snapshot.count
  const duration = snapshot === null ? 0 : snapshot.duration
  const minutes = Math.floor(Math.max(0, duration) / 60)
  const seconds = Math.floor(Math.max(0, duration) % 60)
  const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const activate = () => {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
    if (typeof CustomEvent !== 'function') return
    safe(() => window.dispatchEvent(new CustomEvent(OPEN_EVENT)))
  }

  return React.createElement(
    'button',
    {
      type: 'button',
      className: 've-dock',
      onClick: activate,
      title: t('dock.hint'),
      'data-ve-dock': VIEW_ID,
    },
    React.createElement('span', { className: 've-dock-icon' }, React.createElement(FilmIcon, { size: 13 })),
    React.createElement('span', { className: 've-dock-label' }, t('dock.label')),
    React.createElement('span', { className: 've-dock-dot' }),
    React.createElement('span', { className: 've-dock-meta' }, t('dock.summary', { count: count === null ? '–' : count, time: clock })),
    React.createElement('span', { className: 've-dock-grow' }),
    React.createElement('span', { className: 've-dock-hint' }, t('dock.hint')),
  )
}

/**
 * Plugin body.
 * @param {object} ctx - cordis client context.
 */
export function apply(ctx) {
  const copy = installCopy(ctx)
  const t = copy.t

  // Scoped stylesheet — one tag, removed by the effect disposer.
  ctx.effect(() => {
    const remove = insertStyles()
    return () => {
      safe(remove)
    }
  }, 'video-editor: stylesheet')

  // One shared state poller for the dock strip; collecting/unmounting the last
  // subscriber clears its interval, and this disposer clears every remaining
  // thread on plugin unload.
  const poller = createDockPoller()
  ctx.effect(() => () => {
    safe(() => poller.dispose())
  }, 'video-editor: dock poll timer')

  // Window event listener for the dock → View activation broadcast.
  const openBus = createOpenBus()
  ctx.effect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {}
    const onOpen = () => openBus.dispatch()
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      safe(() => window.removeEventListener(OPEN_EVENT, onOpen))
    }
  }, 'video-editor: open event listener')

  // ---- conversation.view -------------------------------------------------
  ctx.slots.inject('conversation.view', () => ctx.slots.register(
    {
      name: 'conversation.view',
      id: VIEW_ID,
      order: 20,
      locale: NS,
      label: () => t('view.label'),
    },
    (props) => React.createElement(Workbench, { ...props, t: translateOf(props, t), openBus }),
  ))

  // ---- conversation.session.header.views.actions -------------------------
  ctx.slots.inject('conversation.session.header.views.actions', () => ctx.slots.register(
    {
      name: 'conversation.session.header.views.actions',
      id: 'video-editor.opener',
      order: 0,
      locale: NS,
    },
    (props) => React.createElement(OpenerRow, { ...props, t: translateOf(props, t) }),
  ))

  // ---- conversation.composer.dock ----------------------------------------
  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register(
    {
      name: 'conversation.composer.dock',
      id: 'video-editor.status',
      order: 12,
      locale: NS,
    },
    (props) => React.createElement(DockStatus, { ...props, t: translateOf(props, t), poller }),
  ))
}
