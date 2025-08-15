import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Box, Users, History, BarChart2, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { name: 'POS', href: '/pos', icon: ShoppingCart },
  { name: 'Products', href: '/products', icon: Box },
  { name: 'Inventory', href: '/inventory', icon: LayoutDashboard },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Sales History', href: '/sales', icon: History },
  { name: 'Reports', href: '/reports', icon: BarChart2 },
];

function NavItem({ href, children, icon: Icon }: { href: string, children: React.ReactNode, icon: React.ElementType }) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        `flex items-center p-3 rounded-lg transition-colors ${
          isActive
            ? 'bg-blue-600 text-white' // Active state: A vibrant blue background with white text
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700' // Inactive: Muted text, brightens on hover
        }`
      }
    >
      <Icon className="mr-3" size={20} />
      {children}
    </NavLink>
  );
}

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const currentPage = navItems.find(item => location.pathname.startsWith(item.href));
  const pageTitle = currentPage ? currentPage.name : 'Dashboard';

  return (
    // Main container with dark background and light text
    <div className="flex h-screen bg-slate-900 text-slate-200">
      
      {/* Sidebar with a slightly lighter dark background and a border */}
      <aside className="w-64 bg-slate-800 p-4 flex flex-col border-r border-slate-700">
        <div className="text-center mb-10">
            <h1 className="text-2xl font-bold text-blue-500">National Mini Mart</h1>
            <p className="text-sm text-slate-400">Departmental Stores</p>
        </div>
        <nav className="flex-grow space-y-2">
          {navItems.map(item => (
            <NavItem key={item.name} href={item.href} icon={item.icon}>
              {item.name}
            </NavItem>
          ))}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        
        {/* Header with the same background as the sidebar */}
        <header className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800 h-16 shrink-0">
          <h2 className="text-xl font-semibold text-slate-100">{pageTitle}</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {user?.email || 'user@example.com'}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 p-2 rounded-lg transition-colors text-red-400 hover:bg-red-500/20 hover:text-red-300"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Child route content rendered on the main dark background */}
        <main className="flex-1 p-6 overflow-y-auto bg-slate-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
}