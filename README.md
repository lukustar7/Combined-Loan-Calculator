# Windows 贷款组合管理器

版本: 2.2.2

纯静态单页面贷款组合计算器。支持多笔贷款合并、提前还款模拟、CSV 导出、多语言切换、Windows 经典与 Windows Vista 双主题。

## 运行方式

本项目无需构建步骤。图表库已固定在 `vendor/chart.umd.min.js`，运行时不依赖 CDN。

```bash
python3 -m http.server 8000
```

浏览器访问 `http://localhost:8000/`。

## 文件结构

- `index.html`: 页面结构、弹窗、控制面板与入口脚本引用。
- `styles.css`: Windows 经典与 Vista 主题样式。
- `app.js`: 计算引擎、数据清洗、国际化、CSV 导出与图表渲染。
- `vendor/chart.umd.min.js`: 本地固定版本 Chart.js 运行文件。
- `CHANGELOG.md`: 版本变更记录。

## 数据与兼容

用户数据保存于浏览器 `localStorage`。启动时会清洗旧缓存、异常数值和旧版提前还款字段，无法恢复的数据会回退为默认贷款。

旧版深色主题缓存会自动迁移为 Windows 经典主题。当前可选主题为 Windows 经典与 Windows Vista。

## 开源协议

MIT。
