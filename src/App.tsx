import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FiscalYearProvider } from './context/FiscalYearContext';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import CustomerLedger from './pages/CustomerLedger';
import CreateBill from './pages/CreateBill';
import Records from './pages/Records';
import PartyLedger from './pages/PartyLedger';
import Settings from './pages/Settings';
import Stock from './pages/Stock';

function AppRoutes() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Protected — all share the same AppLayout (sidebar) */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/customers" element={<CustomerLedger />} />
                <Route path="/parties" element={<PartyLedger />} />
                <Route path="/create-bill" element={<CreateBill />} />
                <Route path="/records" element={<Records />} />
                <Route path="/stock" element={<Stock />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <FiscalYearProvider>
            <AppRoutes />
          </FiscalYearProvider>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
