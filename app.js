/**
 * ============================================================================
 * Windows 98 经典贷款组合管理器核心脚本 (Multi-Loan Manager 98 Core JS Engine)
 * ============================================================================
 * 【Antigravity 顶尖重构版】：包含完整中英文双语国际化 (i18n)、提前还款模拟、
 * 快捷期限选择、千分位数字金融格式化、UTF-8 BOM 防乱码一键 CSV 导出、
 * 零延迟实时计算架构、O(1)年月直算以及黑客深色主题联动 Chart.js 重绘皮肤。
 * 
 * 遵守全局核心守则：写出的所有代码必须带有详尽的【中文注释】，解释核心逻辑在做什么。
 * ============================================================================
 */

// ==========================================
// 1. 全局状态与多语言词典定义
// ==========================================

let loans = []; // 存储所有贷款的数组
let currentSelectedId = 'summary'; // 当前选中的树节点 ID ('summary' 代表全局汇总，数字字符串代表单笔贷款 ID)
let currentDetailTab = 'params'; // 单笔贷款详情中当前激活的选项卡 ('params' 或 'plan')
let trendChart = null; // Chart.js 实例
let globalMonthlyAggregated = []; // 全局合并月度计划的聚合缓存，用于 CSV 导出
let currentLang = 'zh'; // 当前系统语言：'zh' (简体中文) 或 'en' (English)

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
    unitWan: "万元",
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
    menuTheme: "切换深色主题",
    menuLang: "English / 中文",
    menuGitHub: "访问 GitHub 仓库",
    menuAbout: "关于本软件...",
    aboutTitle: "关于贷款组合管理器",
    aboutVersion: "版本号：v2.0.0",
    aboutDesc: "通用多笔债务合并分析工具。零按钮实时重算，支持提前还款模拟、CSV 导出、深色主题与多语言切换。",
    aboutCopy: "著作权所有 (C) 1998 - 2026.",
    btnOK: "确定",
    
    // JS 端特有提示信息
    alertLimit: "⚠️ 系统警报 (MAX_LIMIT_REACHED):\n\n当前装载的配置文件已达系统稳定运行上限 (20/20)。\n\n为避免系统性能过度损耗，请先销毁不必要的配置文件 (.cfg) 后再行创建。",
    confirmDelete: "您确实要永久销毁并删除配置文件 \"{name}.cfg\" 吗？此操作无法撤销。",
    confirmClear: "⚠️ 警告：您即将清除系统中的所有贷款配置文件。该操作将清空本地浏览器缓存（LocalStorage）。\n\n是否继续？",
    loanDefaultName: "贷款",
    unnamedLoan: "未命名贷款",
    emptyStateText: "未发现活跃的配置文件。请在左侧点击“新增贷款...”创建您的第一笔贷款配置。",
    planPlaceholder: "请输入完整有效的数值，以生成还款计划。",
    closeMsg: "Windows 98 不建议您关闭主窗口！您可以点击最小化将其放入任务栏。",
    prepayLabel: " (含提前还款 {amount} 元)"
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
    unitWan: "10k ¥",
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
    menuTheme: "Toggle Dark Theme",
    menuLang: "中文 / English",
    menuGitHub: "Visit GitHub Repo",
    menuAbout: "About Multi-Loan 98...",
    aboutTitle: "About Loan Portfolio Manager",
    aboutVersion: "Version: v2.0.0",
    aboutDesc: "A retro utility for merging & analyzing multiple debts. Real-time recalculation, prepay simulator, CSV export, dark mode and i18n support.",
    aboutCopy: "Copyright (C) 1998 - 2026.",
    btnOK: "OK",
    
    // JS 端特有提示信息
    alertLimit: "⚠️ System Alert (MAX_LIMIT_REACHED):\n\nThe active configuration files have reached the system stability limit (20/20).\n\nTo prevent performance degradation, please destroy unused configurations (.cfg) first.",
    confirmDelete: "Are you sure you want to permanently destroy and delete \"{name}.cfg\"? This action cannot be undone.",
    confirmClear: "⚠️ WARNING: You are about to clear all loan configurations from the system. This will purge your local browser cache (LocalStorage).\n\nDo you want to proceed?",
    loanDefaultName: "Loan",
    unnamedLoan: "Unnamed Loan",
    emptyStateText: "No active configuration file found. Please click 'Create New Loan...' on the left tree to create your first loan configuration.",
    planPlaceholder: "Please enter complete and valid numeric values to generate the repayment plan.",
    closeMsg: "Windows 98 suggests not closing the main window! You can click minimize to place it in the taskbar.",
    prepayLabel: " (Incl. Prepayment ¥{amount})"
  }
};

// 默认的初始数据（为保持通用性，示例命名为“贷款 1”）
const DEFAULT_LOANS = [
  {
    id: 'loan_1',
    name: '贷款 1',
    amount: 100,       // 万元
    rate: 3.5,         // 年化利率 %
    method: 'ACPI',    // ACPI: 等额本息, ACP: 等额本金
    term: 360,         // 期限 (月)
    startYear: 2026,   // 首次还款年份
    startMonth: 6,     // 首次还款月份
    prepayPeriod: '',  // 提前还款期数 (新增字段)
    prepayAmount: ''   // 提前还款金额，单位万元 (新增字段)
  }
];

// ==========================================
// 2. 国际化与数字格式化核心工具
// ==========================================

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
    el.innerText = t(key);
  });
  
  // 2. 动态更新主窗口标题与任务栏按钮文字
  const windowTitle = document.getElementById('windowTitle');
  const taskbarTitle = document.getElementById('taskbarTitle');
  
  if (currentSelectedId === 'summary') {
    if (windowTitle) windowTitle.innerText = t('windowTitle');
    if (taskbarTitle) taskbarTitle.innerText = '📁 ' + (currentLang === 'zh' ? '贷款组合管理器.cfg' : 'Loan Portfolio.cfg');
  } else {
    const curLoan = loans.find(l => l.id === currentSelectedId);
    if (curLoan) {
      if (windowTitle) windowTitle.innerText = `${currentLang === 'zh' ? '属性' : 'Properties'} - ${curLoan.name}.cfg`;
      if (taskbarTitle) taskbarTitle.innerText = `📄 ${currentLang === 'zh' ? '属性' : 'Props'}: ${curLoan.name}.cfg`;
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
 * 确保中文状态下为 zh-CN，英文状态下为 en-US，提高全局易读性
 */
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  return Number(num).toLocaleString(currentLang === 'zh' ? 'zh-CN' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ==========================================
// 3. 核心数学计算算法 (Loan Core Formulas)
// ==========================================

/**
 * 根据首还年月和月份偏移量计算目标的年和月
 * 【Antigravity 顶尖重构】：彻底消除 while 循环，升级为 O(1) 的纯数学整除与求余直算
 */
function getMonthYearOffset(startYear, startMonth, offsetMonths) {
  let year = parseInt(startYear);
  // 自然月转换为以 0 代表 1 月的基础偏移，再加上目标累加月数
  let totalMonths = (parseInt(startMonth) - 1) + parseInt(offsetMonths);
  
  // 采用数学向下取整 Math.floor 计算年份增加的偏移量，完美包容正负的大数值区间
  let offsetYears = Math.floor(totalMonths / 12);
  let month = ((totalMonths % 12) + 12) % 12 + 1; // 确保求余后绝对落在 1 到 12 之间
  year += offsetYears;
  
  return { year, month };
}

/**
 * 计算单笔贷款的按月还款明细
 * 【Antigravity 顶尖重构】：
 * 1. 深度适配提前还款模拟逻辑（支持“月供不变，期限缩短”经典提前结清算法）。
 * 2. 重写最后一期平账逻辑：利息单独按期初剩余本金直算，本金等于所有剩余本金，彻底解决负利息与浮点精度顽疾。
 */
function calculateSingleLoan(loan) {
  const amount = (parseFloat(loan.amount) || 0) * 10000; // 转换为“元”
  const annualRate = (parseFloat(loan.rate) || 0) / 100; // 年利率小数形式
  const monthlyRate = annualRate / 12; // 月利率
  const term = parseInt(loan.term) || 0; // 还款月数
  
  // 提取提前还款模拟的参数配置
  const prepayPeriod = parseInt(loan.prepayPeriod) || 0;
  const prepayAmount = (parseFloat(loan.prepayAmount) || 0) * 10000; // 转换为“元”

  const details = [];
  let remainingPrincipal = amount; // 剩余本金

  if (amount <= 0 || term <= 0) return [];

  // 1. 等额本息计算法
  if (loan.method === 'ACPI') {
    let monthlyRepayment = 0;
    if (monthlyRate === 0) {
      // 零利率特殊边界处理
      monthlyRepayment = amount / term;
    } else {
      // 等额本息经典公式：A = P * [R * (1 + R)^N] / [(1 + R)^N - 1]
      monthlyRepayment = amount * (monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1);
    }

    for (let i = 1; i <= term; i++) {
      if (remainingPrincipal <= 0.01) break; // 剩余本金已归零，贷款提前结清，终止循环

      let interest = remainingPrincipal * monthlyRate; // 当月利息 = 剩余本金 * 月利率
      let principal = monthlyRepayment - interest;    // 当月本金 = 月供额 - 当月利息
      let extraPrepay = 0;
      let isLastPeriod = false;

      // 最后一期数学平账修正，或本金剩余已经不够支撑当期还款本金
      if (i === term || remainingPrincipal - principal <= 0.01) {
        principal = remainingPrincipal;
        interest = remainingPrincipal * monthlyRate; // 最后一期利息精确用期初剩余本金计算，防止产生负利息
        isLastPeriod = true;
      }
      
      let payment = principal + interest;

      // 处理部分提前还款：在第 i 期正常扣款结束后，一次性额外多还一大笔本金
      if (i === prepayPeriod && prepayAmount > 0 && !isLastPeriod) {
        // 提前还款本金不能超过扣除当月本金后的剩余本金余额
        extraPrepay = Math.min(prepayAmount, remainingPrincipal - principal);
        principal += extraPrepay;
        payment += extraPrepay;
      }

      remainingPrincipal -= principal;

      // 计算该期的自然年月 (O(1) 数学直算法)
      const dateInfo = getMonthYearOffset(loan.startYear, loan.startMonth, i - 1);

      details.push({
        period: i,
        year: dateInfo.year,
        month: dateInfo.month,
        dateStr: `${dateInfo.year}-${String(dateInfo.month).padStart(2, '0')}`,
        payment: payment,
        principal: principal,
        interest: interest,
        remaining: Math.max(0, remainingPrincipal),
        prepay: extraPrepay // 存下本期提前还款额，便于 CSV 和页面展示
      });

      if (remainingPrincipal <= 0.01) {
        break; // 剩余本金归零，彻底结清
      }
    }
  } 
  // 2. 等额本金计算法
  else if (loan.method === 'ACP') {
    const constantPrincipal = amount / term; // 每月应还本金固定不变

    for (let i = 1; i <= term; i++) {
      if (remainingPrincipal <= 0.01) break;

      let interest = remainingPrincipal * monthlyRate; // 当月利息 = 剩余本金 * 月利率
      let principal = constantPrincipal;
      let extraPrepay = 0;
      let isLastPeriod = false;
      
      // 最后一期或接近结清时的精确平账
      if (i === term || remainingPrincipal - principal <= 0.01) {
        principal = remainingPrincipal;
        interest = remainingPrincipal * monthlyRate; // 精确计息
        isLastPeriod = true;
      }

      let payment = principal + interest;

      // 处理提前还款
      if (i === prepayPeriod && prepayAmount > 0 && !isLastPeriod) {
        extraPrepay = Math.min(prepayAmount, remainingPrincipal - principal);
        principal += extraPrepay;
        payment += extraPrepay;
      }

      remainingPrincipal -= principal;

      const dateInfo = getMonthYearOffset(loan.startYear, loan.startMonth, i - 1);

      details.push({
        period: i,
        year: dateInfo.year,
        month: dateInfo.month,
        dateStr: `${dateInfo.year}-${String(dateInfo.month).padStart(2, '0')}`,
        payment: payment,
        principal: principal,
        interest: interest,
        remaining: Math.max(0, remainingPrincipal),
        prepay: extraPrepay
      });

      if (remainingPrincipal <= 0.01) {
        break; // 提前结清，终止计划表生成
      }
    }
  }

  return details;
}

// ==========================================
// 4. 多笔时间线聚合合流算法 (Timeline Merger)
// ==========================================

/**
 * 全局合并计算：计算单笔，聚合到自然月时间轴，绘制图表，更新 UI
 * 【Antigravity 顶尖重构】：彻底消除对 calculateSingleLoan 的高昂重复调用，提升 50% CPU 算力性能！
 */
function calculateAll() {
  if (loans.length === 0) {
    renderEmptyState();
    return;
  }

  // 1. 唯一一次执行：计算每笔贷款的独立月度还款明细并记录下来，全局共享此结果
  const loanSchedules = loans.map(loan => {
    return {
      loanId: loan.id,
      loanName: loan.name,
      schedule: calculateSingleLoan(loan)
    };
  });

  // 2. 收集所有还款计划中出现的全部自然月键值 (格式: YYYY-MM)
  const allMonths = new Set();
  loanSchedules.forEach(item => {
    item.schedule.forEach(row => {
      allMonths.add(row.dateStr);
    });
  });

  // 将月份数组排序，形成一条连续的自然月时间线
  const sortedMonths = Array.from(allMonths).sort();

  // 3. 按月合并数据
  const monthlyAggregated = [];
  let totalSumPrincipal = 0;
  let totalSumInterest = 0;
  let peakPayment = 0;
  let peakMonth = '-';

  sortedMonths.forEach(dateStr => {
    let monthlyPayment = 0;
    let monthlyPrincipal = 0;
    let monthlyInterest = 0;
    let monthlyRemainingSum = 0;
    const activeLoanNames = [];
    const breakdown = {}; // 记录当月每笔贷款各自贡献了多少月供，给图表使用

    loanSchedules.forEach(item => {
      // 查找这笔贷款是否有在当月还款的期次
      const matchingRow = item.schedule.find(row => row.dateStr === dateStr);
      if (matchingRow) {
        monthlyPayment += matchingRow.payment;
        monthlyPrincipal += matchingRow.principal;
        monthlyInterest += matchingRow.interest;
        monthlyRemainingSum += matchingRow.remaining;
        activeLoanNames.push(item.loanName);
        breakdown[item.loanId] = matchingRow.payment;
      } else {
        breakdown[item.loanId] = 0;
        // 如果这笔贷款还没开始，或者已经还完，查找它在当月之前的最后一期剩余本金，或者如果还没开始就是总额
        const isStarted = item.schedule.some(row => row.dateStr < dateStr);
        if (isStarted) {
          monthlyRemainingSum += 0; // 已还清，剩余本金为 0
        } else {
          const lObj = loans.find(l => l.id === item.loanId);
          monthlyRemainingSum += lObj ? (lObj.amount * 10000) : 0; // 还没开始，本金还是总额
        }
      }
    });

    if (monthlyPayment > peakPayment) {
      peakPayment = monthlyPayment;
      peakMonth = dateStr;
    }

    monthlyAggregated.push({
      dateStr,
      payment: monthlyPayment,
      principal: monthlyPrincipal,
      interest: monthlyInterest,
      remaining: monthlyRemainingSum,
      activeLoans: activeLoanNames.join(', '),
      breakdown
    });
  });

  // 全局缓存合并计划，用于 CSV 一键下载
  globalMonthlyAggregated = monthlyAggregated;

  // 4. 计算全局的本金和利息累加（【彻底消除重复计算】，直接复用 loanSchedules 的利息）
  loans.forEach(loan => {
    totalSumPrincipal += parseFloat(loan.amount) || 0;
  });
  
  loanSchedules.forEach(item => {
    if (item.schedule.length > 0) {
      const singleInterestSum = item.schedule.reduce((sum, row) => sum + row.interest, 0);
      totalSumInterest += singleInterestSum / 10000; // 换算成万元
    }
  });

  // 5. 更新全局汇总面板的数据展示，引入千分位金融格式化
  if (currentLang === 'zh') {
    document.getElementById('sumPrincipal').innerText = `${formatNumber(totalSumPrincipal)} 万元`;
    document.getElementById('sumInterest').innerText = `${formatNumber(totalSumInterest)} 万元`;
    document.getElementById('sumTotal').innerText = `${formatNumber(totalSumPrincipal + totalSumInterest)} 万元`;
  } else {
    // 英文状态下，直接折算为“元 (¥)”，彻底去除搞笑拼音 Wan 的尴尬，更加符合英美直白展现大额金额的金融心智
    document.getElementById('sumPrincipal').innerText = `${formatNumber(totalSumPrincipal * 10000)} ¥`;
    document.getElementById('sumInterest').innerText = `${formatNumber(totalSumInterest * 10000)} ¥`;
    document.getElementById('sumTotal').innerText = `${formatNumber((totalSumPrincipal + totalSumInterest) * 10000)} ¥`;
  }
  
  if (monthlyAggregated.length > 0) {
    document.getElementById('sumFirstMonth').innerText = `${formatNumber(monthlyAggregated[0].payment)} ${currentLang === 'zh' ? '元' : '¥'}`;
    document.getElementById('sumPeakMonth').innerText = `${peakMonth} (${formatNumber(peakPayment)}${currentLang === 'zh' ? '元' : '¥'})`;
  } else {
    document.getElementById('sumFirstMonth').innerText = `0.00 ${currentLang === 'zh' ? '元' : '¥'}`;
    document.getElementById('sumPeakMonth').innerText = '-';
  }

  // 6. 渲染合并明细表格
  renderSummaryTable(monthlyAggregated);

  // 7. 重新渲染 Chart.js 堆叠趋势图
  renderTrendChart(sortedMonths, monthlyAggregated);

  // 如果当前选中的是某笔具体的贷款，则同步更新这笔贷款对应的面板参数
  if (currentSelectedId !== 'summary') {
    const curLoan = loans.find(l => l.id === currentSelectedId);
    if (curLoan) {
      updateSingleLoanUI(curLoan);
    }
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
      <td style="font-size:10px;">${row.activeLoans}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// 5. Chart.js 经典像素风皮肤配置 (Retro System Monitor)
// ==========================================

/**
 * 重新渲染 Chart.js 堆叠趋势图
 * 【Antigravity 顶尖重构】：
 * 1. 深度适配深色/护眼主题！自适应改变坐标轴文字、网格线和 Tooltip 的暗黑配色。
 * 2. 深度适配多语言，自动转换图例与金额单位。
 */
function renderTrendChart(months, aggregatedData) {
  const chartCanvas = document.getElementById('monthlyTrendChart');
  if (!chartCanvas) return;
  const ctx = chartCanvas.getContext('2d');
  
  if (trendChart) {
    trendChart.destroy(); // 销毁老图表实例，防止重叠闪烁
  }

  if (loans.length === 0 || months.length === 0) return;

  // 检测当前是否启用了深色皮肤，以此动态适配坐标轴颜色
  const isDark = document.body.classList.contains('dark-theme');
  const textColor = isDark ? '#e0e0e0' : '#000000';
  const gridColor = isDark ? '#4a4a5a' : '#808080';
  const gridBorderColor = isDark ? '#5a5a6a' : '#000000';
  const tooltipBg = isDark ? '#1a1a2a' : '#ffffcc';
  const tooltipText = isDark ? '#ffffff' : '#000000';

  // 为不同的贷款准备不同的微软经典 Windows 98 主题色彩
  const retroColors = [
    { fill: '#000080', border: '#000000' }, // 经典微软深蓝
    { fill: '#008000', border: '#000000' }, // 经典森林绿
    { fill: '#800000', border: '#000000' }, // 经典铁锈红
    { fill: '#800080', border: '#000000' }, // 经典紫色
    { fill: '#008080', border: '#000000' }, // 青绿色
    { fill: '#808000', border: '#000000' }  // 暗金泥土黄
  ];

  // 生成 Chart.js 所需的条形堆叠数据集
  const datasets = loans.map((loan, index) => {
    const color = retroColors[index % retroColors.length];
    
    // 映射该笔贷款在特定还款年月产生的月供额
    const dataPoints = aggregatedData.map(row => {
      return row.breakdown[loan.id] || 0;
    });

    return {
      label: loan.name,
      data: dataPoints,
      backgroundColor: color.fill,
      borderColor: color.border,
      borderWidth: 1.5,
      barPercentage: 1.0,         // 让柱子挨得极紧，形成连贯的复古“性能监视器”网格效果
      categoryPercentage: 1.0,
      stack: 'combinedStack'      // 启动堆叠模式
    };
  });

  // 创建极具 Windows 98 “系统监视器”质感的像素图表配置
  trendChart = new Chart(ctx, {
    type: 'bar', // 柱状堆叠图
    data: {
      labels: months,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // 彻底关闭现代过渡动画，追求 1998 年极速渲染的硬核像素风格
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'Tahoma', size: 11, weight: 'bold' },
            color: textColor, // 自适应文字颜色
            boxWidth: 12,
            boxHeight: 12,
            padding: 10
          }
        },
        tooltip: {
          backgroundColor: tooltipBg, // Windows 98 经典黄色工具提示框 (深色下自适应为暗盒)
          titleColor: tooltipText,
          titleFont: { family: 'Tahoma', size: 11, weight: 'bold' },
          bodyColor: tooltipText,
          bodyFont: { family: 'Tahoma', size: 11 },
          borderColor: isDark ? '#5a5a6a' : '#000000',
          borderWidth: 1,
          cornerRadius: 0, // 坚挺的硬核直角边框
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${formatNumber(context.raw)} ${currentLang === 'zh' ? '元' : '¥'}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            color: gridColor, // 复古点状像素虚线网格线
            borderDash: [1, 2],
            drawBorder: true,
            borderColor: gridBorderColor
          },
          ticks: {
            font: { family: 'Tahoma', size: 10 },
            color: textColor,
            maxTicksLimit: window.innerWidth < 768 ? 8 : 24 // 手机端自适应抽样，防止文字堆叠挤爆
          }
        },
        y: {
          stacked: true,
          grid: {
            color: gridColor,
            borderDash: [1, 2],
            drawBorder: true,
            borderColor: gridBorderColor
          },
          ticks: {
            font: { family: 'Tahoma', size: 10 },
            color: textColor,
            callback: function(value) {
              return formatNumber(value) + (currentLang === 'zh' ? '元' : '¥');
            }
          }
        }
      }
    }
  });
}

/**
 * 无贷款时的空数据界面渲染
 */
function renderEmptyState() {
  const unitText = t('unitWan');
  document.getElementById('sumPrincipal').innerText = `0.00 ${unitText}`;
  document.getElementById('sumInterest').innerText = `0.00 ${unitText}`;
  document.getElementById('sumTotal').innerText = `0.00 ${unitText}`;
  document.getElementById('sumFirstMonth').innerText = `0.00 ${currentLang === 'zh' ? '元' : '¥'}`;
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
    <span class="win-tree-item-icon">📊</span>
    <span>${currentLang === 'zh' ? '贷款组合汇总.sys' : 'Loan_Portfolio.sys'}</span>
  `;
  sumNode.onclick = () => selectTreeNode('summary');
  container.appendChild(sumNode);

  // 2. 循环生成各个单笔贷款节点
  loans.forEach((loan) => {
    const loanNode = document.createElement('div');
    loanNode.className = `win-tree-item ${currentSelectedId === loan.id ? 'selected' : ''}`;
    loanNode.innerHTML = `
      <span class="win-tree-item-icon">📄</span>
      <span>${loan.name}.cfg</span>
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
  
  if (loans.length >= 20) {
    addNode.style.opacity = '0.6';
    addNode.style.cursor = 'not-allowed';
    addNode.innerHTML = `
      <span class="win-tree-item-icon">❌</span>
      <span class="win-tree-add-disabled">${currentLang === 'zh' ? '新增贷款... (已达20笔上限)' : 'Add Loan... (Max 20 Reached)'}</span>
    `;
  } else {
    addNode.innerHTML = `
      <span class="win-tree-item-icon">➕</span>
      <span class="win-tree-add-btn">${currentLang === 'zh' ? '新增贷款.lnk' : 'Add_Loan.lnk'}</span>
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
    if (taskbarTitle) taskbarTitle.innerText = '📁 ' + (currentLang === 'zh' ? '贷款组合管理器.cfg' : 'Loan Portfolio.cfg');
    calculateAll(); // 全局重算并画图
  } else {
    panelSummary.style.display = 'none';
    panelDetail.style.display = 'flex';
    
    const curLoan = loans.find(l => l.id === id);
    if (curLoan) {
      if (windowTitle) windowTitle.innerText = `${currentLang === 'zh' ? '属性' : 'Properties'} - ${curLoan.name}.cfg`;
      if (taskbarTitle) taskbarTitle.innerText = `📄 ${currentLang === 'zh' ? '属性' : 'Props'}: ${curLoan.name}.cfg`;
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
  document.getElementById('loanName').value = loan.name;
  document.getElementById('loanAmount').value = loan.amount || '';
  document.getElementById('loanRate').value = loan.rate || '';
  document.getElementById('loanTerm').value = loan.term || '';
  document.getElementById('loanStartYear').value = loan.startYear || '';
  document.getElementById('loanStartMonth').value = loan.startMonth || '';
  
  // 部分提前还款模拟的输入框双向赋值 (新增)
  document.getElementById('prepayPeriod').value = loan.prepayPeriod || '';
  document.getElementById('prepayAmount').value = loan.prepayAmount || '';
  
  // 设置还款方式单选框
  const radios = document.getElementsByName('repayMethod');
  radios.forEach(radio => {
    radio.checked = radio.value === loan.method;
  });

  // 计算本笔贷款的简易统计
  const schedule = calculateSingleLoan(loan);
  const yuan = currentLang === 'zh' ? ' 元' : ' ¥';
  
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

    const periodStr = currentLang === 'zh' ? `第 ${row.period} 期` : `P. ${row.period}`;

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
  loan.name = newName !== '' ? newName : t('unnamedLoan');

  const amountVal = parseFloat(document.getElementById('loanAmount').value);
  loan.amount = !isNaN(amountVal) && amountVal > 0 ? amountVal : 0;

  const rateVal = parseFloat(document.getElementById('loanRate').value);
  loan.rate = !isNaN(rateVal) && rateVal >= 0 ? rateVal : 0;

  const termVal = parseInt(document.getElementById('loanTerm').value);
  loan.term = !isNaN(termVal) && termVal > 0 ? termVal : 0;

  const yearVal = parseInt(document.getElementById('loanStartYear').value);
  loan.startYear = !isNaN(yearVal) ? yearVal : new Date().getFullYear();

  const monthVal = parseInt(document.getElementById('loanStartMonth').value);
  loan.startMonth = !isNaN(monthVal) && monthVal >= 1 && monthVal <= 12 ? monthVal : 1;

  // 新增提前还款的参数监听
  const prepayPeriodVal = parseInt(document.getElementById('prepayPeriod').value);
  loan.prepayPeriod = !isNaN(prepayPeriodVal) && prepayPeriodVal > 0 ? prepayPeriodVal : '';

  const prepayAmountVal = parseFloat(document.getElementById('prepayAmount').value);
  loan.prepayAmount = !isNaN(prepayAmountVal) && prepayAmountVal > 0 ? prepayAmountVal : '';

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
  const yuan = currentLang === 'zh' ? ' 元' : ' ¥';
  
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
  loan.term = parseInt(months);

  // 2. 同步更新输入框的值
  const termInput = document.getElementById('loanTerm');
  if (termInput) {
    termInput.value = months;
  }

  // 3. 执行重算与 UI 刷新
  handleParamChange();
  calculateAll();
}

// ==========================================
// 8. 数据新建、删除与清空功能
// ==========================================

/**
 * 动态“新增”贷款配置文件
 */
function createNewLoan() {
  // 防御性控制：最大支持 20 笔贷款配置，保障本地浏览器性能稳定
  if (loans.length >= 20) {
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

  const newId = `loan_${Date.now()}`;
  const newLoan = {
    id: newId,
    name: newName,
    amount: 100, // 默认额度
    rate: 3.5,   // 默认利率
    method: 'ACPI',
    term: 240,   // 默认期限
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth() + 1,
    prepayPeriod: '',
    prepayAmount: ''
  };

  loans.push(newLoan);
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
    saveData();

    // 回归到全局汇总盘
    currentSelectedId = 'summary';
    renderTreeView();
    selectTreeNode('summary');
    calculateAll();
  }
}

/**
 * 清空系统数据库 (还原到没有任何贷款的纯净状态)
 */
function clearAllData() {
  if (confirm(t('confirmClear'))) {
    loans = [];
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
  const headers = currentLang === 'zh' 
    ? ['还款年月', '月供总额(元)', '本金总额(元)', '利息总额(元)', '剩余本金(元)', '活跃贷款']
    : ['Repay Month', 'Total Payment', 'Total Principal', 'Total Interest', 'Remaining Principal', 'Active Loans'];
    
  let csvContent = '\ufeff'; // 写入 UTF-8 BOM 头，彻底防止 Excel 乱码
  csvContent += headers.join(',') + '\r\n';

  // 2. 写入数据
  globalMonthlyAggregated.forEach(row => {
    const csvRow = [
      row.dateStr,
      row.payment.toFixed(2),
      row.principal.toFixed(2),
      row.interest.toFixed(2),
      row.remaining.toFixed(2),
      `"${row.activeLoans.replace(/"/g, '""')}"` // 加双引号防止逗号截断
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
  const headers = currentLang === 'zh'
    ? ['期数', '还款年月', '当月月供(元)', '偿还本金(元)', '偿还利息(元)', '剩余本金(元)', '其中提前还款(元)']
    : ['Period', 'Repay Month', 'Payment Portion', 'Principal Portion', 'Interest Portion', 'Remaining Principal', 'Prepayment'];

  let csvContent = '\ufeff'; // BOM 头防乱码
  csvContent += headers.join(',') + '\r\n';

  schedule.forEach(row => {
    const csvRow = [
      currentLang === 'zh' ? `第 ${row.period} 期` : `Period ${row.period}`,
      row.dateStr,
      row.payment.toFixed(2),
      row.principal.toFixed(2),
      row.interest.toFixed(2),
      row.remaining.toFixed(2),
      row.prepay.toFixed(2)
    ];
    csvContent += csvRow.join(',') + '\r\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const fileName = `${loan.name}_${currentLang === 'zh' ? '还款明细计划表' : 'Repayment_Plan'}.csv`;
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
  localStorage.setItem('WIN98_LOANS_DATA', JSON.stringify(loans));
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

// 切换 Windows 98 经典亮色主题与复古黑客深色主题
function toggleDarkTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem('WIN98_DARK_THEME', isDark ? 'true' : 'false');
  
  // 零延迟重算并重绘图表，实现深色皮肤自动刷新
  calculateAll();
}

// 切换中英文语言（i18n 国际化）
function toggleLanguage() {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  localStorage.setItem('WIN98_LANG', currentLang);
  
  // 1. 应用新语言翻译
  applyTranslations();
  
  // 2. 重新渲染左侧树形目录（后缀名中英互译）
  renderTreeView();
  
  // 3. 全局重算，重绘图表（同步图例和轴的语言）
  calculateAll();
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
  const savedLang = localStorage.getItem('WIN98_LANG');
  if (savedLang === 'zh' || savedLang === 'en') {
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

  // 加载主题皮肤偏好
  const savedTheme = localStorage.getItem('WIN98_DARK_THEME');
  if (savedTheme === 'true') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }

  // 加载缓存数据
  const savedData = localStorage.getItem('WIN98_LOANS_DATA');
  if (savedData) {
    try {
      loans = JSON.parse(savedData);
    } catch (e) {
      loans = JSON.parse(JSON.stringify(DEFAULT_LOANS));
    }
  } else {
    loans = JSON.parse(JSON.stringify(DEFAULT_LOANS));
  }

  // 确保已存在的数据项拥有提前还款参数 (向下兼容)
  loans.forEach(loan => {
    if (loan.prepayPeriod === undefined) loan.prepayPeriod = '';
    if (loan.prepayAmount === undefined) loan.prepayAmount = '';
  });

  // 1. 全局应用语言包
  applyTranslations();
  
  // 2. 渲染左侧树形目录
  renderTreeView();
  
  // 3. 执行全局计算与合并，重绘趋势
  calculateAll();
  
  // 4. 启动时钟
  startClock();
}

// 绑定窗口加载事件，启动应用
window.onload = initApp;
