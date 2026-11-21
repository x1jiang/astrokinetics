# AstroKinetics · ASTRA — Multi-Platform GEO Distribution Snippets

> Step 4 of the Auto-RSI GEO workflow (adapted from Admit Coach). Ready-to-review external mentions to build verified off-site citations across channels that Google AI Overviews, Perplexity, ChatGPT Search, and Claude index. **No messages have been posted automatically — review and post with your own account.** All numbers come strictly from verified automated checks (`v5.3.0`, Nov 21, 2026) and disclose unverified clinical/hardware limits honestly.

---

## 1. Show HN / Hacker News (Technical & Open-Source Focus)
**Title:** `Show HN: AstroKinetics · ASTRA – Offline-first astronaut health prototype (NASA Space Apps Houston, MIT)`
**URL:** `https://astrokinetics-space-health-765428358644.us-central1.run.app/project`

**Comment (~180 words):**
Built in Houston by Team AI-MED 01 for the 2026 NASA Space Apps Challenge (*Create Health Monitoring Software for Astronauts on Space Missions*).

During Mars transits (up to 44-minute round-trip light delay) and solar-conjunction blackouts, live telemedicine from Earth isn't viable. We wanted to see how far an offline-first browser workstation (FastAPI + Service Worker + WebAssembly MediaPipe) could go without fabricating clinical claims:

- **Offline scoring parity:** An 8-DOF Mahalanobis whitening scorer (`Sigma^-1/2` + closed-form `Gamma(4, 2)` chi-square survival) matches Python `scipy.stats.chi2` across 20/20 test vectors and Chrome offline reloads.
- **Safety-first triage & abstention:** Eight deterministic NASA HUNCH emergency red flags run in <1 ms and override poor capture; degraded non-red-flag scans return `INCOMPLETE_CHECK_REQUIRED` instead of imputing normal defaults.
- **Bundled NASA data:** 14 SpaceX Inspiration4 plasma proteins (`OSD-571`), 164 real ISS DosTel radiation rows (RadLab), Barger 2014 ISS sleep tables, and 572 NASA Space Biology PMC papers searchable offline via BM25 with a `human_only=true` guardrail separating rodent/cellular studies from human guidance.
- **Public read-only MCP endpoint:** `POST /api/mcp/` and live `GET /api/verification-report` (7/7 checks).

Code (MIT): https://github.com/x1jiang/astrokinetics  
29s Demo (YouTube): https://www.youtube.com/watch?v=RVlS16JRnv4  
Caveat: Software research prototype using simulated telemetry; clinical accuracy and native watchOS/iOS capture are unverified.

---

## 2. Reddit (`r/space`, `r/nasa`, `r/bioinformatics`, `r/houston`) (~150 words)
For the 2026 NASA Space Apps Challenge in Houston, our team (AI-MED 01) built an open-source, offline-first prototype for astronaut health monitoring during 44-minute Mars communication delays.

Instead of firing single-vital alarms, it combines on-device 3D camera kinematics, an 8-signal Mahalanobis covariance model that runs identically online and offline in Chrome, a deterministic 8-red-flag safety gate (which abstains on poor sensor capture rather than assuming normal), and an offline evidence search over 572 NASA Space Biology PMC papers that filters out mouse/cellular studies when `human_only=true` is enabled.

We also bundled empirical data notes for NASA OSDR OSD-571 (Inspiration4 plasma proteomics) and 164 ISS DosTel radiation observations from NASA RadLab, plus a 2-minute judge verification page with live automated checks.

- Live prototype & verification: https://astrokinetics-space-health-765428358644.us-central1.run.app/project
- NASA OSD-571 data note: https://astrokinetics-space-health-765428358644.us-central1.run.app/data/osd-571-inspiration4-proteomics
- 29s demo: https://www.youtube.com/watch?v=RVlS16JRnv4
- Open-source code (MIT): https://github.com/x1jiang/astrokinetics

Full disclosure: this is a hackathon research prototype using simulated wearable inputs — clinical diagnostic accuracy and native Apple Watch capture are not yet validated.

---

## 3. LinkedIn (Houston / Space Medicine / Clinical AI Network) (~170 words)
When an astronaut is 44 light-minutes away from Houston Mission Control, the crew has to be its own clinic.

For the 2026 NASA International Space Apps Challenge (Houston), Team AI-MED 01 built **AstroKinetics · ASTRA** — an open-source (MIT), offline-first crew health monitoring prototype with dual-use potential for rural Texas clinics and austere care.

What we verified in `v5.3.0`:
• Exact Python / offline-browser parity across 8-DOF Mahalanobis whitening and 3-tier crew privacy redaction
• 8/8 deterministic NASA HUNCH emergency red flags overriding poor capture + principled missing-data abstention
• Closed-mesh signed tetrahedral LiDAR volumetry (0.00% error on a 1,000 mL analytical cube + 82% coverage & anti-hallucination gates)
• Bundled empirical NASA OSDR `OSD-571` Inspiration4 proteomics, 164 ISS DosTel radiation observations, Barger 2014 ISS sleep tables, and 572 NASA PMC Space Biology papers with human-vs-model-organism guardrails
• Public read-only MCP endpoint (`/api/mcp/`) and live self-verification report (`/api/verification-report`)

Try the live workstation or 2-minute verification kit:
https://astrokinetics-space-health-765428358644.us-central1.run.app/for-judges
29s Demo: https://www.youtube.com/watch?v=RVlS16JRnv4
GitHub (MIT): https://github.com/x1jiang/astrokinetics

*(Research prototype using simulated telemetry; clinical accuracy and flight qualification remain unverified.)*

#NASASpaceApps #Houston #SpaceMedicine #DigitalHealth #OpenSource #NASAOSDR

---

## 4. X / Twitter (~50 words)
Built in Houston for #NASASpaceApps 2026: **AstroKinetics · ASTRA** — an offline-first astronaut health prototype (MIT) with exact Python/browser Mahalanobis parity, 8 NASA HUNCH red-flag safety rules, bundled NASA OSDR OSD-571 & RadLab ISS data, and a public `/api/mcp/` endpoint.

Live kit: https://astrokinetics-space-health-765428358644.us-central1.run.app/for-judges
29s demo: https://www.youtube.com/watch?v=RVlS16JRnv4

---

## 5. Zhihu / WeChat Long-Form (~240 words)
深空探索面临一个被低估的医学难题：火星任务单程通信延迟最高可达 22 分钟（往返 44 分钟），太阳合相期甚至会完全中断数周，休斯顿地面飞行外科医生无法实时远程会诊。

在 2026 年 NASA Space Apps 休斯顿赛区，AI-MED 01 团队开源了离线优先的宇航员健康监测原型 **AstroKinetics · ASTRA**（MIT 协议），并在提交后完成了系统性的软件与数学验证：

1. **端云一致的离线多变量评估**：通过 Service Worker 缓存和 8 维 Mahalanobis 白化变换（$\Sigma^{-1/2}$），浏览器离线模式与 Python 后端在 4 个任务场景及 16 个边界向量（20/20）上完全一致，并在离线状态下同样执行三级隐私脱敏。
2. **确定性红旗安全门与缺失数据拒判**：8 条 NASA HUNCH 危急红旗规则（<1 ms）优先于传感器质量检查，确保信号差时绝不漏报危急情况；而无红旗且信号缺失时返回 `INCOMPLETE_CHECK_REQUIRED`，拒绝用“正常默认值”掩盖风险。
3. **真实 NASA 数据集与人鼠隔离护栏**：内置 NASA OSDR `OSD-571`（Inspiration4 14 种血浆蛋白）、NASA RadLab 164 条国际空间站 DosTel 辐射实测、Barger 2014 睡眠研究表，以及 572 篇 NASA PMC 空间生物学文献离线检索，并强制区分人类数据与啮齿类/细胞实验，避免跨物种误用。
4. **开放 AI 代理接口**：提供 `/llms.txt`、实时 `/api/verification-report` 与只读 MCP 端点 `/api/mcp/`。

原型体验与验证页：https://astrokinetics-space-health-765428358644.us-central1.run.app/project  
29 秒演示视频：https://www.youtube.com/watch?v=RVlS16JRnv4  
开源仓库：https://github.com/x1jiang/astrokinetics  
（注：当前为基于模拟遥测的软件研究原型，临床诊断准确度与原生手表采集尚未验证。）
