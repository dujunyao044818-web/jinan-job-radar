# 维护说明

## 新增来源

每次只核验 4–6 个单位。

1. 将候选单位名称、别名、类型和官网根地址加入 scripts/source_candidates.json。
2. 在 Actions 手动运行 collect.yml，勾选 source_audit。
3. 下载 source-audit artifact，逐项检查：
   - 页面标题或正文能确认单位身份；
   - URL 是具体招聘栏目，不是官网首页或站内搜索结果；
   - 栏目中至少有一条真实招聘公告；
   - 域名、跳转目标和附件域名均属于官方站点。
4. 人工打开样例标题和原文复核，确认没有验证码、登录或禁止自动访问的要求。
5. 将通过核验的来源移入 scripts/sources.json，补充别名、采集方法、核验日期和允许的官方附件域名。
6. 在功能分支手动运行普通采集，下载 collection artifact，检查来源状态、数量、标题、日期和原文链接后再提交。

无法确认具体招聘栏目时保持候选状态。不得仅因官网首页返回 200 就标记成功。

## 采集状态

每个来源保存 URL、官网、类型、采集方法、状态、本轮数量、尝试时间、最近成功时间和错误原因。成功时 found 为本轮目标公告数；失败时必须为 null。页面必须把失败解释为“数量未知”，继续展示历史公告。

## 结构化字段与依据

site/data/jobs.json 的当前版本为 schema_version 2。每条公告包含官方 URL、来源、标题、发布与报名日期、学历学位、专业、人数、地点、附件、规则判断和修订记录。

evidence 保存正文中支持结构化字段的短文本。发布日期还可由 published_evidence 保存列表项或页面元数据依据。无法识别时使用 null 或“未核实”，不得推测。

只有 deadline_reliable 为 true 时，前端才显示剩余天数和“7 天内截止”筛选。没有截止日期的公告只作为历史索引，不表示仍开放报名。

## 测试

提交前运行：

    python -B -m unittest discover -s tests -p "test_*.py" -v
    node --test tests/frontend.test.mjs
    python -m json.tool scripts/sources.json >/dev/null
    python -m json.tool scripts/source_candidates.json >/dev/null
    python -m json.tool scripts/source_candidates_hospitals.json >/dev/null

测试覆盖公告提取、日期与截止日期、标题清洗、博士评分、专业匹配、资格限制、URL 去重、非招聘过滤、来源失败后的历史保留、JSON 结构和前端筛选排序。

## 故障处理

- TLS 错误：检查系统 CA、证书链和官方替代栏目；不得关闭 TLS 验证。
- HTTP 420、验证码或登录：记录失败，停止自动访问，寻找可公开访问的官方替代栏目。
- 页面结构变化：保存失败状态，更新选择器并用脱敏的模拟 HTML 写回归测试。
- 附件解析失败：保留官方附件链接与错误类型，不得从非官方页面补写字段。
- 所有来源失败：仍发布错误状态与历史数据，Actions 的 collection-health 作业应失败以提醒维护者。
