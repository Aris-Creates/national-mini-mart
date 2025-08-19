// src/components/layout/Layout.tsx
import React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Box, Users, History, BarChart2, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth'; // Ensure this path is correct

// Define the structure for a navigation item
interface NavItemType {
  name: string;
  href: string;
  icon: React.ElementType;
  roles: ('admin' | 'employee')[]; // Roles that can see this link
}

// Define all possible navigation items with their required roles
const allNavItems: NavItemType[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { name: 'POS', href: '/pos', icon: ShoppingCart, roles: ['admin', 'employee'] },
  { name: 'Products', href: '/products', icon: Box, roles: ['admin'] },
  { name: 'Inventory', href: '/inventory', icon: LayoutDashboard, roles: ['admin', 'employee'] },
  { name: 'Customers', href: '/customers', icon: Users, roles: ['admin', 'employee'] },
  { name: 'Sales History', href: '/sales', icon: History, roles: ['admin', 'employee'] },
  { name: 'Reports', href: '/reports', icon: BarChart2, roles: ['admin'] },
];

// A reusable NavLink component for the sidebar
function NavItem({ href, children, icon: Icon }: { href: string; children: React.ReactNode; icon: React.ElementType }) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        `flex items-center p-3 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-600 text-white' // Active state
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200' // Inactive state
        }`
      }
    >
      <Icon className="mr-3 h-5 w-5" />
      {children}
    </NavLink>
  );
}

const Layout: React.FC = () => {
  const { profile, signOutUser } = useAuth(); // Use correct property name from AuthContextType
  const navigate = useNavigate();
  const location = useLocation();

  // Filter the navigation items based on the current user's role
  const accessibleNavItems = allNavItems.filter(item => 
    profile && item.roles.includes(profile.role)
  );

  const handleSignOut = async () => {
    try {
      await signOutUser();
      navigate('/login');
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  const currentPage = allNavItems.find(item => location.pathname.startsWith(item.href));
  const pageTitle = currentPage ? currentPage.name : 'Welcome';

  return (
    <div className="flex h-screen bg-slate-900 text-slate-200">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 p-4 flex flex-col border-r border-slate-700">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-blue-700">National Mini Mart</h1>
          <p className="text-sm text-gray-500">Departmental Stores</p>
        </div>
        <nav className="flex-grow space-y-2">
          {accessibleNavItems.map(item => (
            <NavItem key={item.name} href={item.href} icon={item.icon}>
              {item.name}
            </NavItem>
          ))}
        </nav>

        {/* User & Logout Section */}
        <div className="border-t border-gray-200 pt-4 space-y-4">
          <div className="px-3">
            <p className="text-xs text-gray-500">Welcome, {profile?.role}</p>
            <p className="font-semibold text-gray-800 truncate" title={profile?.email || ''}>
              {profile?.email || 'user@example.com'}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center p-3 transition-colors text-red-600 hover:bg-red-50 hover:text-red-800"
          >
            <LogOut className="mr-3 h-5 w-5" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b bg-white h-16 shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">{pageTitle}</h2>
        </header>

        {/* Child route content */}
        <main className="flex-1 p-6 overflow-y-auto bg-gray-100">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;