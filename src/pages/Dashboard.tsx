import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import NepaliDate from 'nepali-date-converter';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { useFiscalYear } from '../context/FiscalYearContext';
import ToastContainer from '../components/ToastContainer';
import DailySalesChart from '../components/DailySalesChart';
import MonthlySalesChart from '../components/MonthlySalesChart';
import TopCustomersList from '../components/TopCustomersList';
import TopStockList from '../components/TopStockList';
import StockLevelChart from '../components/StockLevelChart';
import { getAllBills } from '../services/billService';
import { getStockParticulars } from '../services/stockService';
import { formatCurrency } from '../utils/numberToWords';
import type { Bill, StockParticular } from '../types';
import './Dashboard.css';

const formatPercentChange = (current: number, previous: number) => {
  if (previous === 0) {
    if (current === 0) {
      return '0.0% vs previous period';
    }
    return `${current > 0 ? '↑' : '↓'} 100.0% vs previous period`;
  }

  const change = ((current - previous) / previous) * 100;
  const arrow = change >= 0 ? '↑' : '↓';
  return `${arrow} ${Math.abs(change).toFixed(1)}% vs previous period`;
};

const getBillDate = (bill: Bill) => {
  const adDate = new Date(bill.date);
  return Number.isNaN(adDate.getTime()) ? new Date(bill.createdAt) : adDate;
};

const getCustomerKey = (bill: Bill) =>
  [bill.customerName, bill.contactNumber, bill.address]
    .map((value) => String(value || '').trim().toLowerCase())
    .join('|');

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { toasts, showError, removeToast } = useToast();
  const { settings, activeFiscalYear, fiscalYearStart, fiscalYearEnd, filterBillsByFY } = useFiscalYear();

  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  const [stockItems, setStockItems] = useState<StockParticular[]>([]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [allBills, allStock] = await Promise.all([
        getAllBills(user?.uid || ''),
        getStockParticulars(user?.uid || ''),
      ]);
      setBills(allBills);
      setStockItems(allStock);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      showError('Failed to load dashboard overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const stats = useMemo(() => {
    // ── Fiscal year filter ────────────────────────────────────────────────────
    // Bills scoped to the active fiscal year
    const fyBills = filterBillsByFY(bills);

    const totalBills = fyBills.length;
    const totalRevenue = fyBills.reduce((sum, bill) => sum + Number(bill.totalAmount || 0), 0);

    // Get current BS date & yesterday in BS
    const todayNd = new NepaliDate();
    const currentBsYear = todayNd.getYear();
    const currentBsMonth = todayNd.getMonth(); // 0-indexed
    const todayBsKey = todayNd.format('YYYY-MM-DD');

    const yesterdayNd = new NepaliDate();
    yesterdayNd.setDate(yesterdayNd.getDate() - 1);
    const yesterdayBsKey = yesterdayNd.format('YYYY-MM-DD');

    const lastMonthNd = new NepaliDate();
    lastMonthNd.setMonth(lastMonthNd.getMonth() - 1);
    const lastMonthBsYear = lastMonthNd.getYear();
    const lastMonthBsMonth = lastMonthNd.getMonth(); // 0-indexed

    const todayCustomers = new Set<string>();
    const yesterdayCustomers = new Set<string>();
    const thisMonthCustomers = new Set<string>();
    const lastMonthCustomers = new Set<string>();
    const totalCustomers = new Set<string>();

    let todaysBills = 0;
    let yesterdayBills = 0;
    let thisMonthBills = 0;
    let lastMonthBills = 0;
    let todaySale = 0;
    let yesterdaySale = 0;
    let monthlyRevenue = 0;
    let lastMonthRevenue = 0;

    for (const bill of fyBills) {
      // Find the BS date of the bill. Fallback to AD converter if missing.
      let bsDate = bill.nepaliDate;
      if (!bsDate) {
        const validDate = getBillDate(bill);
        const nd = new NepaliDate(validDate);
        bsDate = nd.format('YYYY-MM-DD');
      }

      const parts = bsDate.split('-');
      if (parts.length < 3) continue;

      const billYear = parseInt(parts[0], 10);
      const billMonth = parseInt(parts[1], 10) - 1; // Convert to 0-indexed
      
      const revenue = Number(bill.totalAmount || 0);
      const customerKey = getCustomerKey(bill);

      if (customerKey !== '||') {
        totalCustomers.add(customerKey);
      }

      if (bsDate === todayBsKey) {
        todaysBills += 1;
        todaySale += revenue;
        if (customerKey !== '||') {
          todayCustomers.add(customerKey);
        }
      }
      if (bsDate === yesterdayBsKey) {
        yesterdayBills += 1;
        yesterdaySale += revenue;
        if (customerKey !== '||') {
          yesterdayCustomers.add(customerKey);
        }
      }
      if (billMonth === currentBsMonth && billYear === currentBsYear) {
        thisMonthBills += 1;
        monthlyRevenue += revenue;
        if (customerKey !== '||') {
          thisMonthCustomers.add(customerKey);
        }
      }
      if (billMonth === lastMonthBsMonth && billYear === lastMonthBsYear) {
        lastMonthBills += 1;
        lastMonthRevenue += revenue;
        if (customerKey !== '||') {
          lastMonthCustomers.add(customerKey);
        }
      }
    }

    const totalStockItems = stockItems.length;
    const lowStockItems = stockItems.filter((item) => item.currentStock > 0 && item.currentStock <= 10).length;
    const outOfStockItems = stockItems.filter((item) => item.currentStock <= 0).length;
    const totalStockQty = stockItems.reduce((sum, item) => sum + (item.currentStock || 0), 0);

    return {
      totalBills,
      totalRevenue,
      yesterdayBills,
      thisMonthBills,
      lastMonthBills,
      todayCustomers: todayCustomers.size,
      yesterdayCustomers: yesterdayCustomers.size,
      thisMonthCustomers: thisMonthCustomers.size,
      lastMonthCustomers: lastMonthCustomers.size,
      totalCustomers: totalCustomers.size,
      todaySale,
      yesterdaySale,
      thisMonthSale: monthlyRevenue,
      lastMonthSale: lastMonthRevenue,
      todaysBills,
      totalStockItems,
      lowStockItems,
      outOfStockItems,
      totalStockQty,
    };
  }, [bills, stockItems, filterBillsByFY]);

  const nextBillNumber = useMemo(() => {
    const prefix = settings?.billNumberFormat === 'prefix' ? (settings.billNumberPrefix || 'BILL-') : '';
    const maxNumber = bills.reduce((max, bill) => {
      const parts = String(bill.billNo || '').match(/\d+/g);
      const lastNum = parts ? parseInt(parts[parts.length - 1], 10) : 0;
      return Number.isNaN(lastNum) ? max : Math.max(max, lastNum);
    }, 0);

    return `${prefix}${String(maxNumber + 1).padStart(4, '0')}`;
  }, [bills, settings]);

  // Bills filtered to the active fiscal year (used for charts)
  const fyBills = useMemo(() => filterBillsByFY(bills), [bills, filterBillsByFY]);
  const summaryColumns = [
    {
      title: 'Bill',
      cards: [
        {
          label: 'Bill today',
          value: stats.todaysBills,
          delta: formatPercentChange(stats.todaysBills, stats.yesterdayBills),
          tone: stats.todaysBills >= stats.yesterdayBills ? 'positive' : 'negative',
        },
        {
          label: 'Bill this month',
          value: stats.thisMonthBills,
          delta: formatPercentChange(stats.thisMonthBills, stats.lastMonthBills),
          tone: stats.thisMonthBills >= stats.lastMonthBills ? 'positive' : 'negative',
        },
        {
          label: 'Total bill',
          value: stats.totalBills,
          delta: 'All time bills',
          tone: 'neutral',
        },
      ],
    },
    {
      title: 'Customer',
      cards: [
        {
          label: 'Today customer',
          value: stats.todayCustomers,
          delta: formatPercentChange(stats.todayCustomers, stats.yesterdayCustomers),
          tone: stats.todayCustomers >= stats.yesterdayCustomers ? 'positive' : 'negative',
        },
        {
          label: 'This month customer',
          value: stats.thisMonthCustomers,
          delta: formatPercentChange(stats.thisMonthCustomers, stats.lastMonthCustomers),
          tone: stats.thisMonthCustomers >= stats.lastMonthCustomers ? 'positive' : 'negative',
        },
        {
          label: 'Total customer',
          value: stats.totalCustomers,
          delta: 'Unique customers',
          tone: 'neutral',
        },
      ],
    },
    {
      title: 'Stock',
      cards: [
        {
          label: 'Stock quantity',
          value: stats.totalStockQty,
          delta: 'Current inventory quantity',
          tone: 'neutral',
        },
        {
          label: 'Low stock',
          value: stats.lowStockItems,
          delta: 'Items at 1 to 10 quantity',
          tone: 'neutral',
        },
        {
          label: 'Out of stock',
          value: stats.outOfStockItems,
          delta: 'Items at zero quantity',
          tone: 'neutral',
        },
      ],
    },
  ];

  const saleCards = [
    {
      label: 'Today sale',
      value: formatCurrency(stats.todaySale),
      delta: formatPercentChange(stats.todaySale, stats.yesterdaySale),
      tone: stats.todaySale >= stats.yesterdaySale ? 'positive' : 'negative',
    },
    {
      label: 'This month sale',
      value: formatCurrency(stats.thisMonthSale),
      delta: formatPercentChange(stats.thisMonthSale, stats.lastMonthSale),
      tone: stats.thisMonthSale >= stats.lastMonthSale ? 'positive' : 'negative',
    },
    {
      label: 'Total sale',
      value: formatCurrency(stats.totalRevenue),
      delta: 'All time sales',
      tone: 'neutral',
    },
  ];

  return (
    <div className="dashboard-page fade-in">
      <div className="container">
        <div className="dashboard-header">
          <div>
            <h1>Dashboard</h1>
            <p>Overview of Home, Billing, Records, Stock, and Settings at one place.</p>
          </div>
          <button onClick={loadDashboard} className="btn btn-primary dashboard-refresh" disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <polyline points="23 20 23 14 17 14" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="dashboard-loading card">
            <div className="loading-spinner" />
            <p>Loading dashboard stats...</p>
          </div>
        ) : (
          <>
            <div className="dashboard-grid">
              {/* Row 1 - Today */}
              <div className="grid-card card">
                <span className="sales-label">{saleCards[0].label}</span>
                <strong className="sales-value">{saleCards[0].value}</strong>
                <span className={`sales-delta ${saleCards[0].tone}`}>{saleCards[0].delta}</span>
              </div>

              <div className="grid-card card">
                <span className="sales-label">{summaryColumns[0].cards[0].label}</span>
                <strong className="sales-value">{summaryColumns[0].cards[0].value}</strong>
                <span className={`sales-delta ${summaryColumns[0].cards[0].tone}`}>{summaryColumns[0].cards[0].delta}</span>
              </div>

              <div className="grid-card card">
                <span className="sales-label">{summaryColumns[1].cards[0].label}</span>
                <strong className="sales-value">{summaryColumns[1].cards[0].value}</strong>
                <span className={`sales-delta ${summaryColumns[1].cards[0].tone}`}>{summaryColumns[1].cards[0].delta}</span>
              </div>

              <div className="grid-card card">
                <span className="sales-label">{summaryColumns[2].cards[0].label}</span>
                <strong className="sales-value">{summaryColumns[2].cards[0].value}</strong>
                <span className={`sales-delta ${summaryColumns[2].cards[0].tone}`}>{summaryColumns[2].cards[0].delta}</span>
              </div>

              {/* Row 2 - This Month */}
              <div className="grid-card card">
                <span className="sales-label">{saleCards[1].label}</span>
                <strong className="sales-value">{saleCards[1].value}</strong>
                <span className={`sales-delta ${saleCards[1].tone}`}>{saleCards[1].delta}</span>
              </div>

              <div className="grid-card card">
                <span className="sales-label">{summaryColumns[0].cards[1].label}</span>
                <strong className="sales-value">{summaryColumns[0].cards[1].value}</strong>
                <span className={`sales-delta ${summaryColumns[0].cards[1].tone}`}>{summaryColumns[0].cards[1].delta}</span>
              </div>

              <div className="grid-card card">
                <span className="sales-label">{summaryColumns[1].cards[1].label}</span>
                <strong className="sales-value">{summaryColumns[1].cards[1].value}</strong>
                <span className={`sales-delta ${summaryColumns[1].cards[1].tone}`}>{summaryColumns[1].cards[1].delta}</span>
              </div>

              <div className="grid-card card">
                <span className="sales-label">{summaryColumns[2].cards[1].label}</span>
                <strong className="sales-value">{summaryColumns[2].cards[1].value}</strong>
                <span className={`sales-delta ${summaryColumns[2].cards[1].tone}`}>{summaryColumns[2].cards[1].delta}</span>
              </div>

              {/* Row 3 - Total */}
              <div className="grid-card card">
                <span className="sales-label">{saleCards[2].label}</span>
                <strong className="sales-value">{saleCards[2].value}</strong>
                <span className={`sales-delta ${saleCards[2].tone}`}>{saleCards[2].delta}</span>
              </div>

              <div className="grid-card card">
                <span className="sales-label">{summaryColumns[0].cards[2].label}</span>
                <strong className="sales-value">{summaryColumns[0].cards[2].value}</strong>
                <span className={`sales-delta ${summaryColumns[0].cards[2].tone}`}>{summaryColumns[0].cards[2].delta}</span>
              </div>

              <div className="grid-card card">
                <span className="sales-label">{summaryColumns[1].cards[2].label}</span>
                <strong className="sales-value">{summaryColumns[1].cards[2].value}</strong>
                <span className={`sales-delta ${summaryColumns[1].cards[2].tone}`}>{summaryColumns[1].cards[2].delta}</span>
              </div>

              <div className="grid-card card">
                <span className="sales-label">{summaryColumns[2].cards[2].label}</span>
                <strong className="sales-value">{summaryColumns[2].cards[2].value}</strong>
                <span className={`sales-delta ${summaryColumns[2].cards[2].tone}`}>{summaryColumns[2].cards[2].delta}</span>
              </div>
            </div>

            {/* ── Daily Sales Chart ── */}
            <div className="dashboard-chart-section card">
              <DailySalesChart bills={fyBills} />
            </div>

            {/* ── Monthly Sales Chart ── */}
            <div className="dashboard-chart-section card">
              <MonthlySalesChart bills={fyBills} settings={settings} />
            </div>
            {/* ── Top Customers Leaderboard ── */}
            <div className="dashboard-chart-section card">
              <TopCustomersList bills={fyBills} />
            </div>

            {/* ── Top Selling Stock Leaderboard ── */}
            <div className="dashboard-chart-section card">
              <TopStockList bills={fyBills} />
            </div>

            {/* ── Inventory Stock Level Chart ── */}
            <div className="dashboard-chart-section card">
              <StockLevelChart stockItems={stockItems} />
            </div>

            <div className="page-overview-grid">
              <div className="overview-card card">
                <h3>Home</h3>
                <p>System entry page is active and available.</p>
                <Link to="/" className="btn btn-secondary btn-sm">Open Home</Link>
              </div>

              <div className="overview-card card">
                <h3>Create Bill</h3>
                <p>Next bill number: <strong>{nextBillNumber}</strong></p>
                <p>This month revenue: <strong>{formatCurrency(stats.thisMonthSale)}</strong></p>
                <Link to="/create-bill" className="btn btn-secondary btn-sm">Open Create Bill</Link>
              </div>

              <div className="overview-card card">
                <h3>Records</h3>
                <p>Total record count: <strong>{stats.totalBills}</strong></p>
                <Link to="/records" className="btn btn-secondary btn-sm">Open Records</Link>
              </div>

              <div className="overview-card card">
                <h3>Stock</h3>
                <p>Low stock items: <strong>{stats.lowStockItems}</strong></p>
                <p>Out of stock items: <strong>{stats.outOfStockItems}</strong></p>
                <Link to="/stock" className="btn btn-secondary btn-sm">Open Stock</Link>
              </div>

              <div className="overview-card card">
                <h3>Settings</h3>
                <p>Business: <strong>{settings?.businessName || 'Not set'}</strong></p>
                <p>Theme: <strong>{settings?.theme || 'system'}</strong></p>
                <Link to="/settings" className="btn btn-secondary btn-sm">Open Settings</Link>
              </div>
            </div>
          </>
        )}
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default Dashboard;
