/**
 * Tiny observable clock shared by the preview and the timeline.
 *
 * The preview owns the authoritative playback time; the timeline needs to
 * follow it at ~30 Hz *without* re-rendering the workbench. Subscribers here
 * mutate DOM directly (playhead position, timecode text), which keeps the
 * playhead crisp and the rest of the tree untouched.
 */
export function createTimeBus(initial) {
  let time = Number.isFinite(initial) ? initial : 0
  const listeners = new Set()

  return {
    get() {
      return time
    },
    set(next) {
      if (!Number.isFinite(next) || next === time) return
      time = next
      for (const listener of listeners) {
        try {
          listener(time)
        } catch {
          // a subscriber must never break playback
        }
      }
    },
    /** Force a publish even when the value did not change (after a seek). */
    emit() {
      for (const listener of listeners) {
        try {
          listener(time)
        } catch {
          // ignore
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      try {
        listener(time)
      } catch {
        // ignore
      }
      return () => {
        listeners.delete(listener)
      }
    },
    reset(next) {
      time = Number.isFinite(next) ? next : 0
      this.emit()
    },
  }
}
