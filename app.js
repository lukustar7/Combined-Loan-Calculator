import {
  DEFAULT_LOAN,
  DEFAULT_MORTGAGE_COMBO,
  MAX_LOANS,
  MAX_LOAN_AMOUNT,
  MAX_RATE_PERCENT,
  MAX_LOAN_TERM_MONTHS,
  MIN_START_YEAR,
  MAX_START_YEAR,
  PALETTE_20,
  aggregateLoanPortfolio,
  calculatePrepaymentSavings,
  calculateSingleLoan,
  clampInteger,
  clampNumber,
  getAnnualAggregatedData,
  getMonthYearOffset,
  numberToChineseUppercase,
  sanitizeLoan as sanitizeLoanData,
  sanitizeLoanName,
  sanitizeLoans as sanitizeLoansData,
  sanitizePrepayments,
  toFiniteNumber
} from './src/loan-engine.js';

/**
 * ============================================================================
 * 贷款组合管理器页面交互与渲染驱动脚本 v1.5.0
 * ============================================================================
 * 负责 DOM 交互、浏览器存储、CSV 导出、双主题切换与 Chart.js 动态渲染。
 * 纯数学计算与数据清洗统一由 src/loan-engine.js 提供。
 * ============================================================================
 */

const APP_VERSION = "1.5.1";
let loans = []; // 存储所有贷款的数组
let currentSelectedId = 'summary'; // 当前选中的树节点 ID ('summary' 代表全局汇总，数字字符串代表单笔贷款 ID)
let currentDetailTab = 'params'; // 单笔贷款详情中当前激活的选项卡 ('params' 或 'plan')
let trendChart = null; // Chart.js 实例
let globalMonthlyAggregated = []; // 全局合并月度计划的聚合缓存，用于 CSV 导出
let currentChartViewMode = 'monthly'; // 图表查看粒度：'monthly' (按月明细) 或 'annual' (按年汇总)
let currentChartTypeMode = 'trend'; // 图表展示模式：'trend' (单笔独立走势对比，横线/斜线直观可见) 或 'stacked' (组合堆叠构成)

const STORAGE_KEY = 'COMBINED_LOANS_DATA';
const THEME_PREF_KEY = 'APP_THEME_PREF';

/**
 * 安全读取浏览器本地存储。
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
 * 格式化财务数字，保留 2 位小数并加上千分位逗号。
 */
function formatNumber(num) {
  if (num === null || num === undefined || !Number.isFinite(Number(num))) return '0.00';
  return Number(num).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * HTML 实体字符安全转义，用于防范 DOM-XSS 注入攻击。
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, match => {
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
 * CSV 单元格安全转义。
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
 * 清洗下载文件名。
 */
function sanitizeFileName(value, fallback = 'export') {
  const safeName = sanitizeLoanName(value, fallback).replace(/[\\/:*?"<>|]/g, '_');
  return safeName || fallback;
}

// ==========================================
// 1. 全局计算与大盘渲染
// ==========================================

function calculateAll() {
  if (loans.length === 0) {
    renderEmptyState();
    return;
  }

  const portfolio = aggregateLoanPortfolio(loans);
  globalMonthlyAggregated = portfolio.monthly;

  document.getElementById("sumPrincipal").innerText = `${formatNumber(portfolio.totalPrincipal / 10000)} 万元`;
  document.getElementById("sumInterest").innerText = `${formatNumber(portfolio.totalInterest / 10000)} 万元`;
  document.getElementById("sumTotal").innerText = `${formatNumber(portfolio.totalPayment / 10000)} 万元`;

  if (portfolio.monthly.length > 0) {
    document.getElementById("sumFirstMonth").innerText = `${formatNumber(portfolio.firstMonthPayment)} 元`;
    document.getElementById("sumPeakMonth").innerText = `${portfolio.peakMonth} (${formatNumber(portfolio.peakPayment)}元)`;
  } else {
    document.getElementById("sumFirstMonth").innerText = `0.00 元`;
    document.getElementById("sumPeakMonth").innerText = "-";
  }

  renderSummaryTable(portfolio.monthly);

  if (currentChartViewMode === "annual") {
    const annualAggregated = getAnnualAggregatedData(portfolio.monthly);
    renderTrendChart(annualAggregated.map(row => row.dateStr), annualAggregated);
  } else {
    renderTrendChart(portfolio.months, portfolio.monthly);
  }
}

function switchChartViewMode() {
  const selectEl = document.getElementById('chartViewSelect');
  if (selectEl) {
    currentChartViewMode = selectEl.value;
    calculateAll();
  }
}

function switchChartTypeMode() {
  const selectEl = document.getElementById('chartTypeSelect');
  if (selectEl) {
    currentChartTypeMode = selectEl.value;
    calculateAll();
  }
}

function renderSummaryTable(data) {
  const tbody = document.getElementById('tableSummaryBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${row.dateStr}</strong></td>
      <td class="cell-num" style="color:#000080; font-weight:bold;">${formatNumber(row.payment)}</td>
      <td class="cell-num">${formatNumber(row.principal)}</td>
      <td class="cell-num">${formatNumber(row.interest)}</td>
      <td class="cell-num" style="color:#64748b;">${formatNumber(row.remaining)}</td>
      <td style="text-align:center; font-size:11px;">${escapeHTML(row.activeLoans)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// 2. Chart.js 趋势与堆叠图表渲染核心
// ==========================================

function renderTrendChart(months, aggregatedData) {
  const chartCanvas = document.getElementById('monthlyTrendChart');
  if (!chartCanvas) return;
  const fallbackEl = document.getElementById('chartFallback');
  const ctx = chartCanvas.getContext('2d');
  
  if (trendChart) {
    trendChart.destroy();
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
      fallbackEl.innerText = '图表模块未加载，还款表格与 CSV 导出仍可正常使用。';
    }
    return;
  }

  const currentTheme = getGlobalTheme();
  let textColor = currentTheme === 'material' ? '#1e293b' : '#000000';
  let gridColor = currentTheme === 'material' ? '#e2e8f0' : '#808080';
  let tooltipBg = currentTheme === 'material' ? '#0f172a' : '#ffffcc';
  let tooltipText = currentTheme === 'material' ? '#ffffff' : '#000000';

  let datasets = [];
  let isStacked = (currentChartTypeMode === 'stacked');

  if (currentChartTypeMode === 'trend') {
    // 模式 A：单笔独立走势对比 (不堆叠，横线/斜线精准反映)
    datasets = loans.map((loan, index) => {
      const colorInfo = PALETTE_20[index % PALETTE_20.length];
      const dataPoints = aggregatedData.map(row => (row.breakdown ? (row.breakdown[loan.id] || 0) : 0));
      const lineCol = currentTheme === 'material' ? colorInfo.m3Fill : colorInfo.fill;
      const methodTag = loan.method === 'ACP' ? '等额本金' : '等额本息';

      return {
        type: 'line',
        label: `${loan.name} (${methodTag})`,
        loanId: loan.id,
        data: dataPoints,
        borderColor: lineCol,
        backgroundColor: lineCol,
        fill: false,
        borderWidth: 2,
        pointRadius: months.length > 80 ? 0 : 2,
        pointHoverRadius: 5,
        tension: 0
      };
    });

    if (loans.length > 1) {
      const totalPayments = aggregatedData.map(row => row.payment || 0);
      const totalCol = currentTheme === 'material' ? '#0041a2' : '#000000';
      datasets.unshift({
        type: 'line',
        label: '合并总月供 (合并负荷)',
        loanId: '__total__',
        data: totalPayments,
        borderColor: totalCol,
        backgroundColor: totalCol,
        borderWidth: 3,
        borderDash: currentTheme === 'material' ? [4, 3] : [3, 2],
        fill: false,
        pointRadius: months.length > 80 ? 0 : 2.5,
        pointHoverRadius: 6,
        tension: 0
      });
    }
  } else {
    // 模式 B：组合堆叠构成 (累积堆叠)
    const isBar = (currentChartViewMode === 'annual' || months.length <= 60);

    datasets = loans.map((loan, index) => {
      const colorInfo = PALETTE_20[index % PALETTE_20.length];
      const dataPoints = aggregatedData.map(row => (row.breakdown ? (row.breakdown[loan.id] || 0) : 0));
      const fillBg = currentTheme === 'material' ? colorInfo.m3Fill : colorInfo.fill;
      const borderCol = currentTheme === 'material' ? colorInfo.m3Border : colorInfo.border;

      const ds = {
        label: loan.name,
        loanId: loan.id,
        data: dataPoints,
        backgroundColor: fillBg,
        borderColor: borderCol,
        stack: 'combinedStack'
      };

      if (isBar) {
        ds.type = 'bar';
        ds.borderWidth = 1;
        ds.barPercentage = currentTheme === 'material' ? 0.85 : 1.0;
        ds.categoryPercentage = currentTheme === 'material' ? 0.85 : 1.0;
      } else {
        ds.type = 'line';
        ds.fill = true;
        ds.pointRadius = 0;
        ds.pointHoverRadius = 4;
        ds.tension = 0;
        ds.borderWidth = 1.5;
      }

      return ds;
    });
  }

  try {
    trendChart = new ChartConstructor(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        animation: currentTheme === 'material' ? { duration: 250 } : false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 11, weight: 'bold' },
              color: textColor,
              boxWidth: 12,
              boxHeight: 12,
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
            borderWidth: 1,
            cornerRadius: currentTheme === 'material' ? 8 : 0,
            callbacks: {
              label: function(context) {
                const loanId = context.dataset.loanId;
                const rawVal = context.raw;
                if (loanId === '__total__') {
                  return ` 👉 合并总月供: ${formatNumber(rawVal)} 元`;
                }

                const dateRow = aggregatedData[context.dataIndex];
                const prepayVal = (dateRow && dateRow.breakdown) ? (dateRow.breakdown[`${loanId}_prepay`] || 0) : 0;
                
                let labelText = ` ${context.dataset.label}: ${formatNumber(rawVal)} 元`;
                if (prepayVal > 0) {
                  labelText += ` (当月另有提前还款 ${formatNumber(prepayVal)} 元)`;
                }
                return labelText;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: isStacked,
            grid: {
              color: gridColor,
              borderDash: currentTheme === 'material' ? [] : [1, 2]
            },
            ticks: {
              color: textColor,
              maxTicksLimit: window.innerWidth < 768 ? 8 : 24
            }
          },
          y: {
            min: 0,
            stacked: isStacked,
            grid: {
              color: gridColor,
              borderDash: currentTheme === 'material' ? [] : [1, 2]
            },
            ticks: {
              color: textColor,
              callback: value => `${formatNumber(value)} 元`
            }
          }
        }
      }
    });
  } catch (e) {
    chartCanvas.style.display = 'none';
    trendChart = null;
    if (fallbackEl) {
      fallbackEl.style.display = 'flex';
      fallbackEl.innerText = '图表渲染失败，还款表格仍可正常查看。';
    }
  }
}

function renderEmptyState() {
  document.getElementById('sumPrincipal').innerText = `0.00 万元`;
  document.getElementById('sumInterest').innerText = `0.00 万元`;
  document.getElementById('sumTotal').innerText = `0.00 万元`;
  document.getElementById('sumFirstMonth').innerText = `0.00 元`;
  document.getElementById('sumPeakMonth').innerText = '-';
  
  const tbody = document.getElementById('tableSummaryBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#808080; padding:30px;">暂无贷款。请点击左侧“新增单笔贷款”或“一键创建房贷组合”添加贷款。</td></tr>`;
  }
  
  if (trendChart) {
    trendChart.destroy();
    trendChart = null;
  }
}

// ==========================================
// 3. 导航树与对齐规范渲染
// ==========================================

function getTreeIconHTML(type, isMaterial) {
  if (isMaterial) {
    switch (type) {
      case 'summary':
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>`;
      case 'loan':
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
      case 'plus':
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
      case 'home':
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`;
      case 'disabled':
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/></svg>`;
      default:
        return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/></svg>`;
    }
  } else {
    switch (type) {
      case 'summary': return `<span class="win-icon-chart"></span>`;
      case 'loan': return `<span class="win-icon-file"></span>`;
      case 'plus': return `<span class="win-icon-plus"></span>`;
      case 'home': return `<span class="win-icon-folder"></span>`;
      case 'disabled': return `<span class="win-icon-disabled"></span>`;
      default: return `<span class="win-icon-file"></span>`;
    }
  }
}

function renderTreeView() {
  const container = document.getElementById('treeView');
  if (!container) return;
  container.innerHTML = '';

  const currentTheme = getGlobalTheme();
  const isMaterial = (currentTheme === 'material');

  // 1. 全局汇总节点
  const sumNode = document.createElement('div');
  sumNode.className = `win-tree-item ${currentSelectedId === 'summary' ? 'selected' : ''}`;
  sumNode.innerHTML = `
    <div class="win-tree-item-icon">${getTreeIconHTML('summary', isMaterial)}</div>
    <div class="win-tree-item-info">
      <span class="win-tree-item-name">贷款组合总览</span>
    </div>
  `;
  sumNode.onclick = () => selectTreeNode('summary');
  container.appendChild(sumNode);

  // 2. 单笔贷款节点列表
  loans.forEach(loan => {
    const loanNode = document.createElement('div');
    loanNode.className = `win-tree-item ${currentSelectedId === loan.id ? 'selected' : ''}`;
    const methodBadge = loan.method === 'ACP' ? '等额本金' : '等额本息';
    const amountWanyuan = (loan.amount / 10000).toFixed(0);

    loanNode.innerHTML = `
      <div class="win-tree-item-icon">${getTreeIconHTML('loan', isMaterial)}</div>
      <div class="win-tree-item-info">
        <span class="win-tree-item-name">${escapeHTML(loan.name)}</span>
        <span class="win-tree-item-badge">${methodBadge} · ${amountWanyuan}万</span>
      </div>
    `;
    loanNode.onclick = () => selectTreeNode(loan.id);
    container.appendChild(loanNode);
  });

  // 3. 操作入口区
  const actionContainer = document.createElement('div');
  actionContainer.className = 'win-sidebar-actions';
  actionContainer.style.marginTop = '10px';
  actionContainer.style.borderTop = isMaterial ? '1px solid #e2e8f0' : '1px dotted var(--win-shadow)';
  actionContainer.style.paddingTop = '8px';
  actionContainer.style.display = 'flex';
  actionContainer.style.flexDirection = 'column';
  actionContainer.style.gap = '6px';

  // 新增单笔贷款
  const addNode = document.createElement('div');
  addNode.className = 'win-tree-item win-tree-action-item';
  if (loans.length >= MAX_LOANS) {
    addNode.style.opacity = '0.6';
    addNode.style.cursor = 'not-allowed';
    addNode.innerHTML = `
      <div class="win-tree-item-icon">${getTreeIconHTML('disabled', isMaterial)}</div>
      <div class="win-tree-item-info">
        <span class="win-tree-item-name">新增单笔贷款 (已达上限)</span>
      </div>
    `;
  } else {
    addNode.innerHTML = `
      <div class="win-tree-item-icon">${getTreeIconHTML('plus', isMaterial)}</div>
      <div class="win-tree-item-info">
        <span class="win-tree-item-name win-tree-action-btn">新增单笔贷款</span>
      </div>
    `;
  }
  addNode.onclick = createNewLoan;
  actionContainer.appendChild(addNode);

  // 一键创建房贷组合 (公积金 + 商贷) - 唯一保留入口
  if (loans.length < MAX_LOANS - 1) {
    const comboNode = document.createElement('div');
    comboNode.className = 'win-tree-item win-tree-action-item';
    comboNode.innerHTML = `
      <div class="win-tree-item-icon">${getTreeIconHTML('home', isMaterial)}</div>
      <div class="win-tree-item-info">
        <span class="win-tree-item-name win-tree-action-btn" style="color: #0b57d0;">一键创建房贷组合</span>
      </div>
    `;
    comboNode.onclick = createMortgageCombo;
    actionContainer.appendChild(comboNode);
  }

  container.appendChild(actionContainer);
}

function selectTreeNode(id) {
  currentSelectedId = id;
  renderTreeView();

  // 移动端横向标签自动居中平滑滚动
  const container = document.getElementById('treeView');
  if (container) {
    const activeItem = container.querySelector('.win-tree-item.selected');
    if (activeItem && typeof activeItem.scrollIntoView === 'function') {
      activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  const panelSummary = document.getElementById('panelSummary');
  const panelDetail = document.getElementById('panelDetail');
  const windowTitle = document.getElementById('windowTitle');
  const taskbarTitle = document.getElementById('taskbarTitle');

  if (!panelSummary || !panelDetail) return;

  if (id === 'summary') {
    panelSummary.style.display = 'flex';
    panelDetail.style.display = 'none';
    if (windowTitle) windowTitle.innerText = '贷款组合管理器';
    if (taskbarTitle) taskbarTitle.innerHTML = `<span class="win-icon-folder"></span>贷款组合管理器`;
    calculateAll();
  } else {
    panelSummary.style.display = 'none';
    panelDetail.style.display = 'flex';
    
    const curLoan = loans.find(l => l.id === id);
    if (curLoan) {
      if (windowTitle) windowTitle.innerText = `贷款详情 - ${curLoan.name}`;
      if (taskbarTitle) taskbarTitle.innerHTML = `<span class="win-icon-file"></span>${escapeHTML(curLoan.name)}`;
      updateSingleLoanUI(curLoan);
    }
  }
}

// ==========================================
// 4. 单笔贷款编辑与全链路实时联动
// ==========================================

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
 * 刷新单笔贷款的全部 UI 显示（输入框回填、大写提示、提前还款简报、省息卡片、单笔速览与明细表格）
 */
function updateSingleLoanUI(loan) {
  const safeLoan = sanitizeLoanData(loan, loans.findIndex(item => item.id === loan.id));
  Object.assign(loan, safeLoan);

  document.getElementById('loanName').value = loan.name;
  document.getElementById('loanAmount').value = loan.amount ?? '';
  document.getElementById('loanRate').value = loan.rate ?? '';
  document.getElementById('loanTerm').value = loan.term ?? '';
  document.getElementById('loanStartYear').value = loan.startYear ?? '';
  document.getElementById('loanStartMonth').value = loan.startMonth ?? '';

  // 更新大写与万元辅助胶囊
  updateAmountHelper(loan.amount);

  // 刷新提前还款配置简报与省息效益卡片
  refreshPrepayUI(loan);

  // 设置还款方式单选
  const radios = document.getElementsByName('repayMethod');
  radios.forEach(radio => {
    radio.checked = radio.value === loan.method;
  });

  // 刷新单笔本息速览
  refreshSingleSummaryUI(loan);

  if (currentDetailTab === 'plan') {
    renderSingleRepayTable(loan);
  }
}

/**
 * 实时刷新提前还款简报与省息效益卡片
 */
function refreshPrepayUI(loan) {
  const summaryTextEl = document.getElementById('prepaySummaryText');
  if (summaryTextEl) {
    const prepayments = loan.prepayments || [];
    if (prepayments.length > 0) {
      const totalPrepaySum = prepayments.reduce((sum, p) => sum + (toFiniteNumber(p.amount, 0) || 0), 0);
      summaryTextEl.innerText = `已配置 ${prepayments.length} 笔提前还款，累计提前还本 ${formatNumber(totalPrepaySum)} 元`;
    } else {
      summaryTextEl.innerText = '暂无提前还款配置';
    }
  }

  const savings = calculatePrepaymentSavings(loan);
  const savedInterestEl = document.getElementById('savedInterestText');
  const savedMonthsEl = document.getElementById('savedMonthsText');
  if (savedInterestEl && savedMonthsEl) {
    savedInterestEl.innerText = `${formatNumber(savings.savedInterest / 10000)} 万元`;
    savedMonthsEl.innerText = `${savings.savedMonths} 个月`;
  }
}

/**
 * 实时刷新单笔速览指标
 */
function refreshSingleSummaryUI(loan) {
  const schedule = calculateSingleLoan(loan);
  if (schedule.length > 0) {
    const sumTotal = schedule.reduce((sum, r) => sum + r.payment, 0);
    const sumInterest = schedule.reduce((sum, r) => sum + r.interest, 0);
    document.getElementById('detailSumTotal').innerText = `${formatNumber(sumTotal)} 元`;
    document.getElementById('detailSumInterest').innerText = `${formatNumber(sumInterest)} 元`;
    document.getElementById('detailFirstMonth').innerText = `${formatNumber(schedule[0].payment)} 元`;
  } else {
    document.getElementById('detailSumTotal').innerText = `0.00 元`;
    document.getElementById('detailSumInterest').innerText = `0.00 元`;
    document.getElementById('detailFirstMonth').innerText = `0.00 元`;
  }
}

function updateAmountHelper(amount) {
  const helperEl = document.getElementById('loanAmountHelper');
  if (!helperEl) return;
  const num = toFiniteNumber(amount, 0);
  if (num <= 0) {
    helperEl.innerText = '= 0.00 万元 (零元整)';
    return;
  }
  const wanyuan = (num / 10000).toFixed(2);
  const chinese = numberToChineseUppercase(num);
  helperEl.innerText = `= ${formatNumber(wanyuan)} 万元 (${chinese})`;
}

function renderSingleRepayTable(loan) {
  const tbody = document.getElementById('tableDetailBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const schedule = calculateSingleLoan(loan);
  if (schedule.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#808080; padding:20px;">请输入完整有效的数值以生成还款计划。</td></tr>`;
    return;
  }

  schedule.forEach(row => {
    const tr = document.createElement('tr');
    let prepayTag = '';
    if (row.prepay > 0) {
      tr.style.backgroundColor = '#e1f5fe';
      prepayTag = ` (含提前还款 ${formatNumber(row.prepay)} 元)`;
    }

    tr.innerHTML = `
      <td><strong>第 ${row.period} 期</strong></td>
      <td>${row.dateStr}</td>
      <td class="cell-num" style="color:#000080; font-weight:bold;">${formatNumber(row.payment)}${prepayTag}</td>
      <td class="cell-num">${formatNumber(row.principal)}</td>
      <td class="cell-num">${formatNumber(row.interest)}</td>
      <td class="cell-num" style="color:#64748b;">${formatNumber(row.remaining)}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * 参数变更响应函数：确保单笔 UI、侧边栏、大盘数据与图表 100% 实时同步联动！
 */
function handleParamChange() {
  if (currentSelectedId === 'summary') return;

  const loan = loans.find(l => l.id === currentSelectedId);
  if (!loan) return;

  const newName = document.getElementById('loanName').value.trim();
  loan.name = sanitizeLoanName(newName, '未命名贷款');

  const amountVal = document.getElementById('loanAmount').value;
  loan.amount = clampNumber(amountVal, 0, MAX_LOAN_AMOUNT, 0);
  updateAmountHelper(loan.amount);

  const rateVal = document.getElementById('loanRate').value;
  loan.rate = clampNumber(rateVal, 0, MAX_RATE_PERCENT, 0);

  const termVal = document.getElementById('loanTerm').value;
  loan.term = clampInteger(termVal, 0, MAX_LOAN_TERM_MONTHS, 0);

  const yearVal = document.getElementById('loanStartYear').value;
  loan.startYear = clampInteger(yearVal, MIN_START_YEAR, MAX_START_YEAR, new Date().getFullYear());

  const monthVal = document.getElementById('loanStartMonth').value;
  loan.startMonth = clampInteger(monthVal, 1, 12, 1);
  loan.prepayments = sanitizePrepayments(loan.prepayments, loan.term);

  const radios = document.getElementsByName('repayMethod');
  for (let r of radios) {
    if (r.checked) {
      loan.method = r.value;
      break;
    }
  }

  // 1. 实时刷新单笔提前还款简报与省息效益卡片
  refreshPrepayUI(loan);

  // 2. 实时刷新单笔速览
  refreshSingleSummaryUI(loan);

  // 3. 实时刷新还款计划表（若当前在计划表 Tab）
  if (currentDetailTab === 'plan') {
    renderSingleRepayTable(loan);
  }

  // 4. 同步侧边栏导航条目（名称与徽章）
  renderTreeView();

  // 5. 保存数据并触发全局大盘与图表重算
  saveData();
  calculateAll();
}

function setQuickTerm(months) {
  if (currentSelectedId === 'summary') return;
  const loan = loans.find(l => l.id === currentSelectedId);
  if (!loan) return;

  loan.term = clampInteger(months, 1, MAX_LOAN_TERM_MONTHS, 1);
  const termInput = document.getElementById('loanTerm');
  if (termInput) termInput.value = loan.term;

  handleParamChange();
}

function setQuickName(name) {
  if (currentSelectedId === 'summary') return;
  const loan = loans.find(l => l.id === currentSelectedId);
  if (!loan) return;

  loan.name = name;
  const nameInput = document.getElementById('loanName');
  if (nameInput) nameInput.value = name;

  handleParamChange();
}

// ==========================================
// 5. 贷款增删与房贷组合一键模板
// ==========================================

let loanIdSequence = 0;
function createUniqueLoanId() {
  let candidate;
  do {
    loanIdSequence += 1;
    candidate = `loan_${Date.now().toString(36)}_${loanIdSequence.toString(36)}`;
  } while (loans.some(loan => loan.id === candidate));
  return candidate;
}

function createNewLoan() {
  if (loans.length >= MAX_LOANS) {
    alert('最多支持添加 20 笔贷款配置。请先删除不需要的贷款后再行添加。');
    return;
  }

  let count = 1;
  let newName = `商业房贷 ${loans.length + count}`;
  while (loans.some(l => l.name === newName)) {
    count++;
    newName = `商业房贷 ${loans.length + count}`;
  }

  const newId = createUniqueLoanId();
  const newLoan = {
    id: newId,
    name: newName,
    amount: 1000000,
    rate: 3.15,
    method: 'ACPI',
    term: 360,
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth() + 1,
    prepayments: []
  };

  loans.push(sanitizeLoanData(newLoan, loans.length));
  saveData();

  currentSelectedId = newId;
  currentDetailTab = 'params';
  renderTreeView();
  selectTreeNode(newId);
  calculateAll();
}

/**
 * 一键创建房贷组合（公积金 + 商业贷款）
 */
function createMortgageCombo() {
  if (loans.length + 2 > MAX_LOANS) {
    alert('最多支持添加 20 笔贷款配置。当前剩余额度不足以容纳 2 笔房贷组合。');
    return;
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const gjjId = createUniqueLoanId();
  const gjjLoan = {
    ...DEFAULT_MORTGAGE_COMBO[0],
    id: gjjId,
    startYear: currentYear,
    startMonth: currentMonth
  };

  const commId = createUniqueLoanId();
  const commLoan = {
    ...DEFAULT_MORTGAGE_COMBO[1],
    id: commId,
    startYear: currentYear,
    startMonth: currentMonth
  };

  loans.push(sanitizeLoanData(gjjLoan, loans.length));
  loans.push(sanitizeLoanData(commLoan, loans.length));
  saveData();

  currentSelectedId = 'summary';
  renderTreeView();
  selectTreeNode('summary');
  calculateAll();
}

function deleteCurrentLoan() {
  if (currentSelectedId === 'summary') return;
  const loanIndex = loans.findIndex(l => l.id === currentSelectedId);
  if (loanIndex === -1) return;

  const confirmMsg = `确定要删除贷款“${loans[loanIndex].name}”吗？此操作无法撤销。`;
  if (confirm(confirmMsg)) {
    loans.splice(loanIndex, 1);
    if (loans.length === 0) {
      loans = sanitizeLoansData([DEFAULT_LOAN]);
    }
    saveData();
    currentSelectedId = 'summary';
    renderTreeView();
    selectTreeNode('summary');
    calculateAll();
  }
}

function clearAllData() {
  if (confirm('警告：您即将清空系统中的所有贷款数据并恢复出厂初始配置。\n\n是否继续？')) {
    loans = sanitizeLoansData([DEFAULT_LOAN]);
    saveData();
    currentSelectedId = 'summary';
    renderTreeView();
    selectTreeNode('summary');
    calculateAll();
  }
}

// ==========================================
// 6. CSV 数据导出
// ==========================================

function exportSummaryCSV() {
  if (loans.length === 0 || globalMonthlyAggregated.length === 0) return;
  
  const headers = ['还款年月', '月供总额(元)', '本金总额(元)', '利息总额(元)', '剩余本金(元)', '活跃贷款'];
  let csvContent = '\ufeff' + headers.join(',') + '\r\n';

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

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `贷款组合月度还款计划总表_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportSingleCSV() {
  if (currentSelectedId === 'summary') return;
  const loan = loans.find(l => l.id === currentSelectedId);
  if (!loan) return;

  const schedule = calculateSingleLoan(loan);
  if (schedule.length === 0) return;

  const headers = ['期数', '还款年月', '当月月供(元)', '偿还本金(元)', '偿还利息(元)', '剩余本金(元)', '其中提前还款(元)'];
  let csvContent = '\ufeff' + headers.join(',') + '\r\n';

  schedule.forEach(row => {
    const csvRow = [
      escapeCSVCell(`第 ${row.period} 期`),
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
  link.setAttribute('download', `${sanitizeFileName(loan.name, 'loan')}_还款明细表.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==========================================
// 7. 提前还款管理器弹窗
// ==========================================

let tempPrepayments = [];

function showPrepayManager(isOpen) {
  const overlay = document.getElementById('prepayManagerOverlay');
  if (!overlay) return;

  if (isOpen) {
    if (currentSelectedId === 'summary') return;
    const loan = loans.find(l => l.id === currentSelectedId);
    if (!loan) return;

    tempPrepayments = JSON.parse(JSON.stringify(loan.prepayments || []));
    document.getElementById('dialogPrepayPeriod').value = '';
    document.getElementById('dialogPrepayAmount').value = '';
    document.getElementById('dialogPrepayDateHint').innerText = '';
    document.getElementById('dialogPrepayAmountHelper').innerText = '';

    const radios = document.getElementsByName('dialogPrepayMethod');
    radios.forEach(r => { r.checked = r.value === 'shrink'; });

    renderPrepayManagerList();
    overlay.style.display = 'flex';
  } else {
    overlay.style.display = 'none';
  }
}

function syncPrepayDateHint() {
  if (currentSelectedId === 'summary') return;
  const loan = loans.find(l => l.id === currentSelectedId);
  if (!loan) return;

  const periodVal = clampInteger(document.getElementById('dialogPrepayPeriod').value, 0, MAX_LOAN_TERM_MONTHS, 0);
  const hintEl = document.getElementById('dialogPrepayDateHint');
  if (!hintEl) return;

  if (periodVal > 0) {
    const targetDate = getMonthYearOffset(loan.startYear, loan.startMonth, periodVal - 1);
    hintEl.innerText = `对应还款月份：${targetDate.year}年${targetDate.month}月`;
  } else {
    hintEl.innerText = '';
  }
}

function syncPrepayAmountHint() {
  const amountVal = toFiniteNumber(document.getElementById('dialogPrepayAmount').value, 0);
  const helperEl = document.getElementById('dialogPrepayAmountHelper');
  if (!helperEl) return;

  if (amountVal > 0) {
    const wanyuan = (amountVal / 10000).toFixed(2);
    const chinese = numberToChineseUppercase(amountVal);
    helperEl.innerText = `= ${formatNumber(wanyuan)} 万元 (${chinese})`;
  } else {
    helperEl.innerText = '';
  }
}

function renderPrepayManagerList() {
  const tbody = document.getElementById('prepayManagerTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const currentLoan = loans.find(l => l.id === currentSelectedId);
  const loanTerm = currentLoan?.term || MAX_LOAN_TERM_MONTHS;
  tempPrepayments = sanitizePrepayments(tempPrepayments, loanTerm);
  tempPrepayments.sort((a, b) => a.period - b.period);

  if (tempPrepayments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#808080; padding:15px;">暂无提前还款配置</td></tr>`;
    return;
  }

  tempPrepayments.forEach((item, index) => {
    const tr = document.createElement('tr');
    let dateInfo = '';
    if (currentLoan) {
      const d = getMonthYearOffset(currentLoan.startYear, currentLoan.startMonth, item.period - 1);
      dateInfo = ` (${d.year}-${String(d.month).padStart(2, '0')})`;
    }

    const methodText = item.method === 'shrink' ? '缩短期限' : '减少月供';

    tr.innerHTML = `
      <td>第 ${item.period} 期${dateInfo}</td>
      <td class="cell-num" style="font-weight:bold; color:#000080;">${formatNumber(item.amount)}</td>
      <td>${methodText}</td>
      <td style="text-align:center;">
        <a href="#" style="color:#ff0000; text-decoration:underline;" onclick="event.preventDefault(); removeTempPrepay(${index});">移除</a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

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

  if (periodVal <= 0) {
    alert('请输入合法的期数！');
    return;
  }
  
  const loanTerm = clampInteger(loan.term, 0, MAX_LOAN_TERM_MONTHS, 0);
  if (periodVal >= loanTerm) {
    alert(`还款期数必须小于当前贷款的总期限 (${loanTerm}期)`);
    return;
  }

  if (amountVal <= 0.01) {
    alert('请输入合法的还款金额！');
    return;
  }

  const isDuplicate = tempPrepayments.some(p => p.period === periodVal);
  if (isDuplicate) {
    alert('该期数已配置过提前还款！');
    return;
  }

  tempPrepayments.push({
    period: periodVal,
    amount: amountVal,
    method: methodVal
  });

  renderPrepayManagerList();
  document.getElementById('dialogPrepayPeriod').value = '';
  document.getElementById('dialogPrepayAmount').value = '';
  document.getElementById('dialogPrepayDateHint').innerText = '';
  document.getElementById('dialogPrepayAmountHelper').innerText = '';
}

function removeTempPrepay(index) {
  tempPrepayments.splice(index, 1);
  renderPrepayManagerList();
}

function confirmPrepaySelection() {
  if (currentSelectedId === 'summary') return;
  const loan = loans.find(l => l.id === currentSelectedId);
  if (!loan) return;

  loan.prepayments = sanitizePrepayments(tempPrepayments, loan.term);
  showPrepayManager(false);
  
  // 触发全链路实时刷新（包含单笔提前还款简报、省息效益卡片、单笔速览、导航树及大盘总表与图表）
  handleParamChange();
}

// ==========================================
// 8. 主题外观管理与弹窗
// ==========================================

function getGlobalTheme() {
  const savedTheme = readStorage(THEME_PREF_KEY);
  if (savedTheme === 'material' || savedTheme === 'standard') {
    return savedTheme;
  }
  return 'standard';
}

function toggleThemeQuick() {
  const currentTheme = getGlobalTheme();
  const nextTheme = currentTheme === 'material' ? 'standard' : 'material';
  
  document.body.classList.remove('theme-standard', 'theme-material', 'theme-vista');
  document.body.classList.add(`theme-${nextTheme}`);
  writeStorage(THEME_PREF_KEY, nextTheme);

  updateThemeToggleBtnText(nextTheme);
  renderTreeView();
  calculateAll();
}

function updateThemeToggleBtnText(themeName) {
  const btn = document.getElementById('m3ThemeToggleBtn');
  if (btn) {
    if (themeName === 'material') {
      btn.innerHTML = `<span class="m3-btn-icon">🎨</span><span class="m3-btn-text">切换到 Windows 98</span>`;
    } else {
      btn.innerHTML = `<span class="m3-btn-icon">✨</span><span class="m3-btn-text">切换到 Material 3</span>`;
    }
  }
}

function showDisplayProperties(show) {
  const overlay = document.getElementById('displayPropertiesOverlay');
  if (!overlay) return;
  overlay.style.display = show ? 'flex' : 'none';
  
  if (show) {
    const currentTheme = getGlobalTheme();
    const selectEl = document.getElementById('themeSelect');
    if (selectEl) selectEl.value = currentTheme;
    updatePreviewTheme(currentTheme);
  }
}

function handlePreviewThemeChange() {
  const selectEl = document.getElementById('themeSelect');
  if (selectEl) updatePreviewTheme(selectEl.value);
}

function updatePreviewTheme(themeName) {
  const container = document.getElementById('displayPreviewContainer');
  if (!container) return;
  container.classList.remove('theme-standard', 'theme-material');
  container.classList.add(`theme-${themeName}`);
}

function confirmThemeSelection() {
  applyThemeSelection();
  showDisplayProperties(false);
}

function applyThemeSelection() {
  const selectEl = document.getElementById('themeSelect');
  if (!selectEl) return;
  const targetTheme = selectEl.value;
  
  document.body.classList.remove('theme-standard', 'theme-material', 'theme-vista');
  document.body.classList.add(`theme-${targetTheme}`);
  writeStorage(THEME_PREF_KEY, targetTheme);
  updateThemeToggleBtnText(targetTheme);
  renderTreeView();
  calculateAll();
}

function showAboutDialog() {
  const overlay = document.getElementById('aboutDialogOverlay');
  if (overlay) overlay.classList.add('show');
}

function closeAboutDialog() {
  const overlay = document.getElementById('aboutDialogOverlay');
  if (overlay) overlay.classList.remove('show');
}

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

function toggleStartMenu() {
  const menu = document.getElementById('startMenu');
  const btn = document.getElementById('startBtn');
  if (!menu || !btn) return;
  
  const isShow = menu.classList.toggle('show');
  btn.classList.toggle('active', isShow);

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

function visitGitHub() {
  window.open('https://github.com/lukustar7/Combined-Loan-Calculator', '_blank');
}

function saveData() {
  loans = sanitizeLoansData(loans);
  writeStorage(STORAGE_KEY, JSON.stringify(loans));
}

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
  setInterval(updateTime, 1000);
}

// ==========================================
// 9. 应用初始化
// ==========================================

function initApp() {
  const currentTheme = getGlobalTheme();
  document.body.classList.remove('theme-standard', 'theme-material', 'theme-vista');
  document.body.classList.add(`theme-${currentTheme}`);
  updateThemeToggleBtnText(currentTheme);

  const savedData = readStorage(STORAGE_KEY);
  if (savedData) {
    try {
      loans = sanitizeLoansData(JSON.parse(savedData));
    } catch (e) {
      loans = sanitizeLoansData([DEFAULT_LOAN]);
    }
  } else {
    loans = sanitizeLoansData([DEFAULT_LOAN]);
  }

  if (loans.length === 0) {
    loans = sanitizeLoansData([DEFAULT_LOAN]);
  }

  writeStorage(STORAGE_KEY, JSON.stringify(loans));

  renderTreeView();
  calculateAll();
  startClock();
}

Object.assign(globalThis, {
  addTempPrepay,
  applyThemeSelection,
  clearAllData,
  closeAboutDialog,
  confirmPrepaySelection,
  confirmThemeSelection,
  createNewLoan,
  createMortgageCombo,
  deleteCurrentLoan,
  exportSingleCSV,
  exportSummaryCSV,
  handleParamChange,
  handlePreviewThemeChange,
  minimizeOrRestoreMainWindow,
  removeTempPrepay,
  setQuickName,
  setQuickTerm,
  showAboutDialog,
  showDisplayProperties,
  showPrepayManager,
  switchChartTypeMode,
  switchChartViewMode,
  switchDetailTab,
  syncPrepayAmountHint,
  syncPrepayDateHint,
  toggleStartMenu,
  toggleThemeQuick,
  visitGitHub
});

window.addEventListener('load', initApp);
