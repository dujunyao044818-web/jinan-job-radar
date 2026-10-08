# 济南博士招聘雷达

零 AI API 调用的济南高校/医院官方招聘索引。**当前是可运行首版，不是所有济南单位的完整覆盖。**

## 功能
- 4个已确认的官网列表页；可在 `scripts/sources.json` 增加新的**经核验且允许访问**的信息源
- 官方公告标题、来源、发布日期（能从列表项识别时）、原文链接
- 标题级博士相关筛选（非岗位资格审核）、搜索、排序、去重、历史公告
- 每天北京时间约09:25计划采集（GitHub 计划任务可能延迟）
- 手动一键触发：网页「启动新一轮官网检测」→ Actions → `Run workflow`（需要仓库写入权限）
- 网页「刷新已采集结果」只重新读取已经发布的数据；不会启动后台爬虫
- 保留站点失败状态；失败不被标为无招聘

## 部署（新建 public 仓库，默认 main 分支）
1. GitHub 创建公开仓库，例如 `jinan-job-radar`。
2. 将本压缩包**内容**放到仓库根目录（包含隐藏的 `.github/` 文件夹），提交到 `main`。
3. 在 `Settings → Pages → Build and deployment → Source` 选择 **GitHub Actions**。
4. `Actions → Collect official job notices → Run workflow` 首次手动采集。完成后 bot 会将 `site/data/jobs.json` 更新并提交回 `main`，然后通过 `workflow_run` 触发发布。
5. `Publish job radar` workflow 会从 `site/` 自动部署至 `https://用户名.github.io/jinan-job-radar/`。首次部署也可以手动执行。
6. 想立即再扫一次：网页点「启动新一轮官网检测」，在 GitHub Actions 中点 `Run workflow`；完成后返回网页点「刷新已采集结果」。

## 本地运行
```bash
python -m pip install -r requirements.txt
python scripts/collect.py
python -m http.server 8000 --directory site
```
浏览器打开 http://localhost:8000。

## 数据质量与限制
- 不是全文解析；截止日期仅在公告正文符合严格日期模式时提取，否则为**未核实**，不能因为没有截止日期就推断仍开放报名。
- 当前只从公开列表页提取；有些网站使用验证码、JS或反爬措施，可能解析失败。每站状态会显示失败，不会虚构结果。
- 不绕过验证码、身份验证或访问限制。严守网站规则，必要时使用官方RSS/接口或人工录入。
- 博士筛选只基于标题关键词；招聘附件内隐藏的博士岗位可能漏检，且带博士字样不保证适合。
- 招聘信息仅做索引，请核对原文、附件、报名入口。数据时间按北京时间展示。
- 如需新增单位，必须核实具体招聘栏目链接，**不能单凭主页搜索关键词当成覆盖成功**。
- 免费服务额度及政策以 GitHub 官方实时说明为准。
