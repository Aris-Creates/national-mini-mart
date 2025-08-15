import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp, DocumentData } from 'firebase/firestore';
import { db } from '../../firebase';
import { Sale } from '../types/sale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// --- UI Components & Utils ---
import { Button } from '../components/ui/Button';
import { formatCurrency } from '../utils/formatCurrency';
import { TrendingUp, Package, Receipt } from 'lucide-react';

// --- Type Definitions ---
interface ReportData {
  totalSales: number;
  itemsSold: number;
  transactions: number;
}
interface ChartDataPoint {
  date: string;
  sales: number;
}

// --- Type-Safe Converter ---
const docToSaleSummary = (doc: DocumentData): Pick<Sale, 'totalAmount' | 'items' | 'soldAt'> => {
  const data = doc.data();
  return {
    totalAmount: data.totalAmount || 0,
    items: data.items || [],
    soldAt: data.soldAt as Timestamp,
  };
};

// --- NEW: Function to process raw sales data for the chart ---
const processSalesForChart = (sales: Pick<Sale, 'totalAmount' | 'items' | 'soldAt'>[]): ChartDataPoint[] => {
  if (!sales || sales.length === 0) return [];

  const dailySales = new Map<string, number>();

  sales.forEach(sale => {
    const date = sale.soldAt.toDate();
    const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const currentSales = dailySales.get(dateString) || 0;
    dailySales.set(dateString, currentSales + sale.totalAmount);
  });

  // Convert map to array and sort by date
  const sortedChartData = Array.from(dailySales, ([date, sales]) => ({ date, sales }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
  return sortedChartData;
};

export default function ReportsPage() {
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReportData = async () => {
      setIsLoading(true);
      setError(null);
      setReportData(null);
      setChartData([]);

      const now = new Date();
      let startDate = new Date();
      switch (timeRange) {
        case 'daily': startDate.setHours(0, 0, 0, 0); break;
        case 'weekly': startDate.setDate(now.getDate() - 7); startDate.setHours(0, 0, 0, 0); break;
        case 'monthly': startDate.setDate(now.getDate() - 30); startDate.setHours(0, 0, 0, 0); break;
      }

      try {
        const salesQuery = query(collection(db, "sales"), where("soldAt", ">=", Timestamp.fromDate(startDate)));
        const querySnapshot = await getDocs(salesQuery);

        let totalSales = 0;
        let itemsSold = 0;
        const transactions = querySnapshot.size;
        
        const rawSales = querySnapshot.docs.map(docToSaleSummary);

        rawSales.forEach(sale => {
          totalSales += sale.totalAmount;
          sale.items.forEach(item => { itemsSold += item.quantity; });
        });

        setReportData({ totalSales, itemsSold, transactions });
        setChartData(processSalesForChart(rawSales));

      } catch (err) {
        console.error("Error fetching sales report:", err);
        setError("Failed to load report data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [timeRange]);

 const renderMetricCards = () => {
    if (isLoading) {
      return Array(3).fill(0).map((_, index) => (
        <div key={index} className="bg-slate-800 p-6 rounded-lg animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-slate-700 rounded w-1/2"></div>
        </div>
      ));
    }
    if (error) {
      return <p className="col-span-3 text-red-400 text-center">{error}</p>;
    }
    if (reportData) {
      return (
        <>
          <div className="bg-slate-800 p-6 rounded-lg shadow-md">
            <h3 className="text-slate-400 uppercase text-sm font-semibold flex items-center gap-2 mb-2"><TrendingUp size={16}/> Total Sales</h3>
            <p className="text-3xl font-bold text-white">{formatCurrency(reportData.totalSales)}</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-lg shadow-md">
            <h3 className="text-slate-400 uppercase text-sm font-semibold flex items-center gap-2 mb-2"><Package size={16}/> Items Sold</h3>
            <p className="text-3xl font-bold text-white">{reportData.itemsSold.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-lg shadow-md">
            <h3 className="text-slate-400 uppercase text-sm font-semibold flex items-center gap-2 mb-2"><Receipt size={16}/> Total Transactions</h3>
            <p className="text-3xl font-bold text-white">{reportData.transactions.toLocaleString('en-IN')}</p>
          </div>
        </>
      );
    }
    return null;
  };  
  // --- NEW: Custom Tooltip for the chart ---
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-700 p-2 rounded-md border border-slate-600">
          <p className="label text-sm text-slate-300">{`${label}`}</p>
          <p className="intro font-bold text-white">{`Sales: ${formatCurrency(payload[0].value)}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900 text-white min-h-screen p-6 font-sans">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sales Reports</h1>
          <p className="text-slate-400">View key metrics for your sales performance</p>
        </div>
        <div className="flex space-x-1 p-1 bg-slate-800 rounded-lg">
          <Button variant={timeRange === 'daily' ? 'primary' : 'secondary'} onClick={() => setTimeRange('daily')}>Daily</Button>
          <Button variant={timeRange === 'weekly' ? 'primary' : 'secondary'} onClick={() => setTimeRange('weekly')}>Weekly</Button>
          <Button variant={timeRange === 'monthly' ? 'primary' : 'secondary'} onClick={() => setTimeRange('monthly')}>Monthly</Button>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {renderMetricCards()}
      </div>

      <div className="bg-slate-800 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Sales Trend</h2>
        <div className="h-96 w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full"><p className="text-slate-500">Loading Chart Data...</p></div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Number(value) / 1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="sales" stroke="#38bdf8" strokeWidth={2} dot={{ r: 4, fill: '#0ea5e9' }} activeDot={{ r: 8, stroke: '#38bdf8', fill: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">No sales data available for this period to display a chart.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}