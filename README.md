# Windows 贷款组合管理器 (Combined Loan Calculator)

这是一个运行于 Web 浏览器的纯静态多笔贷款合并计算工具。其视觉设计采用 Windows 98 经典用户界面样式，底层通过原生 JavaScript 实现多笔贷款在自然月时间线上的聚合合并计算与可视化呈现。

项目适用于静态托管，可无缝部署于 GitHub Pages。

---

## 主要功能

1. **实时计算**：监听表单输入事件，数据变更时自动触发后台重算，无需手动点击计算按钮。
2. **多笔贷款对齐合并**：支持动态添加多笔贷款（默认命名为 `贷款 1`、`贷款 2`），根据每笔贷款的首次还款年月与期限，将其投射到统一的自然月时间线上，累加求和每个自然月的还款金额。
3. **趋势图表呈现**：通过 Chart.js 渲染堆叠柱状图，展示未来月供的组成结构与变化趋势。
4. **数据本地持久化**：使用浏览器 LocalStorage 存储贷款配置，页面刷新或关闭后数据自动保存与恢复。
5. **Safari 渲染优化**：在 macOS 环境下使用次像素抗锯齿与宋体优先级声明，确保中文字体笔画清晰。

---

## 文件结构

项目由以下三个核心文件组成：
* `index.html` - 页面结构与主视窗 DOM 骨架。
* `styles.css` - Windows 98 样式表，包含 3D 双层边框及响应式自适应布局。
* `app.js` - 计算逻辑、时间线合并合并算法及图表初始化。

---

## 运行与部署

### 1. 本地运行
本应用为纯静态单页面应用，无任何第三方运行环境依赖。
* 双击 [index.html](file:///Users/luku/Combined-Loan-Calculator/index.html) 文件即可直接在浏览器中运行。
* **推荐方案**：为避免本地 `file://` 协议的沙箱限制，可在项目根目录下运行简易 HTTP 服务器：
  ```bash
  python3 -m http.server 8000
  ```
  然后在浏览器中访问 `http://localhost:8000`。

### 2. GitHub Pages 静态部署
1. 在 GitHub 上新建公开仓库 `Combined-Loan-Calculator`。
2. 将本地分支推送到远程仓库：
   ```bash
   git remote add origin https://github.com/您的用户名/Combined-Loan-Calculator.git
   git branch -M main
   git push -u origin main
   ```
3. 进入该仓库的 **Settings** -> **Pages**。
4. 在 **Build and deployment** 的 Branch 处选择 `main` 分支和 `/ (root)`，点击 Save 保存。
5. 稍后即可通过以下链接访问在线版本：
   `https://您的用户名.github.io/Combined-Loan-Calculator/`

---

## 核心计算公式

* **等额本息 (ACPI)**：
  $$A = P \times \frac{R \times (1 + R)^N}{(1 + R)^N - 1}$$
* **等额本金 (ACP)**：
  $$P_m = \frac{P}{N}, \quad I_m = (P - (m - 1) \times P_m) \times R$$

*(其中：$P$ 为贷款本金，$R$ 为月利率，$N$ 为还款总月数，$m$ 为当前期数)*
