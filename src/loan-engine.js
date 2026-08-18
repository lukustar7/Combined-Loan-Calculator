/**
 * 贷款计算领域核心。
 *
 * 本文件只处理数据清洗和数学计算，不读取 DOM、LocalStorage 或主题状态。
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
 * 核心模块的兜底单笔贷款。
 */
export const DEFAULT_LOAN = Object.freeze({
  id: 'loan_1',
  name: '商业房贷 1',
  amount: 1_000_000,
  rate: 3.15,
  method: 'ACPI',
  term: 360,
  startYear: 2026,
  startMonth: 8,
  prepayments: []
});

/**
 * 典型房贷组合（公积金 + 商业贷款）出厂模板。
 */
export const DEFAULT_MORTGAGE_COMBO = Object.freeze([
  {
    id: 'loan_gjj',
    name: '公积金房贷',
    amount: 800_000,
    rate: 2.85,
    method: 'ACPI',
    term: 360,
    startYear: 2026,
    startMonth: 8,
    prepayments: []
  },
  {
    id: 'loan_comm',
    name: '商业房贷',
    amount: 1_200_000,
    rate: 3.15,
    method: 'ACPI',
    term: 360,
    startYear: 2026,
    startMonth: 8,
    prepayments: []
  }
]);

/**
 * 20 种高对比度复古与现代通用调色板，彻底防止多笔贷款堆叠图同色粘连。
 */
export const PALETTE_20 = Object.freeze([
  { fill: '#000080', border: '#000050', m3Fill: '#0b57d0', m3Border: '#0041a2' }, // 经典微软深蓝 / M3 极光蓝
  { fill: '#008000', border: '#005000', m3Fill: '#146c2e', m3Border: '#0b5020' }, // 森林绿 / M3 翡翠绿
  { fill: '#800000', border: '#500000', m3Fill: '#ba1a1a', m3Border: '#93000a' }, // 铁锈红 / M3 砖红
  { fill: '#800080', border: '#500050', m3Fill: '#6750a4', m3Border: '#4f378b' }, // 紫色 / M3 深度紫
  { fill: '#008080', border: '#005050', m3Fill: '#006874', m3Border: '#004f58' }, // 青绿 / M3 蓝青
  { fill: '#800000', border: '#505000', m3Fill: '#7a5900', m3Border: '#5d4300' }, // 暗金泥黄 / M3 琥珀
  { fill: '#1b365d', border: '#0d1b2f', m3Fill: '#4a6572', m3Border: '#344955' }, // 藏青灰
  { fill: '#b33939', border: '#801e1e', m3Fill: '#c05621', m3Border: '#9c4221' }, // 珊瑚朱红
  { fill: '#218c74', border: '#145a4a', m3Fill: '#2e7d32', m3Border: '#1b5e20' }, // 薄荷深绿
  { fill: '#8c1464', border: '#5a0a3e', m3Fill: '#9c27b0', m3Border: '#7b1fa2' }, // 玫瑰品红
  { fill: '#2c2c54', border: '#181830', m3Fill: '#3f51b5', m3Border: '#283593' }, // 极夜蓝靛
  { fill: '#aa6c39', border: '#6e4420', m3Fill: '#d97706', m3Border: '#b45309' }, // 铜棕金
  { fill: '#10ac84', border: '#0a6c52', m3Fill: '#059669', m3Border: '#047857' }, // 亮绿松石
  { fill: '#3742fa', border: '#1f2596', m3Fill: '#2563eb', m3Border: '#1d4ed8' }, // 钴蓝
  { fill: '#ff4757', border: '#b8202d', m3Fill: '#e11d48', m3Border: '#be123c' }, // 茜红
  { fill: '#70a1ff', border: '#3a66bf', m3Fill: '#0284c7', m3Border: '#0369a1' }, // 晴空蓝
  { fill: '#2ed573', border: '#188243', m3Fill: '#16a34a', m3Border: '#15803d' }, // 翠叶绿
  { fill: '#ffa502', border: '#b87400', m3Fill: '#ea580c', m3Border: '#c2410c' }, // 暖橙
  { fill: '#57606f', border: '#2f3542', m3Fill: '#475569', m3Border: '#334155' }, // 铁板灰
  { fill: '#5352ed', border: '#292896', m3Fill: '#7c3aed', m3Border: '#6d28d9' }  // 鸢尾蓝紫
]);

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
 * 清洗一笔贷款并兼容旧版单次提前还款字段。
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

  // 兼容旧版单次提前还款字段
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
 * 修复重复 ID。
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
 */
export function sanitizeLoans(rawLoans, options = {}) {
  const configuredDefaults = Array.isArray(options.defaultLoans) && options.defaultLoans.length > 0
    ? options.defaultLoans
    : [DEFAULT_LOAN];
  const fallbackOptions = {
    defaultLoan: configuredDefaults[0],
    defaultNamePrefix: options.defaultNamePrefix || '贷款'
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
 * 统一创建还款明细行。
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
 * 计算提前还款的综合省息效益与缩短月数。
 */
export function calculatePrepaymentSavings(rawLoan) {
  const loan = sanitizeLoan(rawLoan, 0);
  if (!loan || loan.amount <= 0 || loan.term <= 0) {
    return {
      savedInterest: 0,
      savedMonths: 0,
      originalTotalInterest: 0,
      actualTotalInterest: 0,
      originalTerm: 0,
      actualTerm: 0
    };
  }

  const baselineLoan = { ...loan, prepayments: [] };
  const baselineSchedule = calculateSingleLoan(baselineLoan);
  const actualSchedule = calculateSingleLoan(loan);

  const originalTotalInterest = baselineSchedule.reduce((sum, r) => sum + r.interest, 0);
  const actualTotalInterest = actualSchedule.reduce((sum, r) => sum + r.interest, 0);
  const savedInterest = Math.max(0, originalTotalInterest - actualTotalInterest);

  const originalTerm = baselineSchedule.length;
  const actualTerm = actualSchedule.length;
  const savedMonths = Math.max(0, originalTerm - actualTerm);

  return {
    savedInterest,
    savedMonths,
    originalTotalInterest,
    actualTotalInterest,
    originalTerm,
    actualTerm
  };
}

/**
 * 将数字转换为人民币大写汉字。
 * 遵循银行财务规范：例如 1500000 -> 壹佰伍拾万元整。
 */
export function numberToChineseUppercase(value) {
  const num = toFiniteNumber(value, 0);
  if (num <= 0) return '零元整';
  if (num > MAX_LOAN_AMOUNT) return '金额超限';

  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const radices = ['', '拾', '佰', '仟'];
  const bigRadices = ['', '万', '亿', '万亿'];

  const totalFen = Math.round((num + Number.EPSILON) * 100);
  const yuan = Math.floor(totalFen / 100);
  const jiao = Math.floor((totalFen % 100) / 10);
  const fen = totalFen % 10;

  let result = '';

  if (yuan > 0) {
    let strYuan = String(yuan);
    let len = strYuan.length;
    let sectionCount = Math.ceil(len / 4);

    for (let i = 0; i < sectionCount; i++) {
      let sectionLen = (len % 4 === 0) ? 4 : (len % 4);
      if (i > 0) sectionLen = 4;
      let sectionStart = (i === 0) ? 0 : (len % 4 === 0 ? i * 4 : (len % 4) + (i - 1) * 4);
      let section = strYuan.slice(sectionStart, sectionStart + sectionLen);
      let sectionUnit = bigRadices[sectionCount - 1 - i];

      let sectionStr = '';
      let hasNonZero = false;
      let prevZero = false;

      for (let j = 0; j < section.length; j++) {
        let digit = Number(section[j]);
        let pos = section.length - 1 - j;
        if (digit === 0) {
          prevZero = true;
        } else {
          if (prevZero && hasNonZero) {
            sectionStr += digits[0];
          }
          sectionStr += digits[digit] + radices[pos];
          hasNonZero = true;
          prevZero = false;
        }
      }

      if (hasNonZero) {
        if (i > 0 && Number(section[0]) === 0) {
          result += digits[0];
        }
        result += sectionStr + sectionUnit;
      }
    }
    result += '元';
  } else {
    result = '零元';
  }

  if (jiao === 0 && fen === 0) {
    result += '整';
  } else if (jiao > 0 && fen === 0) {
    result += digits[jiao] + '角整';
  } else if (jiao > 0 && fen > 0) {
    result += digits[jiao] + '角' + digits[fen] + '分';
  } else if (jiao === 0 && fen > 0) {
    result += '零' + digits[fen] + '分';
  }

  result = result
    .replace(/零+/g, '零')
    .replace(/零万/g, '万')
    .replace(/零亿/g, '亿')
    .replace(/亿万/g, '亿零')
    .replace(/零元零/g, '零元零')
    .replace(/^零元零(?=[壹贰叁肆伍陆柒捌玖]分)/, '零元零');

  return result || '零元整';
}

/**
 * 将金额转换为“分”后比较。
 */
function toMinorUnits(amount) {
  return Math.round((amount + Number.EPSILON) * 100);
}

/**
 * 合并多笔贷款到统一自然月时间轴。
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
 * 构造稳定的空组合结果。
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
