# Windows 贷款组合管理器

版本: 2.2.2

纯静态单页面贷款组合计算器。支持多笔贷款合并、提前还款模拟、CSV 导出、多语言切换、Windows 经典与 Windows Vista 双主题。

## 运行方式

本项目无需构建步骤。图表库已固定在 `vendor/chart.umd.min.js`，运行时不依赖 CDN。

```bash
python3 -m http.server 8000
```

浏览器访问 `http://localhost:8000/`。

## 本地验证

需要 Node.js 18 或更高版本，无需安装第三方依赖。

```bash
npm run check
```

该命令依次检查静态部署文件、JavaScript 语法和贷款计算测试。

## 文件结构

- `index.html`: 页面结构、弹窗、控制面板与模块入口。
- `styles.css`: Windows 经典、Vista 主题与响应式样式。
- `app.js`: 页面状态、国际化、浏览器存储、CSV 导出与图表渲染。
- `src/loan-engine.js`: 数据清洗、单笔还款、组合汇总与年度汇总的纯计算核心。
- `test/loan-engine.test.js`: 贷款公式、提前还款、异常数据与极限边界测试。
- `scripts/validate-static-app.js`: 静态部署文件和本地脚本引用检查。
- `package.json`: 无第三方依赖的构建与测试命令。
- `vendor/chart.umd.min.js`: 本地固定版本 Chart.js 运行文件。
- `CHANGELOG.md`: 版本变更记录。

## 数据与兼容

用户数据保存于浏览器 `localStorage`。启动时会清洗旧缓存、异常数值和旧版提前还款字段，无法恢复的数据会回退为默认贷款。

旧版深色主题缓存会自动迁移为 Windows 经典主题。当前可选主题为 Windows 经典与 Windows Vista。

## 开源协议

MIT。
