# 视频剪辑工作台（Video editing workbench）

一个装进 DeepSeek Harness 的剪辑工作台插件：在会话里打开一个深色界面的剪辑软件，上方是
预览器（占页面主要空间），下方是时间轴；支持导入多个视频、在时间轴上剪辑、导出 mp4。
同样的剪辑操作也能由会话中的自然语言驱动——UI 和智能体走同一份数据、同一套操作实现。

## 能力

- **导入**：文件选择 / 拖拽上传、按主机路径批量导入（`import`），素材库显示缩略图、时长、
  分辨率、是否带音频。
- **时间轴**：磁性主轨道（自动首尾相连）+ 自由位置的叠加层（画中画）。支持裁剪入出点、
  在播放头切分、删除、拖拽排序、叠加层位置/宽度调整、缩放与标尺、键盘快捷键。
- **预览**：主轨道视频按片段顺序播放并在片段边界换源，叠加层按自己的时间窗口合成显示；
  播放头、逐帧步进、音量、适配窗口。
- **导出**：ffmpeg 一次性 filtergraph 渲染（裁切 + 缩放补边 + 音频拼接/静音补齐 + 叠加合成），
  带进度轮询、下载链接和主机输出路径。随包内置 ffmpeg / ffprobe 可执行文件。
- **自然语言**：`video_editor` 工具支持 import / add_clip / trim / split / delete / move /
  set_project / export 等动作，直接操作当前会话的时间轴。

## 安装

```text
plugin_manager install_bundle  target = <本目录 video-editor>
```

安装后：
- 插件页出现「视频剪辑工作台」条目（中英文标题与描述、自带图标）；
- 任意会话顶部页签多出「剪辑工作台」，或在页签「更多」菜单里打开；
- 输入框下方出现一行安静的状态条（素材数、总时长），点它也能进入工作台；
- 智能体获得 `video_editor` 工具。

## 结构

```
video-editor/
  package.json          bundle 清单（dsh.bundle.patch + dsh.client）
  cordis.patch.yml      插入 video-editor 行
  index.js              Host 半边：HTTP 路由、导出任务、video_editor 工具
  client.js             构建产物（window.__ModuleLoader__.load 手递）
  host/
    project.js          时间轴状态机（唯一操作实现 + 撤销/重做 + 持久化）
    media.js            ffprobe 探测、封面/帧抽取、Range 流式输出
    render.js           ffmpeg 渲染管线（进度、取消、清理）
    http.js             请求体、同源围栏、Range、路径工具
    store.js            会话级 JSON 持久化
    projecttest.mjs     状态机单测
    hosttest.mjs        端到端（探测 + 操作 + 真渲染）
    toolscheck.mjs      用真实 @deepseek-ai/dsh-tools 校验工具定义
  src/client/           浏览器半边源码（构建前）
    index.jsx           入口：注册 locale / 视图 / 打开器 / 状态条
    model.js            纯函数时间轴数学
    api.js              路由客户端 + 轮询
    Workbench.jsx       页面骨架
    Preview.jsx         预览舞台 + 播放引擎
    Timeline.jsx        标尺 / 轨道 / 片段 / 播放头
    MediaBin.jsx        素材库
    ExportDialog.jsx    导出面板
    styles.js           作用域样式表
  bin/                  ffmpeg.exe / ffprobe.exe
  locale/zh.json        en.json 插件元数据
  icon.svg
```

## 构建

```text
node tools/build.mjs        # 重新生成 video-editor/client.js
```

## 测试

先构建，再按顺序**串行**运行（并发会互相干扰各自的临时目录）：

```text
node tools/build.mjs

node video-editor/host/projecttest.mjs    # 时间轴状态机
node video-editor/host/hosttest.mjs       # 探测 + 操作 + 真实渲染
node video-editor/host/routetest.mjs      # HTTP 路由（含 Range / 导出 / 会话隔离）
node video-editor/host/toolscheck.mjs     # 工具 schema 与分发一致性（用真实 registry）
node video-editor/host/selftest.mjs       # 媒体/渲染 48 项自检

node tmp-clienttest/verify.mjs            # 构建产物手递 + 三个插槽注册
node tmp-clienttest/dock.test.mjs         # 状态条派发打开事件
node tmp-clienttest/model.test.mjs        # Host/Client 时间轴数学一致
node tmp-clienttest/render.test.mjs       # 渲染路径
node tmp-clienttest/deeprender.test.mjs   # 交互（有状态假 React）
node tmp-clienttest/focus.test.mjs        # 选中 + Delete
node tmp-clienttest/split.test.mjs        # 选中 + 切分
node tmp-clienttest/smoke.mjs             # 离线冒烟
```

详细说明与注意事项见 `docs/verification.md`。

## 数据位置

- 工程文档：`<DSH_HOME>/video-editor/projects/<sessionId>.json`
- 上传素材：`<DSH_HOME>/video-editor/media/`
- 封面与帧缓存：`<DSH_HOME>/video-editor/poster/`、`frame/`
- 导出文件：`<DSH_HOME>/video-editor/exports/<sessionId>/`
- 按路径导入的文件**不复制**，直接引用原文件。

## 已知限制

- 主轨道保持磁性（无空隙）；需要空隙时可把片段放到叠加层，或先插入占位素材。
- 叠加层最多按 1/10 精度取帧缓存；filmstrip 缩略图数量随片段宽度变化。
- 仅 Windows 内置 ffmpeg 二进制；其他平台可设置 `DSH_VIDEO_EDITOR_FFMPEG` /
  `DSH_VIDEO_EDITOR_FFPROBE` 指向本机可执行文件。
- 导出为 H.264 + AAC mp4；暂不支持转场、字幕、音频混音。
