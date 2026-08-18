# 贷款组合管理器

版本: 1.5.0

纯静态单页面贷款组合计算器。支持多笔贷款合并、房贷组合（公积金与商业贷款）一键模板、提前还款省息效益测算、金额大写实时转换、CSV 导出，以及 Windows 98 经典与 Google Material 3 现代双主题切换。

## 运行方式

本项目为纯静态单页面结构，无需编译与打包。图表库本地内嵌于 `vendor/chart.umd.min.js`，运行期零外部网络与 CDN 依赖。

```bash
python3 -m http.server 8000
```

浏览器访问 `http://localhost:8000/`。

## 本地验证

需要 Node.js 18 或更高版本，无需安装第三方 npm 依赖包。

```bash
npm run check
```

该命令依次执行静态文件完整性检查、JavaScript 语法检查和贷款计算自动化测试套件。

## 文件结构

- `index.html`: 页面结构、参数配置、数据大盘与弹窗视图。
- `styles.css`: Windows 98 经典复古与 Google Material 3 现代主题样式系统。
- `app.js`: 页面交互驱动、DOM 状态管理、图表联动与 CSV 导出适配。
- `src/loan-engine.js`: 纯数学计算核心，负责数据清洗、还款公式、组合时间线对齐、省息效益计算与金额大写转换。
- `test/loan-engine.test.js`: 涵盖基准公式、提前还款、省息测算、大写算法、异常容灾与极限边界的自动化测试。
- `scripts/validate-static-app.js`: 静态部署文件和本地脚本引用检查脚本。
- `package.json`: 项目元数据与无第三方依赖的检查测试命令。
- `vendor/chart.umd.min.js`: 本地固定版本 Chart.js 运行库。
- `CHANGELOG.md`: 遵循 Keep a Changelog 规范的版本变更记录。

## 数据与兼容

用户配置保存于浏览器 `localStorage`。系统启动时执行数据清洗，过滤异常数值与重复 ID，遇到损坏或空数据时回退至出厂默认配置。

系统仅保留纯净简体中文界面。当前支持的主题方案为 Windows 98 经典复古 (`standard`) 与 Google Material 3 现代质感 (`material`)。

## 开源协议

MIT License.
