// src/components/layout/Layout.tsx
import React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Box, Users, History, BarChart2, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

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
        `flex items-center p-3 text-sm font-medium transition-colors rounded-md ${isActive
          ? 'bg-zinc-700 text-white' // Active state: A lighter, solid gray
          : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50' // Inactive: Muted, brightens on hover
        }`
      }
    >
      <Icon className="mr-3 h-5 w-5" />
      {children}
    </NavLink>
  );
}

const Layout: React.FC = () => {
  const { profile, signOutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
    <div className="flex h-screen bg-gray-100">

      {/* --- NEW THEME: Dark Zinc Sidebar --- */}
      <aside className="w-64 bg-zinc-900 text-zinc-100 p-4 flex flex-col border-r border-zinc-700">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-white">National Mini Mart</h1>
          <p className="text-sm text-zinc-400">Departmental Stores</p>
        </div>
        <nav className="flex-grow space-y-2">
          {accessibleNavItems.map(item => (
            <NavItem key={item.name} href={item.href} icon={item.icon}>
              {item.name}
            </NavItem>
          ))}
        </nav>

        {/* User & Logout Section - Styled for Zinc Theme */}
        <div className="border-t border-zinc-700 pt-4 space-y-4">
          <div className="px-3">
            <p className="text-xs text-zinc-400">Welcome, {profile?.role}</p>
            <p className="font-semibold text-zinc-100 truncate" title={profile?.email || ''}>
              {profile?.email || 'user@example.com'}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center p-3 transition-colors text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-md"
          >
            <LogOut className="mr-3 h-5 w-5" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* --- Main Content Area (Stays Light) --- */}
      <div className="flex-1 flex flex-col overflow-hidden">


        {/* Child route content - Light Theme */}
        <main className="flex-1 p-6 overflow-y-auto bg-gray-100">
          <Outlet />
        </main>

        {/* --- FOOTER: Themed to match the dark sidebar --- */}
        <footer className="p-4 border-t border-zinc-700 bg-zinc-900 text-center text-sm text-zinc-400 shrink-0">
          &copy; {new Date().getFullYear()} NMM V2.10.03. All Rights Reserved.<br />
          Brought to life by <a href="https://arisinnovations.in" target="_blank" rel="noopener noreferrer"> Aris Innovations</a>
        </footer>
      </div>
    </div>
  );
}

export default Layout;