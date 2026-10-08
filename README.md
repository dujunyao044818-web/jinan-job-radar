# 济南博士招聘雷达

济南医院、高校与科研机构官方招聘公告索引，重点服务医学博士毕业生。项目使用规则解析与免费开源库，不调用 AI API，也不保存报名者信息。

线上地址：<https://dujunyao044818-web.github.io/jinan-job-radar/>

## 能做什么

- 读取经核验的官方招聘栏目，解析公告正文与 PDF、DOCX、XLSX 附件。
- 提取发布日期、报名起止日期、学历、学位、专业、人数、工作地点和官方附件链接；没有依据的字段显示“未核实”。
- 使用可解释规则区分“博士岗位、可能符合专业、需要人工核实、非目标岗位”，并单列博士后。
- 标注医师资格证、住院医师规范化培训、临床执业资格和特定职称限制。
- 支持关键词、单位类型、来源、专业、发布日期、截止日期、最近新增、即将截止、历史公告和浏览器本地收藏。
- 单个来源失败时保留历史公告和最近成功时间，失败数量显示为未知，不会显示成“0 条招聘”。
- 用规范化 URL 去重；结构化字段变化时保留最多 10 次修订记录。

规则评分只是检索辅助。基础医学博士不会因为专业名称匹配而自动判定符合临床医师岗位，最终条件必须核对官方原文及附件。

## 已投入生产的官方来源

| 来源 | 官方招聘栏目 | 采集方式 | 2026-10-08 云端抽样 |
| --- | --- | --- | --- |
| 山东大学人才招聘网 | <https://rsrczp.sdu.edu.cn/> | HTML 列表、详情及附件 | GitHub Actions 证书主机名校验失败，替代栏目核验中 |
| 山东第一医科大学人事部 | <https://personnel.sdfmu.edu.cn/> | HTML 列表、详情及附件 | 成功，识别 6 条目标公告 |
| 山东大学齐鲁医院 | <https://www.qiluhospital.com/list-313-2.html> | HTML 列表、详情及附件 | 失败，官方站返回 HTTP 420 |
| 山东省立医院 | <https://www.sph.com.cn/Html/News/Columns/124/Index.html> | HTML 列表、详情及附件 | 成功，严格过滤后识别 1 条目标公告 |
| 山东第一医科大学附属肿瘤医院 | <https://www.sd-cancer.com/tender_sub/> | HTML 列表、详情及附件 | 成功，识别 13 条目标公告 |
| 济南大学人力资源处 | <https://rsc.ujn.edu.cn/rczp.htm> | HTML 列表、详情及附件 | 成功，识别 1 条目标公告 |
| 齐鲁工业大学人事处 | <https://rsc.qlu.edu.cn/575/list.htm> | HTML 列表、详情及附件 | 招聘列表核验成功，完整采集复核中 |
| 山东师范大学人力资源处 | <https://rsc.sdnu.edu.cn/gkzp.htm> | HTML 列表、详情及附件 | 公开招聘栏目核验成功，完整采集复核中 |

这里的数量是当次列表提取结果，不等于当前仍在报名的岗位数量。齐鲁医院的 420 不会被绕过；在找到并验证官方替代栏目之前继续保留失败状态。

第一批 6 个医院候选官网中只有山东第一医科大学附属肿瘤医院通过三项检查。第二、三批高校与政府渠道核验后，济南大学、齐鲁工业大学和山东师范大学具有具体招聘栏目。失败与待确认结果分别保存在 [医院候选记录](scripts/source_candidates_hospitals.json)、[高校候选记录](scripts/source_candidates_universities.json) 和 [剩余渠道](scripts/source_candidates_batch3.json)，不会参与生产采集。

## 本地开发

推荐 Python 3.11：

    python -m venv .venv
    .venv/bin/python -m pip install -r requirements.txt
    .venv/bin/python -B -m unittest discover -s tests -p "test_*.py" -v
    node --test tests/frontend.test.mjs
    python -m http.server 8000 --directory site

采集会更新 site/data/jobs.json：

    python scripts/collect.py

遇到代理或站点限制时，不要关闭 TLS 校验、伪造成功状态或用测试数据覆盖正式数据。使用单元测试中的模拟响应验证解析逻辑，并在 GitHub Actions 托管运行器上完成真实采集验证。

## 自动采集与部署

[collect.yml](.github/workflows/collect.yml) 每天 UTC 01:25（北京时间约 09:25）运行，也支持手动启动。

- 所有运行先执行 Python 和前端测试。
- Pull Request 只测试，不采集、不提交数据、不部署。
- 功能分支手动运行会生成真实采集 JSON artifact，不写回仓库、不部署。
- main 上的计划或手动运行会保存 site/data/jobs.json 并部署 GitHub Pages。
- 即使所有来源都失败，错误状态与历史公告仍会生成并发布，最后的健康检查会把工作流标红。
- 手动勾选 source_audit 时，只核验候选来源并上传证据 artifact。

网页“刷新已发布数据”只重新读取 Pages 上的 JSON；“前往 Actions 启动采集”链接固定指向 collect.yml。

## 数据真实性

生产数据和测试数据严格隔离。测试用例只使用 jobs.example.org 模拟响应和内存生成的 Office 文件。采集器：

- 不绕过验证码、登录、HTTP 420 或其他访问限制；
- 使用系统或 REQUESTS_CA_BUNDLE 指定的可信 CA，不关闭证书校验；
- 对 429 和服务端临时错误有限重试，并设置连接、读取超时和站点间延迟；
- 限制附件为 12 MB、每个来源每轮最多解析指定数量的详情；
- 对旧版 DOC/XLS、损坏或受密码保护的附件保留官方链接并标明未解析。

数据字段与来源维护流程见 [MAINTENANCE.md](MAINTENANCE.md)。
