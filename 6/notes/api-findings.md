# DSH client-plugin API findings (ground truth for a hand-written plain-JS plugin)

Everything below was read from the installed DeepSeek Harness asar
(`C:\Users\Shihao\AppData\Local\Programs\DeepSeek Harness\resources\app.asar`), extracted with
`py tools\asar_extract.py` into `_dsh_src\`, plus `cordis_inspect_query` on the Host Service catalog.
Cite style: `<extracted path>:<line>`. Paths are relative to this workspace.

Live client inspect providers (`Service`, `Slots`, `Builtin`) all **timed out** in this session
(10 s cap, page apparently not answering). Treat every Client statement below as *source-backed*,
not live-verified. Host `Service.listService` **did** answer (spool:
`C:\Users\Shihao\AppData\Local\Temp\dsh-spill-zi18Zf\session-835c9d83a8c3\7ec83c5704e0-cordis_inspect_query.txt`).

Two plugin shapes exist. Choose deliberately:

| shape | how it ships | client code surface |
|---|---|---|
| **Installed bundle** (recommended here) | package on disk with `dsh.client`, installed via `plugin_manager install_bundle` | `window.__ModuleLoader__.load({id, factory(require){…}})` |
| **Dynamic Cordis package** (`cordis_define`) | source strings stored in a Session | async-function body with closure symbols `React, console, styles, host, harness, …` |

The right-sidebar tab API, composer API and locale API are identical in both. Only the factory
boilerplate and `host.call` differ (§4).

---

## 1. Right sidebar: register a tab type + its body

### 1.1 The registry service

`ctx.sidebarRightTabs` is `sidebarRightTabs` on the client context, provided by
`dsh-client-ui-sidebar-right`:

```js
// _dsh_src/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js:5599
const disposeRegistry = ctx.reflect.provide("sidebarRightTabs", tabs);
```

Declare it in `inject` (a missing declaration is a hard error on a dynamic package, and a
non-activation on a bundle):

```js
const inject = ["slots", "locale", "sidebarRightTabs", "sidebarRight"];
```

### 1.2 `register(definition)` — exact accepted fields

```js
// .../dsh-client-ui-sidebar-right/lib/client.js:4905-4936
register(definition) {
    const { id, kind } = definition;
    const entries = definition.guide ?? [];
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error(`sidebarRight: duplicate guide entry id in "${id}"`);
    const band = definition.priority ?? DEFAULT_BAND;
    if (this.ids.has(id)) throw new Error(`sidebarRight: tab type id "${id}" is already registered`);
    const held = this.kinds.get(kind);
    if (held !== void 0 && !coexists(held, band)) throw new Error(`sidebarRight: tab kind "${kind}" is already registered (${held.inForce.band})`);
    ...
    matchers: (definition.patterns ?? []).map((pattern) => ({ pattern, test: matcherFor(pattern) })),
```

Field-by-field, from the two shipped implementations plus the registry body:

| field | type | notes |
|---|---|---|
| `id` | string, **required, globally unique** | also the Slot key of the body and title (§1.4). Package name is the natural value (`.../dsh-client-ui-sidebar-documentpreview/lib/client.js:1186`) |
| `kind` | string, required | discriminator used by `openTab(kind, …)` and by tab records |
| `patterns` | string[] | globs over `dsh-resource://` addresses; omit for a **page** type (opened by kind only) |
| `priority` | `'extension' \| 'builtin' \| 'fallback'` | default `'extension'` (`DEFAULT_BAND`, line 4840); ranks resource claiming |
| `canOpen` | `(address) => boolean` | vetoes a claim; called for patterns-matched candidates and for an explicit `kind` |
| `title` | `(address) => string`, **required in practice** | captured into the tab record at open time; every shipped type passes one |
| `guide` | guide-entry[] | entry identity must be unique within the definition |
| `keepMounted` | boolean | retains visited bodies across tab/Session changes and collapse (line 1568, 1765) |
| `multiple` | boolean | each open gets `${pageAddress(kind)}/${randomUUID()}` (line 2580) |

Page types register no `patterns`; `title` is called with the composed address `sidebar://<kind>`
(`.../sidebar-right/lib/client.js:759-761`):

```js
function pageAddress(kind) {
    return `sidebar://${kind}`;
}
```

Working, verbatim-shaped example (copied from the shipped `plan` type,
`.../dsh-client-ui-plan/lib/client.js:750-757`):

```js
ctx.effect(() => ctx.sidebarRightTabs.register({
    id: previewId,                       // "@deepseek-ai/dsh-client-ui-plan"
    kind: "plan",
    patterns: ["dsh-resource://plan/**", "dsh-resource://plan-review/**"],
    priority: "builtin",
    canOpen: (address) => parsePlanAddress(address) !== void 0 || isReviewPreviewAddress(address),
    title: () => t("preview.title")
}), "ui-plan: sidebar type");
```

A pure page type with a guide card (`.../dsh-client-ui-sidebar-files/lib/client.js:22-37`).
The shipped code imports `GuideArtworkFiles` from `dsh-client-ui-primitives`; **do not copy that** —
`references/practices.md:35` forbids requiring harness Client packages. Pass your own component:

```js
return {
    id: FILES_ID,
    kind: FILES_KIND,
    priority: "builtin",
    title: () => t("type.label"),
    guide: [{
        id: "workspace",
        commandId: "workspace.files",
        order: 10,
        title: () => t("guide.title"),
        description: () => t("guide.description"),
        icon: MyPaperGlyph          // your own component: ({ size }) => element
    }]
};
```

`icon` is optional; when absent the guide draws its own `CubeGlyph` placeholder
(`.../sidebar-right/lib/client.js:535`).

### 1.3 Guide entry object — exact fields consumed

`refresh()` spreads the entry and adds two fields (`.../sidebar-right/lib/client.js:5059-5063`):

```js
this.guideEntries = this.cached.flatMap((definition) => (definition.guide ?? []).map((entry) => ({
    ...entry,
    kind: definition.kind,
    providerId: definition.id
}))).sort((left, right) => left.order - right.order);
```

So a guide entry is `{ id, order, title: () => string, description?: () => string,
icon?: ReactComponent, commandId?: shortcutId }`. Rendering reads exactly those
(`.../sidebar-right/lib/client.js:534-566, 641-658`):

```js
const Icon = entry.icon ?? CubeGlyph;
const description = described ? entry.description?.() : void 0;
... entry.title() ...
```

`order` sorts cards; `icon` receives a `size` prop; `commandId` is matched against
`ctx.shortcuts` ids to print the key hint (`shortcuts.find((shortcut) => shortcut.id === entry.commandId)`,
line 652). Duplicate `entry.id` inside one definition throws.

### 1.4 Body and title registration — `key = definition.id`

The seat declares the keyed slots (`.../sidebar-right/lib/client.js:5679-5692`):

```js
yield ctx.slots.register({
    name: "rightbar.session",
    locale: NS,
    children: {
        "sidebar.right.pane.tab": {
            kind: "keyed",
            scope: "session",
            inject: { hooks: { tabInfo: tabInfoFactory } }
        },
        "sidebar.right.pane.tab.title": {
            kind: "keyed",
            scope: "session",
            inject: { hooks: { tabInfo: tabInfoFactory } }
        }
    },
```

The seat dispatches by `definition.id` (`.../sidebar-right/lib/client.js:1596-1600`):

```js
const content = renderSlot(seat, {}, {
    entryKey: definition?.id ?? tab.kind,
    fallback,
    hookContext
});
```

So register the body **and** title under `key: <definition.id>`, inside
`ctx.slots.inject("sidebar.right.pane.tab", …)` so the registration waits for the seat
declaration and is disposed when it collapses:

```js
ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
    name: "sidebar.right.pane.tab",
    key: "@local/paper-reader",          // must equal definition.id
    locale: NS,
    // children / store / inject are optional here
}, PaperReaderBody)), "paper-reader: tab body");

ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
    name: "sidebar.right.pane.tab.title",
    key: "@local/paper-reader",
    locale: NS
}, PaperReaderTitle)), "paper-reader: tab title");
```

`ctx.slots.inject(key, callback)` is the wait-and-(re)install seam: the callback runs immediately
when the declaration already exists, otherwise inside the declaring `register()`
(`_dsh_src/.../dsh-cordis-client-runner/lib/client.js:1540-1551`, the client catalog's `slots`
entry for `inject`). Note `ctx.slots.inject` does **not** itself
own the registration lifetime beyond the slot declaration; wrapping it in `ctx.effect` makes the
wait a plugin effect too (shipped code does exactly this: `ctx.effect(() => ctx.slots.inject(…))`).

Both shipped forms appear in-tree — with and without the `ctx.slots.inject` wrapper
(documentpreview `.../dsh-client-ui-sidebar-documentpreview/lib/client.js:8021-8054` uses
`ctx.slots.inject`; plan `.../dsh-client-ui-plan/lib/client.js:811-819` registers directly,
and the seat is already declared by the time that package mounts). Use `ctx.slots.inject`:
registration into a non-declared slot throws, and the rightbar seat belongs to another package
whose activation order you do not control.

`keepMounted: true` on the definition keeps the body mounted while the tab is not the active
one (line 1568: `const retained = seat === "sidebar.right.pane.tab" && definition?.keepMounted === true;`).
Use it for a PDF viewer that must not reload on tab switching.

### 1.5 `useTabInfo()` — exact returned shape

```js
// .../sidebar-right/lib/client.js:5433-5473
const tabInfoFactory = (standard, context) => {
    const { sessionId } = standard;
    const { tabId, title, fullscreen, active, signal, actions, useStore, useTabNavigation, shortcuts } = context;
    return function useTabInfo() {
        const layout = useStore((state) => state.bySession[sessionId]?.layout);
        const navigation = useTabNavigation(tabId);
        return (0, react.useMemo)(() => {
            const tab = layout?.tabs[tabId];
            if (layout === void 0 || tab === void 0 || navigation === void 0) throw new Error(`sidebarRight: tab "${tabId}" is not committed in session "${sessionId}"`);
            const pane = (0, _deepseek_ai_dsh_client_ui_dockkit.findTabPane)(layout, tabId);
            return {
                sidebar: { expanded: layout.expanded, fullscreen },
                panel: { id: pane.id, isFloating: pane.host === "float" },
                tab: {
                    ...tab,
                    visible: active && (pane.host === "float" || layout.expanded && (title || pane.activeTabId === tabId)),
                    navigation, signal, actions,
                    refreshShortcut: shortcuts.find((row) => row.id === "page.refresh")
                }
            };
        }, [...]);
    };
};
```

Concrete result for a body:

```ts
{
  sidebar: { expanded: boolean, fullscreen: boolean },
  panel:   { id: string, isFloating: boolean },     // pane id; follows drags dock<->float
  tab: {
    id: string, kind: string, contentId: string, title: string,   // record (layout zod schema, lines 828-833)
    visible: boolean,
    navigation: { address: string, params: unknown, revision: number },  // snapshot store
    signal: AbortSignal,          // aborted only on record removal / plugin unload
    actions: TabActions,
    refreshShortcut?: shortcut
  }
}
```

`navigation.address` / `navigation.params` are how a tab receives opener data —
`.../dsh-client-ui-plan/lib/client.js:179-182` reads
`tab.tab.navigation.address` and `tab.tab.navigation.params`. `params` is delivered by
`sessions.place(...)` → `tabDomain.navigate(sessionId, tabId, { address, params })`
(`.../sidebar-right/lib/client.js:2569-2572, 2603-2607`).

### 1.6 `tab.actions` — exact methods

```js
// .../sidebar-right/lib/client.js:2229-2258
tabActions: {
    bindCommands: (commands) => { ...; return release; },
    openResource: (address, options = {}) => {
        navigator.openResourceIn(sessionId, address, options.destination === void 0
            ? { ...place(options), params: options.params }
            : { destination: options.destination, params: options.params });
    },
    openTab: (kind, options = {}) => {
        navigator.openTabIn(sessionId, kind, { ...place(options), params: options.params });
    },
    close: () => { navigator.closeIn(sessionId, tabId); }
}
```

and `place` (line 2213-2218) forwards only `replaceTab` (boolean → own tab id), own `paneId`,
`preferNewPane`, `revealIfOpened`. So the usable `tab.actions` are:

| method | args | meaning |
|---|---|---|
| `openResource(address, opts?)` | `opts: { params?, paneId?, preferNewPane?, revealIfOpened?, replaceTab?: true, destination? }` | go to a `dsh-resource://` address |
| `openTab(kind, opts?)` | same minus `destination` | open a page type |
| `close()` | — | close this tab (runs the registered close handler) |
| `bindCommands({ refresh })` | — | wire the page-refresh command; returns a release; call it from `useEffect` (files body line 1727) |

`tab.actions.*` always target **their own Session**, not the on-screen one
(comment at `.../sidebar-right/lib/client.js:2340-2343`).

`registerCloseHandler(kind, handler)` on `ctx.sidebarRight` lets the owning package save
background cleanup before a tab is closed/replaced (`.../sidebar-right/lib/client.js:2430-2436`).

---

## 2. `ctx.sidebarRight.openTab(kind, options)` and opening from another component

Signature (`.../sidebar-right/lib/client.js:2503-2506`):

```js
openTab(kind, options = {}) {
    const { sessionId, actions } = this.require();
    this.placeTab(sessionId, actions, kind, options);
}
```

`require()` throws `"sidebarRight: no session surface is mounted"` when no Session is on screen
(line 2919-2927) — so call it from an effect/event, never at module scope.

Recognised `options` (the union of `placeIn`/`place`/`placeTab`, lines 2553-2615):

```
{ paneId?: string, preferNewPane?: boolean, revealIfOpened?: boolean,
  replaceTab?: string,        // tab id, not boolean, at this level
  params?: unknown, kind?: string /* openResource only */,
  destination?: 'sidebar' | 'float' /* openResource only */ }
```

`placeTab` composes the address and title, then places (lines 2577-2586):

```js
placeTab(sessionId, actions, kind, options) {
    const definition = this.tabs.get(kind);
    if (definition === void 0) throw new Error(`sidebarRight: no tab type is registered as "${kind}"`);
    const address = definition.multiple === true ? `${pageAddress(kind)}/${randomUUID()}` : pageAddress(kind);
    this.place(sessionId, actions, { kind, contentId: address, title: definition.title(address) }, address, options, options.params);
}
```

Other public face members confirmed in the same class: `openResource(address, options)`,
`openResourceIn`, `openTabIn`, `close(tabId)`, `hide(tabId)`, `active()`, `isExpanded()`,
`toggleExpanded()`, `toggleFullscreen(target)`, `focus(tabId)`, `split(paneId?)`,
`float(tabId, rect?)`, `dock(paneId)`, `commandTarget(element?)`, `openTabFromTarget(kind, target)`,
`mounted` (observable of the on-screen Session), `openTabs`, `tabsIn(sessionId)`,
`focusedTarget`, `canCloseTarget`, `closeTarget`, `isTargetCurrent`.

**Opening from a conversation-header button** — two working routes:

1. Register a component into `conversation.session.header.actions` (list, session scope) and call
   `ctx.sidebarRight.openTab("<kind>")` in its `onClick`. The slot catalog lists this entry with
   `inputActions: InputActions` among its standard props
   (`.../dsh-cordis-client-runner/lib/client.js:4229-4290`), so the same component can also put
   text into the composer (§3). Example registration shape from the shipped files package's
   shortcut resolver (`.../dsh-client-ui-sidebar-files/lib/client.js:2176-2194`) which calls
   `ctx.sidebarRight.openTabFromTarget(FILES_KIND, target)`.
2. Skip the button entirely: a `guide` entry on the tab type puts your type on the sidebar's
   "start page". The shipped guide opens it with
   `tab.actions.openTab(kind, { replaceTab: true })` + `tab.actions.close()`
   (`.../sidebar-right/lib/client.js:629-631`).

Header-action registration (list slot: `id` required, `order`, `label`):

```js
ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
    name: "conversation.session.header.actions",
    id: "paper-reader-open",
    order: 100,
    label: () => t("open.paper")
}, OpenPaperButton));
```

---

## 3. Text into the current Session's composer

### 3.1 The supported path: the `inputActions` standard prop

`dsh-client-ui-conversation` publishes the per-Session composer shell as **standard props** on
every Session-scoped slot (README `.../dsh-client-ui-conversation/README.md:14`):

> contributes the `useConversation`, `useInput`, and `inputActions` standard props through
> `ctx.uiSession`

```js
// .../dsh-client-ui-conversation/lib/client.js:22775-22791
ctx.uiSession.provide({
    hooks: ["conversation", "input"],
    props: ["inputActions"],
    resolve: (binding) => {
        trackBinding(binding);
        const shell = inputHub.shellFor(binding);
        const conversation = uiConversation.binding(binding);
        restoreView(binding.sessionId);
        return {
            hooks: { conversation: conversation.snapshot, input: shell.state },
            props: { inputActions: shell.actions }
        };
    }
});
```

The action object — this is the exact API, not a guess (`.../dsh-client-ui-conversation/lib/client.js:15368-15395`):

```js
actions = {
    insertQuote: (text) => this.insertQuote(text),
    captureInsertion: () => ({ ...this.caretSpan(), draftRev: this.rev }),
    insertText: (text, span) => {
        if (frozen(this.snapshot.phase) || this.disposed) return false;
        if (span.draftRev !== this.rev) return false;
        return this.draftEditor.insertAsyncText(span, text);
    },
    setDraft: (text) => { this.setDraft(text); },
    persistDraft: () => { this.persistCurrentDraft(); },
    addAttachments: (ids) => this.addAttachments(ids),
    removeAttachment: (id) => { this.removeAttachment(id); },
    pruneAttachments: (ids) => { this.pruneAttachments(ids); },
    submit: () => { this.submit("queue"); }
};
```

Semantics to respect (`.../dsh-client-ui-conversation/README.md:64,183`):

* `insertQuote(text)` inserts a non-blank selection **as an atomic quote node**, only while the
  composer phase is `plain`; returns `false` otherwise
  (`.../dsh-client-ui-conversation/lib/client.js:15464-15469`). This is what the shipped
  quote button uses: `if (!inputActions.insertQuote(text)) return;`
  (`.../dsh-message-quotes/lib/client.js:48`).
* `captureInsertion()` snapshots `{ start, end, draftRev }`; `insertText(text, span)` inserts
  plain text **only when `span.draftRev` still equals the live revision** (optimistic guard,
  returns `false` on staleness).
* `setDraft(text)` replaces the whole draft, accepts plain text or a semantic document, caret to end.
* `input` hook (`useInput`) gives `InputState`; `submit()` queues the current draft.

**Reachable from a sidebar tab body**: the slot catalog declares `inputActions: InputActions`
among `sidebar.right.pane.tab`'s standard props
(`.../dsh-cordis-client-runner/lib/client.js:6352-6353`; same list for the title slot at 6410-6411
and for header actions at 4270-4271). Because `inputActions` is contributed at **session** scope
by `uiSession.provide`, every Session-scoped entry rendered inside a Session area receives it as a
prop — so a right-sidebar body can do, for "send this highlighted passage to the agent":

```js
function PaperReaderBody({ inputActions, sessionId, t, useTabInfo }) {
    const { tab, panel } = useTabInfo();
    const onSendQuote = (text) => {
        if (inputActions.insertQuote(text)) return;   // atomic quote chip; plain phase only
        // fallback: append as plain text at the current caret, guarded by the revision
        const span = inputActions.captureInsertion();
        if (!inputActions.insertText(`\n\n> ${text}\n\n`, span)) {
            console.warn("[paper-reader] composer rejected the insertion");
        }
    };
    ...
}
```

`setDraft` takes a **string** (not an updater function), so never call it with a callback:
`setDraft(text)` replaces the whole draft (`.../dsh-client-ui-conversation/lib/client.js:15379-15381` →
`SessionInputShell.setDraft`, lines 15452-15463).

UNCERTAIN (not live-verified): that a `rightbar.session` subtree actually receives the
`inputActions` prop. The static typing says yes (catalog above) and the renderer merge logic is
generic (`.../dsh-client-ui-renderer/lib/client.js:667-701, 784-790`), but the client inspect
(`Slots.listSubTree`) timed out, so confirm once the page answers. The **supported, documented**
alternative is a `conversation.input.*` component (§3.2), whose props are the same standard set.

### 3.2 Alternative: a composer-side component

Register into a composer slot (all Session-scoped) and receive the same `inputActions`
(`.../dsh-client-ui-conversation/lib/client.js:22958-22998`):

```js
children: {
  "conversation.input.attachments": { kind: "single", scope: "session-maybe" },
  "conversation.input.overlay":     { kind: "list",   scope: "session" },
  "conversation.input.permission":  { kind: "single", scope: "session" },
  "conversation.input.left":        { kind: "list",   scope: "session" },
  "conversation.input.plan":        { kind: "single", scope: "session" },
  "conversation.input.right":       { kind: "list",   scope: "session" },
  "conversation.input.model":       { kind: "single", scope: "session" },
  "conversation.input.activity":    { kind: "single", scope: "session" },
  "conversation.composer.dock":     { kind: "list",   scope: "session" }
}
```

```js
ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
    name: "conversation.input.right", id: "paper-reader-quote", order: 50
}, InsertQuoteButton));
```

Fixed overlays must portal to `document.body`: the docked composer is a containing block
(README line 109).

### 3.3 No clean `ctx.get('uiSession')` path — do not use it

There is no global composer service:

* `conversation` (`ctx.get('conversation')`) is a **Session-scoped** service; every method calls
  `scopeId()` which throws unless the caller sits in a Session scope
  (`.../dsh-client-ui-conversation/lib/client.js:5076-5092`): *"conversation.${op} requires a
  session scope — address one via ctx.sessions.scope(id).conversation"*. From a plugin
  `apply(ctx)` at root it throws.
* `uiSession` exposes only `adapter.current`, `bindingSource`, `renderArea`, `whenAccess`,
  `provide`, `registerPendingInteraction`, `sessionStatus` — no per-Session input handle
  (`.../dsh-client-ui-session/lib/client.js:766-909`). `ctx.uiSession.adapter.current` is what
  the sidebar uses to know the on-screen Session (`.../sidebar-right/lib/client.js:5508`).
* `inputHub` is package-internal: its own doc says the keyboard face is "package-internal — handed
  through the composer-bar entry's inject, never across a plugin boundary"
  (`.../dsh-client-ui-conversation/lib/client.js:16235-16244`).

Closest programmatic alternative without the UI prop: `tab.actions.openTab` a page, or
`ctx.remote.commands.execute(sessionId, "/cmd", [])` for commands. For a plain prompt,
`binding.session.prompt([{type:'text', text}], 'queue')` exists on the Session object
(`ISession` in `.../dsh-cordis-client-runner/lib/client.js:2089-2090`), reachable as
`ctx.sessions.binding(sessionId).session.prompt(...)`; that **sends** rather than drafting.

---

## 4. Factory builtins and `host.call`

### 4.1 Installed bundle (module-loader factory)

Bundles execute **only registration**; the body runs at first import
(`.../dsh-client-modules/lib/client.js:16-24`). The contract:

```js
// _dsh_src/.../dsh-client-locale/lib/client.js:1-3 (same shape everywhere)
window.__ModuleLoader__.load({
  id: "@deepseek-ai/dsh-client-locale",
  factory: (require) => { var module = { exports: {} }; var exports = module.exports; ... }
});
```

`require` resolves three ways (`.../dsh-client-modules/lib/client.js:834-853`):

```js
makeRequire(ownerId, edges) {
    const require = (spec) => {
        edges.add(spec);
        if (this.seed.has(spec)) return this.seed.get(spec);
        const id = stripClientSuffix(spec);
        const record = this.loadCache.get(id);
        if (record !== void 0) return record.exports;
        if (this.factories.has(id)) return this.materialize(id).exports;
        throw new Error(`client-modules: require("${spec}") missed the module table — ...`);
    };
    require.asset = (reference) => this.resolveAsset(reference);
    require.async = async (spec) => { ... };
    return require;
}
```

`this.seed` is the **platform seed** passed by the web shell
(`.../dsh-web-frontend/dist/assets/index-BgUyXZcc.js:196` — `staticModules: YZ()`):

```
react, react/jsx-runtime, react-dom, react-dom/client,
@deepseek-ai/cordis, zod, @tanstack/react-virtual,
@deepseek-ai/dsh-client-store, @deepseek-ai/dsh-client-ui-slots,
@deepseek-ai/dsh-client-ui-primitives, @deepseek-ai/dsh-client-ui-dockkit
```

There is **no `host`, `styles`, or `console` builtin** on this path — those are dynamic-package
symbols. A bundle's plugin object is `{ inject, apply(ctx) }` (or a function), exactly like a
normal Cordis plugin; `apply` receives a full `ctx` (the client root context), so
`ctx.slots`, `ctx.locale`, `ctx.sidebarRightTabs`, `ctx.sidebarRight`, `ctx.get(name)` all work.
Skill guidance says not to `require('@deepseek-ai/dsh-client-ui-primitives')` even though it is
seeded — it changes without notice and a crash blanks your slot entry
(`.../dsh-agent-preset/skills/cordis-plugin-development/references/practices.md:35`).

Splitting a large client half: `require.async("./client.pdf.js")` loads a **package-local chunk**
served on the same `/plugins` route; the filename must match `CLIENT_CHUNK`
`/^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$/`
(`.../dsh-client-modules/lib/index.js:198, 1005-1048`). The shipped PDF viewer uses exactly this:

```js
// .../dsh-client-ui-sidebar-documentpreview/lib/client.js:5720
const LoadedPdfBody = (react.lazy)(async () => ({ default: (await require.async("./client.pdf.js")).PdfBody }));
```

### 4.2 Dynamic Cordis package — closure symbols and `host.call`

```js
// _dsh_src/.../dsh-cordis-client-runner/lib/client.js:308-343
async function evaluateClientHalf(pluginId, clientCode, env, styles) {
    const traps = closureTraps();
    const parameters = ["React", "console", "styles", "host", "harness", ...Object.keys(traps), "process", "Buffer"];
    let closure;
    try {
        closure = new Function(...parameters, `return (async () => {\n${clientCode}\n})()`);
    } catch (error) { ... "The browser half is plain JavaScript (no JSX, no TypeScript); build elements with React.createElement." }
    const returned = await closure(react, taggedConsole(pluginId, ...), styles, {
        call: (method, args = null) => env.invoke(method, args)
    }, harnessTrap(), ...Object.values(traps), void 0, void 0);
```

So a dynamic client half writes:

```js
return {
  inject: ['slots'],
  apply(ctx) { ... }
}
```

with `React`, `console` (tagged `[cordis:<pluginId>]`), `styles.insert(css)` (per-package style
tags removed on unload, line 240-251), `host.call`, and `harness` (a trap that throws: `harness`
belongs to the Host half). `setTimeout/fetch/require` are callable traps that throw teaching
errors (`DYNAMIC_CLIENT_REDIRECTS`, lines 205-212).

`host.call(method, args)` mapping — three hops, all source-backed:

1. Client: `call: (method, args = null) => env.invoke(method, args)`; omitting args passes `null`
   ("the wire carries JSON and `undefined` is not JSON", comment lines 330-337).
2. Client transport (`.../dsh-cordis-client-runner/lib/client.js:7859-7867`):
   ```js
   invoke: async (pluginId, pluginRunId, method, args) => {
       const answered = await ctx.remote.dynamicCordisRunner.invoke(pluginId, pluginRunId, method, args).catch((error) => {
           throw new Error(wireFailure(pluginId, method, error));
       });
       if (!answered.ok) throw new Error(wireFailure(pluginId, method, `${answered.error.code}: ${answered.error.message}`));
       const result = answered.value;
       if (result.ok) return result.value;
       throw invokeError(pluginId, method, result);
   },
   ```
3. Host (`.../dsh-cordis-host-runner/lib/index.js:2115-2148`):
   ```js
   async invoke(pluginId, pluginRunId, method, args) {
       const plugin = this.registry.get(pluginId);
       if (plugin === void 0 || plugin.run === void 0) return { ok: false, code: "plugin-not-running", ... };
       ...
       const handler = run.handlers.get(method);
       if (handler === void 0) return { ok: false, code: "method-not-found", message: `dynamic plugin "${pluginId}" registered no Host method "${method}"` };
       try { return { ok: true, value: await handler(args) }; }
       catch (error) { ... this.steerHostHandlerFailure(plugin, run, method, failure); return { ok: false, code: "handler-error", ...failure }; }
   }
   ```

Registration on the Host side is `harness.handle(method, fn)` (installed into the Host sandbox,
`.../dsh-cordis-host-runner/lib/types/sandbox.js:90-105`); the handler receives the wire-decoded
JSON args and its result is JSON-cloned (`normalizeHandler`, `.../dsh-cordis-host-runner/lib/index.js:516-533`).
Errors surface client-side as `Error("host.call(\"m\") on <pluginId> failed inside the host handler: …")`
plus the Host stack (`.../dsh-cordis-client-runner/lib/client.js:7795-7807`).

**Both directions are JSON only** (line 7815-7817). Plan RPC shapes accordingly: pass plain
objects, return plain JSON or `null`.

Dynamic-package `ctx` is a whitelist proxy (`.../dsh-cordis-client-runner/lib/client.js:484-514`):
`ctx.get(name)` for optional lookup; `ctx.<service>` only if declared in `inject`
(`fiber.inject`); verbs `effect, on, once, provide, timeout, interval, setTimeout, setInterval,
throttle, debounce`; reads are read-only (`set` throws). The Host half gets a twin façade
(`sandboxContext`, `.../dsh-cordis-host-runner/lib/index.js:629-661`) plus `ctx.tools.register`.

---

## 5. Static asset serving from a Host plugin

### 5.1 webserver route API (Host)

`ctx.webServer` (Host `Service.listService` → key `webServer`):

```
getOrigin(): string
register(route: WebRoute | WebResourceRoute): () => void
registerUpgrade(route: WebUpgradeRoute): () => void
registerFallback(fallback): () => void
async readResource(request, peer): Promise<Response>
tapIndex(transform): () => void
applyIndexTaps(html): string
collectIndexInjections(peer): IndexInjection[]
renderIndex(html, peer): string
```

Exact route types (`_dsh_src/.../dsh-tool-cordis/lib/types/api-catalog.js:9905-9922`):

```ts
export type WebResource = (request: Request, peer?: PeerScope) => Promise<Response>;
export interface WebResourceRoute { kind: WebRouteKind; path: string; resource: WebResource }
export interface WebRoute { kind: WebRouteKind; path: string; handler: (req, res) => void | Promise<void> }
export type WebRouteKind = 'exact' | 'prefix';
```

```js
// _dsh_src/.../dsh-host-webserver/lib/index.js:369-382
register(route) {
    const table = route.kind === "exact" ? this.exact : this.prefixes;
    if (table.has(route.path)) throw new Error(`webserver: duplicate ${route.kind} route "${route.path}"`);
    table.set(route.path, route);
    return () => { table.delete(route.path); };
}
```

Matching is exact table first, then **longest prefix**, then the fallback
(`.../dsh-host-webserver/lib/index.js:576-589`). Resource routes answer only GET/HEAD
(`.../dsh-host-webserver/lib/index.js:599-626`), and the request arrives without a Peer:
*"The request becomes a Fetch `Request` without a Peer … The client's authority stays only in
the `host` header."*

### 5.2 How the shipped bundle route is registered (the pattern to copy)

```js
// _dsh_src/.../dsh-client-modules/lib/index.js:620-627
const registerWebCarrier = (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register({
        kind: "prefix",
        path: PLUGIN_ROUTE,                     // "/plugins" (line 230)
        resource: (request) => this.fetchBundle(request)
    }), "client-modules: bundle route");
};
ctx.inject(["webServer"], registerWebCarrier);
```

Its handler answers without any auth of its own — the `/plugins` route performs **no cookie,
Host, or Origin check**; it only validates method and path
(`.../dsh-client-modules/lib/index.js:1095-1114`), and serves package assets with
`cache-control: public, max-age=31536000, immutable`, `etag: "<assetPath>"`,
`x-content-type-options: nosniff` (lines 1062-1088).

Package assets are restricted: only under `/plugins/<pkg>/assets/<path>`, and only media types
`.svg .png .webp .jpg .jpeg` (`.../dsh-client-modules/lib/index.js:11-30`). **That route cannot
serve `.mjs`, `.bcmap`, `.ttf`, or `.wasm`.**

### 5.3 Recommended pattern for a plugin's own vendored pdf.js tree

Do **not** reuse `/plugins`. Register one private prefix route owned by your plugin's effect and
serve files from your package directory with an allow-list of extensions:

```js
// host half (index.js of the bundle)
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const inject = ["webServer"];
const MEDIA = {
  ".mjs": "text/javascript; charset=utf-8",
  ".js":  "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".bcmap": "application/octet-stream",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

function apply(ctx, config) {
  const root = new URL(".", import.meta.url);           // package dir
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/paper-reader-assets",
    resource: async (request) => {
      const url = new URL(request.url);
      const rel = decodeURIComponent(url.pathname.slice("/paper-reader-assets/".length));
      if (rel.split("/").some((s) => s === ".." || s === "." || s === "")) return new Response(null, { status: 403 });
      const abs = new URL(rel, root);
      if (!abs.href.startsWith(root.href)) return new Response(null, { status: 403 });
      const media = MEDIA[rel.slice(rel.lastIndexOf("."))];
      if (media === undefined) return new Response(null, { status: 404 });
      try {
        const body = await readFile(fileURLToPath(abs));
        return new Response(body, {
          headers: { "content-type": media, "cache-control": "public, max-age=31536000, immutable" },
        });
      } catch { return new Response(null, { status: 404 }); }
    },
  }), "paper-reader: asset route");
}
```

Rules that follow from the source:

* The route must be `kind: "prefix"` and its path must be unique — duplicates throw
  (`.../dsh-host-webserver/lib/index.js:377`). Pick something unmistakably yours
  (`/paper-reader-assets`), never `""`, `/`, `/api`, `/plugins`, `/connect`.
* Method: resource routes receive only GET/HEAD; anything else is a 405 answered by the
  webserver before your function runs (`.../dsh-host-webserver/lib/index.js:600-604`).
  A `handler` route instead gets the raw `node:http` req/res and owns everything.
* **No Peer is passed.** `resource(request, peer)` is called with one argument here — the webserver
  builds `new Request(target, { method, headers, signal })` and nothing else
  (`.../dsh-host-webserver/lib/index.js:614-618`). So do not expect `peer`.
* **A bare `webServer.register` route performs no authentication.** Only the shipped `/api`
  route and the SPA fallback authenticate, by calling `ctx.connection`:

  ```js
  // _dsh_src/.../dsh-client-connection/lib/index.js:1044-1058
  const fetchHandler = connection.createSharedFetchHandler(API_PATH);
  const route = {
      kind: "prefix",
      path: API_PATH,
      handler: async (req, res) => {
          const admission = connection.admit(req);
          if ("rejection" in admission) {
              res.writeHead(admission.rejection);
              res.end(admission.rejection === 401 ? "unauthorized" : "forbidden");
              return;
          }
          await webCtx.waterfall("connection/request", req, res, () => bridge(req, res, fetchHandler, admission.peer, maxRequestBodyBytes));
      }
  };
  ```

  `connection.admit(request)` is "Apply the Host/Origin fence and require an authenticated live
  Peer" (`.../dsh-client-connection/lib/index.js:736-750`) and `isTrustedApiRequest` checks
  loopback/trusted Host plus `sec-fetch-site` and `Origin` (lines 240-249). To require the
  browser cookie on your own asset route, either register a `kind: "prefix"` **handler** route
  that calls `ctx.connection.requestRejection(req)` first, or accept that your assets are
  public-to-loopback like `/plugins` is. The page already holds the session cookie, so a
  URL-relative `<img>`/`fetch` request works either way.
* Path-safety is yours: the webserver does no traversal check for handler routes; the SPA
  fallback does its own `resolve`/`startsWith` guard (see `.../dsh-host-frontend-static/lib/index.js:69-70`)
  — copy that guard.
* Serve the whole vendored tree (`build/pdf.min.mjs`, `build/pdf.worker.min.mjs`, `cmaps/*.bcmap`,
  `standard_fonts/*.ttf`, `wasm/*.wasm`) under your prefix and point pdf.js at it:
  `GlobalWorkerOptions.workerSrc = "/paper-reader-assets/build/pdf.worker.min.mjs"`, and
  `getDocument({ data, cMapUrl: "/paper-reader-assets/cmaps/", standardFontDataUrl: "/paper-reader-assets/standard_fonts/", wasmUrl: "/paper-reader-assets/wasm/" })`.
  The shipped viewer inlines assets instead, to avoid all of this
  (`.../dsh-client-ui-sidebar-documentpreview/lib/client.pdf.js:24414-24420, 24728-24737`
  and the Blob-worker construction at 24707-24711); that is an option only if you accept a
  ~7 MB client chunk.

For the asset URLs to be same-origin and loadable, the browser must be able to GET them without
extra headers — a `script-src`/`worker-src` CSP is not set by the shell, and workers loaded from
your own origin work (the shipped viewer does `new Worker(url, { type: "module" })` from a Blob URL,
line 24708).

---

## 6. Calling your own Host half from a bundle (no `host.call`)

`host.call` / `harness.handle` exist **only** for dynamic Cordis packages (§4.2). An installed
bundle's two halves talk over the shared **Connection RPC channel registry** — no codegen, no
typert, no `@Remote` decorator:

Host (`index.js`), both shapes from the catalog
(`_dsh_src/.../dsh-tool-cordis/lib/types/api-catalog.js:6589-6590, 5897-5902`):

```ts
export interface HostConnectionRpc {
  handle(channel: string, handler: ConnectionRpcHandler): () => Promise<void>;
  intercept(channel: '/api', matches: ConnectionRpcEndpointMatcher, handler: ConnectionRpcHandler): () => Promise<void>;
}
export type ConnectionRpcHandler = (endpoint: string, payload: unknown, signal: AbortSignal, peer: PeerScope)
  => Promise<ConnectionRpcHandlerResult>;
export type ConnectionRpcHandlerResult =
  | { readonly ok: true; readonly value: unknown; readonly attachments?: readonly ConnectionRpcAttachment[] }
  | { readonly ok: false; readonly error: ConnectionRpcFailure };
```

Client (`client.js`):

```ts
export interface ClientConnectionRpc {
  call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<ConnectionRpcResult<unknown>>;
  readonly open?: (channel: string, endpoint: string, payload: unknown, signal: AbortSignal, uplink?: AsyncIterable<unknown>) => AsyncIterable<unknown>;
}
```

So one pair, end to end:

```js
// host half (index.js of the bundle)
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const inject = ["connection"];
function apply(ctx) {
  const dispose = ctx.effect(() => ctx.connection.rpc.handle("/paper-reader", async (endpoint, payload, signal, peer) => {
    if (endpoint === "readPdf") {
      const bytes = await readFile(payload.path);       // payload is plain JSON
      return { ok: true, value: { base64: bytes.toString("base64") } };
    }
    return { ok: false, error: { code: "paper-reader/unknown-endpoint", message: `no endpoint ${endpoint}`, details: {} } };
  }), "paper-reader: rpc channel");
  return dispose;
}
```

```js
// Client half
const answered = await ctx.connection.rpc.call("/paper-reader", "readPdf", { path }, signal);
if (!answered.ok) throw new Error(`${answered.error.code}: ${answered.error.message}`);
const { base64 } = answered.value;
```

Constraints, all enforced in source:

* channel must match `/^\/[A-Za-z0-9._~-]+$/` and **must not be `/api`**
  (`.../dsh-client-connection/lib/index.js:689, 970-972`);
* endpoint segments must match `/^[A-Za-z0-9_$.-]+$/` and may not be `.`/`..`/empty
  (lines 926-931);
* transport is `POST <channel>/<endpoint>` with `content-type: application/json` and a
  `{type:"client-request", rpcId, method, payload}` envelope; a content-type other than
  JSON is 415, a non-JSON body is 400, a body with a mismatched `method` is
  `gateway/bad-request` (lines 888-917);
* **the channel route is admitted and authenticated** — it is registered with
  `kind:"prefix"` and the handler calls `this.admit(req)` before bridging
  (`.../dsh-client-connection/lib/index.js:855-871`), so a browser cookie/loopback trust applies
  and the handler receives a real `peer`;
* binary results can ride `attachments` (`ConnectionRpcAttachment[]`, `fullResponse` builds a
  `multipart/form-data` reply, lines 938-969); the client decodes it back into `Uint8Array`s
  (`.../dsh-client-connection/lib/client.browser.js:1240-1279`).

### 6.1 Reading the PDF bytes — the shipped path

If the file lives in the workspace, you do not need your own channel at all: the Host already
serves `ctx.remote.workspaceFiles` (Host catalog:
`@Remote async read(workspaceFileScope, path, range, signal)`,
`@Remote async readBytes(workspaceFileScope, path, options, signal)`,
`.../dsh-tool-cordis/lib/types/api-catalog.js` `workspaceFiles`). The shipped PDF viewer pulls
bytes through it:

```js
// _dsh_src/.../dsh-client-ui-sidebar-documentpreview/lib/client.js:8016
const face = textFace(createReadPage(ctx.remote), (file, signal) => ctx.remote.workspaceFiles.readBytes(file.sessionId, file.path, {}, signal), ctx.resources);
```

Declare `"remote"` and `"remote.workspaceFiles"` in the client `inject`
(`.../dsh-client-ui-sidebar-documentpreview/lib/client.js:7985-7994`), then:

```js
const result = await ctx.remote.workspaceFiles.readBytes(sessionId, path, {}, signal);
// result.ok ? result.value : result.error   (RemoteResult envelope)
```

and hand the `Uint8Array` to `getDocument({ data: bytes, … })`
(see the shipped call at `.../dsh-client-ui-sidebar-documentpreview/lib/client.pdf.js:24728-24737`).
Add a Host `webServer` prefix route (§5.3) only for the **pdf.js support assets**, not the PDF.

---

## 7. Locale for a plain plugin

### 7.1 Register dictionaries

The service is `ctx.locale`, provided by `dsh-client-locale`
(`.../dsh-client-locale/lib/client.js:1838` — `ctx.provide("locale", locale)`). Register a namespace
inside an effect; mode B1 is `register(ns, { zh, en, … })`:

```js
// _dsh_src/.../dsh-client-ui-plan/lib/client.js:736-745
ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), "ui-plan: dictionaries");
```

The signature accepts both spellings (`.../dsh-client-locale/lib/client.js:1675-1684`):

```js
register(ns, localeOrDicts, dict) {
    const pairs = typeof localeOrDicts === "string" ? [[localeOrDicts, dict]] : Object.entries(localeOrDicts);
    for (const [locale] of pairs) if (!LOCALE_ID_PATTERN.test(locale)) throw new Error(`locale id "${locale}" is not a BCP 47-style tag`);
    ...
    for (const [locale] of pairs) if (locales.has(localeKey(locale))) throw new Error(`locale namespace "${ns}" already has locale "${locale}"`);
```

Constraints: locale ids must match `/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u`
(line 920); a namespace may register each locale **once** (re-registering throws — so never
re-register on a locale change); built-ins are exactly `zh` and `en` (`LOCALE_IDS`, line 922;
`zh` falls back to `en`, lines 1430-1435); the returned disposer removes the exact dict objects.

### 7.2 Translate at runtime

```js
// _dsh_src/.../dsh-client-ui-plan/lib/client.js:747
const t = ctx.locale.bind(NS);              // stable fn bound to a namespace
t("guide.title")                            // key lookup, `{name}` params supported
```

```js
// _dsh_src/.../dsh-client-locale/lib/client.js:1702-1716
bind(ns) {
    let t = this.bound.get(ns);
    if (!t) { t = (key, params) => this.translate(ns, key, params); this.bound.set(ns, t); return t; }
    return t;
}
translate(ns, key, params) {
    const chain = this.fallbackChain(this.snapshot.active);
    const template = this.lookup(ns, key, chain) ?? (ns !== "common" ? this.lookup("common", key, chain) : void 0) ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name) => name in params ? String(params[name]) : match);
}
```

For a slot entry, prefer passing `locale: NS` to `ctx.slots.register` — the renderer then hands
the component a `t` prop bound to that namespace, re-minted on each locale switch
(`.../dsh-client-ui-renderer/lib/client.js:542-557, 742-746`):

```js
ctx.slots.register({ name: "sidebar.right.pane.tab", key: PAGE_ID, locale: "paperReader" }, Body);
// inside Body: ({ t }) => t("toolbar.open")
```

### 7.3 Read the active locale (for prompt language)

```js
// _dsh_src/.../dsh-client-locale/lib/client.js:1516-1522
getLocale() { return this.snapshot; }
```

Snapshot shape is `{ active, locales, revision }`, frozen, replaced on every change
(`publish(active, localeChanged, locales)`, lines 1731-1736; `getSnapshot()` returns the same object,
line 1538). So:

```js
const active = ctx.locale.getLocale().active;   // "zh" | "en" | …
const isChineseUi = active === "zh";
const promptLanguage = isChineseUi ? "zh" : "en";   // match the interface language
```

Inside React use the reactive pair — `ctx.locale.getSnapshot()` / `ctx.locale.subscribe(fn)`
(lines 1533-1552), the `locale/change` event (`ctx.on("locale/change", (snapshot) => …)`, emitted
only on an actual locale switch, line 1737), or `useLocale` if injected. Prefer the
`LocaleSnapshot.revision`-driven subscription: dictionary registrations bump `revision` but do **not**
emit `locale/change` (comment lines 1724-1730), so a listener-only design misses late dicts.
The shipped renderer subscribes exactly that way (`useLocaleRevision` →
`useSyncExternalStore(subscribe, () => face.getSnapshot().revision)`,
`.../dsh-client-ui-renderer/lib/client.js:587-590, 1007`), and every rendered entry re-derives its
`t` seat at the new revision (lines 541-558).

---

## 8. Gotchas

1. **`id` is the Slot key, and it is globally unique.** A second `register` with the same `id`
   throws (`.../sidebar-right/lib/client.js:4910`); a `kind` can hold at most one `builtin` plus
   one `extension`, and a `fallback` shares its kind with nothing (lines 4909-4912, 4845-4847).
   Do not take the `text` or `files` kinds.
2. **Register the body/title under `key: definition.id`, not `tab.kind`.** The seat dispatches
   `entryKey: definition?.id ?? tab.kind` (line 1597), so a mismatch renders the "nothing can view
   this" fallback (`tab.unavailable`, line 1615-1630).
3. **Registration must be inside `ctx.effect`, and slot registration inside `ctx.slots.inject`.**
   Registering into an undeclared slot throws; the rightbar seat is declared by another package
   (`children: { "sidebar.right.pane.tab": … }`, line 5683), so wrap with `inject`.
4. **`ctx.sidebarRight.openTab` throws when no Session is mounted.** `require()` raises
   `"sidebarRight: no session surface is mounted"` (line 2922) — call from a click/effect, and
   guard for the hero screen (the right sidebar has no surface without a Session: README §Known
   Limitations line 152).
5. **`title(address)` is captured at open time and never refreshed.** A live chip needs the
   separate `sidebar.right.pane.tab.title` registration (README line 156;
   `renderSlot(…, fallback: tab.title)`, line 1634-1640).
6. **`insertQuote` is phase- and content-gated.** Returns `false` unless phase is `plain`, the
   session is writable, and text is non-blank (`.../dsh-client-ui-conversation/lib/client.js:15464-15469`).
   Always branch on the boolean.
7. **`insertText` needs a fresh `captureInsertion()` span.** A span captured before any edit has a
   stale `draftRev` and silently returns `false` (lines 15374-15378, 15771-15773).
8. **`ctx.get('conversation')` is Session-scoped and throws at root** — the error message even tells
   you to address a Session scope (lines 5083-5086). There is **no** global composer service and
   no `uiSession` accessor that yields one.
9. **`host.call` and `harness` are dynamic-package only.** A module-loader bundle has no
   `host`/`styles`/`console` symbols; calling them is `undefined`. Conversely a dynamic package's
   `ctx` is a read-only whitelist proxy — `ctx.sidebarRightTabs` works only if you declared it in
   `inject` (lines 486-496).
10. **`/plugins/<pkg>/assets/` serves only images** (`.svg .png .webp .jpg .jpeg`,
    `.../dsh-client-modules/lib/index.js:11-30`) — pdf.js's `.mjs`, `.bcmap`, `.ttf` and `.wasm`
    must go through your own `webServer` prefix route (§5.3).
11. **`webServer.register` routes are unauthenticated by default.** Only `/api` and the SPA index
    call `ctx.connection.admit` (§5.3); loopback binding is the practical boundary, and the Host
    refuses a wildcard bind outright (`.../dsh-host-webserver/lib/index.js:304`).
12. **`ctx.locale.register` rejects a second registration of the same namespace+locale** (line 1683)
    — register once per plugin load, in one effect, and never on locale change.
13. **Client inspect timed out in this session.** Everything in §1/§2/§7 is read from shipped
    bundles, not from a live page; re-run `cordis_inspect_query` (`platform: "client"`,
    `provider: "Slots"`, `input: { root: "sidebar.right.pane.tab" }`) once the page answers to
    confirm the live occupant/prop list.

