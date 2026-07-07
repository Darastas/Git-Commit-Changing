# Repo Movie Machine

[English README](./README.md)

## 产品介绍

Repo Movie Machine 是一个紧凑的创意开发者工具，可以把公开 GitHub 仓库转换成可播放的提交与星标趋势电影。

用户输入 `owner/repo` 这样的仓库地址后，服务端会获取仓库信息和提交历史，分析器生成可复用的 `RepoMovie` JSON 模型，浏览器再渲染带动画的趋势时间线，展示累计提交数、历史 stars、当前提交、变更文件、分享和导出能力。

当前能力：

- 支持公开 GitHub 仓库输入：`https://github.com/owner/repo`、`github.com/owner/repo` 或 `owner/repo`。
- 提交数量可选：`30`、`100`、`250`、`500` 或 `全部`。默认 `100`。
- GitHub API 只在服务端访问；可选配置 `GITHUB_TOKEN`，令牌不会暴露给浏览器代码。
- 无 token 时使用 summary 模式，避免低匿名额度下对每个提交发起详情请求。
- 配置 `GITHUB_TOKEN` 时会获取真实 GitHub stargazer 时间线；失败或无 token 时回退到估算星标趋势。
- 前端支持中英双语，并提供页面内语言切换。
- 支持本地分享链接、查询参数加载、JSON 导出、PNG 截图导出和浏览器端 WebM 录制。

## 本地部署教程

环境要求：

- Node.js 20+
- npm
- 可选 GitHub token，用于提升 API 额度和获取真实历史 stars

安装并运行：

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

可选 `.env.local`：

```bash
GITHUB_TOKEN=github_pat_or_classic_token_here
```

验证项目：

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

当前 Next.js 应用最简单的生产部署目标是 Vercel。部署时在项目环境变量里配置 `GITHUB_TOKEN`，构建命令使用 `npm run build`。注意：当前 job 和 movie 存储都是内存实现；如果要依赖持久分享链接，建议替换成 Redis、Vercel KV、Upstash、Postgres、Cloudflare KV、D1 或 Durable Objects。

## 网页用法

1. 在左侧面板输入公开 GitHub 仓库。
2. 选择提交数量。超大仓库建议先用 `30` 或 `100`。
3. 点击播放按钮生成电影。
4. 使用播放/暂停、跳转、倍速、曲线样式、主题和时间线拖动查看动画。
5. 点击语言切换控件，在英文和中文之间切换。
6. 点击提交轨迹或可视化里的文件，查看当前变更上下文。
7. 生成真实仓库电影后，可以导出 `RepoMovie` JSON、保存 PNG 截图、录制 WebM，或复制分享链接。

建议手动验证目标：

- `octocat/Hello-World`
- `vercel/next.js`，先用 30 条提交
- 非法输入，例如 `https://example.com/a/b`
- 不存在的仓库，例如 `octocat/does-not-exist-repo`
- 不配置 `GITHUB_TOKEN`
- 配置 `GITHUB_TOKEN`
- 桌面和移动端视口

## 简单的技术说明

项目使用 Next.js App Router、TypeScript、React、Tailwind CSS、Canvas、lucide-react、Vitest 和 Playwright。

主要结构：

```text
app/                  页面路由和 API
components/           工作台、播放器、canvas、面板和双语 UI
lib/github/           GitHub URL 解析和 REST API 客户端
lib/jobs/             内存 job 队列/存储和缓存 key
lib/movie/            RepoMovie 模型、解析器、趋势计算、录制工具
lib/storage/          内存 movie 存储
lib/security/         输入限制和请求冷却
worker/               异步分析流程
tests/                单元、组件和 e2e 覆盖
```

当前限制：

- job 和 movie 产物存储在进程内存中。
- 分享链接只在同一个服务进程保留结果时有效。
- 不配置 `GITHUB_TOKEN` 时，电影使用 commit list 摘要和合成的 `.repo/activity/*` 文件，而不是精确的逐提交文件详情。
- 分析器只使用 GitHub API，不会 clone 仓库。
- `全部` 模式分析超大仓库时可能需要请求很多提交分页。
- 暂不支持 MP4 导出；WebM 为浏览器端录制。

推荐后续升级：

- 持久化 job 和 movie 存储。
- 引入带重试和取消能力的 worker 队列。
- 可选 clone-based 分析器，用于更完整的历史数据。
- 独立于内存 job ID 的持久公开分享 slug。
- 服务端渲染/导出 MP4 管线。
