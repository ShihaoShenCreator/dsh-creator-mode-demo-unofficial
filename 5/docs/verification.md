# 验证说明（视频剪辑工作台）

## 运行全部测试

工作区根目录依次执行（`tmp-clienttest` 里的浏览器侧测试需要先构建 `client.js`）：

```text
node tools/build.mjs

node video-editor/host/projecttest.mjs      # 时间轴状态机（撤销/重做/裁剪/切分/移动/叠加层/持久化）
node video-editor/host/hosttest.mjs         # 端到端：探测 + 全部操作 + 真实 ffmpeg 渲染
node video-editor/host/routetest.mjs        # HTTP 路由一致性（导入/操作/Range/封面/导出/会话隔离）
node video-editor/host/toolscheck.mjs       # 用真实 @deepseek-ai/dsh-tools 校验工具 schema 与分发一致性
node video-editor/host/selftest.mjs         # 媒体/渲染模块的 48 项自检

node tmp-clienttest/model.test.mjs          # 纯时间轴数学 + 与 Host layout 的交叉校验（70 项）
node tmp-clienttest/verify.mjs              # 构建产物手递协议 + apply(ctx) 注册三个插槽
node tmp-clienttest/dock.test.mjs           # 输入框状态条派发 dsh-video-editor:open
node tmp-clienttest/render.test.mjs         # 渲染路径浅层测试
node tmp-clienttest/deeprender.test.mjs     # 有状态 React 假实现下的交互测试（21 项）
node tmp-clienttest/focus.test.mjs          # 选中片段后按 Delete 真的发出 delete 操作
node tmp-clienttest/split.test.mjs          # 切分按钮在选中后启用并发出 split 操作
node tmp-clienttest/smoke.mjs               # 构建产物离线冒烟
```

## 测试脚手架注意事项

浏览器侧的假 React 必须模拟三个真实 React 行为，否则会把正确代码判成错误：

1. `createElement` 要把 children 合并进 `props.children`（错误边界读 `this.props.children`）。
2. 类组件要 `new type(props)` 后调用 `render()`，不能当函数调用。
3. React 模块要带 `__esModule = true` 且 `default` 指向自身 —— esbuild 的
   `__toESM` 互操作会据此产出 `import_react.default.createElement`。

另外，选中片段是 React 状态：测试里点完片段后必须**重新渲染一次**并从新节点上取事件处理器，
否则拿到的是旧的闭包（表现为「按钮没反应」而产品其实是对的）。
`refresh()` 返回最新节点列表，请用它而不是旧解构的 `nodes`。

## 环境约束

- 本机 sandbox 下 **ffmpeg 只能写工作区内的路径**（写 `%TEMP%`、`Documents` 都会 "Permission denied"，
  而 Node 可以写）。Host 模块已做探测并回退到包内暂存目录，测试也把临时目录放在工作区内
  （`tmp-hosttest/`、`tmp-routetest/`）。
- 因此 **不要并发跑多个 Host 测试**：它们各自的临时目录会被互相干扰，串行运行才稳定。
- 该 ffmpeg 构建（N-92722）上 CFR 顺序必须是 `trim → fps → setpts`，
  写成 `trim → setpts → fps` 会把时长算错（3s 渲染成 4s）。
