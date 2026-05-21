import React, { useMemo, useState } from 'react';
import NepaliDate from 'nepali-date-converter';
import { dateConfigMap } from 'nepali-date-converter';
import type { Bill } from '../types';
import { formatCurrency } from '../utils/numberToWords';
import './DailySalesChart.css';

interface DailySalesChartProps {
  bills: Bill[];
}

interface DayData {
  day: number;
  dateLabel: string;
  amount: number;
  qty: number;
  billCount: number;
}

const BS_MONTH_NAMES = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Aswin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const DailySalesChart: React.FC<DailySalesChartProps> = ({ bills }) => {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState<'amount' | 'qty'>('amount');

  const { dailyData, monthLabel, maxAmount, maxQty, daysInMonth, todayDay } = useMemo(() => {
    // Get current BS date
    const todayNd = new NepaliDate(new Date());
    const bsYear = todayNd.getYear();
    const bsMonth = todayNd.getMonth(); // 0-indexed
    const todayDay = todayNd.getDate();
    const monthName = BS_MONTH_NAMES[bsMonth];
    const monthLabel = `${monthName} ${bsYear} BS`;

    // Get number of days in this BS month from the config map
    const yearConfig = (dateConfigMap as Record<number, Record<string, number>>)[bsYear];
    const daysInMonth = yearConfig ? (yearConfig[monthName] || 30) : 30;

    // Initialize all days
    const dayMap: Record<number, DayData> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      dayMap[d] = {
        day: d,
        dateLabel: `${monthName.slice(0, 3)} ${d}`,
        amount: 0,
        qty: 0,
        billCount: 0,
      };
    }

    // Format current BS year-month for matching (1-indexed month with zero-padding)
    const bsMonthStr = String(bsMonth + 1).padStart(2, '0');
    const bsYearStr = String(bsYear);

    // Aggregate bill data using bill.nepaliDate (BS date stored as "YYYY-MM-DD")
    for (const bill of bills) {
      let bsDate = bill.nepaliDate;
      if (!bsDate) {
        // Fallback: parse bill.date (AD date) and convert to BS
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

      const billYear = parts[0];
      const billMonth = parts[1].padStart(2, '0');
      const billDay = parseInt(parts[2], 10);

      if (billYear === bsYearStr && billMonth === bsMonthStr && dayMap[billDay]) {
        dayMap[billDay].amount += Number(bill.totalAmount || 0);
        dayMap[billDay].qty += Number(bill.totalQty || bill.items.reduce((s, i) => s + Number(i.qty), 0));
        dayMap[billDay].billCount += 1;
      }
    }

    const dailyData = Object.values(dayMap).sort((a, b) => a.day - b.day);
    const maxAmount = Math.max(...dailyData.map(d => d.amount), 1);
    const maxQty = Math.max(...dailyData.map(d => d.qty), 1);

    return { dailyData, monthLabel, maxAmount, maxQty, daysInMonth, todayDay };
  }, [bills]);

  // Chart dimensions
  const chartHeight = 220;
  const chartPadding = { top: 20, right: 16, bottom: 36, left: 60 };
  const barAreaWidth = Math.max(daysInMonth * 28, 600);
  const svgWidth = barAreaWidth + chartPadding.left + chartPadding.right;
  const svgHeight = chartHeight + chartPadding.top + chartPadding.bottom;
  const plotHeight = chartHeight;
  const barWidth = Math.max((barAreaWidth / daysInMonth) * 0.55, 10);
  const barGap = (barAreaWidth / daysInMonth);

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

  const hoveredData = hoveredDay !== null ? dailyData.find(d => d.day === hoveredDay) : null;

  // Totals for the month so far
  const monthTotals = useMemo(() => {
    const totalAmount = dailyData.reduce((s, d) => s + d.amount, 0);
    const totalQty = dailyData.reduce((s, d) => s + d.qty, 0);
    const totalBills = dailyData.reduce((s, d) => s + d.billCount, 0);
    const activeDays = dailyData.filter(d => d.billCount > 0).length;
    const avgDaily = activeDays > 0 ? totalAmount / activeDays : 0;
    return { totalAmount, totalQty, totalBills, activeDays, avgDaily };
  }, [dailyData]);

  return (
    <div className="daily-sales-chart">
      <div className="chart-header">
        <div className="chart-title-row">
          <div>
            <h3 className="chart-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Daily Sales — {monthLabel}
            </h3>
            <p className="chart-subtitle">
              {monthTotals.activeDays} active day{monthTotals.activeDays !== 1 ? 's' : ''} · {monthTotals.totalBills} bills · Avg {formatCurrency(monthTotals.avgDaily)}/day
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
          <span className="chart-stat-label">Total Amount</span>
          <span className="chart-stat-value amount">{formatCurrency(monthTotals.totalAmount)}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Total Qty</span>
          <span className="chart-stat-value qty">{monthTotals.totalQty}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Total Bills</span>
          <span className="chart-stat-value bills">{monthTotals.totalBills}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Avg/Day</span>
          <span className="chart-stat-value avg">{formatCurrency(monthTotals.avgDaily)}</span>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredData && (
        <div className="chart-tooltip-bar">
          <strong>{hoveredData.dateLabel}</strong>
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
          {dailyData.map((d, i) => {
            const value = activeMetric === 'amount' ? d.amount : d.qty;
            const h = getBarHeight(value);
            const x = chartPadding.left + i * barGap + (barGap - barWidth) / 2;
            const y = chartPadding.top + plotHeight - h;
            const isHovered = hoveredDay === d.day;
            const isToday = d.day === todayDay;

            return (
              <g
                key={d.day}
                onMouseEnter={() => setHoveredDay(d.day)}
                onMouseLeave={() => setHoveredDay(null)}
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
                    isToday
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
                  fill={isToday ? 'var(--accent-primary)' : 'var(--text-secondary)'}
                  fontSize="10"
                  fontWeight={isToday ? '700' : '400'}
                  fontFamily="inherit"
                >
                  {d.day}
                </text>
                {/* Today marker dot */}
                {isToday && (
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
          Today
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: activeMetric === 'amount' ? 'hsl(158, 64%, 52%)' : 'hsl(217, 91%, 60%)' }} />
          {activeMetric === 'amount' ? 'Sale Amount' : 'Quantity Sold'}
        </span>
      </div>
    </div>
  );
};

export default DailySalesChart;
