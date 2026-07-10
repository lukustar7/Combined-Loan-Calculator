import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_LOANS,
  MAX_LOAN_AMOUNT,
  MAX_LOAN_TERM_MONTHS,
  aggregateLoanPortfolio,
  calculateSingleLoan,
  getAnnualAggregatedData,
  getMonthYearOffset,
  sanitizeLoan,
  sanitizeLoans
} from '../src/loan-engine.js';

/**
 * 财务公式会产生正常的浮点尾差，断言时只允许指定范围内的误差。
 * 这比把所有结果先四舍五入更严格，可以发现本金没有真正结清的问题。
 */
function assertClose(actual, expected, tolerance = 1e-7) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `期望 ${expected}，实际 ${actual}，允许误差 ${tolerance}`
  );
}

function createLoan(overrides = {}) {
  return {
    id: 'loan_test',
    name: '测试贷款',
    amount: 100_000,
    rate: 12,
    method: 'ACPI',
    term: 12,
    startYear: 2026,
    startMonth: 1,
    prepayments: [],
    ...overrides
  };
}

test('年月偏移跨年后保持正确的自然月', () => {
  assert.deepEqual(getMonthYearOffset(2026, 12, 0), { year: 2026, month: 12 });
  assert.deepEqual(getMonthYearOffset(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(getMonthYearOffset(2026, 1, 3599), { year: 2325, month: 12 });
});

test('数据清洗限制数量、数值、危险 ID 和重复提前还款', () => {
  const rawLoans = Array.from({ length: MAX_LOANS + 5 }, (_, index) => ({
    id: index < 2 ? '__proto__' : 'same-id',
    name: `\u0000贷款 ${index + 1}`,
    amount: index === 0 ? Number.POSITIVE_INFINITY : MAX_LOAN_AMOUNT + 1,
    rate: -5,
    method: 'unknown',
    term: MAX_LOAN_TERM_MONTHS + 99,
    startYear: 9999,
    startMonth: 99,
    prepayments: [
      { period: 3, amount: 5000, method: 'reduce' },
      { period: 3, amount: 9000, method: 'shrink' },
      { period: MAX_LOAN_TERM_MONTHS, amount: 1000, method: 'shrink' }
    ]
  }));

  const sanitized = sanitizeLoans(rawLoans);
  assert.equal(sanitized.length, MAX_LOANS);
  assert.equal(new Set(sanitized.map(loan => loan.id)).size, MAX_LOANS);
  assert.ok(sanitized.every(loan => loan.id.length <= 48));
  assert.equal(sanitized[0].amount, 1_000_000);
  assert.equal(sanitized[1].amount, MAX_LOAN_AMOUNT);
  assert.equal(sanitized[0].rate, 0);
  assert.equal(sanitized[0].method, 'ACPI');
  assert.equal(sanitized[0].term, MAX_LOAN_TERM_MONTHS);
  assert.deepEqual(sanitized[0].prepayments, [{ period: 3, amount: 5000, method: 'reduce' }]);
});

test('旧版单次提前还款字段会迁移到新数组', () => {
  const loan = sanitizeLoan(createLoan({
    prepayPeriod: 4,
    prepayAmount: 12_000,
    prepayMethod: 'reduce'
  }));

  assert.deepEqual(loan.prepayments, [{ period: 4, amount: 12_000, method: 'reduce' }]);
  assert.equal('prepayPeriod' in loan, false);
});

test('等额本息已知案例按 12 期结清且本息正确', () => {
  const schedule = calculateSingleLoan(createLoan());

  assert.equal(schedule.length, 12);
  assertClose(schedule[0].payment, 8884.878867834172);
  assertClose(schedule.reduce((sum, row) => sum + row.principal, 0), 100_000);
  assertClose(schedule.reduce((sum, row) => sum + row.interest, 0), 6618.546414010049);
  assert.equal(schedule.at(-1).remaining, 0);
});

test('等额本金的本金固定、利息递减并在末期结清', () => {
  const schedule = calculateSingleLoan(createLoan({
    amount: 12_000,
    method: 'ACP'
  }));

  assert.equal(schedule.length, 12);
  assertClose(schedule[0].payment, 1120);
  assertClose(schedule[1].payment, 1110);
  assertClose(schedule.at(-1).payment, 1010);
  assertClose(schedule.reduce((sum, row) => sum + row.principal, 0), 12_000);
  assert.equal(schedule.at(-1).remaining, 0);
});

test('零利率和极低利率都不会产生 NaN 或 Infinity', () => {
  const zeroRate = calculateSingleLoan(createLoan({ amount: 12_000, rate: 0 }));
  const tinyRate = calculateSingleLoan(createLoan({ rate: 1e-12 }));

  assert.ok(zeroRate.every(row => row.payment === 1000 && row.interest === 0));
  assert.ok(tinyRate.every(row => Object.values(row).every(value => (
    typeof value !== 'number' || Number.isFinite(value)
  ))));
  assertClose(tinyRate.reduce((sum, row) => sum + row.principal, 0), 100_000, 1e-6);
});

test('提前还款的缩短期限和减少月供采用不同后续策略', () => {
  const baseLoan = createLoan({ rate: 6, term: 24 });
  const baseline = calculateSingleLoan(baseLoan);
  const shrink = calculateSingleLoan({
    ...baseLoan,
    prepayments: [{ period: 6, amount: 20_000, method: 'shrink' }]
  });
  const reduce = calculateSingleLoan({
    ...baseLoan,
    prepayments: [{ period: 6, amount: 20_000, method: 'reduce' }]
  });

  assert.equal(shrink[5].prepay, 20_000);
  assert.equal(reduce[5].prepay, 20_000);
  assert.ok(shrink.length < baseline.length);
  assert.equal(reduce.length, baseline.length);
  assert.ok(reduce[6].payment < baseline[6].payment);
  assert.ok(shrink.reduce((sum, row) => sum + row.interest, 0) < baseline.reduce((sum, row) => sum + row.interest, 0));
  assert.ok(reduce.reduce((sum, row) => sum + row.interest, 0) < baseline.reduce((sum, row) => sum + row.interest, 0));
  assertClose(shrink.reduce((sum, row) => sum + row.principal, 0), 100_000);
  assertClose(reduce.reduce((sum, row) => sum + row.principal, 0), 100_000);
});

test('组合汇总正确处理错峰贷款和尚未开始的本金', () => {
  const portfolio = aggregateLoanPortfolio([
    createLoan({
      id: 'main',
      name: '主贷',
      amount: 1200,
      rate: 0,
      term: 12,
      startMonth: 1
    }),
    createLoan({
      id: 'car',
      name: '车贷',
      amount: 600,
      rate: 0,
      term: 6,
      startMonth: 3
    })
  ]);

  assert.equal(portfolio.months.length, 12);
  assert.equal(portfolio.monthly[0].dateStr, '2026-01');
  assertClose(portfolio.monthly[0].payment, 100);
  assertClose(portfolio.monthly[0].remaining, 1700);
  assertClose(portfolio.monthly[2].payment, 200);
  assertClose(portfolio.monthly[2].remaining, 1400);
  assert.equal(portfolio.peakMonth, '2026-03');
  assertClose(portfolio.peakPayment, 200);
  assertClose(portfolio.totalPrincipal, 1800);
  assertClose(portfolio.totalInterest, 0);
});

test('相同月供按分比较并保留最早峰值月份', () => {
  const portfolio = aggregateLoanPortfolio([createLoan({
    amount: 1_000_000,
    rate: 3.5,
    term: 360,
    startYear: 2026,
    startMonth: 6
  })]);

  assert.equal(portfolio.peakMonth, '2026-06');
  assert.equal(portfolio.peakPayment, 4490.45);
});

test('年度汇总保留带逗号的完整贷款名称', () => {
  const portfolio = aggregateLoanPortfolio([createLoan({
    id: 'named',
    name: '住房, 主贷',
    amount: 1200,
    rate: 0,
    term: 12
  })]);
  const annual = getAnnualAggregatedData(portfolio.monthly);

  assert.equal(annual.length, 1);
  assertClose(annual[0].payment, 1200);
  assert.deepEqual(annual[0].activeLoanNames, ['住房, 主贷']);
  assert.equal(annual[0].activeLoans, '住房, 主贷');
});

test('最大金额、最高利率和最长期限下所有结果保持有限', () => {
  const schedule = calculateSingleLoan(createLoan({
    amount: MAX_LOAN_AMOUNT,
    rate: 100,
    term: MAX_LOAN_TERM_MONTHS
  }));

  assert.equal(schedule.length, MAX_LOAN_TERM_MONTHS);
  assert.ok(schedule.every(row => (
    Number.isFinite(row.payment)
    && Number.isFinite(row.principal)
    && Number.isFinite(row.interest)
    && Number.isFinite(row.remaining)
    && row.principal >= 0
    && row.interest >= 0
    && row.remaining >= 0
  )));
  assertClose(schedule.reduce((sum, row) => sum + row.principal, 0), MAX_LOAN_AMOUNT, 0.01);
  assert.equal(schedule.at(-1).remaining, 0);
});
