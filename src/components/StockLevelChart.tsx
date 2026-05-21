import React, { useMemo, useState } from 'react';
import type { StockParticular } from '../types';
import './StockLevelChart.css';

interface StockLevelChartProps {
  stockItems: StockParticular[];
}

const StockLevelChart: React.FC<StockLevelChartProps> = ({ stockItems }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { chartData, maxStock, totals } = useMemo(() => {
    // Sort items by currentStock descending
    const sorted = [...stockItems].sort((a, b) => b.currentStock - a.currentStock);
    const maxStock = Math.max(...sorted.map(s => s.currentStock), 10);
    
    const totals = {
      totalItems: sorted.length,
      totalQty: sorted.reduce((sum, item) => sum + item.currentStock, 0),
      lowStockCount: sorted.filter(s => s.currentStock > 0 && s.currentStock <= 10).length,
      outOfStockCount: sorted.filter(s => s.currentStock <= 0).length
    };

    return { chartData: sorted, maxStock, totals };
  }, [stockItems]);

  // Chart dimensions
  const chartHeight = 220;
  const chartPadding = { top: 20, right: 16, bottom: 44, left: 50 };
  
  // Ensure enough width for all bars (min width 600)
  const barAreaWidth = Math.max(chartData.length * 40, 600);
  const svgWidth = barAreaWidth + chartPadding.left + chartPadding.right;
  const svgHeight = chartHeight + chartPadding.top + chartPadding.bottom;
  const plotHeight = chartHeight;
  
  // Calculate bar width based on available space, max 32px
  const barGap = chartData.length > 0 ? (barAreaWidth / chartData.length) : 0;
  const barWidth = Math.min(Math.max(barGap * 0.6, 12), 32);

  // Generate Y-axis ticks (4 ticks + 0)
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) {
      ticks.push(Math.round((maxStock / 4) * i));
    }
    return ticks;
  }, [maxStock]);

  const getBarHeight = (value: number) => {
    return maxStock > 0 ? (Math.max(value, 0) / maxStock) * plotHeight : 0;
  };

  const hoveredData = hoveredIndex !== null ? chartData[hoveredIndex] : null;

  return (
    <div className="stock-level-chart">
      <div className="chart-header">
        <div className="chart-title-row">
          <div>
            <h3 className="chart-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path>
                <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path>
                <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path>
              </svg>
              Inventory Stock Levels
            </h3>
            <p className="chart-subtitle">
              {totals.totalItems} Unique Items · {totals.totalQty} Total Qty in Stock
            </p>
          </div>
        </div>
      </div>

      {/* Summary stats row */}
      <div className="chart-stats-row">
        <div className="chart-stat">
          <span className="chart-stat-label">Total Qty</span>
          <span className="chart-stat-value qty">{totals.totalQty}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Low Stock</span>
          <span className="chart-stat-value warning">{totals.lowStockCount}</span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-label">Out of Stock</span>
          <span className="chart-stat-value danger">{totals.outOfStockCount}</span>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredData && (
        <div className="chart-tooltip-bar">
          <strong>{hoveredData.name}</strong>
          <span className="tooltip-detail">
            <span className={`tooltip-dot ${hoveredData.currentStock <= 0 ? 'danger-dot' : hoveredData.currentStock <= 10 ? 'warning-dot' : 'qty-dot'}`} /> 
            Current Stock: {hoveredData.currentStock}
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
            const y = chartPadding.top + plotHeight - (plotHeight * (tick / maxStock));
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
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {chartData.map((item, i) => {
            const value = item.currentStock;
            const h = getBarHeight(value);
            const x = chartPadding.left + i * barGap + (barGap - barWidth) / 2;
            const y = chartPadding.top + plotHeight - h;
            const isHovered = hoveredIndex === i;
            
            // Color coding based on stock level
            let barColor = 'hsl(217, 91%, 60%)'; // Normal
            if (value <= 0) barColor = 'hsl(348, 83%, 47%)'; // Out of stock (red)
            else if (value <= 10) barColor = 'hsl(48, 89%, 50%)'; // Low stock (yellow)

            return (
              <g
                key={item.id || i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
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
                {value > 0 ? (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(h, 2)}
                    rx="3"
                    fill={barColor}
                    opacity={isHovered ? 1 : 0.8}
                    className="chart-bar"
                  />
                ) : (
                  // Out of stock indicator line
                  <rect
                    x={x}
                    y={chartPadding.top + plotHeight - 2}
                    width={barWidth}
                    height={2}
                    rx="1"
                    fill={barColor}
                    opacity={1}
                  />
                )}
                
                {/* Hover value label */}
                {isHovered && (
                  <text
                    x={x + barWidth / 2}
                    y={value > 0 ? y - 6 : chartPadding.top + plotHeight - 6}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="inherit"
                  >
                    {value}
                  </text>
                )}
                
                {/* X-axis label (rotated) */}
                <text
                  x={x + barWidth / 2}
                  y={chartPadding.top + plotHeight + 16}
                  textAnchor="end"
                  fill="var(--text-secondary)"
                  fontSize="10"
                  fontWeight={isHovered ? '600' : '400'}
                  fontFamily="inherit"
                  transform={`rotate(-45, ${x + barWidth / 2}, ${chartPadding.top + plotHeight + 16})`}
                  style={{ textTransform: 'capitalize' }}
                >
                  {item.name.length > 12 ? item.name.slice(0, 10) + '..' : item.name}
                </text>
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
          <span className="legend-dot" style={{ background: 'hsl(217, 91%, 60%)' }} />
          Healthy Stock
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: 'hsl(48, 89%, 50%)' }} />
          Low Stock (≤10)
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: 'hsl(348, 83%, 47%)' }} />
          Out of Stock
        </span>
      </div>
    </div>
  );
};

export default StockLevelChart;
