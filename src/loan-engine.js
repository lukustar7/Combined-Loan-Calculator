/**
 * 贷款计算领域核心。
 *
 * 本文件只处理数据清洗和数学计算，不读取 DOM、LocalStorage、语言或主题状态。
 * 保持“纯计算”边界后，浏览器页面和自动化测试会共同调用同一套公式，避免两套逻辑逐渐偏离。
 */

export const MAX_LOANS = 20;
export const MAX_LOAN_AMOUNT = 1_000_000_000_000;
export const MAX_RATE_PERCENT = 100;
export const MAX_LOAN_TERM_MONTHS = 3_600;
export const MIN_START_YEAR = 1990;
export const MAX_START_YEAR = 2100;
export const MAX_LOAN_NAME_LENGTH = 80;
export const MAX_LOAN_ID_LENGTH = 48;

// 浮点计算可能留下远小于一分钱的尾数。这里只忽略数学噪声，不吞掉真实的一分钱余额。
const BALANCE_EPSILON = 1e-8;

/**
 * 核心模块的兜底贷款。
 * 页面可以通过 options.defaultLoan 传入自己的默认值，因此这里不会反向依赖界面层。
 */
export const DEFAULT_LOAN = Object.freeze({
  id: 'loan_1',
  name: '贷款 1',
  amount: 1_000_000,
  rate: 3.5,
  method: 'ACPI',
  term: 360,
  startYear: 2026,
  startMonth: 6,
  prepayments: []
});

/**
 * 将外部输入转换为有限数字。
 * 空字符串、NaN 和 Infinity 都不能进入贷款公式，否则一个坏值会污染整张还款表。
 */
export function toFiniteNumber(value, fallback = 0) {
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

/**
 * 把数字限制在业务允许的闭区间内。
 * HTML 的 min/max 只约束正常手输，这一层还负责拦截旧缓存和控制台注入的异常值。
 */
export function clampNumber(value, min, max, fallback = min) {
  const numericValue = toFiniteNumber(value, fallback);
  return Math.min(max, Math.max(min, numericValue));
}

/**
 * 把期数、年份和月份转换成合法整数。
 */
export function clampInteger(value, min, max, fallback = min) {
  const numericValue = Math.trunc(toFiniteNumber(value, fallback));
  return Math.min(max, Math.max(min, numericValue));
}

/**
 * 清洗贷款名称，去掉不可见控制字符并限制长度。
 */
export function sanitizeLoanName(value, fallback = '未命名贷款') {
  const rawText = typeof value === 'string' ? value : '';
  const cleanText = rawText.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleanText) return fallback;
  return cleanText.slice(0, MAX_LOAN_NAME_LENGTH);
}

/**
 * 清洗内部贷款 ID。
 * ID 会作为图表数据对象的键，因此只允许普通字母、数字、下划线和连字符。
 */
export function sanitizeLoanId(value, fallback) {
  const rawText = typeof value === 'string' ? value : '';
  const cleanText = rawText.replace(/[^A-Za-z0-9_-]/g, '').slice(0, MAX_LOAN_ID_LENGTH);
  if (!cleanText || cleanText === '__proto__' || cleanText === 'constructor' || cleanText === 'prototype') {
    return fallback;
  }
  return cleanText;
}

/**
 * 清洗提前还款列表。
 * 同一期只保留第一条记录，并剔除最后一期及期限外配置，避免一笔本金被重复扣减。
 */
export function sanitizePrepayments(rawPrepayments, loanTerm = MAX_LOAN_TERM_MONTHS) {
  if (!Array.isArray(rawPrepayments)) return [];

  const seenPeriods = new Set();
  const safeTerm = clampInteger(loanTerm, 0, MAX_LOAN_TERM_MONTHS, MAX_LOAN_TERM_MONTHS);
  const sanitized = [];

  rawPrepayments.forEach(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;

    const period = clampInteger(item.period, 1, MAX_LOAN_TERM_MONTHS, 0);
    const amount = clampNumber(item.amount, 0, MAX_LOAN_AMOUNT, 0);
    const method = item.method === 'reduce' ? 'reduce' : 'shrink';

    if (period <= 0 || amount <= 0 || (safeTerm > 0 && period >= safeTerm) || seenPeriods.has(period)) {
      return;
    }

    seenPeriods.add(period);
    sanitized.push({ period, amount, method });
  });

  sanitized.sort((a, b) => a.period - b.period);
  return sanitized;
}

/**
 * 清洗一笔贷款并迁移旧版单次提前还款字段。
 * options 让页面按当前语言提供默认名称，同时保持核心模块不感知国际化状态。
 */
export function sanitizeLoan(rawLoan, index = 0, options = {}) {
  const safeIndex = Math.max(0, Math.trunc(index));
  const configuredDefault = options.defaultLoan && typeof options.defaultLoan === 'object'
    ? options.defaultLoan
    : DEFAULT_LOAN;
  const fallbackLoan = { ...DEFAULT_LOAN, ...configuredDefault };
  const source = rawLoan && typeof rawLoan === 'object' && !Array.isArray(rawLoan) ? rawLoan : {};
  const defaultNamePrefix = sanitizeLoanName(options.defaultNamePrefix, '贷款');
  const fallbackName = `${defaultNamePrefix} ${safeIndex + 1}`;
  const term = clampInteger(source.term, 0, MAX_LOAN_TERM_MONTHS, fallbackLoan.term);
  const prepayments = sanitizePrepayments(source.prepayments, term);

  // 兼容 2.2.0 之前的单次提前还款字段；迁移结果统一写入 prepayments 数组。
  const oldPeriod = clampInteger(source.prepayPeriod, 1, MAX_LOAN_TERM_MONTHS, 0);
  const oldAmount = clampNumber(source.prepayAmount, 0, MAX_LOAN_AMOUNT, 0);
  if (oldPeriod > 0 && oldAmount > 0 && (term <= 0 || oldPeriod < term)) {
    const exists = prepayments.some(item => item.period === oldPeriod);
    if (!exists) {
      prepayments.push({
        period: oldPeriod,
        amount: oldAmount,
        method: source.prepayMethod === 'reduce' ? 'reduce' : 'shrink'
      });
      prepayments.sort((a, b) => a.period - b.period);
    }
  }

  return {
    id: sanitizeLoanId(source.id, `loan_${safeIndex + 1}`),
    name: sanitizeLoanName(source.name, fallbackName),
    amount: clampNumber(source.amount, 0, MAX_LOAN_AMOUNT, fallbackLoan.amount),
    rate: clampNumber(source.rate, 0, MAX_RATE_PERCENT, fallbackLoan.rate),
    method: source.method === 'ACP' ? 'ACP' : 'ACPI',
    term,
    startYear: clampInteger(source.startYear, MIN_START_YEAR, MAX_START_YEAR, fallbackLoan.startYear),
    startMonth: clampInteger(source.startMonth, 1, 12, fallbackLoan.startMonth),
    prepayments
  };
}

/**
 * 修复重复 ID，并确保追加序号后仍不超过 ID 长度上限。
 */
function ensureUniqueLoanIds(sanitizedLoans) {
  const usedIds = new Set();

  return sanitizedLoans.map((loan, index) => {
    const baseId = loan.id || `loan_${index + 1}`;
    let nextId = baseId;
    let suffix = 2;

    while (usedIds.has(nextId)) {
      const suffixText = `_${suffix}`;
      nextId = `${baseId.slice(0, MAX_LOAN_ID_LENGTH - suffixText.length)}${suffixText}`;
      suffix += 1;
    }

    usedIds.add(nextId);
    return { ...loan, id: nextId };
  });
}

/**
 * 清洗贷款数组。
 * 非数组、空数组会恢复默认贷款；这是页面启动和“清空数据”流程需要的既有行为。
 */
export function sanitizeLoans(rawLoans, options = {}) {
  const configuredDefaults = Array.isArray(options.defaultLoans) && options.defaultLoans.length > 0
    ? options.defaultLoans
    : [DEFAULT_LOAN];
  const fallbackOptions = {
    defaultLoan: configuredDefaults[0],
    defaultNamePrefix: options.defaultNamePrefix
  };

  const sanitizeDefaults = () => ensureUniqueLoanIds(
    configuredDefaults.slice(0, MAX_LOANS).map((loan, index) => sanitizeLoan(loan, index, fallbackOptions))
  );

  if (!Array.isArray(rawLoans)) return sanitizeDefaults();

  const sanitized = ensureUniqueLoanIds(
    rawLoans.slice(0, MAX_LOANS).map((loan, index) => sanitizeLoan(loan, index, fallbackOptions))
  );
  return sanitized.length > 0 ? sanitized : sanitizeDefaults();
}

/**
 * 根据首还年月和月份偏移量计算目标年月，时间复杂度为 O(1)。
 */
export function getMonthYearOffset(startYear, startMonth, offsetMonths) {
  const year = clampInteger(startYear, MIN_START_YEAR, MAX_START_YEAR, DEFAULT_LOAN.startYear);
  const normalizedMonth = clampInteger(startMonth, 1, 12, DEFAULT_LOAN.startMonth) - 1;
  const safeOffset = clampInteger(offsetMonths, 0, MAX_LOAN_TERM_MONTHS, 0);
  const totalMonths = normalizedMonth + safeOffset;

  return {
    year: year + Math.floor(totalMonths / 12),
    month: (totalMonths % 12) + 1
  };
}

/**
 * 计算等额本息月供。
 * 使用 log1p/expm1 保留极低利率下的有效小数，避免普通幂公式出现 0/0 和 NaN。
 */
function calculateAnnuityPayment(principal, monthlyRate, term) {
  if (monthlyRate === 0) return principal / term;

  const growthMinusOne = Math.expm1(term * Math.log1p(monthlyRate));
  const growth = growthMinusOne + 1;
  return principal * (monthlyRate * growth) / growthMinusOne;
}

/**
 * 生成一笔贷款的逐月还款计划。
 * 提前还款发生在当期常规还款之后：shrink 保持月供并缩短期限，reduce 保持期限并降低后续月供。
 */
export function calculateSingleLoan(rawLoan) {
  const loan = sanitizeLoan(rawLoan, 0);
  const amount = loan.amount;
  const monthlyRate = loan.rate / 100 / 12;
  const term = loan.term;

  if (amount <= 0 || term <= 0) return [];

  const prepaymentMap = new Map(loan.prepayments.map(item => [item.period, item]));
  const details = [];
  let remainingPrincipal = amount;

  if (loan.method === 'ACPI') {
    let monthlyRepayment = calculateAnnuityPayment(amount, monthlyRate, term);

    for (let period = 1; period <= term; period += 1) {
      if (remainingPrincipal <= BALANCE_EPSILON) break;

      let interest = remainingPrincipal * monthlyRate;
      // 极高利率和超长期限下，理论首期本金可能小于浮点精度；差值若出现微小负数必须归零。
      let principal = Math.max(0, monthlyRepayment - interest);
      let extraPrepay = 0;
      let isLastPeriod = false;

      if (period === term || remainingPrincipal - principal <= BALANCE_EPSILON) {
        principal = remainingPrincipal;
        interest = remainingPrincipal * monthlyRate;
        isLastPeriod = true;
      }

      let payment = principal + interest;
      const prepayItem = prepaymentMap.get(period);

      if (prepayItem && prepayItem.amount > 0 && !isLastPeriod) {
        const availablePrincipal = Math.max(0, remainingPrincipal - principal);
        extraPrepay = Math.min(prepayItem.amount, availablePrincipal);
        principal += extraPrepay;
        payment += extraPrepay;
      }

      remainingPrincipal = Math.max(0, remainingPrincipal - principal);

      if (prepayItem?.method === 'reduce' && extraPrepay > 0) {
        const remainingPeriods = term - period;
        if (remainingPeriods > 0 && remainingPrincipal > BALANCE_EPSILON) {
          monthlyRepayment = calculateAnnuityPayment(remainingPrincipal, monthlyRate, remainingPeriods);
        }
      }

      details.push(createScheduleRow(loan, period, payment, principal, interest, remainingPrincipal, extraPrepay));
    }
  } else {
    let constantPrincipal = amount / term;

    for (let period = 1; period <= term; period += 1) {
      if (remainingPrincipal <= BALANCE_EPSILON) break;

      let interest = remainingPrincipal * monthlyRate;
      let principal = constantPrincipal;
      let extraPrepay = 0;
      let isLastPeriod = false;

      if (period === term || remainingPrincipal - principal <= BALANCE_EPSILON) {
        principal = remainingPrincipal;
        interest = remainingPrincipal * monthlyRate;
        isLastPeriod = true;
      }

      let payment = principal + interest;
      const prepayItem = prepaymentMap.get(period);

      if (prepayItem && prepayItem.amount > 0 && !isLastPeriod) {
        const availablePrincipal = Math.max(0, remainingPrincipal - principal);
        extraPrepay = Math.min(prepayItem.amount, availablePrincipal);
        principal += extraPrepay;
        payment += extraPrepay;
      }

      remainingPrincipal = Math.max(0, remainingPrincipal - principal);

      if (prepayItem?.method === 'reduce' && extraPrepay > 0) {
        const remainingPeriods = term - period;
        if (remainingPeriods > 0 && remainingPrincipal > BALANCE_EPSILON) {
          constantPrincipal = remainingPrincipal / remainingPeriods;
        }
      }

      details.push(createScheduleRow(loan, period, payment, principal, interest, remainingPrincipal, extraPrepay));
    }
  }

  return details;
}

/**
 * 统一创建还款明细行，保证两种还款方式输出完全相同的数据结构。
 */
function createScheduleRow(loan, period, payment, principal, interest, remaining, prepay) {
  const date = getMonthYearOffset(loan.startYear, loan.startMonth, period - 1);
  return {
    period,
    year: date.year,
    month: date.month,
    dateStr: `${date.year}-${String(date.month).padStart(2, '0')}`,
    payment,
    principal,
    interest,
    remaining,
    prepay
  };
}

/**
 * 将金额转换为“分”后比较。
 * 金额上限与贷款数量上限共同保证结果仍处在 JavaScript 安全整数范围内。
 */
function toMinorUnits(amount) {
  return Math.round((amount + Number.EPSILON) * 100);
}

/**
 * 合并多笔贷款到统一自然月时间轴。
 * 返回值同时包含页面汇总指标和图表/表格需要的逐月数据。
 */
export function aggregateLoanPortfolio(rawLoans) {
  if (!Array.isArray(rawLoans) || rawLoans.length === 0) {
    return createEmptyPortfolioResult();
  }

  const safeLoans = ensureUniqueLoanIds(
    rawLoans.slice(0, MAX_LOANS).map((loan, index) => sanitizeLoan(loan, index))
  );
  const loanSchedules = safeLoans.map(loan => {
    const schedule = calculateSingleLoan(loan);
    return {
      loan,
      schedule,
      scheduleByMonth: new Map(schedule.map(row => [row.dateStr, row])),
      firstMonth: schedule[0]?.dateStr ?? null,
      lastMonth: schedule.at(-1)?.dateStr ?? null
    };
  });

  const months = Array.from(new Set(
    loanSchedules.flatMap(item => item.schedule.map(row => row.dateStr))
  )).sort();
  const monthly = [];
  let peakPaymentMinor = -1;
  let peakPayment = 0;
  let peakMonth = '-';

  months.forEach(dateStr => {
    let payment = 0;
    let principal = 0;
    let interest = 0;
    let remaining = 0;
    const activeLoanNames = [];
    const breakdown = Object.create(null);

    loanSchedules.forEach(item => {
      const row = item.scheduleByMonth.get(dateStr);
      const { loan } = item;

      if (row) {
        payment += row.payment;
        principal += row.principal;
        interest += row.interest;
        remaining += row.remaining;
        activeLoanNames.push(loan.name);
        breakdown[loan.id] = row.payment - row.prepay;
        breakdown[`${loan.id}_prepay`] = row.prepay;
        return;
      }

      breakdown[loan.id] = 0;
      breakdown[`${loan.id}_prepay`] = 0;
      if (item.firstMonth && dateStr < item.firstMonth) {
        remaining += loan.amount;
      }
    });

    // 按“分”判断相等金额；相同月供保留最早月份，避免浮点尾差把峰值推到最后一期。
    const paymentMinor = toMinorUnits(payment);
    if (paymentMinor > peakPaymentMinor) {
      peakPaymentMinor = paymentMinor;
      peakPayment = paymentMinor / 100;
      peakMonth = dateStr;
    }

    monthly.push({
      dateStr,
      payment,
      principal,
      interest,
      remaining,
      activeLoans: activeLoanNames.join(', '),
      activeLoanNames,
      breakdown
    });
  });

  const totalPrincipal = safeLoans.reduce((sum, loan) => sum + loan.amount, 0);
  const totalInterest = loanSchedules.reduce((portfolioSum, item) => (
    portfolioSum + item.schedule.reduce((loanSum, row) => loanSum + row.interest, 0)
  ), 0);

  return {
    loans: safeLoans,
    loanSchedules,
    months,
    monthly,
    totalPrincipal,
    totalInterest,
    totalPayment: totalPrincipal + totalInterest,
    firstMonthPayment: monthly[0]?.payment ?? 0,
    peakPayment,
    peakMonth
  };
}

/**
 * 构造稳定的空组合结果，页面无需为缺字段单独分支。
 */
function createEmptyPortfolioResult() {
  return {
    loans: [],
    loanSchedules: [],
    months: [],
    monthly: [],
    totalPrincipal: 0,
    totalInterest: 0,
    totalPayment: 0,
    firstMonthPayment: 0,
    peakPayment: 0,
    peakMonth: '-'
  };
}

/**
 * 将月度组合数据汇总为年度图表数据。
 * activeLoanNames 保留原始名称数组，贷款名包含逗号时也不会被错误拆成多笔贷款。
 */
export function getAnnualAggregatedData(monthlyData) {
  if (!Array.isArray(monthlyData) || monthlyData.length === 0) return [];

  const annualMap = new Map();

  monthlyData.forEach(row => {
    if (!row || typeof row.dateStr !== 'string') return;
    const year = row.dateStr.slice(0, 4);

    if (!annualMap.has(year)) {
      annualMap.set(year, {
        dateStr: year,
        payment: 0,
        principal: 0,
        interest: 0,
        remaining: 0,
        activeLoanNames: new Set(),
        breakdown: Object.create(null)
      });
    }

    const annualRow = annualMap.get(year);
    annualRow.payment += toFiniteNumber(row.payment, 0);
    annualRow.principal += toFiniteNumber(row.principal, 0);
    annualRow.interest += toFiniteNumber(row.interest, 0);
    annualRow.remaining = toFiniteNumber(row.remaining, 0);

    const names = Array.isArray(row.activeLoanNames)
      ? row.activeLoanNames
      : String(row.activeLoans || '').split(', ').filter(Boolean);
    names.forEach(name => annualRow.activeLoanNames.add(name));

    if (row.breakdown && typeof row.breakdown === 'object') {
      Object.keys(row.breakdown).forEach(key => {
        annualRow.breakdown[key] = (annualRow.breakdown[key] || 0) + toFiniteNumber(row.breakdown[key], 0);
      });
    }
  });

  return Array.from(annualMap.values())
    .map(row => ({
      ...row,
      activeLoans: Array.from(row.activeLoanNames).join(', '),
      activeLoanNames: Array.from(row.activeLoanNames)
    }))
    .sort((a, b) => Number(a.dateStr) - Number(b.dateStr));
}
