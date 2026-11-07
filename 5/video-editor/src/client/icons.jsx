/**
 * Inline SVG glyphs. No emoji, no icon fonts, no external imports.
 *
 * Every export is a plain function component taking `{size, className}` and
 * rendering `React.createElement` SVG primitives.
 */
import React from 'react'

function svg(props, children, viewBox) {
  return React.createElement(
    'svg',
    {
      width: props.size === undefined ? 14 : props.size,
      height: props.size === undefined ? 14 : props.size,
      viewBox: viewBox === undefined ? '0 0 16 16' : viewBox,
      fill: 'currentColor',
      stroke: 'none',
      'aria-hidden': 'true',
      focusable: 'false',
      style: { display: 'block', flex: '0 0 auto' },
      className: props.className,
    },
    children,
  )
}

function path(d, extra) {
  return React.createElement('path', Object.assign({ d, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, extra))
}

/** Film-frame glyph used by the brand, the dock strip and empty states. */
export function FilmIcon(props) {
  return svg(props, [
    React.createElement('rect', {
      key: 'r',
      x: 1.75,
      y: 2.75,
      width: 12.5,
      height: 10.5,
      rx: 1.2,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.4,
    }),
    React.createElement('path', {
      key: 'p',
      d: 'M5.25 2.75v10.5M10.75 2.75v10.5M1.75 7.2h3.5M1.75 9.4h3.5M10.75 7.2h3.5M10.75 9.4h3.5',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1,
      opacity: 0.6,
    }),
  ])
}

export function PlayIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M5 3.2l7.6 4.8-7.6 4.8z', fill: 'currentColor', stroke: 'none' }),
  ])
}

export function PauseIcon(props) {
  return svg(props, [
    React.createElement('rect', { key: 'a', x: 4.6, y: 3.1, width: 2.6, height: 9.8, fill: 'currentColor' }),
    React.createElement('rect', { key: 'b', x: 8.8, y: 3.1, width: 2.6, height: 9.8, fill: 'currentColor' }),
  ])
}

export function StepBackIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M4.4 3v10', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 }),
    React.createElement('path', { key: 't', d: 'M12 3.4L5.9 8l6.1 4.6z', fill: 'currentColor' }),
  ])
}

export function StepForwardIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M11.6 3v10', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 }),
    React.createElement('path', { key: 't', d: 'M4 3.4L10.1 8 4 12.6z', fill: 'currentColor' }),
  ])
}

export function PlusIcon(props) {
  return svg(props, [React.createElement('path', { key: 'p', d: 'M8 3.5v9M3.5 8h9', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' })])
}

export function TrashIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M3.2 4.6h9.6M6.2 4.6V3.2h3.6v1.4M4.6 4.6l.6 8h5.6l.6-8', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
  ])
}

export function UploadIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M8 10.5V3.4M5 6.2L8 3.2l3 3M3 11.4v1.1h10v-1.1', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
  ])
}

export function DownloadIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M8 3.2v7.4M5 7.6L8 10.6l3-3M3 11.6v1.2h10v-1.2', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
  ])
}

export function UndoIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M6.2 4.2L3.4 7l2.8 2.8', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
    React.createElement('path', { key: 'a', d: 'M3.6 7h6a3.2 3.2 0 0 1 0 6.4H6.2', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
  ])
}

export function RedoIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M9.8 4.2L12.6 7l-2.8 2.8', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
    React.createElement('path', { key: 'a', d: 'M12.4 7h-6a3.2 3.2 0 0 0 0 6.4h3.4', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
  ])
}

export function SplitIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M8 2.5v11', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 }),
    React.createElement('path', { key: 'a', d: 'M2.6 5.4l3.2 2.6-3.2 2.6M13.4 5.4L10.2 8l3.2 2.6', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
  ])
}

export function ExportIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M8 10V2.8M5 5.8L8 2.8l3 3', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
    React.createElement('path', { key: 'a', d: 'M3 9.6v3.2h10v-3.2', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
  ])
}

export function FitIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M2.6 6V2.6h3.4M13.4 6V2.6H10M2.6 10v3.4H6M13.4 10v3.4H10', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
  ])
}

export function WarningIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M8 2.6l6 10.8h-12z', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }),
    React.createElement('path', { key: 'a', d: 'M8 6v3.6M8 11.4v.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
  ])
}

export function ChevronIcon(props) {
  return svg(props, [React.createElement('path', { key: 'p', d: 'M6 4l4 4-4 4', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' })])
}

export function CloseIcon(props) {
  return svg(props, [React.createElement('path', { key: 'p', d: 'M4.2 4.2l7.6 7.6M11.8 4.2L4.2 11.8', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' })])
}

export function FolderIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M2.4 12.2V4.4h4l1.2 1.8h6v5.9z', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
  ])
}

export function VolumeIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M3 6.2h2.3L8.4 3.4v9.2L5.3 9.8H3z', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }),
    React.createElement('path', { key: 'a', d: 'M10.6 6a3 3 0 0 1 0 4M12.6 4.4a5.6 5.6 0 0 1 0 7.2', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.75 }),
  ])
}

export function RetryIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M13 8a5 5 0 1 1-1.6-3.7', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
    React.createElement('path', { key: 'a', d: 'M13.2 2.6v2.6h-2.6', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
  ])
}

export function PathIcon(props) {
  return svg(props, [
    React.createElement('path', { key: 'p', d: 'M2.6 8.4h2.2l1.2 1.4h1.8l1.2-1.4h2.4', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3 }),
    React.createElement('path', { key: 'a', d: 'M2.6 8.4V4.2h6.2v2.8', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round' }),
  ])
}

export const glyphs = {
  film: FilmIcon,
  play: PlayIcon,
  pause: PauseIcon,
  stepBack: StepBackIcon,
  stepForward: StepForwardIcon,
  plus: PlusIcon,
  trash: TrashIcon,
  upload: UploadIcon,
  download: DownloadIcon,
  undo: UndoIcon,
  redo: RedoIcon,
  split: SplitIcon,
  export: ExportIcon,
  fit: FitIcon,
  warning: WarningIcon,
  chevron: ChevronIcon,
  close: CloseIcon,
  folder: FolderIcon,
  volume: VolumeIcon,
  retry: RetryIcon,
  path: PathIcon,
}
