import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Box, Users, History, BarChart2, LogOut, PlusCircle, List, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

// Define the structure for a navigation item
interface NavItemType {
  name: string;
  href?: string; // Optional because parent items might just toggle
  icon: React.ElementType;
  roles: ('admin' | 'employee')[];
  subItems?: { name: string; href: string; icon: React.ElementType }[];
}

// Define navigation items
const allNavItems: NavItemType[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { name: 'POS', href: '/pos', icon: ShoppingCart, roles: ['admin', 'employee'] },
  
  // UPDATED: Products is now a parent item with sub-menus
  { 
    name: 'Products', 
    icon: Box, 
    roles: ['admin'],
    subItems: [
      { name: 'Add New', href: '/products?mode=add', icon: PlusCircle },
      { name: 'Edit / List', href: '/products?mode=edit', icon: List }
    ]
  },
  
  { name: 'Inventory', href: '/inventory', icon: LayoutDashboard, roles: ['admin', 'employee'] },
  { name: 'Customers', href: '/customers', icon: Users, roles: ['admin', 'employee'] },
  { name: 'Sales History', href: '/sales', icon: History, roles: ['admin', 'employee'] },
  { name: 'Reports', href: '/reports', icon: BarChart2, roles: ['admin'] },
];

// Reusable NavLink Component
function NavLinkItem({ href, children, icon: Icon, isSubItem = false }: { href: string; children: React.ReactNode; icon: React.ElementType; isSubItem?: boolean }) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        `flex items-center p-3 text-sm font-medium transition-colors rounded-md mb-1 ${
            isActive
            ? 'bg-zinc-700 text-white'
            : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
        } ${isSubItem ? 'pl-11 text-xs' : ''}`
      }
    >
      <Icon className={`${isSubItem ? 'h-4 w-4' : 'h-5 w-5'} mr-3`} />
      {children}
    </NavLink>
  );
}

const Layout: React.FC = () => {
  const { profile, signOutUser } = useAuth();
  const navigate = useNavigate();
  
  // State to manage expanding/collapsing menus (default open for products if needed)
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({ 'Products': true });

  const accessibleNavItems = allNavItems.filter(item =>
    profile && item.roles.includes(profile.role)
  );

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      navigate('/login');
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 text-zinc-100 p-4 flex flex-col border-r border-zinc-700 overflow-y-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">National Mini Mart</h1>
          <p className="text-sm text-zinc-400">Departmental Stores</p>
        </div>
        
        <nav className="flex-grow space-y-1">
          {accessibleNavItems.map(item => (
            <div key={item.name}>
              {item.subItems ? (
                // Render Parent with Collapse logic
                <>
                  <button
                    onClick={() => toggleMenu(item.name)}
                    className="w-full flex items-center justify-between p-3 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-700/50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </div>
                    {openMenus[item.name] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  
                  {/* Render Sub Items */}
                  {openMenus[item.name] && (
                    <div className="mt-1 space-y-1">
                      {item.subItems.map(sub => (
                        <NavLinkItem key={sub.name} href={sub.href} icon={sub.icon} isSubItem>
                          {sub.name}
                        </NavLinkItem>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                // Render Standard Link
                <NavLinkItem href={item.href!} icon={item.icon}>
                  {item.name}
                </NavLinkItem>
              )}
            </div>
          ))}
        </nav>

        {/* Footer User Info */}
        <div className="border-t border-zinc-700 pt-4 mt-4 space-y-4">
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 p-6 overflow-y-auto bg-gray-100">
          <Outlet />
        </main>
        <footer className="p-4 border-t border-zinc-700 bg-zinc-900 text-center text-sm text-zinc-400 shrink-0">
          &copy; {new Date().getFullYear()} NMM V2.12.00. All Rights Reserved.
        </footer>
      </div>
    </div>
  );
}

export default Layout;