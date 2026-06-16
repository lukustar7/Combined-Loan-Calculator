# 📁 Windows 贷款组合管理器 (Multi-Loan 98)

[最新版本: v2.2.0](file:///Users/luku/Combined-Loan-Calculator/CHANGELOG.md) | [许可证: MIT](https://opensource.org/licenses/MIT)

> 运行于浏览器的纯静态、怀旧风多笔贷款合并计算器。支持 Windows 98 经典与 Windows Vista Aero 双重皮肤。

---

## 🚀 快速开始

本项目为纯静态单页面应用，无任何第三方运行环境依赖。

```bash
# 1. 克隆项目
git clone https://github.com/lukustar7/Combined-Loan-Calculator.git

# 2. 根目录下启动简易服务（推荐）
python3 -m http.server 8000
```
然后在浏览器中访问 `http://localhost:8000` 即可直接运行。

---

## ✨ 核心亮点

1. **零延迟实时重算**：全站输入框监听，数据变更毫秒级自动重算与趋势图表重绘制。
2. **时间轴对齐合流**：支持最大装载 20 笔贷款配置，自适应对齐首次还款年月并合并生成总账表。
3. **多次提前还款模拟**：支持在贷款期内任意多次、不定期配置提前还款计划。单独提供“缩短期限”与“减少月供”两种处理方式，多次还款支持级联重新分摊，并配备经典的弹窗管理器。
4. **双重怀旧皮肤**：一键切换 Windows 98 经典浮雕与 Windows Vista Aero 半透明毛玻璃外观，Chart.js 配色智能联动。
5. **地道多语言热切**：简体中文、繁体中文、英文、日文四语一键秒切，CSV 导出特制 UTF-8 BOM 杜绝 Excel 乱码。

---

## 🛠️ 开发者速查（二次开发）

### 1. 项目文件结构
* [index.html](file:///Users/luku/Combined-Loan-Calculator/index.html) - DOM 结构、“显示属性”与“区域语言设置”控制面板。
* [styles.css](file:///Users/luku/Combined-Loan-Calculator/styles.css) - 复古系统皮肤 CSS 变量定义、Aero 高光渐变及响应式自适应布局。
* [app.js](file:///Users/luku/Combined-Loan-Calculator/app.js) - 计算引擎、多语言词包（`I18N_DICTS`）、合并映射机制与 Chart.js 皮肤联动逻辑。

### 2. 怎么加一门新语言？
在 `app.js` 的 `I18N_DICTS` 中新增语言包，并在 `index.html` 的语言选择器中注册选项即可。HTML 元素声明 `data-i18n="Key"` 即可实现自动绑定翻译：
```javascript
// app.js 中的 I18N_DICTS 示例
de: {
  windowTitle: "Mein Computer - Darlehens-Manager.exe",
  aboutVersion: "Version: v{version}",
}
```

### 3. 怎么写一套新皮肤？
在 `styles.css` 中根据 body 类名（如 `.theme-xp`）重写全局 CSS 变量（如 `--win-bg`），然后在 `index.html` 的显示属性下拉框中注册该选项。最后在 `app.js` 的 `updateChartTheme()` 中联动配置 Chart.js 配色。

### 4. 底层架构特点
* **单一版本源**：版本号在 `app.js` 头部以 `APP_VERSION` 全量定义，多语言自动动态填充变量。
* **数据持久化**：用户沙盘配置自动同步至 `localStorage`，防空值拦截设计确保开箱即用。
* **性能优化**：合并计算时采用内存一次性映射机制，年月偏移使用 $O(1)$ 纯数学直算，无 while 循环，杜绝卡死。

---

## 📄 开源协议

本项目基于 [MIT](https://opensource.org/licenses/MIT) 协议开源。详细变更历史请参阅 [CHANGELOG.md](file:///Users/luku/Combined-Loan-Calculator/CHANGELOG.md)。
