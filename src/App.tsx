// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';

// --- Import All Your Pages ---
import LoginPage from './pages/login';
import DashboardPage from './pages/dashboard';
import PosPage from './pages/pos';
import ProductsPage from './pages/products';
import InventoryPage from './pages/inventory';
import CustomersPage from './pages/customers';
import SalesPage from './pages/sales';
import ReportsPage from './pages/reports';

/**
 * A special redirect component that sends users to the correct
 * default page based on their role after logging in.
 */
function RoleBasedRedirect() {
    const { profile } = useAuth();
    if (profile?.role === 'admin') {
        return <Navigate to="/dashboard" replace />;
    }
    // Default for employees or any other role
    return <Navigate to="/pos" replace />;
}


function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public route for login */}
          <Route path="/login" element={<LoginPage />} />

          {/* This parent route handles the initial authentication check for ALL protected routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'employee']} />}>
            
            {/* This nested parent route applies the shared UI Layout to the pages within it */}
            <Route element={<Layout />}>
              
              {/* --- Routes accessible to both 'employee' and 'admin' --- */}
              <Route path="/pos" element={<PosPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/sales" element={<SalesPage />} />

              {/* --- Routes restricted to 'admin' only --- */}
              {/* We add another ProtectedRoute layer for more specific role checking */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
              </Route>
            </Route>

            {/* --- Routes that are protected but do NOT need the Layout --- */}
            {/* The root and catch-all routes will redirect logged-in users correctly. */}
            <Route path="/" element={<RoleBasedRedirect />} />
            <Route path="*" element={<RoleBasedRedirect />} />

          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;