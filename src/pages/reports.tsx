// src/pages/ReportsPage.tsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp, DocumentData } from 'firebase/firestore';
import { db } from '../../firebase';
import { Sale, SaleItem } from '../types/sale'; // Using the full SaleItem for accuracy
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

// --- Type-Safe Converter (Summarized for reporting) ---
const docToSaleSummary = (doc: DocumentData): { totalAmount: number; items: SaleItem[]; soldAt: Timestamp } => {
  const data = doc.data();
  return {
    totalAmount: data.totalAmount || 0,
    items: data.items || [],
    soldAt: data.soldAt as Timestamp,
  };
};

// --- Processes raw sales data for the chart ---
const processSalesForChart = (sales: { totalAmount: number; soldAt: Timestamp }[]): ChartDataPoint[] => {
  if (!sales || sales.length === 0) return [];

  const dailySales = new Map<string, number>();

  sales.forEach(sale => {
    const date = sale.soldAt.toDate();
    const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const currentSales = dailySales.get(dateString) || 0;
    dailySales.set(dateString, currentSales + sale.totalAmount);
  });

  // Convert map to array and sort by date for a proper time-series chart
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
          // The SaleItem structure has the quantity
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
        <div key={index} className="bg-white p-6 border border-gray-200 animate-pulse">
          <div className="h-4 bg-gray-200 w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-300 w-1/2"></div>
        </div>
      ));
    }
    if (error) {
      return <p className="col-span-3 text-red-600 text-center">{error}</p>;
    }
    if (reportData) {
      return (
        <>
          <div className="bg-white p-6 border border-gray-200">
            <h3 className="text-gray-500 uppercase text-sm font-semibold flex items-center gap-2 mb-2"><TrendingUp size={16}/> Total Sales</h3>
            <p className="text-3xl font-bold text-gray-800">{formatCurrency(reportData.totalSales)}</p>
          </div>
          <div className="bg-white p-6 border border-gray-200">
            <h3 className="text-gray-500 uppercase text-sm font-semibold flex items-center gap-2 mb-2"><Package size={16}/> Items Sold</h3>
            <p className="text-3xl font-bold text-gray-800">{reportData.itemsSold.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-white p-6 border border-gray-200">
            <h3 className="text-gray-500 uppercase text-sm font-semibold flex items-center gap-2 mb-2"><Receipt size={16}/> Total Transactions</h3>
            <p className="text-3xl font-bold text-gray-800">{reportData.transactions.toLocaleString('en-IN')}</p>
          </div>
        </>
      );
    }
    return null;
  };  

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg">
          <p className="label text-sm text-gray-600">{`${label}`}</p>
          <p className="intro font-bold text-gray-800">{`Sales: ${formatCurrency(payload[0].value)}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-100 text-black min-h-screen p-6 font-sans">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Sales Reports</h1>
          <p className="text-gray-500">View key metrics for your sales performance</p>
        </div>
        <div className="flex space-x-1 p-1 bg-gray-200">
          <Button className={`${timeRange === 'daily' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-700 hover:bg-gray-300'}`} onClick={() => setTimeRange('daily')}>Daily</Button>
          <Button className={`${timeRange === 'weekly' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-700 hover:bg-gray-300'}`} onClick={() => setTimeRange('weekly')}>Weekly</Button>
          <Button className={`${timeRange === 'monthly' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-700 hover:bg-gray-300'}`} onClick={() => setTimeRange('monthly')}>Monthly</Button>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {renderMetricCards()}
      </div>

      <div className="bg-white p-6 border border-gray-200">
        <h2 className="text-xl font-bold mb-4 text-gray-700">Sales Trend</h2>
        <div className="h-96 w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full"><p className="text-gray-500">Loading Chart Data...</p></div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Number(value) / 1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '14px' }} />
                <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8, stroke: '#3b82f6', fill: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">No sales data available for this period to display a chart.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}