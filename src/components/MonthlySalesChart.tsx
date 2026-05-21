import React, { useMemo, useState } from 'react';
import NepaliDate from 'nepali-date-converter';
import type { Bill, AppSettings } from '../types';
import { formatCurrency } from '../utils/numberToWords';
import './MonthlySalesChart.css';

interface MonthlySalesChartProps {
  bills: Bill[];
  settings?: AppSettings | null;
}

interface MonthData {
  monthIndex: number;
  monthName: string;
  amount: number;
  qty: number;
  billCount: number;
}

const BS_MONTH_NAMES = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Aswin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const MonthlySalesChart: React.FC<MonthlySalesChartProps> = ({ bills, settings }) => {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState<'amount' | 'qty'>('amount');

  const { monthlyData, yearLabel, maxAmount, maxQty, currentMonthIndex } = useMemo(() => {
    // Get current BS date
    const todayNd = new NepaliDate(new Date());
    const currentMonthIndex = todayNd.getMonth(); // 0-indexed

    // Determine fiscal year range from settings
    const activeFY = settings?.activeFiscalYear;
    const fyStart = settings?.fiscalYearStart ?? 4;   // 1-indexed BS month
    const fyEnd = settings?.fiscalYearEnd ?? 3;       // 1-indexed BS month

    // Build ordered list of {year, month0} pairs for the fiscal year
    // e.g. FY 2080-81, start=4 (Shrawan), end=3 (Ashadh):
    //   2080/3, 2080/4, ..., 2080/11, 2081/0, 2081/1, 2081/2
    let fyMonths: Array<{ year: number; month0: number }> = [];
    let yearLabel = '';

    if (activeFY) {
      const startYear = parseInt(activeFY.split('-')[0], 10);
      const endYear = startYear + 1;
      yearLabel = `FY ${activeFY} BS`;

      // Months in start year: from fyStart-1 (0-indexed) to 11
      for (let m = fyStart - 1; m <= 11; m++) {
        fyMonths.push({ year: startYear, month0: m });
      }
      // Months in end year: from 0 to fyEnd-1 (0-indexed)
      for (let m = 0; m <= fyEnd - 1; m++) {
        fyMonths.push({ year: endYear, month0: m });
      }
    } else {
      // Fallback: show current BS year
      const bsYear = todayNd.getYear();
      yearLabel = `${bsYear} BS`;
      for (let m = 0; m < 12; m++) {
        fyMonths.push({ year: bsYear, month0: m });
      }
    }

    // Initialize month map
    const monthMap: Record<string, MonthData & { year: number; month0: number }> = {};
    fyMonths.forEach(({ year, month0 }, idx) => {
      const key = `${year}-${month0}`;
      monthMap[key] = {
        monthIndex: idx,
        monthName: BS_MONTH_NAMES[month0],
        amount: 0,
        qty: 0,
        billCount: 0,
        year,
        month0,
      };
    });

    // Aggregate bill data
    for (const bill of bills) {
      let bsDate = bill.nepaliDate;
      if (!bsDate) {
        const adDateStr = bill.date || (bill.createdAt instanceof Date ? bill.createdAt.toISOString() : String(bill.createdAt));
        if (adDateStr) {
          try {
            const adDate = new Date(adDateStr);
            if (!Number.isNaN(adDate.getTime())) {
              const nd = new NepaliDate(adDate);
              bsDate = nd.format('YYYY-MM-DD');
            }
          } catch (e) {
            console.error('Error fallback converting bill date:', e);
          }
        }
      }
      if (!bsDate) continue;

      const parts = bsDate.split('-');
      if (parts.length < 3) continue;

      const billYear = parseInt(parts[0], 10);
      const billMonth0 = parseInt(parts[1], 10) - 1; // 0-indexed
      const key = `${billYear}-${billMonth0}`;

      if (monthMap[key]) {
        monthMap[key].amount += Number(bill.totalAmount || 0);
        monthMap[key].qty += Number(bill.totalQty || bill.items.reduce((s, i) => s + Number(i.qty), 0));
        monthMap[key].billCount += 1;
      }
    }

    const monthlyData = Object.values(monthMap).sort((a, b) => a.monthIndex - b.monthIndex);
    const maxAmount = Math.max(...monthlyData.map(d => d.amount), 1);
    const maxQty = Math.max(...monthlyData.map(d => d.qty), 1);

    return { monthlyData, yearLabel, maxAmount, maxQty, currentMonthIndex };
  }, [bills, settings]);

  // Chart dimensions
  const chartHeight = 220;
  const chartPadding = { top: 20, right: 16, bottom: 36, left: 60 };
  const barAreaWidth = 600;
  const svgWidth = barAreaWidth + chartPadding.left + chartPadding.right;
  const svgHeight = chartHeight + chartPadding.top + chartPadding.bottom;
  const plotHeight = chartHeight;
  const barWidth = 24;
  const barGap = (barAreaWidth / Math.max(monthlyData.length, 1));

  const maxVal = activeMetric === 'amount' ? maxAmount : maxQty;

  // Generate Y-axis ticks (5 ticks)
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) {
      ticks.push(Math.round((maxVal / 4) * i));
    }
    return ticks;
  }, [maxVal]);

  const formatYTick = (val: number) => {
    if (activeMetric === 'amount') {
      if (val >= 100000) return `${(val / 100000).toFixed(1)}L`;
      if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
      return val.toString();
    }
    return val.toString();
  };

  const getBarHeight = (value: number) => {
    return maxVal > 0 ? (value / maxVal) * plotHeight : 0;
  };

  const hoveredData = hoveredMonth !== null ? monthlyData.find(d => d.monthIndex === hoveredMonth) : null;

  // Totals for the current BS year
  const yearTotals = useMemo(() => {
    const totalAmount = monthlyData.reduce((s, d) => s + d.amount, 0);
    const totalQty = monthlyData.reduce((s, d) => s + d.qty, 0);
    const totalBills = monthlyData.reduce((s, d) => s + d.billCount, 0);
    const activeMonths = monthlyData.filter(d => d.billCount > 0).length;
    const avgMonthly = activeMonths > 0 ? totalAmount / activeMonths : 0;
    return { totalAmount, totalQty, totalBills, activeMonths, avgMonthly };
  }, [monthlyData]);

  return (
    <div className="monthly-sales-chart">
      <div className="chart-header">
        <div className="chart-title-row">
          <div>
            <h3 className="chart-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
              </svg>
              Monthly Sales — {yearLabel}
            </h3>
            <p className="chart-subtitle">
              {yearTotals.activeMonths} active month{yearTotals.activeMonths !== 1 ? 's' : ''} · {yearTotals.totalBills} bills · Avg {formatCurrency(yearTotals.avgMonthly)}/month
            </p>
          </div>
          <div className="chart-metric-toggle">
            <button
              className={`metric-btn ${activeMetric === 'amount' ? 'active' : ''}`}
              onClick={() => setActiveMetric('amount')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Amount
            </button>
            <button
              className={`metric-btn ${activeMetric === 'qty' ? 'active' : ''}`}
              onClick={() => setActiveMetric('qty')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              Quantity
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats row */}
      <div className="chart-stats-row">
        <div className="chart-stat">
          <span className="chart-stat-label">Yearly Amount</span>
          <span className="chart-stat-value amount">{formatCurrency(yearTotals.totalAmount)}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Yearly Qty</span>
          <span className="chart-stat-value qty">{yearTotals.totalQty}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Yearly Bills</span>
          <span className="chart-stat-value bills">{yearTotals.totalBills}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Avg/Month</span>
          <span className="chart-stat-value avg">{formatCurrency(yearTotals.avgMonthly)}</span>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredData && (
        <div className="chart-tooltip-bar">
          <strong>{hoveredData.monthName}</strong>
          <span className="tooltip-detail">
            <span className="tooltip-dot amount-dot" /> Amount: {formatCurrency(hoveredData.amount)}
          </span>
          <span className="tooltip-detail">
            <span className="tooltip-dot qty-dot" /> Qty: {hoveredData.qty}
          </span>
          <span className="tooltip-detail">
            <span className="tooltip-dot bill-dot" /> Bills: {hoveredData.billCount}
          </span>
        </div>
      )}

      {/* Chart area */}
      <div className="chart-scroll-wrapper">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="chart-svg"
        >
          {/* Gridlines */}
          {yTicks.map((tick, i) => {
            const y = chartPadding.top + plotHeight - (plotHeight * (tick / maxVal));
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={chartPadding.left}
                  y1={y}
                  x2={svgWidth - chartPadding.right}
                  y2={y}
                  stroke="var(--border-color)"
                  strokeWidth="1"
                  strokeDasharray={i === 0 ? 'none' : '4,4'}
                  opacity="0.5"
                />
                <text
                  x={chartPadding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--text-secondary)"
                  fontSize="11"
                  fontFamily="inherit"
                >
                  {formatYTick(tick)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {monthlyData.map((d, i) => {
            const value = activeMetric === 'amount' ? d.amount : d.qty;
            const h = getBarHeight(value);
            const x = chartPadding.left + i * barGap + (barGap - barWidth) / 2;
            const y = chartPadding.top + plotHeight - h;
            const isHovered = hoveredMonth === d.monthIndex;
            const isCurrentMonth = d.monthIndex === currentMonthIndex;

            return (
              <g
                key={d.monthIndex}
                onMouseEnter={() => setHoveredMonth(d.monthIndex)}
                onMouseLeave={() => setHoveredMonth(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Hover background */}
                <rect
                  x={chartPadding.left + i * barGap}
                  y={chartPadding.top}
                  width={barGap}
                  height={plotHeight}
                  fill={isHovered ? 'var(--accent-primary)' : 'transparent'}
                  opacity="0.06"
                  rx="2"
                />
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(h, value > 0 ? 2 : 0)}
                  rx="3"
                  fill={
                    isCurrentMonth
                      ? 'var(--accent-primary)'
                      : activeMetric === 'amount'
                        ? 'hsl(158, 64%, 52%)'
                        : 'hsl(217, 91%, 60%)'
                  }
                  opacity={isHovered ? 1 : 0.75}
                  className="chart-bar"
                />
                {/* Hover value label */}
                {isHovered && value > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="inherit"
                  >
                    {activeMetric === 'amount' ? formatCurrency(value) : value}
                  </text>
                )}
                {/* X-axis label */}
                <text
                  x={x + barWidth / 2}
                  y={chartPadding.top + plotHeight + 16}
                  textAnchor="middle"
                  fill={isCurrentMonth ? 'var(--accent-primary)' : 'var(--text-secondary)'}
                  fontSize="10"
                  fontWeight={isCurrentMonth ? '700' : '400'}
                  fontFamily="inherit"
                >
                  {d.monthName.slice(0, 3)}
                </text>
                {/* Current month marker dot */}
                {isCurrentMonth && (
                  <circle
                    cx={x + barWidth / 2}
                    cy={chartPadding.top + plotHeight + 24}
                    r="2.5"
                    fill="var(--accent-primary)"
                  />
                )}
              </g>
            );
          })}

          {/* X-axis baseline */}
          <line
            x1={chartPadding.left}
            y1={chartPadding.top + plotHeight}
            x2={svgWidth - chartPadding.right}
            y2={chartPadding.top + plotHeight}
            stroke="var(--border-color)"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Legend */}
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--accent-primary)' }} />
          Current Month
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: activeMetric === 'amount' ? 'hsl(158, 64%, 52%)' : 'hsl(217, 91%, 60%)' }} />
          {activeMetric === 'amount' ? 'Monthly Amount' : 'Quantity Sold'}
        </span>
      </div>
    </div>
  );
};

export default MonthlySalesChart;
