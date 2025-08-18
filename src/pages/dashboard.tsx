// src/pages/DashboardPage.tsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Sale } from '../types/sale';
import { Product } from '../types/product';
import { formatCurrency } from '../utils/formatCurrency';
import { BarChart, DollarSign, Package, AlertTriangle, ShoppingCart, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Stats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  lowStockCount: number;
}

interface ChartData {
  name: string;
  sales: number;
}

// A reusable component for displaying key statistics
const StatCard = ({ title, value, icon, description }: { title: string; value: string; icon: React.ReactNode; description: string; }) => (
    <div className="bg-white p-6 border border-gray-200">
        <div className="flex items-center gap-4">
            <div className="bg-gray-100 p-3">{icon}</div>
            <div>
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
                <p className="text-xs text-gray-400">{description}</p>
            </div>
        </div>
    </div>
);

// --- SOLUTION: Helper function for dynamic greeting ---
const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
};


export default function DashboardPage() {
    const [stats, setStats] = useState<Stats>({ today: 0, thisWeek: 0, thisMonth: 0, lowStockCount: 0 });
    const [recentSales, setRecentSales] = useState<Sale[]>([]);
    const [topProducts, setTopProducts] = useState<{ name: string; quantity: number }[]>([]);
    const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
    const [salesChartData, setSalesChartData] = useState<ChartData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                // --- Date Ranges ---
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                weekStart.setHours(0, 0, 0, 0);
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

                // --- Fetch Sales Data ---
                const salesQuery = query(collection(db, "sales"), where("soldAt", ">=", Timestamp.fromDate(monthStart)));
                const salesSnapshot = await getDocs(salesQuery);
                const salesData = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sale[];

                let todaySales = 0;
                let weekSales = 0;
                let monthSales = 0;
                const productSales: { [key: string]: { name: string; quantity: number } } = {};

                salesData.forEach(sale => {
                    const saleDate = (sale.soldAt as Timestamp).toDate();
                    const saleTotal = sale.totalAmount;
                    monthSales += saleTotal;
                    if (saleDate >= todayStart) todaySales += saleTotal;
                    if (saleDate >= weekStart) weekSales += saleTotal;

                    sale.items.forEach(item => {
                        if (productSales[item.productId]) {
                            productSales[item.productId].quantity += item.quantity;
                        } else {
                            productSales[item.productId] = { name: item.productName, quantity: item.quantity };
                        }
                    });
                });

                // --- Fetch Product Data for Low Stock ---
                const productsSnapshot = await getDocs(collection(db, "products"));
                const allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
                const lowItems = allProducts.filter(p => p.stock_quantity <= p.min_stock_level);
                setLowStockItems(lowItems.slice(0, 5)); // show top 5

                // --- Process Top Products ---
                const sortedTopProducts = Object.values(productSales).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
                setTopProducts(sortedTopProducts);

                // --- Fetch Recent Sales ---
                const recentSalesQuery = query(collection(db, "sales"), orderBy("soldAt", "desc"), limit(5));
                const recentSalesSnapshot = await getDocs(recentSalesQuery);
                setRecentSales(recentSalesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sale[]);

                // --- Prepare Sales Chart Data (Last 7 Days) ---
                const last7Days = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    return d;
                }).reverse();

                const chartData = last7Days.map(date => {
                    const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });
                    const salesOnDay = salesData
                        .filter(s => (s.soldAt as Timestamp).toDate().toDateString() === date.toDateString())
                        .reduce((sum, s) => sum + s.totalAmount, 0);
                    return { name: dayStr, sales: salesOnDay };
                });
                setSalesChartData(chartData);

                // --- Set Final Stats ---
                setStats({ today: todaySales, thisWeek: weekSales, thisMonth: monthSales, lowStockCount: lowItems.length });

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (isLoading) {
        return <div className="p-6 text-center text-gray-500">Loading Dashboard...</div>;
    }

    return (
        <div className="bg-gray-100 min-h-screen p-6 font-sans">
            <header className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
                {/* --- SOLUTION: Use the greeting function here --- */}
                <p className="text-gray-500">{getGreeting()}, Admin! Here's a summary of your store's activity.</p>
            </header>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <StatCard title="Today's Sales" value={formatCurrency(stats.today)} icon={<DollarSign className="text-green-500" />} description="Total revenue for today" />
                <StatCard title="This Week's Sales" value={formatCurrency(stats.thisWeek)} icon={<ShoppingCart className="text-blue-500" />} description="Total revenue this week" />
                <StatCard title="This Month's Sales" value={formatCurrency(stats.thisMonth)} icon={<BarChart className="text-orange-500" />} description="Total revenue this month" />
                <StatCard title="Low Stock Items" value={stats.lowStockCount.toString()} icon={<AlertTriangle className="text-red-500" />} description="Products needing attention" />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Chart */}
                <div className="lg:col-span-2 bg-white p-6 border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2"><TrendingUp size={22}/>Sales Trend (Last 7 Days)</h2>
                    <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            {/* --- SOLUTION: Add margin to the chart to prevent clipping --- */}
                            <LineChart data={salesChartData} margin={{ top: 15, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                                <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(value) => formatCurrency(value as number)} />
                                <Tooltip
                                  formatter={(value: number) => [formatCurrency(value), 'Sales']}
                                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }} 
                                />
                                <Legend />
                                <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Selling Products */}
                <div className="bg-white p-6 border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2"><Package size={22}/>Top Selling Products</h2>
                    <ul className="space-y-3">
                        {topProducts.length > 0 ? topProducts.map((product, index) => (
                            <li key={index} className="flex justify-between items-center text-sm">
                                <span className="text-gray-800 font-medium truncate pr-4">{product.name}</span>
                                <span className="bg-gray-100 text-gray-600 font-bold px-2 py-1 rounded">{product.quantity} sold</span>
                            </li>
                        )) : <p className="text-gray-500 text-sm">No sales data for this period yet.</p>}
                    </ul>
                </div>

                {/* Low Stock & Recent Sales */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 border border-gray-200">
                        <h2 className="text-xl font-bold text-gray-700 mb-4">Low Stock Items</h2>
                         <ul className="space-y-3">
                            {lowStockItems.length > 0 ? lowStockItems.map(item => (
                                <li key={item.id} className="flex justify-between items-center text-sm">
                                    <span className="text-gray-800">{item.name}</span>
                                    <span className="text-red-600 font-bold">Only {item.stock_quantity} left</span>
                                </li>
                            )) : <p className="text-gray-500 text-sm">No items are low on stock. Great!</p>}
                        </ul>
                    </div>
                     <div className="bg-white p-6 border border-gray-200">
                        <h2 className="text-xl font-bold text-gray-700 mb-4">Recent Sales</h2>
                         <ul className="space-y-3">
                             {recentSales.map(sale => (
                                <li key={sale.id} className="flex justify-between items-center text-sm">
                                    <div>
                                        <p className="font-medium text-gray-800">{sale.customerName || 'Walk-in Customer'}</p>
                                        <p className="text-xs text-gray-500">{sale.billNumber}</p>
                                    </div>
                                    <span className="font-bold text-blue-600">{formatCurrency(sale.totalAmount)}</span>
                                </li>
                             ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}