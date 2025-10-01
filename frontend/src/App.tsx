import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Context Providers
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import LoadingSpinner from './components/LoadingSpinner';

// Pages (lazy loaded)
const Home = React.lazy(() => import('./pages/Home'));
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Devices = React.lazy(() => import('./pages/Devices'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Account = React.lazy(() => import('./pages/Account'));
const OrderReports = React.lazy(() => import('./pages/OrderReports'));
const PaymentSuccess = React.lazy(() => import('./pages/PaymentSuccess'));
const PaymentCancel = React.lazy(() => import('./pages/PaymentCancel'));

// Admin Pages
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = React.lazy(() => import('./pages/admin/AdminUsers'));
const AdminSubscriptions = React.lazy(() => import('./pages/admin/AdminSubscriptions'));
const AdminDevices = React.lazy(() => import('./pages/admin/AdminDevices'));
const AdminOrderReports = React.lazy(() => import('./pages/admin/AdminOrderReports'));
const AdminSettings = React.lazy(() => import('./pages/admin/AdminSettings'));

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <div className="min-h-screen bg-gray-50">
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/payment/success" element={<PaymentSuccess />} />
                <Route path="/payment/cancel" element={<PaymentCancel />} />

                {/* Protected Routes */}
                <Route
                  path="/dashboard/*"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Routes>
                          <Route index element={<Dashboard />} />
                          <Route path="devices" element={<Devices />} />
                          <Route path="reports" element={<Reports />} />
                          <Route path="orders" element={<OrderReports />} />
                          <Route path="account" element={<Account />} />
                        </Routes>
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Admin Routes */}
                <Route
                  path="/admin/*"
                  element={
                    <AdminRoute>
                      <Layout>
                        <Routes>
                          <Route index element={<AdminDashboard />} />
                          <Route path="users" element={<AdminUsers />} />
                          <Route path="subscriptions" element={<AdminSubscriptions />} />
                          <Route path="devices" element={<AdminDevices />} />
                          <Route path="orders" element={<AdminOrderReports />} />
                          <Route path="settings" element={<AdminSettings />} />
                        </Routes>
                      </Layout>
                    </AdminRoute>
                  }
                />

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>

            {/* Toast notifications */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#fff',
                  color: '#374151',
                  boxShadow:
                    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.75rem',
                },
              }}
            />
          </div>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
