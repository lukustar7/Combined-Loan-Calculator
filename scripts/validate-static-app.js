import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

/**
 * 静态项目没有传统的打包产物，因此“构建”负责验证部署所需文件、引用顺序和模块入口。
 * 任何缺失文件或错误的外部脚本引用都会让命令以非零状态退出，阻止残缺版本进入交付流程。
 */

const projectRoot = new URL('../', import.meta.url);
const requiredFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'src/loan-engine.js',
  'vendor/chart.umd.min.js'
];

await Promise.all(requiredFiles.map(file => (
  access(new URL(file, projectRoot), constants.R_OK)
)));

const [html, appSource] = await Promise.all([
  readFile(new URL('index.html', projectRoot), 'utf8'),
  readFile(new URL('app.js', projectRoot), 'utf8')
]);

const chartScript = 'vendor/chart.umd.min.js';
const appModulePattern = /<script\s+type=["']module["']\s+src=["']app\.js["']><\/script>/;
if (!appModulePattern.test(html)) {
  throw new Error('index.html 缺少 app.js 的 ES 模块入口。');
}

if (!html.includes(chartScript) || html.indexOf(chartScript) > html.indexOf('src="app.js"')) {
  throw new Error('本地 Chart.js 必须在 app.js 模块之前加载。');
}

if (/<script[^>]+src=["']https?:\/\//i.test(html)) {
  throw new Error('检测到远程脚本依赖，离线部署将不可用。');
}

if (!appSource.includes("from './src/loan-engine.js'")) {
  throw new Error('app.js 未连接贷款计算核心模块。');
}

console.log(`静态构建检查通过：${requiredFiles.length} 个部署文件完整，脚本均为本地引用。`);
