/**
 * Windows 98 经典贷款组合管理器 (Multi-Loan Manager 98 Core Javascript)
 * 完全采用 Vanilla JS 编写，包含核心还款计算、多笔对齐合并算法、Chart.js 复古皮肤和 100% 还原的 Win98 交互。
 */

// ==========================================
// 1. 全局状态与初始化数据
// ==========================================

let loans = []; // 存储所有贷款的数组
let currentSelectedId = 'summary'; // 当前选中的树节点 ID ('summary' 代表全局汇总，数字字符串代表单笔贷款 ID)
let currentDetailTab = 'params'; // 单笔贷款详情中当前激活的选项卡 ('params' 或 'plan')
let trendChart = null; // Chart.js 实例

// 默认的初始数据（为保持通用性，示例命名为“贷款 1”）
const DEFAULT_LOANS = [
  {
    id: 'loan_1',
    name: '贷款 1',
    amount: 100,      // 万元
    rate: 3.5,        // 年化利率 %
    method: 'ACPI',   // ACPI: 等额本息, ACP: 等额本金
    term: 360,        // 期限 (月)
    startYear: 2026,  // 首次还款年份
    startMonth: 6     // 首次还款月份
  }
];

// 初始化加载数据
function initApp() {
  const savedData = localStorage.getItem('WIN98_LOANS_DATA');
  if (savedData) {
    try {
      loans = JSON.parse(savedData);
    } catch (e) {
      loans = [...DEFAULT_LOANS];
    }
  } else {
    loans = [...DEFAULT_LOANS];
  }

  // 渲染左侧树形目录
  renderTreeView();
  // 执行全局计算与合并
  calculateAll();
  // 启动任务栏小时钟
  startClock();
}

// 保存数据至 LocalStorage
function saveData() {
  localStorage.setItem('WIN98_LOANS_DATA', JSON.stringify(loans));
}

// ==========================================
// 2. 核心数学计算算法 (Loan Core Formulas)
// ==========================================

/**
 * 计算单笔贷款的按月还款明细
 * @param {Object} loan 贷款配置对象
 * @returns {Array} 包含每月还款信息的明细数组
 */
function calculateSingleLoan(loan) {
  const amount = loan.amount * 10000; // 转换为“元”
  const annualRate = loan.rate / 100; // 年利率小数形式
  const monthlyRate = annualRate / 12; // 月利率
  const term = parseInt(loan.term); // 还款月数
  
  const details = [];
  let remainingPrincipal = amount; // 剩余本金

  if (amount <= 0 || term <= 0) return [];

  // 1. 等额本息计算法
  if (loan.method === 'ACPI') {
    let monthlyRepayment = 0;
    if (monthlyRate === 0) {
      // 零利率特例
      monthlyRepayment = amount / term;
    } else {
      // 等额本息经典公式：A = P * [R * (1 + R)^N] / [(1 + R)^N - 1]
      monthlyRepayment = amount * (monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1);
    }

    for (let i = 1; i <= term; i++) {
      let interest = remainingPrincipal * monthlyRate; // 当月利息 = 剩余本金 * 月利率
      let principal = monthlyRepayment - interest;    // 当月本金 = 月供额 - 当月利息
      
      // 最后一期修正，避免浮点数精度截断误差
      if (i === term) {
        principal = remainingPrincipal;
        interest = monthlyRepayment - principal;
      }
      
      remainingPrincipal -= principal;

      // 计算该期的自然年月
      const dateInfo = getMonthYearOffset(loan.startYear, loan.startMonth, i - 1);

      details.push({
        period: i,
        year: dateInfo.year,
        month: dateInfo.month,
        dateStr: `${dateInfo.year}-${String(dateInfo.month).padStart(2, '0')}`,
        payment: monthlyRepayment,
        principal: principal,
        interest: interest,
        remaining: Math.max(0, remainingPrincipal)
      });
    }
  } 
  // 2. 等额本金计算法
  else if (loan.method === 'ACP') {
    const constantPrincipal = amount / term; // 每月应还本金固定不变

    for (let i = 1; i <= term; i++) {
      let interest = remainingPrincipal * monthlyRate; // 当月利息 = 剩余本金 * 月利率
      let payment = constantPrincipal + interest;      // 当月月供 = 固定本金 + 当月利息
      
      // 最后一期修正
      let principal = constantPrincipal;
      if (i === term) {
        principal = remainingPrincipal;
        payment = principal + interest;
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
        remaining: Math.max(0, remainingPrincipal)
      });
    }
  }

  return details;
}

/**
 * 辅助函数：根据首还年月和月份偏移量计算目标的年和月
 */
function getMonthYearOffset(startYear, startMonth, offsetMonths) {
  let year = parseInt(startYear);
  let month = parseInt(startMonth) + parseInt(offsetMonths);
  
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  
  return { year, month };
}

// ==========================================
// 3. 多笔时间线聚合合并算法 (Timeline Merger)
// ==========================================

/**
 * 全局合并计算：计算单笔，聚合到自然月时间轴，绘制图表，更新 UI
 */
function calculateAll() {
  if (loans.length === 0) {
    renderEmptyState();
    return;
  }

  // 1. 计算出每笔贷款的独立月度计划明细，并记录下来
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
        // 如果这笔贷款还没开始，或者已经还完
        // 我们需要找到它在当月之前的最后一期剩余本金，或者如果还没开始就是总额
        const isStarted = item.schedule.some(row => row.dateStr < dateStr);
        if (isStarted) {
          monthlyRemainingSum += 0; // 已还清，剩余本金为0
        } else {
          monthlyRemainingSum += (loans.find(l => l.id === item.loanId).amount * 10000); // 还没开始，本金还是总额
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

  // 计算全局的本金和利息累加
  loans.forEach(loan => {
    totalSumPrincipal += loan.amount;
    const schedule = calculateSingleLoan(loan);
    if (schedule.length > 0) {
      const singleInterestSum = schedule.reduce((sum, row) => sum + row.interest, 0);
      totalSumInterest += singleInterestSum / 10000; // 换算成万元
    }
  });

  // 4. 更新全局汇总面板的数据展示
  document.getElementById('sumPrincipal').innerText = `${totalSumPrincipal.toFixed(2)} 万元`;
  document.getElementById('sumInterest').innerText = `${totalSumInterest.toFixed(2)} 万元`;
  document.getElementById('sumTotal').innerText = `${(totalSumPrincipal + totalSumInterest).toFixed(2)} 万元`;
  
  if (monthlyAggregated.length > 0) {
    document.getElementById('sumFirstMonth').innerText = `${monthlyAggregated[0].payment.toFixed(2)} 元`;
    document.getElementById('sumPeakMonth').innerText = `${peakMonth} (${peakPayment.toFixed(2)}元)`;
  } else {
    document.getElementById('sumFirstMonth').innerText = '0.00 元';
    document.getElementById('sumPeakMonth').innerText = '-';
  }

  // 5. 渲染合并明细表格
  renderSummaryTable(monthlyAggregated);

  // 6. 重新渲染 Chart.js 堆叠趋势图
  renderTrendChart(sortedMonths, monthlyAggregated);

  // 如果当前选中的是某笔具体的贷款，则还需要同步更新这笔贷款对应的面板数据
  if (currentSelectedId !== 'summary') {
    const curLoan = loans.find(l => l.id === currentSelectedId);
    if (curLoan) {
      updateSingleLoanUI(curLoan);
    }
  }
}

// 渲染全局合并明细表格
function renderSummaryTable(data) {
  const tbody = document.getElementById('tableSummaryBody');
  tbody.innerHTML = '';
  
  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${row.dateStr}</strong></td>
      <td style="color:#000080; font-weight:bold;">${row.payment.toFixed(2)}</td>
      <td>${row.principal.toFixed(2)}</td>
      <td>${row.interest.toFixed(2)}</td>
      <td style="color:#808080;">${row.remaining.toFixed(2)}</td>
      <td style="font-size:10px;">${row.activeLoans}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// 4. Chart.js 经典像素风皮肤配置 (Retro System Monitor)
// ==========================================

function renderTrendChart(months, aggregatedData) {
  const ctx = document.getElementById('monthlyTrendChart').getContext('2d');
  
  if (trendChart) {
    trendChart.destroy(); // 销毁老图表
  }

  if (loans.length === 0 || months.length === 0) return;

  // 为不同的贷款准备不同的微软经典主题色彩 (极具 Win98 像素图标神韵)
  const retroColors = [
    { fill: '#000080', border: '#000000' }, // 经典微软深蓝
    { fill: '#008000', border: '#000000' }, // 经典森林绿
    { fill: '#800000', border: '#000000' }, // 经典铁锈红
    { fill: '#800080', border: '#000000' }, // 经典紫色
    { fill: '#008080', border: '#000000' }, // 青绿色
    { fill: '#808000', border: '#000000' }  /* 暗金泥土黄 */
  ];

  // 生成 Chart.js 所需的数据集 (Datasets)
  const datasets = loans.map((loan, index) => {
    const color = retroColors[index % retroColors.length];
    
    // 映射该笔贷款在每个月份的月供额
    const dataPoints = aggregatedData.map(row => {
      return row.breakdown[loan.id] || 0;
    });

    return {
      label: loan.name,
      data: dataPoints,
      backgroundColor: color.fill,
      borderColor: color.border,
      borderWidth: 1.5,
      barPercentage: 1.0,         // 让柱子挨得极紧，形成连贯的资源占用格栅效果
      categoryPercentage: 1.0,
      stack: 'combinedStack'      // 启动堆叠机制
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
      animation: false, // 关闭动画，追求 1998 年极速渲染的硬核感
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'Tahoma', size: 11, weight: 'bold' },
            color: '#000000',
            boxWidth: 12,
            boxHeight: 12,
            padding: 10
          }
        },
        tooltip: {
          backgroundColor: '#ffffcc', // 经典的黄色小提示窗 (Tooltip Balloon)
          titleColor: '#000000',
          titleFont: { family: 'Tahoma', size: 11, weight: 'bold' },
          bodyColor: '#000000',
          bodyFont: { family: 'Tahoma', size: 11 },
          borderColor: '#000000',
          borderWidth: 1,
          cornerRadius: 0, // 锐利直角
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${context.raw.toFixed(2)} 元`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            color: '#808080',
            borderDash: [1, 2], // 完美的点状像素虚线网格
            drawBorder: true,
            borderColor: '#000000'
          },
          ticks: {
            font: { family: 'Tahoma', size: 10 },
            color: '#000000',
            maxTicksLimit: window.innerWidth < 768 ? 8 : 24 // 自适应时间刻度限制，防挤爆
          }
        },
        y: {
          stacked: true,
          grid: {
            color: '#808080',
            borderDash: [1, 2],
            drawBorder: true,
            borderColor: '#000000'
          },
          ticks: {
            font: { family: 'Tahoma', size: 10 },
            color: '#000000',
            callback: function(value) {
              return value + '元';
            }
          }
        }
      }
    }
  });
}

// 无贷款时的空数据界面渲染
function renderEmptyState() {
  document.getElementById('sumPrincipal').innerText = '0.00 万元';
  document.getElementById('sumInterest').innerText = '0.00 万元';
  document.getElementById('sumTotal').innerText = '0.00 万元';
  document.getElementById('sumFirstMonth').innerText = '0.00 元';
  document.getElementById('sumPeakMonth').innerText = '-';
  document.getElementById('tableSummaryBody').innerHTML = '<tr><td colspan="6" style="text-align:center; color:#808080; padding:30px;">未发现活跃的配置文件。请在左侧点击“新增贷款...”创建您的第一笔贷款配置。</td></tr>';
  
  if (trendChart) {
    trendChart.destroy();
    trendChart = null;
  }
}

// ==========================================
// 5. 树形导航栏 (Tree Explorer) 渲染与交互
// ==========================================

function renderTreeView() {
  const container = document.getElementById('treeView');
  container.innerHTML = '';

  // 1. 全局汇总节点
  const sumNode = document.createElement('div');
  sumNode.className = `win-tree-item ${currentSelectedId === 'summary' ? 'selected' : ''}`;
  sumNode.innerHTML = `
    <span class="win-tree-item-icon">📊</span>
    <span>贷款组合汇总.sys</span>
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

  // 3. “新增贷款”伪节点
  const addNode = document.createElement('div');
  addNode.className = 'win-tree-item';
  addNode.style.marginTop = '10px';
  addNode.style.borderTop = '1px dotted var(--win-shadow)';
  addNode.style.paddingTop = '6px';
  
  if (loans.length >= 20) {
    addNode.style.opacity = '0.6';
    addNode.innerHTML = `
      <span class="win-tree-item-icon">❌</span>
      <span style="font-weight:bold; color:var(--win-shadow);">新增贷款... (已达20笔上限)</span>
    `;
  } else {
    addNode.innerHTML = `
      <span class="win-tree-item-icon">➕</span>
      <span style="font-weight:bold; color:#000080;">新增贷款.lnk</span>
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

  if (id === 'summary') {
    panelSummary.style.display = 'flex';
    panelDetail.style.display = 'none';
    windowTitle.innerText = '我的电脑 - 贷款组合管理器.exe';
    taskbarTitle.innerText = '📁 贷款组合管理器.cfg';
    calculateAll(); // 全局重算并画图
  } else {
    panelSummary.style.display = 'none';
    panelDetail.style.display = 'flex';
    
    const curLoan = loans.find(l => l.id === id);
    if (curLoan) {
      windowTitle.innerText = `属性 - ${curLoan.name}.cfg`;
      taskbarTitle.innerText = `📄 属性: ${curLoan.name}.cfg`;
      updateSingleLoanUI(curLoan);
    }
  }
}

// ==========================================
// 6. 单笔属性面板编辑与刷新 (Tab Controls)
// ==========================================

/**
 * 切换单笔贷款面板中的属性选项卡 (参数配置/还款计划表)
 */
function switchDetailTab(tabName) {
  currentDetailTab = tabName;
  const tabs = document.querySelectorAll('.win-tab');
  
  tabs[0].classList.toggle('active', tabName === 'params');
  tabs[1].classList.toggle('active', tabName === 'plan');
  
  document.getElementById('tabDetailParams').classList.toggle('active', tabName === 'params');
  document.getElementById('tabDetailPlan').classList.toggle('active', tabName === 'plan');

  if (currentSelectedId !== 'summary') {
    const curLoan = loans.find(l => l.id === currentSelectedId);
    if (curLoan && tabName === 'plan') {
      renderSingleRepayTable(curLoan);
    }
  }
}

/**
 * 同步单笔贷款的数据到表单 DOM
 */
function updateSingleLoanUI(loan) {
  document.getElementById('loanName').value = loan.name;
  document.getElementById('loanAmount').value = loan.amount || '';
  document.getElementById('loanRate').value = loan.rate || '';
  document.getElementById('loanTerm').value = loan.term || '';
  document.getElementById('loanStartYear').value = loan.startYear || '';
  document.getElementById('loanStartMonth').value = loan.startMonth || '';
  
  // 设置还款方式单选框
  const radios = document.getElementsByName('repayMethod');
  radios.forEach(radio => {
    radio.checked = radio.value === loan.method;
  });

  // 计算本笔的简易统计
  const schedule = calculateSingleLoan(loan);
  if (schedule.length > 0) {
    const sumTotal = schedule.reduce((sum, r) => sum + r.payment, 0);
    const sumInterest = schedule.reduce((sum, r) => sum + r.interest, 0);
    
    document.getElementById('detailSumTotal').innerText = `${sumTotal.toFixed(2)} 元`;
    document.getElementById('detailSumInterest').innerText = `${sumInterest.toFixed(2)} 元`;
    document.getElementById('detailFirstMonth').innerText = `${schedule[0].payment.toFixed(2)} 元`;
  } else {
    document.getElementById('detailSumTotal').innerText = '0.00 元';
    document.getElementById('detailSumInterest').innerText = '0.00 元';
    document.getElementById('detailFirstMonth').innerText = '0.00 元';
  }

  // 如果当前刚好在还款计划表标签页，也顺便重绘计划表
  if (currentDetailTab === 'plan') {
    renderSingleRepayTable(loan);
  }
}

/**
 * 渲染单笔还款明细计划表
 */
function renderSingleRepayTable(loan) {
  const tbody = document.getElementById('tableDetailBody');
  tbody.innerHTML = '';

  const schedule = calculateSingleLoan(loan);
  if (schedule.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#808080; padding:20px;">请输入完整有效的数值，以生成还款计划。</td></tr>';
    return;
  }

  schedule.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>第 ${row.period} 期</strong></td>
      <td>${row.dateStr}</td>
      <td style="color:#000080; font-weight:bold;">${row.payment.toFixed(2)}</td>
      <td>${row.principal.toFixed(2)}</td>
      <td>${row.interest.toFixed(2)}</td>
      <td style="color:#808080;">${row.remaining.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * 监听所有参数的输入变动 (零延迟实时计算的发动机)
 */
function handleParamChange() {
  if (currentSelectedId === 'summary') return;

  const loan = loans.find(l => l.id === currentSelectedId);
  if (!loan) return;

  // 抓取 DOM 中的最新数值，同步更新至内存状态
  const newName = document.getElementById('loanName').value.trim();
  loan.name = newName !== '' ? newName : '未命名贷款';

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

  const radios = document.getElementsByName('repayMethod');
  for (let r of radios) {
    if (r.checked) {
      loan.method = r.value;
      break;
    }
  }

  // 1. 同步更新树形目录中可能的重命名
  const matchingTreeItem = document.querySelector(`.win-tree-item.selected span:last-child`);
  if (matchingTreeItem) {
    matchingTreeItem.innerText = `${loan.name}.cfg`;
  }

  // 2. 局部更新属性指标
  const schedule = calculateSingleLoan(loan);
  if (schedule.length > 0) {
    const sumTotal = schedule.reduce((sum, r) => sum + r.payment, 0);
    const sumInterest = schedule.reduce((sum, r) => sum + r.interest, 0);
    document.getElementById('detailSumTotal').innerText = `${sumTotal.toFixed(2)} 元`;
    document.getElementById('detailSumInterest').innerText = `${sumInterest.toFixed(2)} 元`;
    document.getElementById('detailFirstMonth').innerText = `${schedule[0].payment.toFixed(2)} 元`;
  } else {
    document.getElementById('detailSumTotal').innerText = '0.00 元';
    document.getElementById('detailSumInterest').innerText = '0.00 元';
    document.getElementById('detailFirstMonth').innerText = '0.00 元';
  }

  if (currentDetailTab === 'plan') {
    renderSingleRepayTable(loan);
  }

  // 3. 反应式联动：自动将变更合流，刷新全局数据
  saveData();
}

// ==========================================
// 7. 新增、删除与重置功能
// ==========================================

/**
 * 动态“新增”贷款配置文件
 */
function createNewLoan() {
  // 防御性控制：最大支持 20 笔贷款配置
  if (loans.length >= 20) {
    alert('⚠️ 系统警报 (MAX_LIMIT_REACHED):\n\n当前装载的配置文件已达系统稳定运行上限 (20/20)。\n\n为避免系统性能过度损耗，请先销毁不必要的配置文件 (.cfg) 后再行创建。');
    return;
  }

  // 查找一个未被占用的“贷款 N”序列名称
  let count = 1;
  let newName = `贷款 ${loans.length + count}`;
  while (loans.some(l => l.name === newName)) {
    count++;
    newName = `贷款 ${loans.length + count}`;
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
    startMonth: new Date().getMonth() + 1
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
 * 销毁当前选中的单笔贷款
 */
function deleteCurrentLoan() {
  if (currentSelectedId === 'summary') return;
  
  const loanIndex = loans.findIndex(l => l.id === currentSelectedId);
  if (loanIndex === -1) return;

  const confirmMsg = `您确实要永久销毁并删除配置文件 "${loans[loanIndex].name}.cfg" 吗？此操作无法撤销。`;
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
  if (confirm('⚠️ 警告：您即将清除系统中的所有贷款配置文件。该操作将清空本地浏览器缓存（LocalStorage）。\n\n是否继续？')) {
    loans = [];
    saveData();
    currentSelectedId = 'summary';
    renderTreeView();
    selectTreeNode('summary');
    calculateAll();
  }
}

// ==========================================
// 8. 经典 Windows 98 界面动态交互
// ==========================================

// 任务栏小时钟动态走时
function startClock() {
  const clockEl = document.getElementById('systrayClock');
  
  function updateTime() {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    clockEl.innerText = `${hrs}:${mins}`;
  }
  
  updateTime();
  setInterval(updateTime, 1000); // 每秒校验走字
}

// 展开/收起底部开始菜单
function toggleStartMenu() {
  const menu = document.getElementById('startMenu');
  const btn = document.getElementById('startBtn');
  
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
  if (!menu.contains(e.target) && !btn.contains(e.target)) {
    menu.classList.remove('show');
    btn.classList.remove('active');
    document.removeEventListener('click', closeMenuOutside);
  }
}

// 帮助 -> 关于 对话框弹窗操作
function showAboutDialog() {
  document.getElementById('aboutDialogOverlay').classList.add('show');
}

function closeAboutDialog(e) {
  document.getElementById('aboutDialogOverlay').classList.remove('show');
}

// 最小化 / 恢复主窗口演示（通过收起高度或设置淡入淡出模拟）
let isWindowMinimized = false;
function minimizeOrRestoreMainWindow() {
  const windowEl = document.getElementById('mainWindow');
  const taskBtn = document.getElementById('taskbarTitle');

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

// 绑定全局点击事件，如果在编辑单笔贷款配置时点击了其他任何地方
// 确保数据已回写并同步重算（双保险，防止 input 没触发完）
document.addEventListener('focusout', function(e) {
  if (e.target && e.target.classList.contains('win-input')) {
    handleParamChange();
    calculateAll(); // 重新加载全局图表和数据
  }
});

// ==========================================
// 9. 智能跳转至用户的 GitHub 仓库地址
// ==========================================
function visitGitHub() {
  const hostname = window.location.hostname;
  let targetUrl = 'https://github.com';
  
  if (hostname.includes('.github.io')) {
    const username = hostname.split('.')[0];
    targetUrl = `https://github.com/${username}/Combined-Loan-Calculator`;
  } else {
    alert('📡 部署提示：\n\n当您将本项目 push 到 GitHub 并开启 GitHub Pages 后，此链接会自动识别并跳转到您专属的 GitHub 源码仓库！\n\n当前本地运行将为您打开 GitHub 主网。');
  }
  window.open(targetUrl, '_blank');
}

// ==========================================
// 10. 启动应用
// ==========================================
window.onload = initApp;
