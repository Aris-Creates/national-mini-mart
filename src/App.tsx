import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';

import LoginPage from './pages/login';
import PosPage from './pages/pos';
import ProductsPage from './pages/products';
import InventoryPage from './pages/inventory';
import CustomersPage from './pages/customers';
import SalesPage from './pages/sales';
import ReportsPage from './pages/reports';
import Layout from './components/layout/Layout';
import { JSX } from 'react';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div>Loading...</div>; // Or a proper loader component
  }
  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/pos" />} />
            <Route path="pos" element={<PosPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;