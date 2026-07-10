import {
  DEFAULT_LOAN,
  MAX_LOANS,
  MAX_LOAN_AMOUNT,
  MAX_RATE_PERCENT,
  MAX_LOAN_TERM_MONTHS,
  MIN_START_YEAR,
  MAX_START_YEAR,
  aggregateLoanPortfolio,
  calculateSingleLoan,
  clampInteger,
  clampNumber,
  getAnnualAggregatedData,
  sanitizeLoan as sanitizeLoanData,
  sanitizeLoanName,
  sanitizeLoans as sanitizeLoansData,
  sanitizePrepayments,
  toFiniteNumber
} from './src/loan-engine.js';

/**
 * ============================================================================
 * Windows 贷款组合管理器页面交互脚本
 * ============================================================================
 * 负责国际化、DOM 交互、浏览器存储、CSV 导出和 Chart.js 渲染。
 * 贷款清洗与数学计算统一由 src/loan-engine.js 提供，本文件不再维护重复公式。
 * ============================================================================
 */

// ==========================================
// 1. 全局状态与多语言词典定义
// ==========================================

const APP_VERSION = "2.2.2"; // 系统统一版本号，作为版本信息的单一可信数据源
let loans = []; // 存储所有贷款的数组
let currentSelectedId = 'summary'; // 当前选中的树节点 ID ('summary' 代表全局汇总，数字字符串代表单笔贷款 ID)
let currentDetailTab = 'params'; // 单笔贷款详情中当前激活的选项卡 ('params' 或 'plan')
let trendChart = null; // Chart.js 实例
let globalMonthlyAggregated = []; // 全局合并月度计划的聚合缓存，用于 CSV 导出
let currentLang = 'zh'; // 当前系统语言：'zh' (简体中文) 或 'en' (English)
let currentChartViewMode = 'monthly'; // 图表查看视图：'monthly' (按月明细) 或 'annual' (按年汇总)

// 多语言国际化全局字典包，支持 50+ 个 UI 标签及弹窗的完美互译
const I18N_DICTS = {
  zh: {
    windowTitle: "我的电脑 - 贷款组合管理器.exe",
    labelTotalPrincipal: "贷款总额",
    labelTotalInterest: "应还总利息",
    labelTotalSum: "累计本息合计",
    labelFirstMonth: "首月还款额",
    labelPeakMonth: "最高月供月份",
    chartTitle: "系统性能监视器 - 未来月供趋势图表",
    mergedTableTitle: "合并月度还款计划总表",
    btnExportCSV: "导出 CSV",
    thDate: "还款年月",
    thPayment: "月供总额(元)",
    thPrincipal: "本金总额(元)",
    thInterest: "利息总额(元)",
    thRemaining: "剩余本金(元)",
    thActive: "活跃贷款",
    tabParams: "基本参数(P)",
    tabPlan: "还款计划表(L)",
    groupLoanConfig: "贷款基本属性配置",
    lblName: "贷款名称：",
    lblAmount: "贷款金额：",
    unitYuan: "元",
    lblRate: "年化利率：",
    lblMethod: "还款方式：",
    methodACPI: "等额本息",
    methodACP: "等额本金",
    lblTerm: "贷款期限：",
    unitMonth: "个月",
    lblStart: "首次还款：",
    lblYear: "年",
    lblMonthUnit: "月",
    groupPrepay: "提前还款模拟 (可选)",
    lblPrepayPeriod: "在第几期：",
    lblPeriodUnit: "期后",
    lblPrepayAmount: "还款金额：",
    lblPrepayMethod: "处理方式：",
    prepayShrink: "缩短期限",
    prepayReduce: "减少月供",
    groupQuickView: "本笔贷款计算速览",
    lblDetailTotal: "本笔本息合计",
    lblDetailInterest: "本笔应付利息",
    lblDetailFirst: "首月应还月供",
    btnDelete: "销毁本笔贷款.lnk",
    thPeriod: "期数",
    thMonthPay: "当月月供(元)",
    thMonthPrincipal: "偿还本金(元)",
    thMonthInterest: "偿还利息(元)",
    btnStart: "开始(S)",
    menuNewLoan: "新增贷款文件(.lnk)",
    menuClearAll: "清空所有数据(.sys)",
    menuTheme: "显示属性(D)...",
    displayTitle: "显示属性",
    tabAppearance: "外观(A)",
    lblScheme: "方案(S)：",
    schemeStandard: "Windows 经典",
    schemeVista: "Windows Vista",
    btnApply: "应用(A)",
    btnCancel: "取消",
    menuLang: "区域和语言设置 (Language)...",
    langTitle: "区域和语言设置",
    tabRegional: "区域设置(R)",
    lblLangSelect: "请选择系统所使用的语言和区域格式：",
    menuGitHub: "访问 GitHub 仓库",
    menuAbout: "关于本软件...",
    aboutTitle: "关于贷款组合管理器",
    aboutVersion: "版本号：v{version}",
    aboutDesc: "通用多笔债务合并分析工具。零按钮实时重算，支持提前还款模拟、CSV 导出、显示属性与多语言切换。",
    aboutCopy: "著作权所有 (C) 1998 - 2026.",
    btnOK: "确定",
    btn5Yr: "5年",
    btn10Yr: "10年",
    btn20Yr: "20年",
    btn30Yr: "30年",
    nameMortgage: "房贷",
    nameAuto: "车贷",
    nameCard: "信用卡",
    nameConsumer: "消费贷",
    
    // JS 端特有提示信息
    alertLimit: "⚠️ 系统警报 (MAX_LIMIT_REACHED):\n\n当前装载的配置文件已达系统稳定运行上限 (20/20)。\n\n为避免系统性能过度损耗，请先销毁不必要的配置文件 (.cfg) 后再行创建。",
    confirmDelete: "您确实要永久销毁并删除配置文件 \"{name}.cfg\" 吗？此操作无法撤销。",
    confirmClear: "⚠️ 警告：您即将清除系统中的所有贷款配置文件。该操作将清空本地浏览器缓存（LocalStorage）。\n\n是否继续？",
    loanDefaultName: "贷款",
    unnamedLoan: "未命名贷款",
    emptyStateText: "未发现活跃的配置文件。请在左侧点击“新增贷款...”创建您的第一笔贷款配置。",
    planPlaceholder: "请输入完整有效的数值，以生成还款计划。",
    closeMsg: "Windows 98 不建议您关闭主窗口！您可以点击最小化将其放入任务栏。",
    prepayLabel: " (含提前还款 {amount} 元)",
    btnManagePrepay: "管理提前还款配置(M)...",
    prepayManagerTitle: "提前还款计划管理器",
    lblPrepaySummary: "已配置 {count} 笔提前还款，累计提前还本 {sum} 元",
    lblNoPrepay: "暂无提前还款配置",
    btnAddToList: "添加到列表(A)",
    thPrepayAction: "操作",
    linkRemove: "移除",
    msgInvalidPeriod: "请输入合法的期数！",
    msgInvalidAmount: "请输入合法的还款金额！",
    msgDuplicatePeriod: "该期数已配置过提前还款！",
    lblChartView: "查看视图：",
    optViewMonthly: "按月明细",
    optViewAnnual: "按年汇总"
  },
  "zh-HK": {
    windowTitle: "我的電腦 - 貸款組合管理器.exe",
    labelTotalPrincipal: "貸款總額",
    labelTotalInterest: "應還總利息",
    labelTotalSum: "累計本息合計",
    labelFirstMonth: "首月還款額",
    labelPeakMonth: "最高月供月份",
    chartTitle: "系統性能監視器 - 未來月供趨勢圖表",
    mergedTableTitle: "合並月度還款計劃總表",
    btnExportCSV: "導出 CSV",
    thDate: "還款年月",
    thPayment: "月供總額(元)",
    thPrincipal: "本金總額(元)",
    thInterest: "利息總額(元)",
    thRemaining: "剩餘本金(元)",
    thActive: "活躍貸款",
    tabParams: "基本參數(P)",
    tabPlan: "還款計劃表(L)",
    groupLoanConfig: "貸款基本屬性配置",
    lblName: "貸款名稱：",
    lblAmount: "貸款金額：",
    unitYuan: "元",
    lblRate: "年化利率：",
    lblMethod: "還款方式：",
    methodACPI: "等額本息",
    methodACP: "等額本金",
    lblTerm: "貸款期限：",
    unitMonth: "個月",
    lblStart: "首次還款：",
    lblYear: "年",
    lblMonthUnit: "月",
    groupPrepay: "提前還款模擬 (可選)",
    lblPrepayPeriod: "在第幾期：",
    lblPeriodUnit: "期後",
    lblPrepayAmount: "還款金額：",
    lblPrepayMethod: "處理方式：",
    prepayShrink: "縮短期限",
    prepayReduce: "減少月供",
    groupQuickView: "本筆貸款計算速覽",
    lblDetailTotal: "本筆本息合計",
    lblDetailInterest: "本筆應付利息",
    lblDetailFirst: "首月應還月供",
    btnDelete: "銷毀本筆貸款.lnk",
    thPeriod: "期數",
    thMonthPay: "當月月供(元)",
    thMonthPrincipal: "償還本金(元)",
    thMonthInterest: "償還利息(元)",
    btnStart: "開始(S)",
    menuNewLoan: "新增貸款文件(.lnk)",
    menuClearAll: "清空所有數據(.sys)",
    menuTheme: "顯示屬性(D)...",
    displayTitle: "顯示屬性",
    tabAppearance: "外觀(A)",
    lblScheme: "方案(S)：",
    schemeStandard: "Windows 經典",
    schemeVista: "Windows Vista",
    btnApply: "應用(A)",
    btnCancel: "取消",
    menuLang: "區域和語言設置 (Language)...",
    langTitle: "區域和語言設置",
    tabRegional: "區域設置(R)",
    lblLangSelect: "請選擇系統所使用的語言和區域格式：",
    menuGitHub: "訪問 GitHub 倉庫",
    menuAbout: "關於本軟件...",
    aboutTitle: "關於貸款組合管理器",
    aboutVersion: "版本號：v{version}",
    aboutDesc: "通用多筆債務合並分析工具。零按鈕實時重算，支持提前還款模擬、CSV 導出、顯示屬性與多語言切換。",
    aboutCopy: "著作權所有 (C) 1998 - 2026.",
    btnOK: "確定",
    btn5Yr: "5年",
    btn10Yr: "10年",
    btn20Yr: "20年",
    btn30Yr: "30年",
    nameMortgage: "房貸",
    nameAuto: "車貸",
    nameCard: "信用卡",
    nameConsumer: "消費貸",
    
    // JS 端特有提示信息
    alertLimit: "⚠️ 系統警報 (MAX_LIMIT_REACHED):\n\n當前裝載的配置文件已達系統穩定運行上限 (20/20)。\n\n為避免系統性能過度損耗，請先銷毀不必要的配置文件 (.cfg) 後再行創建。",
    confirmDelete: "您確實要永久銷毀並刪除配置文件 \"{name}.cfg\" 嗎？此操作無法撤銷。",
    confirmClear: "⚠️ 警告：您即將清除系統中的所有貸款配置文件。該操作將清空本地瀏覽器緩存（LocalStorage）。\n\n是否繼續？",
    loanDefaultName: "貸款",
    unnamedLoan: "未命名貸款",
    emptyStateText: "未發現活躍的配置文件。請在左側點擊“新增貸款...”創建您的第一筆貸款配置。",
    planPlaceholder: "請輸入完整有效的數值，以生成還款計劃。",
    closeMsg: "Windows 不建議您關閉主窗口！您可以點擊最小化將其放入任務欄。",
    prepayLabel: " (含提前還款 {amount} 元)",
    btnManagePrepay: "管理提前還款配置(M)...",
    prepayManagerTitle: "提前還款計劃管理器",
    lblPrepaySummary: "已配置 {count} 筆提前還款，累計提前還本 {sum} 元",
    lblNoPrepay: "暫無提前還款配置",
    btnAddToList: "添加到列表(A)",
    thPrepayAction: "操作",
    linkRemove: "移除",
    msgInvalidPeriod: "請輸入合法的期數！",
    msgInvalidAmount: "請輸入合法的還款金額！",
    msgDuplicatePeriod: "該期數已配置過提前還款！",
    lblChartView: "查看視圖：",
    optViewMonthly: "按月明細",
    optViewAnnual: "按年彙總"
  },
  en: {
    windowTitle: "My Computer - Loan Portfolio Manager.exe",
    labelTotalPrincipal: "Total Principal",
    labelTotalInterest: "Total Interest",
    labelTotalSum: "Total Principal + Interest",
    labelFirstMonth: "1st Month Payment",
    labelPeakMonth: "Peak Payment Month",
    chartTitle: "System Monitor - Future Monthly Payment Trend",
    mergedTableTitle: "Merged Monthly Repayment Plan",
    btnExportCSV: "Export CSV",
    thDate: "Repay Month",
    thPayment: "Monthly Payment (¥)",
    thPrincipal: "Principal Portion (¥)",
    thInterest: "Interest Portion (¥)",
    thRemaining: "Remaining Principal (¥)",
    thActive: "Active Loans",
    tabParams: "Basic Params(P)",
    tabPlan: "Repay Plan(L)",
    groupLoanConfig: "Loan Configuration",
    lblName: "Loan Name: ",
    lblAmount: "Amount: ",
    unitYuan: "¥",
    lblRate: "Annual Rate: ",
    lblMethod: "Repay Method: ",
    methodACPI: "ACPI (Amortized)",
    methodACP: "ACP (Principal)",
    lblTerm: "Duration: ",
    unitMonth: "Months",
    lblStart: "Start Date: ",
    lblYear: "Yr",
    lblMonthUnit: "Mo",
    groupPrepay: "Prepayment Simulator (Optional)",
    lblPrepayPeriod: "At Period: ",
    lblPeriodUnit: "th payment",
    lblPrepayAmount: "Prepay Amount: ",
    lblPrepayMethod: "Handling: ",
    prepayShrink: "Reduce Term",
    prepayReduce: "Reduce Payment",
    groupQuickView: "Quick View (This Loan)",
    lblDetailTotal: "Total P+I Due",
    lblDetailInterest: "Total Interest Due",
    lblDetailFirst: "1st Month Due",
    btnDelete: "Destroy Loan.lnk",
    thPeriod: "Period",
    thMonthPay: "Payment (¥)",
    thMonthPrincipal: "Principal (¥)",
    thMonthInterest: "Interest (¥)",
    btnStart: "Start(S)",
    menuNewLoan: "Create New Loan (.lnk)",
    menuClearAll: "Purge All Data (.sys)",
    menuTheme: "Display Properties(D)...",
    displayTitle: "Display Properties",
    tabAppearance: "Appearance",
    lblScheme: "Scheme: ",
    schemeStandard: "Windows Standard",
    schemeVista: "Windows Vista",
    btnApply: "Apply",
    btnCancel: "Cancel",
    menuLang: "Language & Regional Settings...",
    langTitle: "Regional Settings",
    tabRegional: "Regional Settings(R)",
    lblLangSelect: "Select the language and regional format for the system:",
    menuGitHub: "Visit GitHub Repo",
    menuAbout: "About Multi-Loan 98...",
    aboutTitle: "About Loan Portfolio Manager",
    aboutVersion: "Version: v{version}",
    aboutDesc: "A retro utility for merging & analyzing multiple debts. Real-time recalculation, prepay simulator, CSV export, theme customization and i18n support.",
    aboutCopy: "Copyright (C) 1998 - 2026.",
    btnOK: "OK",
    btn5Yr: "5 Yrs",
    btn10Yr: "10 Yrs",
    btn20Yr: "20 Yrs",
    btn30Yr: "30 Yrs",
    nameMortgage: "Mortgage",
    nameAuto: "Auto",
    nameCard: "Card",
    nameConsumer: "Consumer",
    
    // JS 端特有提示信息
    alertLimit: "⚠️ System Alert (MAX_LIMIT_REACHED):\n\nThe active configuration files have reached the system stability limit (20/20).\n\nTo prevent performance degradation, please destroy unused configurations (.cfg) first.",
    confirmDelete: "Are you sure you want to permanently destroy and delete \"{name}.cfg\"? This action cannot be undone.",
    confirmClear: "⚠️ WARNING: You are about to clear all loan configurations from the system. This will purge your local browser cache (LocalStorage).\n\nDo you want to proceed?",
    loanDefaultName: "Loan",
    unnamedLoan: "Unnamed Loan",
    emptyStateText: "No active configuration file found. Please click 'Create New Loan...' on the left tree to create your first loan configuration.",
    planPlaceholder: "Please enter complete and valid numeric values to generate the repayment plan.",
    closeMsg: "Windows 98 suggests not closing the main window! You can click minimize to place it in the taskbar.",
    prepayLabel: " (Incl. Prepayment ¥{amount})",
    btnManagePrepay: "Manage Prepayments(M)...",
    prepayManagerTitle: "Prepayment Plan Manager",
    lblPrepaySummary: "{count} prepayments configured, total prepay ¥{sum}",
    lblNoPrepay: "No prepayment plan configured",
    btnAddToList: "Add to List(A)",
    thPrepayAction: "Action",
    linkRemove: "Remove",
    msgInvalidPeriod: "Please enter a valid period!",
    msgInvalidAmount: "Please enter a valid prepay amount!",
    msgDuplicatePeriod: "This period has already been configured!",
    lblChartView: "View Mode:",
    optViewMonthly: "Monthly Details",
    optViewAnnual: "Annual Summary"
  },
  ja: {
    windowTitle: "マイ コンピュータ - ローン ポートフォリオ マネージャー.exe",
    labelTotalPrincipal: "ローン総額",
    labelTotalInterest: "利息総額",
    labelTotalSum: "元利合計",
    labelFirstMonth: "初回返済額",
    labelPeakMonth: "ピーク月支払い月",
    chartTitle: "システム モニタ - 月別返済トレンド",
    mergedTableTitle: "マージされた月次返済計画表",
    btnExportCSV: "CSV エクスポート",
    thDate: "返済年月",
    thPayment: "月返済額(円)",
    thPrincipal: "元金総額(円)",
    thInterest: "利息総額(円)",
    thRemaining: "残り元金(円)",
    thActive: "アクティブなローン",
    tabParams: "基本パラメーター(P)",
    tabPlan: "返済計画表(L)",
    groupLoanConfig: "ローンの基本属性設定",
    lblName: "ローン名：",
    lblAmount: "ローン金額：",
    unitYuan: "円",
    lblRate: "年利：",
    lblMethod: "返済方式：",
    methodACPI: "元利均等返済",
    methodACP: "元金均等返済",
    lblTerm: "返済期間：",
    unitMonth: "ヶ月",
    lblStart: "初回返済：",
    lblYear: "年",
    lblMonthUnit: "月",
    groupPrepay: "繰上返済シミュレータ (任意)",
    lblPrepayPeriod: "返済回数：",
    lblPeriodUnit: "回目後",
    lblPrepayAmount: "繰上返済額：",
    lblPrepayMethod: "返済方式：",
    prepayShrink: "期間短縮",
    prepayReduce: "返済額軽減",
    groupQuickView: "このローンの返済概要",
    lblDetailTotal: "このローンの元利合計",
    lblDetailInterest: "このローンの利息合計",
    lblDetailFirst: "初回返済額",
    btnDelete: "ローン.lnkの破棄",
    thPeriod: "期数",
    thMonthPay: "当月返済額(円)",
    thMonthPrincipal: "充当元金(円)",
    thMonthInterest: "支払利息(円)",
    btnStart: "スタート(S)",
    menuNewLoan: "ローンの新規作成(.lnk)",
    menuClearAll: "全データの消去(.sys)",
    menuTheme: "画面のプロパティ(D)...",
    displayTitle: "画面のプロパティ",
    tabAppearance: "デザイン(A)",
    lblScheme: "配色(S)：",
    schemeStandard: "Windows クラシック",
    schemeVista: "Windows Vista",
    btnApply: "適用(A)",
    btnCancel: "キャンセル",
    menuLang: "言語と地域の設定 (Language)...",
    langTitle: "地域と言語のオプション",
    tabRegional: "地域設定(R)",
    lblLangSelect: "システムで使用する言語と地域の形式を選択してください：",
    menuGitHub: "GitHub リポジトリにアクセス",
    menuAbout: "このソフトウェアについて...",
    aboutTitle: "ローン ポートフォリオ マネージャーについて",
    aboutVersion: "バージョン：v{version}",
    aboutDesc: "マルチローン合併分析ツール。リアルタイム自動再計算、繰上返済シミュレーション、CSVエクスポート、画面デザインとマルチ言語の切り替えに対応しています。",
    aboutCopy: "Copyright (C) 1998 - 2026.",
    btnOK: "OK",
    btn5Yr: "5年",
    btn10Yr: "10年",
    btn20Yr: "20年",
    btn30Yr: "30年",
    nameMortgage: "住宅ローン",
    nameAuto: "マイカーローン",
    nameCard: "カードローン",
    nameConsumer: "フリーローン",
    
    // JS 端特有提示信息
    alertLimit: "⚠️ システム警告 (MAX_LIMIT_REACHED):\n\n現在ロードされている設定ファイルが上限 (20/20) に達しました。\n\nシステムの安定動作のため、不要な設定ファイル (.cfg) を破棄してから新規作成してください。",
    confirmDelete: "設定ファイル \"{name}.cfg\" を永久に破棄し、削除してもよろしいですか？この操作は取り消せません。",
    confirmClear: "⚠️ 警告: システム内のすべてのローン設定ファイルを消去しようとしています。ローカルキャッシュ (LocalStorage) もクリアされます。\n\n続行しますか？",
    loanDefaultName: "ローン",
    unnamedLoan: "名称未設定ローン",
    emptyStateText: "有効な設定ファイルが見つかりません。左側のツリーで「ローンの新規作成...」をクリックして、最初のローン設定を作成してください。",
    planPlaceholder: "返済計画表を生成するには、有効な数値を入力してください。",
    closeMsg: "ウィンドウを閉じないことをお勧めします。最小化してタスクバーに収納することができます。",
    prepayLabel: " (繰上返済額 {amount} 円を含む)",
    btnManagePrepay: "繰上返済の管理(M)...",
    prepayManagerTitle: "繰上返済計画マネージャー",
    lblPrepaySummary: "{count}件の繰上返済が設定されています。累計 ¥{sum}",
    lblNoPrepay: "繰上返済計画は設定されていません",
    btnAddToList: "リストに追加(A)",
    thPrepayAction: "操作",
    linkRemove: "削除",
    msgInvalidPeriod: "有効な返済回数を入力してください！",
    msgInvalidAmount: "有効な返済金額を入力してください！",
    msgDuplicatePeriod: "この回数はすでに設定されています！",
    lblChartView: "表示ビュー：",
    optViewMonthly: "月次明細",
    optViewAnnual: "年次集計"
  }
};

// 页面只复制核心模块的默认模板，避免默认金额、利率和期限在两个文件中分别维护。
const DEFAULT_LOANS = [
  { ...DEFAULT_LOAN, prepayments: [] }
];

const STORAGE_KEY = 'WIN98_LOANS_DATA'; // 浏览器本地缓存键名，集中定义避免散落字符串
const THEME_PREF_KEY = 'WIN_THEME_PREF'; // 当前主题缓存键名
const LEGACY_DARK_THEME_KEY = 'WIN98_DARK_THEME'; // 旧版深色主题缓存键名，用于兼容迁移
const LANG_PREF_KEY = 'WIN98_LANG'; // 当前语言缓存键名

/**
 * 深拷贝默认贷款配置。
 * 默认数据只作为模板使用，任何运行期修改都必须落到独立对象，避免污染出厂配置。
 */
function cloneDefaultLoans() {
  return JSON.parse(JSON.stringify(DEFAULT_LOANS));
}

/**
 * 安全读取浏览器本地存储。
 * 隐私模式、存储策略或浏览器配额异常都可能让 localStorage 直接抛错，读取失败时按“没有缓存”处理。
 */
function readStorage(key) {
  try {
    return globalThis.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

/**
 * 安全写入浏览器本地存储。
 * 写入失败不会阻断本次计算和界面交互，当前会话中的内存数据仍然保持可用。
 */
function writeStorage(key, value) {
  try {
    globalThis.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 安全删除旧版缓存键，避免存储权限异常影响主题迁移。
 */
function removeStorage(key) {
  try {
    globalThis.localStorage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 为纯计算模块注入页面当前语言下的默认贷款名。
 * 核心模块不读取国际化状态，避免数学公式与页面环境互相绑死。
 */
function sanitizeLoan(rawLoan, index = 0) {
  return sanitizeLoanData(rawLoan, index, {
    defaultLoan: DEFAULT_LOANS[0],
    defaultNamePrefix: t('loanDefaultName')
  });
}

/**
 * 清洗贷款集合并修复重复 ID。
 * 页面保留原有的“空数据恢复默认贷款”行为，具体边界规则由核心模块统一维护。
 */
function sanitizeLoans(rawLoans) {
  return sanitizeLoansData(rawLoans, {
    defaultLoans: DEFAULT_LOANS,
    defaultNamePrefix: t('loanDefaultName')
  });
}

/**
 * CSV 单元格安全转义。
 * 除了逗号和双引号，还要防止 Excel 将 =、+、-、@ 开头的文本当作公式执行。
 */
function escapeCSVCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * 下载文件名安全清洗。
 * 浏览器不会真的按路径写入，但保守去掉路径分隔符能避免跨平台下载体验异常。
 */
function sanitizeFileName(value, fallback = 'export') {
  const safeName = sanitizeLoanName(value, fallback).replace(/[\\/:*?"<>|]/g, '_');
  return safeName || fallback;
}

// ==========================================
// 2. 国际化与数字格式化核心工具
// ==========================================

/**
 * HTML 实体字符安全转义，用于防范 DOM-XSS 注入攻击
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, function(match) {
    switch (match) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return match;
    }
  });
}

/**
 * 翻译文本提取函数，支持占位符动态替换
 */
function t(key, variables = {}) {
  let text = (I18N_DICTS[currentLang] && I18N_DICTS[currentLang][key]) || key;
  for (let k in variables) {
    text = text.replace(`{${k}}`, variables[k]);
  }
  return text;
}

/**
 * 动态刷新 HTML 页面中所有的国际化 DOM 元素
 */
function applyTranslations() {
  // 1. 扫描所有带有 data-i18n 的普通元素
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    // 如果是关于对话框中的版本号，需动态注入全局版本号
    if (key === 'aboutVersion') {
      el.innerText = t(key, { version: APP_VERSION });
    } else {
      el.innerText = t(key);
    }
  });
  
  // 2. 动态更新主窗口标题与任务栏按钮文字
  const windowTitle = document.getElementById('windowTitle');
  const taskbarTitle = document.getElementById('taskbarTitle');
  
  let summaryTitle = getPortfolioFileName();
  let propText = getPropertyLabel();
  let propTask = getPropertyTaskLabel();
  
  if (currentSelectedId === 'summary') {
    if (windowTitle) windowTitle.innerText = t('windowTitle');
    if (taskbarTitle) taskbarTitle.innerHTML = `<span class="win-icon-folder"></span>${escapeHTML(summaryTitle)}`;
  } else {
    const curLoan = loans.find(l => l.id === currentSelectedId);
    if (curLoan) {
      if (windowTitle) windowTitle.innerText = `${propText} - ${curLoan.name}.cfg`;
      if (taskbarTitle) taskbarTitle.innerHTML = `<span class="win-icon-file"></span>${escapeHTML(`${propTask}: ${curLoan.name}.cfg`)}`;
    }
  }

  // 3. 翻译关于对话框中版本描述等部分
  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    const i18nSpan = startBtn.querySelector('span[data-i18n]');
    if (i18nSpan) i18nSpan.innerText = t('btnStart');
  }
}

/**
 * 财务数字千分位格式化：保留 2 位小数并加上千分位逗号
 * 自适应多国语言区域设置，提高全局金融易读性
 */
function formatNumber(num) {
  if (num === null || num === undefined || !Number.isFinite(Number(num))) return '0.00';
  let locale = 'en-US';
  if (currentLang === 'zh') locale = 'zh-CN';
  else if (currentLang === 'zh-HK') locale = 'zh-HK';
  else if (currentLang === 'ja') locale = 'ja-JP';
  return Number(num).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * 依据系统当前的语言设置，获取贴切地道的货币单位（元/円/¥）
 * 用于全局统一大盘面板、图表 Tooltip 和坐标轴的金融币种后缀展示
 */
function getCurrencyUnit() {
  if (currentLang === 'zh' || currentLang === 'zh-HK') {
    return '元';
  } else if (currentLang === 'ja') {
    return '円';
  }
  return '¥';
}

/**
 * 组合贷款总览文件名，用于窗口标题、任务栏和树形目录。
 */
function getPortfolioFileName() {
  if (currentLang === 'zh') return '贷款组合管理器.cfg';
  if (currentLang === 'zh-HK') return '貸款組合管理器.cfg';
  if (currentLang === 'ja') return 'ローンポートフォリオ.cfg';
  return 'Loan Portfolio.cfg';
}

/**
 * 单笔贷款属性窗口标题词。
 */
function getPropertyLabel() {
  if (currentLang === 'zh') return '属性';
  if (currentLang === 'zh-HK') return '屬性';
  if (currentLang === 'ja') return 'プロパティ';
  return 'Properties';
}

/**
 * 任务栏中单笔贷款属性窗口的短标签。
 */
function getPropertyTaskLabel() {
  if (currentLang === 'zh') return '属性';
  if (currentLang === 'zh-HK') return '屬性';
  if (currentLang === 'ja') return '詳細';
  return 'Props';
}

/**
 * 左侧资源树的汇总节点名称。
 */
function getSummaryTreeLabel() {
  if (currentLang === 'zh') return '贷款组合汇总.sys';
  if (currentLang === 'zh-HK') return '貸款組合彙總.sys';
  if (currentLang === 'ja') return 'ローン集計.sys';
  return 'Loan_Portfolio.sys';
}

/**
 * 左侧资源树的新增贷款入口文案。
 */
function getAddLoanTreeLabel(isLimitReached) {
  if (isLimitReached) {
    if (currentLang === 'zh') return '新增贷款... (已达20笔上限)';
    if (currentLang === 'zh-HK') return '新增貸款... (已達20筆上限)';
    if (currentLang === 'ja') return 'ローン追加... (20件上限)';
    return 'Add Loan... (Max 20 Reached)';
  }
  if (currentLang === 'zh') return '新增贷款.lnk';
  if (currentLang === 'zh-HK') return '新增貸款.lnk';
  if (currentLang === 'ja') return 'ローン追加.lnk';
  return 'Add_Loan.lnk';
}

/**
 * 期数文本统一格式化，避免繁体/日文界面混入英文缩写。
 */
function getPeriodLabel(period) {
  if (currentLang === 'zh' || currentLang === 'zh-HK') return `第 ${period} 期`;
  if (currentLang === 'ja') return `第 ${period} 回`;
  return `Period ${period}`;
}

/**
 * CSV 表头按当前语言输出。
 */
function getSummaryCSVHeaders() {
  if (currentLang === 'zh') return ['还款年月', '月供总额(元)', '本金总额(元)', '利息总额(元)', '剩余本金(元)', '活跃贷款'];
  if (currentLang === 'zh-HK') return ['還款年月', '月供總額(元)', '本金總額(元)', '利息總額(元)', '剩餘本金(元)', '活躍貸款'];
  if (currentLang === 'ja') return ['返済年月', '月返済額(円)', '元金総額(円)', '利息総額(円)', '残り元金(円)', '有効ローン'];
  return ['Repay Month', 'Total Payment', 'Total Principal', 'Total Interest', 'Remaining Principal', 'Active Loans'];
}

/**
 * 单笔贷款 CSV 表头按当前语言输出。
 */
function getSingleCSVHeaders() {
  if (currentLang === 'zh') return ['期数', '还款年月', '当月月供(元)', '偿还本金(元)', '偿还利息(元)', '剩余本金(元)', '其中提前还款(元)'];
  if (currentLang === 'zh-HK') return ['期數', '還款年月', '當月月供(元)', '償還本金(元)', '償還利息(元)', '剩餘本金(元)', '其中提前還款(元)'];
  if (currentLang === 'ja') return ['回数', '返済年月', '月返済額(円)', '元金返済額(円)', '利息返済額(円)', '残り元金(円)', '繰上返済額(円)'];
  return ['Period', 'Repay Month', 'Payment Portion', 'Principal Portion', 'Interest Portion', 'Remaining Principal', 'Prepayment'];
}

/**
 * 单笔贷款导出文件名后缀。
 */
function getSingleCSVFileSuffix() {
  if (currentLang === 'zh') return '还款明细计划表';
  if (currentLang === 'zh-HK') return '還款明細計劃表';
  if (currentLang === 'ja') return '返済明細計画表';
  return 'Repayment_Plan';
}

// ==========================================
// 3. 贷款组合计算结果与页面渲染适配
// ==========================================

/**
 * 调用纯计算核心生成组合结果，再把结果映射到页面。
 * 此处不再维护任何贷款公式，确保生产页面和自动化测试使用同一套规则。
 */
function calculateAll() {
  if (loans.length === 0) {
    renderEmptyState();
    return;
  }

  const portfolio = aggregateLoanPortfolio(loans);
  globalMonthlyAggregated = portfolio.monthly;

  const unitText = t("unitYuan");
  document.getElementById("sumPrincipal").innerText = `${formatNumber(portfolio.totalPrincipal)} ${unitText}`;
  document.getElementById("sumInterest").innerText = `${formatNumber(portfolio.totalInterest)} ${unitText}`;
  document.getElementById("sumTotal").innerText = `${formatNumber(portfolio.totalPayment)} ${unitText}`;

  if (portfolio.monthly.length > 0) {
    document.getElementById("sumFirstMonth").innerText = `${formatNumber(portfolio.firstMonthPayment)} ${getCurrencyUnit()}`;
    document.getElementById("sumPeakMonth").innerText = `${portfolio.peakMonth} (${formatNumber(portfolio.peakPayment)}${getCurrencyUnit()})`;
  } else {
    document.getElementById("sumFirstMonth").innerText = `0.00 ${getCurrencyUnit()}`;
    document.getElementById("sumPeakMonth").innerText = "-";
  }

  renderSummaryTable(portfolio.monthly);

  if (currentChartViewMode === "annual") {
    const annualAggregated = getAnnualAggregatedData(portfolio.monthly);
    renderTrendChart(annualAggregated.map(row => row.dateStr), annualAggregated);
  } else {
    renderTrendChart(portfolio.months, portfolio.monthly);
  }

  if (currentSelectedId !== "summary") {
    const currentLoan = loans.find(loan => loan.id === currentSelectedId);
    if (currentLoan) updateSingleLoanUI(currentLoan);
  }
}

/**
 * 切换图表查看视图（按月/按年）
 */
function switchChartViewMode() {
  const selectEl = document.getElementById('chartViewSelect');
  if (selectEl) {
    currentChartViewMode = selectEl.value;
    // 触发重算与图表重绘
    calculateAll();
  }
}

/**
 * 渲染全局合并明细表格
 */
function renderSummaryTable(data) {
  const tbody = document.getElementById('tableSummaryBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${row.dateStr}</strong></td>
      <td style="color:#000080; font-weight:bold;">${formatNumber(row.payment)}</td>
      <td>${formatNumber(row.principal)}</td>
      <td>${formatNumber(row.interest)}</td>
      <td style="color:#808080;">${formatNumber(row.remaining)}</td>
      <td style="font-size:10px;">${escapeHTML(row.activeLoans)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// 5. Chart.js 经典像素风皮肤配置 (Retro System Monitor)
// ==========================================

/**
 * 提前还款标记 Chart.js 局部插件
 * 在发生提前还款的柱体上方，Windows 98 渲染醒目的红色感叹号三角形，Windows Vista 渲染半透明 Aero 玻璃发光球，
 * 并支持移动端触控及大屏 hover 触发常规 Tooltip 展现提前还款额。
 */
const prepaymentMarkerPlugin = {
  id: 'prepaymentMarker',
  afterDatasetsDraw(chart, args, options) {
    const { ctx } = chart;
    const currentTheme = getGlobalTheme();
    const aggregatedData = options.aggregatedData;
    if (!aggregatedData) return;

    chart.data.labels.forEach((dateStr, index) => {
      const dateRow = aggregatedData[index];
      if (!dateRow) return;

      // 统计当月这笔月份下所有贷款的提前还款总额
      let totalPrepay = 0;
      loans.forEach(loan => {
        totalPrepay += dateRow.breakdown[loan.id + '_prepay'] || 0;
      });

      if (totalPrepay > 0) {
        // 计算除去提前还款额的“常规月供”总和
        let sumRegularPayment = 0;
        loans.forEach(loan => {
          sumRegularPayment += dateRow.breakdown[loan.id] || 0;
        });

        // 获得该柱子的 X 轴像素坐标
        const x = chart.scales.x.getPixelForValue(dateStr);
        // 获得顶部常规还款折合的 Y 轴像素坐标
        const y = chart.scales.y.getPixelForValue(sumRegularPayment);

        if (isNaN(x) || isNaN(y)) return;

        const isLineChart = chart.config.type === 'line';

        if (currentTheme === 'vista') {
          // Vista 主题：精致的半透明 Aero 玻璃圆形发光球
          ctx.save();
          
          if (isLineChart) {
            // 绘制 Aero 科技感发光连接线
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y - 11);
            ctx.strokeStyle = 'rgba(0, 192, 255, 0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 绘制折线上的微小白发光折点
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0, 192, 255, 0.8)';
            ctx.shadowBlur = 4;
            ctx.fill();
            ctx.shadowBlur = 0; // 重置阴影，避免影响后续绘制
          }

          const cy = y - 18;
          
          // 1. 绘制圆形发光外圈阴影
          ctx.beginPath();
          ctx.arc(x, cy, 10, 0, Math.PI * 2);
          const shadowGrad = ctx.createRadialGradient(x, cy, 5, x, cy, 10);
          shadowGrad.addColorStop(0, 'rgba(0, 192, 255, 0.4)');
          shadowGrad.addColorStop(1, 'rgba(0, 192, 255, 0)');
          ctx.fillStyle = shadowGrad;
          ctx.fill();

          // 2. 绘制精致的 Vista 圆形小气泡（渐变蓝，带有微白色高光）
          ctx.beginPath();
          ctx.arc(x, cy, 7, 0, Math.PI * 2);
          const grad = ctx.createRadialGradient(x - 2, cy - 2, 1, x, cy, 7);
          grad.addColorStop(0, '#ffffff'); // 高光点
          grad.addColorStop(0.3, '#33b3e2'); // Aero 亮蓝
          grad.addColorStop(0.8, '#1e528e'); // Aero 深蓝
          grad.addColorStop(1, '#0e2c56');
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; // 半透明亮描边
          ctx.stroke();

          // 3. 绘制内部白色“P”字母
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('P', x, cy);
          ctx.restore();
        } else {
          // Windows 98 经典：经典的复古红色感叹号警告三角形
          ctx.save();
          
          if (isLineChart) {
            // 绘制像素风格点状虚线，符合 Win98 像素界面特征
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y - 10);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.stroke();

            // 绘制折线上的像素风格方块原点 (4x4px)
            ctx.fillStyle = '#000000';
            ctx.fillRect(x - 2, y - 2, 4, 4);
          }

          ctx.beginPath();
          const cy = y - 16;
          ctx.moveTo(x, cy - 8);     // 顶点
          ctx.lineTo(x - 8, cy + 6); // 左下
          ctx.lineTo(x + 8, cy + 6); // 右下
          ctx.closePath();
          ctx.fillStyle = '#ff0000'; // 醒目的复古红
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#000000'; // 边框自适应
          ctx.stroke();
          
          // 绘制内部的小白色惊叹号
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px Tahoma';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('!', x, cy + 1);
          ctx.restore();
        }
      }
    });
  }
};

/**
 * 重新渲染 Chart.js 堆叠趋势图
 * 【Antigravity 顶尖重构】：
 * 1. 深度适配深色/护眼主题！自适应改变坐标轴文字、网格线和 Tooltip 的暗黑配色。
 * 2. 深度适配多语言，自动转换图例与金额单位。
 */
function renderTrendChart(months, aggregatedData) {
  const chartCanvas = document.getElementById('monthlyTrendChart');
  if (!chartCanvas) return;
  const fallbackEl = document.getElementById('chartFallback');
  const ctx = chartCanvas.getContext('2d');
  
  if (trendChart) {
    trendChart.destroy(); // 销毁老图表实例，防止重叠闪烁
    trendChart = null;
  }

  if (fallbackEl) {
    fallbackEl.style.display = 'none';
    fallbackEl.innerText = '';
  }
  chartCanvas.style.display = 'block';

  if (loans.length === 0 || months.length === 0) return;

  const ChartConstructor = globalThis.Chart;
  if (typeof ChartConstructor !== 'function') {
    chartCanvas.style.display = 'none';
    if (fallbackEl) {
      fallbackEl.style.display = 'flex';
      fallbackEl.innerText = currentLang === 'zh'
        ? 'Chart.js 图表模块未加载。还款表格与 CSV 导出仍可正常使用。'
        : 'Chart.js module is unavailable. Tables and CSV export remain available.';
    }
    return;
  }

  // 根据当前激活的全局主题动态适配图表配色与字体
  const currentTheme = getGlobalTheme();
  
  // 长周期月度数据使用细线图，避免柱体挤成一整块色墙，保留 Win98 系统监视器的硬边读数感。
  const isLineChart = months.length > 60 && currentChartViewMode === 'monthly';

  let textColor = '#000000';
  let gridColor = '#808080';
  let gridBorderColor = '#000000';
  let tooltipBg = '#ffffcc';
  let tooltipText = '#000000';
  let fontName = 'Tahoma';
  let retroColors = [
    { fill: '#000080', border: '#000000' }, // 经典微软深蓝
    { fill: '#008000', border: '#000000' }, // 经典森林绿
    { fill: '#800000', border: '#000000' }, // 经典铁锈红
    { fill: '#800080', border: '#000000' }, // 经典紫色
    { fill: '#008080', border: '#000000' }, // 青绿色
    { fill: '#808000', border: '#000000' }  // 暗金泥土黄
  ];

  if (currentTheme === 'vista') {
    // Windows Vista Aero：采用 Segoe UI 现代字体，轻柔质感的半透明磨砂玻璃设计
    textColor = '#1d2530';
    gridColor = 'rgba(0, 0, 0, 0.08)'; // 柔和暗色网格，搭配 Aero 白底面板
    gridBorderColor = 'rgba(0, 0, 0, 0.15)';
    tooltipBg = 'rgba(255, 255, 255, 0.9)'; // 高档半透明 white 磨砂气泡
    tooltipText = '#1d2530';
    fontName = '"Segoe UI", "Microsoft YaHei", -apple-system, sans-serif';
    retroColors = [
      { fill: 'rgba(78, 128, 174, 0.28)', border: 'rgba(30, 82, 142, 0.9)' }, // Vista Aero 蓝
      { fill: 'rgba(86, 150, 150, 0.26)', border: 'rgba(38, 124, 139, 0.9)' }, // Vista 青绿
      { fill: 'rgba(120, 150, 190, 0.24)', border: 'rgba(80, 112, 158, 0.9)' }, // Vista 灰蓝
      { fill: 'rgba(110, 140, 120, 0.24)', border: 'rgba(70, 110, 85, 0.9)' }, // Vista 灰绿
      { fill: 'rgba(130, 135, 155, 0.22)', border: 'rgba(90, 95, 120, 0.9)' }, // Vista 钢灰
      { fill: 'rgba(95, 145, 175, 0.22)', border: 'rgba(55, 105, 135, 0.9)' } // Vista 冷青
    ];
  }

  // 生成 Chart.js 所需的数据集
  const datasets = loans.map((loan, index) => {
    const color = retroColors[index % retroColors.length];
    
    // 映射该笔贷款在特定还款年月产生的月供额
    const dataPoints = aggregatedData.map(row => {
      return row.breakdown[loan.id] || 0;
    });

    let fillBg = color.fill;
    let borderCol = color.border;

    const ds = {
      label: loan.name,
      loanId: loan.id, // 额外保存 loanId，以便 tooltip 能精准匹配其 prepay 值
      data: dataPoints,
      backgroundColor: fillBg,
      borderColor: borderCol,
      stack: 'combinedStack' // 启动堆叠模式
    };

    if (isLineChart) {
      // 启用细线图配置：不填充面积，避免长周期数据变成一整块色墙。
      ds.type = 'line';
      ds.fill = false;
      ds.pointRadius = 0;
      ds.pointHoverRadius = currentTheme === 'vista' ? 4 : 3;
      ds.tension = currentTheme === 'vista' ? 0.12 : 0;
      ds.borderWidth = currentTheme === 'vista' ? 2 : 1;
      ds.pointStyle = 'rect';
    } else {
      // 柱状堆叠图专属配置
      ds.type = 'bar';
      ds.borderWidth = currentTheme === 'vista' ? 1.0 : 1.5;
      ds.barPercentage = currentTheme === 'vista' ? 0.85 : 1.0; // Vista 下柱体留白间距，符合现代 UI 规范
      ds.categoryPercentage = currentTheme === 'vista' ? 0.85 : 1.0;
    }

    return ds;
  });

  // 创建符合当前 system 皮肤质感的像素/现代图表配置
  try {
    trendChart = new ChartConstructor(ctx, {
    type: isLineChart ? 'line' : 'bar', // 自适应图表类别
    data: {
      labels: months,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // 优化图表交互模式：只要鼠标/手指落在当前时段的垂直通道内，就能激活 Tooltip
      interaction: {
        mode: 'index',
        intersect: false
      },
      animation: currentTheme === 'vista' ? { duration: 220 } : false, // Vista 保留短动画，Win98 保持极速响应
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: fontName, size: 11, weight: 'bold' },
            color: textColor, // 自适应文字颜色
            boxWidth: 12,
            boxHeight: 12,
            padding: 10
          }
        },
        tooltip: {
          backgroundColor: tooltipBg, // Windows 98 经典黄色工具提示框 (深色和 Vista 下自适应)
          titleColor: tooltipText,
          titleFont: { family: fontName, size: 11, weight: 'bold' },
          bodyColor: tooltipText,
          bodyFont: { family: fontName, size: 11 },
          borderColor: currentTheme === 'vista' ? 'rgba(0,0,0,0.15)' : '#000000',
          borderWidth: 1,
          cornerRadius: currentTheme === 'vista' ? 4 : 0, // Vista 主题下气泡有小圆角
          callbacks: {
            label: function(context) {
              const loanId = context.dataset.loanId;
              const rawVal = context.raw;
              const dateRow = aggregatedData[context.dataIndex];
              const prepayVal = (dateRow && dateRow.breakdown) ? (dateRow.breakdown[loanId + '_prepay'] || 0) : 0;
              
              let labelText = ` ${context.dataset.label}: ${formatNumber(rawVal)} ${getCurrencyUnit()}`;
              if (prepayVal > 0) {
                // 如果当月有提前还款，在 Tooltip 中增加贴心标注
                if (currentLang === 'zh') {
                  labelText += ` (当月另有提前还款 ${formatNumber(prepayVal)} 元)`;
                } else if (currentLang === 'zh-HK') {
                  labelText += ` (當月另有提前還款 ${formatNumber(prepayVal)} 元)`;
                } else if (currentLang === 'ja') {
                  labelText += ` (当月に繰上返済 ${formatNumber(prepayVal)} 円あり)`;
                } else {
                  labelText += ` (extra prepayment of ${formatNumber(prepayVal)} ¥)`;
                }
              }
              return labelText;
            }
          }
        },
        // 传递提前还款数据给插件使用
        prepaymentMarker: {
          aggregatedData: aggregatedData
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            color: gridColor, // 复古点状像素虚线网格线
            borderDash: currentTheme === 'vista' ? [] : [1, 2], // Vista 下为实线
            drawBorder: true,
            borderColor: gridBorderColor
          },
          ticks: {
            font: { family: fontName, size: 10 },
            color: textColor,
            maxTicksLimit: window.innerWidth < 768 ? 8 : 24 // 手机端自适应抽样，防止文字堆叠挤爆
          }
        },
        y: {
          min: 0,
          stacked: true,
          grid: {
            color: gridColor,
            borderDash: currentTheme === 'vista' ? [] : [1, 2],
            drawBorder: true,
            borderColor: gridBorderColor
          },
          ticks: {
            font: { family: fontName, size: 10 },
            color: textColor,
            callback: function(value) {
              return formatNumber(value) + getCurrencyUnit();
            }
          }
        }
      }
    },
    // 注册自定义提前还款指示器插件
      plugins: [prepaymentMarkerPlugin]
    });
  } catch (e) {
    chartCanvas.style.display = 'none';
    trendChart = null;
    if (fallbackEl) {
      fallbackEl.style.display = 'flex';
      fallbackEl.innerText = currentLang === 'zh'
        ? '图表渲染失败。请检查浏览器环境，表格数据不受影响。'
        : 'Chart rendering failed. The repayment table is still available.';
    }
  }
}

/**
 * 无贷款时的空数据界面渲染
 */
function renderEmptyState() {
  const unitText = t('unitYuan');
  document.getElementById('sumPrincipal').innerText = `0.00 ${unitText}`;
  document.getElementById('sumInterest').innerText = `0.00 ${unitText}`;
  document.getElementById('sumTotal').innerText = `0.00 ${unitText}`;
  document.getElementById('sumFirstMonth').innerText = `0.00 ${getCurrencyUnit()}`;
  document.getElementById('sumPeakMonth').innerText = '-';
  
  const tbody = document.getElementById('tableSummaryBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#808080; padding:30px;">${t('emptyStateText')}</td></tr>`;
  }
  
  if (trendChart) {
    trendChart.destroy();
    trendChart = null;
  }
}

// ==========================================
// 6. 树形导航栏 (Tree Explorer) 渲染与交互
// ==========================================

function renderTreeView() {
  const container = document.getElementById('treeView');
  if (!container) return;
  container.innerHTML = '';

  // 1. 全局汇总节点 (支持多语言互译)
  const sumNode = document.createElement('div');
  sumNode.className = `win-tree-item ${currentSelectedId === 'summary' ? 'selected' : ''}`;
  sumNode.innerHTML = `
    <span class="win-tree-item-icon win-icon-chart"></span>
    <span>${getSummaryTreeLabel()}</span>
  `;
  sumNode.onclick = () => selectTreeNode('summary');
  container.appendChild(sumNode);

  // 2. 循环生成各个单笔贷款节点
  loans.forEach((loan) => {
    const loanNode = document.createElement('div');
    loanNode.className = `win-tree-item ${currentSelectedId === loan.id ? 'selected' : ''}`;
    loanNode.innerHTML = `
      <span class="win-tree-item-icon win-icon-file"></span>
      <span>${escapeHTML(loan.name)}.cfg</span>
    `;
    loanNode.onclick = () => selectTreeNode(loan.id);
    container.appendChild(loanNode);
  });

  // 3. “新增贷款”按钮节点，当达到 20 笔最大上限时展示灰色禁用样式
  const addNode = document.createElement('div');
  addNode.className = 'win-tree-item';
  addNode.style.marginTop = '10px';
  addNode.style.borderTop = '1px dotted var(--win-shadow)';
  addNode.style.paddingTop = '6px';
  
  if (loans.length >= MAX_LOANS) {
    addNode.style.opacity = '0.6';
    addNode.style.cursor = 'not-allowed';
    addNode.innerHTML = `
      <span class="win-tree-item-icon win-icon-disabled"></span>
      <span class="win-tree-add-disabled">${getAddLoanTreeLabel(true)}</span>
    `;
  } else {
    addNode.innerHTML = `
      <span class="win-tree-item-icon win-icon-plus"></span>
      <span class="win-tree-add-btn">${getAddLoanTreeLabel(false)}</span>
    `;
  }
  addNode.onclick = createNewLoan;
  container.appendChild(addNode);
}

/**
 * 选择树形导航节点
 */
function selectTreeNode(id) {
  currentSelectedId = id;
  renderTreeView();

  const panelSummary = document.getElementById('panelSummary');
  const panelDetail = document.getElementById('panelDetail');
  const windowTitle = document.getElementById('windowTitle');
  const taskbarTitle = document.getElementById('taskbarTitle');

  if (!panelSummary || !panelDetail) return;

  if (id === 'summary') {
    panelSummary.style.display = 'flex';
    panelDetail.style.display = 'none';
    if (windowTitle) windowTitle.innerText = t('windowTitle');
    if (taskbarTitle) taskbarTitle.innerHTML = `<span class="win-icon-folder"></span>${escapeHTML(getPortfolioFileName())}`;
    calculateAll(); // 全局重算并画图
  } else {
    panelSummary.style.display = 'none';
    panelDetail.style.display = 'flex';
    
    const curLoan = loans.find(l => l.id === id);
    if (curLoan) {
      if (windowTitle) windowTitle.innerText = `${getPropertyLabel()} - ${curLoan.name}.cfg`;
      if (taskbarTitle) taskbarTitle.innerHTML = `<span class="win-icon-file"></span>${escapeHTML(`${getPropertyTaskLabel()}: ${curLoan.name}.cfg`)}`;
      updateSingleLoanUI(curLoan);
    }
  }
}

// ==========================================
// 7. 单笔属性面板编辑与刷新 (Tab Controls)
// ==========================================

/**
 * 切换单笔贷款面板中的属性选项卡 (参数配置/还款计划表)
 */
function switchDetailTab(tabName) {
  currentDetailTab = tabName;
  const tabs = document.querySelectorAll('.win-tab');
  if (tabs.length < 2) return;
  
  tabs[0].classList.toggle('active', tabName === 'params');
  tabs[1].classList.toggle('active', tabName === 'plan');
  
  const paneParams = document.getElementById('tabDetailParams');
  const panePlan = document.getElementById('tabDetailPlan');
  
  if (paneParams) paneParams.classList.toggle('active', tabName === 'params');
  if (panePlan) panePlan.classList.toggle('active', tabName === 'plan');

  if (currentSelectedId !== 'summary') {
    const curLoan = loans.find(l => l.id === currentSelectedId);
    if (curLoan && tabName === 'plan') {
      renderSingleRepayTable(curLoan);
    }
  }
}

/**
 * 同步单笔贷款的数据到表单 DOM，应用千分位金融格式化
 */
function updateSingleLoanUI(loan) {
  const safeLoan = sanitizeLoan(loan, loans.findIndex(item => item.id === loan.id));
  Object.assign(loan, safeLoan);
  document.getElementById('loanName').value = loan.name;
  document.getElementById('loanAmount').value = loan.amount ?? '';
  document.getElementById('loanRate').value = loan.rate ?? '';
  document.getElementById('loanTerm').value = loan.term ?? '';
  document.getElementById('loanStartYear').value = loan.startYear ?? '';
  document.getElementById('loanStartMonth').value = loan.startMonth ?? '';
  
  // 渲染多次提前还款配置简报 (新增)
  const summaryTextEl = document.getElementById('prepaySummaryText');
  if (summaryTextEl) {
    const prepayments = loan.prepayments || [];
    if (prepayments.length > 0) {
      const totalPrepaySum = prepayments.reduce((sum, p) => sum + (toFiniteNumber(p.amount, 0) || 0), 0);
      summaryTextEl.innerText = t('lblPrepaySummary', {
        count: prepayments.length,
        sum: formatNumber(totalPrepaySum)
      });
    } else {
      summaryTextEl.innerText = t('lblNoPrepay');
    }
  }

  // 设置还款方式单选框
  const radios = document.getElementsByName('repayMethod');
  radios.forEach(radio => {
    radio.checked = radio.value === loan.method;
  });

  // 计算本笔贷款的简易统计
  const schedule = calculateSingleLoan(loan);
  const yuan = ' ' + getCurrencyUnit();
  
  if (schedule.length > 0) {
    const sumTotal = schedule.reduce((sum, r) => sum + r.payment, 0);
    const sumInterest = schedule.reduce((sum, r) => sum + r.interest, 0);
    
    document.getElementById('detailSumTotal').innerText = `${formatNumber(sumTotal)}${yuan}`;
    document.getElementById('detailSumInterest').innerText = `${formatNumber(sumInterest)}${yuan}`;
    document.getElementById('detailFirstMonth').innerText = `${formatNumber(schedule[0].payment)}${yuan}`;
  } else {
    document.getElementById('detailSumTotal').innerText = `0.00${yuan}`;
    document.getElementById('detailSumInterest').innerText = `0.00${yuan}`;
    document.getElementById('detailFirstMonth').innerText = `0.00${yuan}`;
  }

  // 如果当前刚好在还款计划表标签页，也顺便重绘计划表
  if (currentDetailTab === 'plan') {
    renderSingleRepayTable(loan);
  }
}

/**
 * 渲染单笔还款明细计划表，带千分位与提前还款特别标注
 */
function renderSingleRepayTable(loan) {
  const tbody = document.getElementById('tableDetailBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const schedule = calculateSingleLoan(loan);
  if (schedule.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#808080; padding:20px;">${t('planPlaceholder')}</td></tr>`;
    return;
  }

  schedule.forEach(row => {
    const tr = document.createElement('tr');
    
    // 如果当期有提前还款，进行特别的复古高亮渲染，并显示提示标签
    let prepayTag = '';
    if (row.prepay > 0) {
      tr.style.backgroundColor = currentLang === 'zh' ? '#e1f5fe' : '#e8f5e9'; // 轻柔高亮
      prepayTag = t('prepayLabel', { amount: formatNumber(row.prepay) });
    }

    const periodStr = getPeriodLabel(row.period);

    tr.innerHTML = `
      <td><strong>${periodStr}</strong></td>
      <td>${row.dateStr}</td>
      <td style="color:#000080; font-weight:bold;">${formatNumber(row.payment)}${prepayTag}</td>
      <td>${formatNumber(row.principal)}</td>
      <td>${formatNumber(row.interest)}</td>
      <td style="color:#808080;">${formatNumber(row.remaining)}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * 监听所有参数的输入变动 (零延迟实时反应式计算核心引擎)
 */
function handleParamChange() {
  if (currentSelectedId === 'summary') return;

  const loan = loans.find(l => l.id === currentSelectedId);
  if (!loan) return;

  // 抓取 DOM 中的最新数值，同步更新至内存状态
  const newName = document.getElementById('loanName').value.trim();
  loan.name = sanitizeLoanName(newName, t('unnamedLoan'));

  const amountVal = document.getElementById('loanAmount').value;
  loan.amount = clampNumber(amountVal, 0, MAX_LOAN_AMOUNT, 0);

  const rateVal = document.getElementById('loanRate').value;
  loan.rate = clampNumber(rateVal, 0, MAX_RATE_PERCENT, 0);

  const termVal = document.getElementById('loanTerm').value;
  loan.term = clampInteger(termVal, 0, MAX_LOAN_TERM_MONTHS, 0);

  const yearVal = document.getElementById('loanStartYear').value;
  loan.startYear = clampInteger(yearVal, MIN_START_YEAR, MAX_START_YEAR, new Date().getFullYear());

  const monthVal = document.getElementById('loanStartMonth').value;
  loan.startMonth = clampInteger(monthVal, 1, 12, 1);
  loan.prepayments = sanitizePrepayments(loan.prepayments, loan.term);

  // 移去单笔提前还款的直接监听，多次提前还款现由管理器弹窗统一控制配置

  const radios = document.getElementsByName('repayMethod');
  for (let r of radios) {
    if (r.checked) {
      loan.method = r.value;
      break;
    }
  }

  // 1. 同步更新树形目录中可能出现的贷款重命名
  const matchingTreeItem = document.querySelector(`.win-tree-item.selected span:last-child`);
  if (matchingTreeItem) {
    matchingTreeItem.innerText = `${loan.name}.cfg`;
  }

  // 2. 局部刷新单笔属性指标
  const schedule = calculateSingleLoan(loan);
  const yuan = ' ' + getCurrencyUnit();
  
  if (schedule.length > 0) {
    const sumTotal = schedule.reduce((sum, r) => sum + r.payment, 0);
    const sumInterest = schedule.reduce((sum, r) => sum + r.interest, 0);
    document.getElementById('detailSumTotal').innerText = `${formatNumber(sumTotal)}${yuan}`;
    document.getElementById('detailSumInterest').innerText = `${formatNumber(sumInterest)}${yuan}`;
    document.getElementById('detailFirstMonth').innerText = `${formatNumber(schedule[0].payment)}${yuan}`;
  } else {
    document.getElementById('detailSumTotal').innerText = `0.00${yuan}`;
    document.getElementById('detailSumInterest').innerText = `0.00${yuan}`;
    document.getElementById('detailFirstMonth').innerText = `0.00${yuan}`;
  }

  if (currentDetailTab === 'plan') {
    renderSingleRepayTable(loan);
  }

  // 3. 反应式联动：自动保存至 LocalStorage，并立刻合流重绘全局数据
  saveData();
}

/**
 * 快捷设置贷款期限（年数一键折算为月份数，支持参数零延迟直算）
 * @param {number} months 月份数 (如 60, 120, 240, 360)
 */
function setQuickTerm(months) {
  if (currentSelectedId === 'summary') return;
  
  const loan = loans.find(l => l.id === currentSelectedId);
  if (!loan) return;

  // 1. 改写内存中的状态
  loan.term = clampInteger(months, 1, MAX_LOAN_TERM_MONTHS, 1);

  // 2. 同步更新输入框的值
  const termInput = document.getElementById('loanTerm');
  if (termInput) {
    termInput.value = loan.term;
  }

  // 3. 执行重算与 UI 刷新
  handleParamChange();
  calculateAll();
}

/**
 * 快捷设置贷款名称类型，支持中英文自适应重命名
 * @param {string} type 贷款类型：'Mortgage' (房贷), 'Auto' (车贷), 'Card' (信用卡), 'Consumer' (消费贷)
 */
function setQuickName(type) {
  if (currentSelectedId === 'summary') return;
  
  const loan = loans.find(l => l.id === currentSelectedId);
  if (!loan) return;

  // 利用全局翻译包，完全自适应简体、繁体、英文及日语等所有当前系统语言进行快速填充
  let translatedName = t(`name${type}`);

  // 1. 同步改写输入框中的值
  const nameInput = document.getElementById('loanName');
  if (nameInput) {
    nameInput.value = translatedName;
  }

  // 2. 触发参数变动联动与全局重算
  handleParamChange();
  calculateAll();
}


// ==========================================
// 8. 数据新建、删除与清空功能
// ==========================================

let loanIdSequence = 0;

/**
 * 生成当前贷款集合内唯一的 ID。
 * 时间戳后追加会话内递增序号，并再次检查现有集合，可承受自动化连点或同一毫秒内的重复创建。
 */
function createUniqueLoanId() {
  let candidate;
  do {
    loanIdSequence += 1;
    candidate = `loan_${Date.now().toString(36)}_${loanIdSequence.toString(36)}`;
  } while (loans.some(loan => loan.id === candidate));
  return candidate;
}

/**
 * 动态“新增”贷款配置文件
 */
function createNewLoan() {
  // 防御性控制：最大支持 20 笔贷款配置，保障本地浏览器性能稳定
  if (loans.length >= MAX_LOANS) {
    alert(t('alertLimit'));
    return;
  }

  // 查找一个未被占用的“贷款 N”序列名称
  let count = 1;
  const defNamePrefix = t('loanDefaultName');
  let newName = `${defNamePrefix} ${loans.length + count}`;
  while (loans.some(l => l.name === newName)) {
    count++;
    newName = `${defNamePrefix} ${loans.length + count}`;
  }

  const newId = createUniqueLoanId();
  const newLoan = {
    id: newId,
    name: newName,
    amount: 1000000, // 默认额度：100 万元，以“元”为高精度单位
    rate: 3.5,       // 默认利率
    method: 'ACPI',
    term: 240,       // 默认期限
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth() + 1,
    prepayments: []  // 默认无提前还款计划，直接使用新版数据模型
  };

  loans.push(sanitizeLoan(newLoan, loans.length));
  saveData();

  // 切换选中到这笔新建的贷款上
  currentSelectedId = newId;
  currentDetailTab = 'params'; // 默认切回参数配置页
  
  renderTreeView();
  selectTreeNode(newId);
  calculateAll();
}

/**
 * 销毁当前选中的单笔贷款配置文件
 */
function deleteCurrentLoan() {
  if (currentSelectedId === 'summary') return;
  
  const loanIndex = loans.findIndex(l => l.id === currentSelectedId);
  if (loanIndex === -1) return;

  const confirmMsg = t('confirmDelete', { name: loans[loanIndex].name });
  if (confirm(confirmMsg)) {
    loans.splice(loanIndex, 1);
    // 如果删除后没有贷款，则自动初始化为默认贷款，避免界面空白
    if (loans.length === 0) {
      loans = sanitizeLoans(cloneDefaultLoans());
    }
    saveData();

    // 回归到全局汇总盘
    currentSelectedId = 'summary';
    renderTreeView();
    selectTreeNode('summary');
    calculateAll();
  }
}

/**
 * 清空系统数据库 (还原到默认出厂配置状态)
 */
function clearAllData() {
  if (confirm(t('confirmClear'))) {
    // 清空数据时，重置为一笔默认初始贷款，让系统拥有良好的出厂初始化状态
    loans = sanitizeLoans(cloneDefaultLoans());
    saveData();
    currentSelectedId = 'summary';
    renderTreeView();
    selectTreeNode('summary');
    calculateAll();
  }
}

// ==========================================
// 9. 一键导出 CSV 电子表格逻辑
// ==========================================

/**
 * 导出全局合并后的月度还款计划总表为 CSV 文件
 * 支持根据当前语言自适应表头，且开头加入 UTF-8 BOM 杜绝 Excel 中文乱码！
 */
function exportSummaryCSV() {
  if (loans.length === 0 || globalMonthlyAggregated.length === 0) return;
  
  // 1. 根据当前语言自适应表头
  const headers = getSummaryCSVHeaders();
    
  let csvContent = '\ufeff'; // 写入 UTF-8 BOM 头，彻底防止 Excel 乱码
  csvContent += headers.join(',') + '\r\n';

  // 2. 写入数据
  globalMonthlyAggregated.forEach(row => {
    const csvRow = [
      escapeCSVCell(row.dateStr),
      escapeCSVCell(row.payment.toFixed(2)),
      escapeCSVCell(row.principal.toFixed(2)),
      escapeCSVCell(row.interest.toFixed(2)),
      escapeCSVCell(row.remaining.toFixed(2)),
      escapeCSVCell(row.activeLoans)
    ];
    csvContent += csvRow.join(',') + '\r\n';
  });

  // 3. 触发浏览器下载
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const fileName = currentLang === 'zh'
    ? `贷款组合月度还款计划总表_${new Date().toISOString().slice(0, 10)}.csv`
    : `Loan_Portfolio_Merged_Plan_${new Date().toISOString().slice(0, 10)}.csv`;
    
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 导出当前选中的单笔贷款还款明细表
 */
function exportSingleCSV() {
  if (currentSelectedId === 'summary') return;
  const loan = loans.find(l => l.id === currentSelectedId);
  if (!loan) return;

  const schedule = calculateSingleLoan(loan);
  if (schedule.length === 0) return;

  // 自适应多语言表头
  const headers = getSingleCSVHeaders();

  let csvContent = '\ufeff'; // BOM 头防乱码
  csvContent += headers.join(',') + '\r\n';

  schedule.forEach(row => {
    const csvRow = [
      escapeCSVCell(getPeriodLabel(row.period)),
      escapeCSVCell(row.dateStr),
      escapeCSVCell(row.payment.toFixed(2)),
      escapeCSVCell(row.principal.toFixed(2)),
      escapeCSVCell(row.interest.toFixed(2)),
      escapeCSVCell(row.remaining.toFixed(2)),
      escapeCSVCell(row.prepay.toFixed(2))
    ];
    csvContent += csvRow.join(',') + '\r\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const fileName = `${sanitizeFileName(loan.name, 'loan')}_${getSingleCSVFileSuffix()}.csv`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==========================================
// 10. 经典 Windows 98 界面动态交互
// ==========================================

// 保存数据至 LocalStorage
function saveData() {
  loans = sanitizeLoans(loans);
  writeStorage(STORAGE_KEY, JSON.stringify(loans));
}

// 任务栏小时钟动态走时
function startClock() {
  const clockEl = document.getElementById('systrayClock');
  if (!clockEl) return;
  
  function updateTime() {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    clockEl.innerText = `${hrs}:${mins}`;
  }
  
  updateTime();
  setInterval(updateTime, 1000); // 每秒走字
}

// 展开/收起底部开始菜单
function toggleStartMenu() {
  const menu = document.getElementById('startMenu');
  const btn = document.getElementById('startBtn');
  if (!menu || !btn) return;
  
  const isShow = menu.classList.toggle('show');
  btn.classList.toggle('active', isShow);

  // 点击外部自动关闭菜单
  if (isShow) {
    setTimeout(() => {
      document.addEventListener('click', closeMenuOutside);
    }, 10);
  } else {
    document.removeEventListener('click', closeMenuOutside);
  }
}

function closeMenuOutside(e) {
  const menu = document.getElementById('startMenu');
  const btn = document.getElementById('startBtn');
  if (!menu || !btn) return;
  
  if (!menu.contains(e.target) && !btn.contains(e.target)) {
    menu.classList.remove('show');
    btn.classList.remove('active');
    document.removeEventListener('click', closeMenuOutside);
  }
}

// 帮助 -> 关于 对话框弹窗操作
let tempPrepayments = []; // 用于记录在提前还款管理器弹窗中未保存的临时改动

/**
 * 显示或隐藏提前还款管理器弹窗
 */
function showPrepayManager(isOpen) {
  const overlay = document.getElementById('prepayManagerOverlay');
  if (!overlay) return;

  if (isOpen) {
    if (currentSelectedId === 'summary') return;
    const loan = loans.find(l => l.id === currentSelectedId);
    if (!loan) return;

    // 深拷贝当前贷款的提前还款配置到临时数组中
    tempPrepayments = JSON.parse(JSON.stringify(loan.prepayments || []));
    
    // 清空新增区域的输入框
    document.getElementById('dialogPrepayPeriod').value = '';
    document.getElementById('dialogPrepayAmount').value = '';
    
    // 重置单选框为默认值
    const radios = document.getElementsByName('dialogPrepayMethod');
    radios.forEach(r => {
      r.checked = r.value === 'shrink';
    });

    renderPrepayManagerList();
    overlay.style.display = 'flex';
  } else {
    overlay.style.display = 'none';
  }
}

/**
 * 渲染提前还款管理器列表
 */
function renderPrepayManagerList() {
  const tbody = document.getElementById('prepayManagerTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  tempPrepayments = sanitizePrepayments(tempPrepayments, currentSelectedId === 'summary' ? MAX_LOAN_TERM_MONTHS : (loans.find(l => l.id === currentSelectedId)?.term || MAX_LOAN_TERM_MONTHS));

  // 保证排序准确
  tempPrepayments.sort((a, b) => a.period - b.period);

  if (tempPrepayments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#808080; padding:15px;">${t('lblNoPrepay')}</td></tr>`;
    return;
  }

  tempPrepayments.forEach((item, index) => {
    const tr = document.createElement('tr');
    const periodText = getPeriodLabel(item.period);
    const methodText = item.method === 'shrink' ? t('prepayShrink') : t('prepayReduce');

    const periodTd = document.createElement('td');
    periodTd.textContent = periodText;

    const amountTd = document.createElement('td');
    amountTd.style.fontWeight = 'bold';
    amountTd.style.color = '#000080';
    amountTd.textContent = formatNumber(item.amount);

    const methodTd = document.createElement('td');
    methodTd.textContent = methodText;

    const actionTd = document.createElement('td');
    actionTd.style.textAlign = 'center';
    const removeLink = document.createElement('a');
    // 使用普通锚点并阻止默认跳转，避免留下脚本伪协议入口。
    removeLink.href = '#';
    removeLink.style.color = '#ff0000';
    removeLink.style.textDecoration = 'underline';
    removeLink.textContent = t('linkRemove');
    removeLink.onclick = function(event) {
      event.preventDefault();
      removeTempPrepay(index);
    };
    actionTd.appendChild(removeLink);

    tr.appendChild(periodTd);
    tr.appendChild(amountTd);
    tr.appendChild(methodTd);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

/**
 * 添加一笔提前还款记录至临时列表
 */
function addTempPrepay() {
  if (currentSelectedId === 'summary') return;
  const loan = loans.find(l => l.id === currentSelectedId);
  if (!loan) return;

  const periodVal = clampInteger(document.getElementById('dialogPrepayPeriod').value, 0, MAX_LOAN_TERM_MONTHS, 0);
  const amountVal = clampNumber(document.getElementById('dialogPrepayAmount').value, 0, MAX_LOAN_AMOUNT, 0);
  
  let methodVal = 'shrink';
  const radios = document.getElementsByName('dialogPrepayMethod');
  for (let r of radios) {
    if (r.checked) {
      methodVal = r.value;
      break;
    }
  }

  // 参数边界合法性校验
  if (periodVal <= 0) {
    alert(t('msgInvalidPeriod'));
    return;
  }
  
  // 期限范围校验，不能超过贷款总期限
  const loanTerm = clampInteger(loan.term, 0, MAX_LOAN_TERM_MONTHS, 0);
  if (periodVal >= loanTerm) {
    alert(currentLang === 'zh' ? `⚠️ 警告：还款期数必须小于当前贷款的总期限 (${loanTerm}期)` : `⚠️ Warning: Repayment period must be less than the loan term (${loanTerm})`);
    return;
  }

  if (amountVal <= 0.01) {
    alert(t('msgInvalidAmount'));
    return;
  }

  // 重复期数拦截校验
  const isDuplicate = tempPrepayments.some(p => p.period === periodVal);
  if (isDuplicate) {
    alert(t('msgDuplicatePeriod'));
    return;
  }

  // 将校验后的记录推入临时列表
  tempPrepayments.push({
    period: periodVal,
    amount: amountVal,
    method: methodVal
  });

  // 刷新展示列表，重置添加输入框
  renderPrepayManagerList();
  document.getElementById('dialogPrepayPeriod').value = '';
  document.getElementById('dialogPrepayAmount').value = '';
}

/**
 * 从临时列表移除特定记录
 */
function removeTempPrepay(index) {
  tempPrepayments.splice(index, 1);
  renderPrepayManagerList();
}

/**
 * 确定保存配置并刷新计算引擎
 */
function confirmPrepaySelection() {
  if (currentSelectedId === 'summary') return;
  const loan = loans.find(l => l.id === currentSelectedId);
  if (!loan) return;

  // 正式持久化写入当前内存模型中
  loan.prepayments = sanitizePrepayments(tempPrepayments, loan.term);

  showPrepayManager(false);
  
  // 触发全局重新计算及 DOM 联动刷新
  handleParamChange();
}

function showAboutDialog() {
  const overlay = document.getElementById('aboutDialogOverlay');
  if (overlay) overlay.classList.add('show');
}

function closeAboutDialog() {
  const overlay = document.getElementById('aboutDialogOverlay');
  if (overlay) overlay.classList.remove('show');
}

// 最小化 / 恢复主窗口演示（通过收起高度或设置显示状态模拟）
let isWindowMinimized = false;
function minimizeOrRestoreMainWindow() {
  const windowEl = document.getElementById('mainWindow');
  const taskBtn = document.getElementById('taskbarTitle');
  if (!windowEl || !taskBtn) return;

  if (isWindowMinimized) {
    windowEl.style.display = 'flex';
    taskBtn.classList.add('active');
    isWindowMinimized = false;
  } else {
    windowEl.style.display = 'none';
    taskBtn.classList.remove('active');
    isWindowMinimized = true;
  }
}

// 控制“显示属性”弹窗显示或隐藏
function showDisplayProperties(show) {
  const overlay = document.getElementById('displayPropertiesOverlay');
  if (!overlay) return;
  // 切换弹窗的 flex 布局显示状态
  overlay.style.display = show ? 'flex' : 'none';
  
  if (show) {
    // 弹窗打开时，初始化下拉框选中的当前全局主题
    const currentTheme = getGlobalTheme();
    const selectEl = document.getElementById('themeSelect');
    if (selectEl) {
      selectEl.value = currentTheme;
    }
    // 并更新预览区的局部样式
    updatePreviewTheme(currentTheme);
  }
}

// 获取当前的全局主题，默认为 'standard'，并向下兼容深色偏好至 standard
function getGlobalTheme() {
  const savedTheme = readStorage(THEME_PREF_KEY);
  if (savedTheme === 'dark') {
    writeStorage(THEME_PREF_KEY, 'standard');
    removeStorage(LEGACY_DARK_THEME_KEY);
    return 'standard';
  }
  if (savedTheme === 'vista' || savedTheme === 'standard') {
    return savedTheme;
  }
  // 向后兼容旧版本的深色模式配置
  const oldDark = readStorage(LEGACY_DARK_THEME_KEY);
  if (oldDark === 'true') {
    writeStorage(THEME_PREF_KEY, 'standard');
    removeStorage(LEGACY_DARK_THEME_KEY);
    return 'standard';
  }
  return 'standard';
}

// 预览区局部主题变更事件句柄
function handlePreviewThemeChange() {
  const selectEl = document.getElementById('themeSelect');
  if (selectEl) {
    updatePreviewTheme(selectEl.value);
  }
}

// 更新预览容器的 class，实现仅在预览框里渲染所选皮肤的效果
function updatePreviewTheme(themeName) {
  const container = document.getElementById('displayPreviewContainer');
  if (!container) return;
  // 清除所有的局部预览主题样式
  container.classList.remove('theme-standard', 'theme-dark', 'theme-vista');
  // 挂载所选的局部预览主题样式
  container.classList.add(`theme-${themeName}`);
}

// 显示属性确定按钮回调：保存并应用全局主题，然后关闭窗口
function confirmThemeSelection() {
  applyThemeSelection();
  showDisplayProperties(false);
}

// 核心应用逻辑：将主题应用于全局 body，更新 LocalStorage 缓存，并实时重绘图表与计算
function applyThemeSelection() {
  const selectEl = document.getElementById('themeSelect');
  if (!selectEl) return;
  const targetTheme = selectEl.value;
  
  // 1. 全局清理已有的主题类
  document.body.classList.remove('theme-standard', 'theme-dark', 'theme-vista', 'dark-theme');
  
  // 2. 挂载新的主题类
  document.body.classList.add(`theme-${targetTheme}`);
  
  // 3. 将最新主题偏好保存至浏览器 LocalStorage
  writeStorage(THEME_PREF_KEY, targetTheme);
  removeStorage(LEGACY_DARK_THEME_KEY);
  
  // 4. 触发零延迟重算并重绘 Chart.js 图表
  calculateAll();
}

// 控制“区域和语言设置”弹窗显示或隐藏
function showLangProperties(show) {
  const overlay = document.getElementById('langPropertiesOverlay');
  if (!overlay) return;
  // 切换弹窗的显示与隐藏状态
  overlay.style.display = show ? 'flex' : 'none';
  
  if (show) {
    // 弹窗打开时，初始化下拉框选中的当前全局语言偏好
    const selectEl = document.getElementById('langSelect');
    if (selectEl) {
      selectEl.value = currentLang;
    }
  }
}

// 区域和语言确定按钮回调：保存偏好，执行多语言热重载，并关闭窗口
function confirmLangSelection() {
  const selectEl = document.getElementById('langSelect');
  if (!selectEl) return;
  const targetLang = selectEl.value;
  
  // 1. 设置当前的语言状态变量
  currentLang = targetLang;
  
  // 2. 将新的语言偏好写入浏览器 LocalStorage 缓存
  writeStorage(LANG_PREF_KEY, targetLang);
  
  // 3. 应用全新的语言包翻译
  applyTranslations();
  
  // 4. 重新渲染左侧文件资源目录树（同步后缀名翻译）
  renderTreeView();
  
  // 5. 触发零延迟全盘重算与图表重绘（同步图例和轴的多语言文字）
  calculateAll();
  
  // 6. 关闭设置对话框
  showLangProperties(false);
}

/**
 * 智能直连用户的专属 GitHub 源码仓库
 */
function visitGitHub() {
  window.open('https://github.com/lukustar7/Combined-Loan-Calculator', '_blank');
}

// 绑定全局 focusout 事件，在编辑单笔配置且光标离开输入框时，做双重保存与计算联动
document.addEventListener('focusout', function(e) {
  if (e.target && e.target.classList.contains('win-input')) {
    handleParamChange();
    calculateAll(); // 重新加载全局图表和数据
  }
});

// ==========================================
// 11. 初始化加载
// ==========================================
function initApp() {
  // 加载语言偏好
  const savedLang = readStorage(LANG_PREF_KEY);
  if (savedLang === 'zh' || savedLang === 'zh-HK' || savedLang === 'en' || savedLang === 'ja') {
    currentLang = savedLang;
  } else {
    // 默认读取浏览器语言自适应
    const sysLang = navigator.language || navigator.userLanguage;
    if (sysLang && sysLang.toLowerCase().startsWith('en')) {
      currentLang = 'en';
    } else {
      currentLang = 'zh';
    }
  }

  // 加载主题皮肤偏好，支持新版多皮肤架构
  const currentTheme = getGlobalTheme();
  document.body.classList.remove('theme-standard', 'theme-dark', 'theme-vista', 'dark-theme');
  document.body.classList.add(`theme-${currentTheme}`);

  // 加载缓存数据
  const savedData = readStorage(STORAGE_KEY);
  let shouldPersistSanitizedData = false;
  if (savedData) {
    try {
      loans = sanitizeLoans(JSON.parse(savedData));
      shouldPersistSanitizedData = true;
    } catch (e) {
      loans = sanitizeLoans(cloneDefaultLoans());
      shouldPersistSanitizedData = true;
    }
  } else {
    loans = sanitizeLoans(cloneDefaultLoans());
    shouldPersistSanitizedData = true;
  }

  // 如果加载出的贷款列表为空（例如之前清空过），则自动初始化为默认贷款，确保系统不留白
  if (loans.length === 0) {
    loans = sanitizeLoans(cloneDefaultLoans());
    shouldPersistSanitizedData = true;
  }

  if (shouldPersistSanitizedData) {
    writeStorage(STORAGE_KEY, JSON.stringify(loans));
  }

  // 1. 全局应用语言包
  applyTranslations();
  
  // 2. 渲染左侧树形目录
  renderTreeView();
  
  // 3. 执行全局计算与合并，重绘趋势
  calculateAll();
  
  // 4. 启动时钟
  startClock();
}

/**
 * index.html 仍保留复古桌面所需的内联事件属性。
 * ES 模块默认不会把函数挂到 window，这里只公开 HTML 实际调用的交互入口，内部计算函数继续保持私有。
 */
Object.assign(globalThis, {
  addTempPrepay,
  applyThemeSelection,
  clearAllData,
  closeAboutDialog,
  confirmLangSelection,
  confirmPrepaySelection,
  confirmThemeSelection,
  createNewLoan,
  deleteCurrentLoan,
  exportSingleCSV,
  exportSummaryCSV,
  handleParamChange,
  handlePreviewThemeChange,
  minimizeOrRestoreMainWindow,
  setQuickName,
  setQuickTerm,
  showAboutDialog,
  showDisplayProperties,
  showLangProperties,
  showPrepayManager,
  switchChartViewMode,
  switchDetailTab,
  toggleStartMenu,
  visitGitHub
});

// 等待页面结构和本地图表库加载完成后再启动应用。
window.addEventListener('load', initApp);
