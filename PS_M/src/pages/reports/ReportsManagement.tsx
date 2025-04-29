import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Download,
  Loader2,
  AlertCircle,
  FileText,
  TrendingUp,
  Gamepad2,
  ShoppingBag,
  Printer,
} from 'lucide-react';
import { supabase, DailySummary } from '../../lib/supabase';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { jsPDF } from 'jspdf';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

type DateRange = 'daily' | 'weekly' | 'monthly';

export default function ReportsManagement() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('daily');
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      fetchSummaries();
    }
  }, [dateRange, selectedDate]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      fetchSummaries();
    } catch (err) {
      console.error('Auth check error:', err);
      navigate('/login');
    }
  };

  const fetchSummaries = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase.from('daily_summaries').select('*');

      const today = new Date(selectedDate);
      const startDate = new Date(today);
      let endDate = new Date(today);

      switch (dateRange) {
        case 'weekly':
          startDate.setDate(today.getDate() - 7);
          query = query.gte('date', startDate.toISOString().split('T')[0]);
          break;
        case 'monthly':
          startDate.setMonth(today.getMonth() - 1);
          query = query.gte('date', startDate.toISOString().split('T')[0]);
          break;
        default: // daily
          query = query.eq('date', today.toISOString().split('T')[0]);
      }

      query = query.lte('date', endDate.toISOString().split('T')[0]);
      query = query.order('date', { ascending: false });

      const { data, error } = await query;
      
      if (error) throw error;
      setSummaries(data || []);
    } catch (err) {
      console.error('Error fetching summaries:', err);
      setError('حدث خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotals = () => {
    return summaries.reduce((acc, summary) => ({
      sessions_revenue: acc.sessions_revenue + summary.sessions_revenue,
      sales_revenue: acc.sales_revenue + summary.sales_revenue,
      expenses_total: acc.expenses_total + summary.expenses_total,
      discounts_total: acc.discounts_total + summary.discounts_total,
      net_income: acc.net_income + summary.net_income,
    }), {
      sessions_revenue: 0,
      sales_revenue: 0,
      expenses_total: 0,
      discounts_total: 0,
      net_income: 0,
    });
  };

  const getChartData = () => {
    const sortedSummaries = [...summaries].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return {
      labels: sortedSummaries.map(s => new Date(s.date).toLocaleDateString('ar-JO')),
      datasets: [
        {
          label: 'إيرادات الجلسات',
          data: sortedSummaries.map(s => s.sessions_revenue),
          borderColor: 'rgba(255, 255, 255, 0.8)',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          tension: 0.4,
        },
        {
          label: 'إيرادات المبيعات',
          data: sortedSummaries.map(s => s.sales_revenue),
          borderColor: 'rgba(74, 222, 128, 0.8)',
          backgroundColor: 'rgba(74, 222, 128, 0.2)',
          tension: 0.4,
        },
        {
          label: 'صافي الدخل',
          data: sortedSummaries.map(s => s.net_income),
          borderColor: 'rgba(168, 85, 247, 0.8)',
          backgroundColor: 'rgba(168, 85, 247, 0.2)',
          tension: 0.4,
        },
      ],
    };
  };

  const downloadReport = () => {
    const totals = calculateTotals();
    const reportTitle = `تقرير ${
      dateRange === 'daily' ? 'يومي' :
      dateRange === 'weekly' ? 'أسبوعي' : 'شهري'
    }`;

    let reportContent = `${reportTitle}\n`;
    reportContent += `التاريخ: ${new Date().toLocaleDateString('ar-JO')}\n\n`;
    
    reportContent += `إجمالي إيرادات الجلسات: ${totals.sessions_revenue.toFixed(2)} دينار\n`;
    reportContent += `إجمالي إيرادات المبيعات: ${totals.sales_revenue.toFixed(2)} دينار\n`;
    reportContent += `إجمالي المصروفات: ${totals.expenses_total.toFixed(2)} دينار\n`;
    reportContent += `إجمالي الخصومات: ${totals.discounts_total.toFixed(2)} دينار\n`;
    reportContent += `صافي الدخل: ${totals.net_income.toFixed(2)} دينار\n\n`;

    reportContent += 'تفاصيل التقرير:\n';
    summaries.forEach(summary => {
      reportContent += `\nتاريخ: ${new Date(summary.date).toLocaleDateString('ar-JO')}\n`;
      reportContent += `- إيرادات الجلسات: ${summary.sessions_revenue.toFixed(2)} دينار\n`;
      reportContent += `- إيرادات المبيعات: ${summary.sales_revenue.toFixed(2)} دينار\n`;
      reportContent += `- المصروفات: ${summary.expenses_total.toFixed(2)} دينار\n`;
      reportContent += `- الخصومات: ${summary.discounts_total.toFixed(2)} دينار\n`;
      reportContent += `- صافي الدخل: ${summary.net_income.toFixed(2)} دينار\n`;
    });

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_${dateRange}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const totals = calculateTotals();
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    doc.setFontSize(24);
    doc.text('Friends PS', 105, 20, { align: 'center' });
    
    doc.setFontSize(18);
    doc.text(`تقرير ${dateRange === 'daily' ? 'يومي' : dateRange === 'weekly' ? 'أسبوعي' : 'شهري'}`, 105, 30, { align: 'center' });
    doc.text(new Date().toLocaleDateString('ar-JO'), 105, 40, { align: 'center' });

    doc.setFontSize(14);
    doc.text('ملخص التقرير', 190, 60, { align: 'right' });
    
    doc.setFontSize(12);
    const summaryLines = [
      `إجمالي إيرادات الجلسات: ${totals.sessions_revenue.toFixed(2)} دينار`,
      `إجمالي إيرادات المبيعات: ${totals.sales_revenue.toFixed(2)} دينار`,
      `إجمالي المصروفات: ${totals.expenses_total.toFixed(2)} دينار`,
      `إجمالي الخصومات: ${totals.discounts_total.toFixed(2)} دينار`,
      `صافي الدخل: ${totals.net_income.toFixed(2)} دينار`,
    ];

    let y = 70;
    summaryLines.forEach(line => {
      doc.text(line, 190, y, { align: 'right' });
      y += 10;
    });

    doc.save(`تقرير_${dateRange}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen animated-bg flex items-center justify-center">
        <div className="flex items-center space-x-2 rtl:space-x-reverse text-white">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>جاري تحميل البيانات...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen animated-bg flex items-center justify-center">
        <div className="glass-card p-4 rounded-lg flex items-center space-x-2 rtl:space-x-reverse text-white">
          <AlertCircle className="w-6 h-6" />
          <span>{error}</span>
          <button
            onClick={fetchSummaries}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="min-h-screen animated-bg">
      <div className="glass-card border-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="bg-white/20 p-2 rounded-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">التقارير والإحصائيات</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="glass-card rounded-xl p-6 mb-8">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center space-x-4 rtl:space-x-reverse">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  نوع التقرير
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRange)}
                  className="glass-input rounded-lg"
                >
                  <option value="daily">يومي</option>
                  <option value="weekly">أسبوعي</option>
                  <option value="monthly">شهري</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  التاريخ
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="glass-input rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <button
                onClick={downloadReport}
                className="flex items-center px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors hover-effect"
              >
                <Download className="w-4 h-4 ml-2" />
                حفظ كملف نصي
              </button>

              <button
                onClick={printReport}
                className="flex items-center px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors hover-effect"
              >
                <Printer className="w-4 h-4 ml-2" />
                طباعة PDF
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="glass-card rounded-xl p-6 hover-effect">
            <div className="flex items-center justify-between mb-4">
              <Gamepad2 className="w-8 h-8 text-white" />
              <h3 className="text-lg font-semibold text-white">إيرادات الجلسات</h3>
            </div>
            <div className="text-3xl font-bold text-white">{totals.sessions_revenue.toFixed(2)} دينار</div>
          </div>

          <div className="glass-card rounded-xl p-6 hover-effect">
            <div className="flex items-center justify-between mb-4">
              <ShoppingBag className="w-8 h-8 text-white" />
              <h3 className="text-lg font-semibold text-white">إيرادات المبيعات</h3>
            </div>
            <div className="text-3xl font-bold text-white">{totals.sales_revenue.toFixed(2)} دينار</div>
          </div>

          <div className="glass-card rounded-xl p-6 hover-effect">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-white" />
              <h3 className="text-lg font-semibold text-white">صافي الدخل</h3>
            </div>
            <div className="text-3xl font-bold text-white">{totals.net_income.toFixed(2)} دينار</div>
          </div>
        </div>

        {summaries.length > 0 && (
          <div className="glass-card rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">الرسم البياني</h2>
            <div className="h-[400px]">
              <Line
                data={getChartData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top' as const,
                      rtl: true,
                      labels: {
                        usePointStyle: true,
                        padding: 20,
                        color: 'white',
                      },
                    },
                    tooltip: {
                      mode: 'index',
                      intersect: false,
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => `${value} دينار`,
                        color: 'white',
                      },
                      grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                      },
                    },
                    x: {
                      ticks: {
                        color: 'white',
                      },
                      grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                      },
                    },
                  },
                  interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false,
                  },
                }}
              />
            </div>
          </div>
        )}

        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-bold text-white flex items-center">
              <FileText className="w-5 h-5 ml-2" />
              تفاصيل التقرير
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5">
                  <th className="px-6 py-3 text-right text-sm font-medium text-white/80">التاريخ</th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-white/80">إيرادات الجلسات</th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-white/80">إيرادات المبيعات</th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-white/80">المصروفات</th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-white/80">الخصومات</th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-white/80">صافي الدخل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {summaries.map(summary => (
                  <tr key={summary.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 text-sm text-white">
                      {new Date(summary.date).toLocaleDateString('ar-JO')}
                    </td>
                    <td className="px-6 py-4 text-sm text-white">
                      {summary.sessions_revenue.toFixed(2)} دينار
                    </td>
                    <td className="px-6 py-4 text-sm text-white">
                      {summary.sales_revenue.toFixed(2)} دينار
                    </td>
                    <td className="px-6 py-4 text-sm text-red-300">
                      - {summary.expenses_total.toFixed(2)} دينار
                    </td>
                    <td className="px-6 py-4 text-sm text-orange-300">
                      {summary.discounts_total.toFixed(2)} دينار
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-green-300">
                      {summary.net_income.toFixed(2)} دينار
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}