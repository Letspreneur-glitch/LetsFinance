import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Transaction, TransactionType, Category } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Download, Printer, ChevronLeft, ChevronRight, Calendar, Filter, Check, RefreshCw, FileText, Sparkles, Loader2, PieChart as PieChartIcon, TableProperties } from 'lucide-react';
import { getReportAnalysis } from '../services/geminiService';

interface ReportsProps {
  transactions: Transaction[];
}

type Period = 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
type ReportView = 'VISUAL' | 'ACCOUNTING';

const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

export const Reports: React.FC<ReportsProps> = React.memo(({ transactions }) => {
  const [period, setPeriod] = useState<Period>('MONTHLY');
  const [viewMode, setViewMode] = useState<ReportView>('VISUAL');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Custom Range State
  const [customRange, setCustomRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // 1st of current month
    end: new Date().toISOString().split('T')[0] // Today
  });
  
  // Category Filter State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]); // Empty = All
  const filterRef = useRef<HTMLDivElement>(null);

  // AI Analysis State
  const [analysisPoints, setAnalysisPoints] = useState<string[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset analysis when data changes
  useEffect(() => {
    setAnalysisPoints(null);
  }, [transactions, period, currentDate, customRange, selectedCategories]);

  // Helper untuk navigasi tanggal
  const navigateDate = (direction: 'prev' | 'next') => {
    if (period === 'CUSTOM') return; // Disable for custom
    const newDate = new Date(currentDate);
    if (period === 'WEEKLY') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (period === 'MONTHLY') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else {
      newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(cat)) {
        return prev.filter(c => c !== cat);
      } else {
        return [...prev, cat];
      }
    });
  };

  const clearFilter = () => setSelectedCategories([]);

  // Helper formatting text periode
  const getPeriodLabel = () => {
    if (period === 'WEEKLY') {
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay() || 7; 
      if (day !== 1) startOfWeek.setHours(-24 * (day - 1)); // Set to Monday
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      return `${startOfWeek.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else if (period === 'MONTHLY') {
      return currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    } else if (period === 'YEARLY') {
      return currentDate.getFullYear().toString();
    } else {
      // Custom Range Label
      const start = new Date(customRange.start + 'T00:00:00');
      const end = new Date(customRange.end + 'T00:00:00');
      return `${start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
  };

  // 1. Filter Data by Date (Global for the period)
  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      const tDateStr = t.date; // YYYY-MM-DD string

      if (period === 'CUSTOM') {
         return tDateStr >= customRange.start && tDateStr <= customRange.end;
      } else if (period === 'WEEKLY') {
        const startOfWeek = new Date(currentDate);
        const day = startOfWeek.getDay() || 7; 
        if (day !== 1) startOfWeek.setHours(-24 * (day - 1));
        startOfWeek.setHours(0,0,0,0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23,59,59,999);
        
        return tDate >= startOfWeek && tDate <= endOfWeek;
      } else if (period === 'MONTHLY') {
        return tDate.getMonth() === currentDate.getMonth() && tDate.getFullYear() === currentDate.getFullYear();
      } else {
        return tDate.getFullYear() === currentDate.getFullYear();
      }
    });
  }, [transactions, period, currentDate, customRange]);

  // 2. Aggregation for Stats
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredData.forEach(t => {
      if (t.type === TransactionType.INCOME) income += t.amount;
      else expense += t.amount;
    });
    return { income, expense, profit: income - expense };
  }, [filteredData]);

  // 2b. Aggregation for Accounting Report
  const accountingData = useMemo(() => {
    const incomeGroups: Record<string, number> = {};
    const expenseGroups: Record<string, number> = {};
    
    let dataToUse = filteredData;
    if (selectedCategories.length > 0) {
        dataToUse = filteredData.filter(t => selectedCategories.includes(t.category));
    }

    dataToUse.forEach(t => {
        if (t.type === TransactionType.INCOME) {
            incomeGroups[t.category] = (incomeGroups[t.category] || 0) + t.amount;
        } else {
            expenseGroups[t.category] = (expenseGroups[t.category] || 0) + t.amount;
        }
    });

    const incomeList = Object.entries(incomeGroups)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);
        
    const expenseList = Object.entries(expenseGroups)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);

    return { incomeList, expenseList };
  }, [filteredData, selectedCategories]);

  // 3. Data for Time Series Bar Chart (Global - unaffected by category filter)
  const chartData = useMemo(() => {
    const grouped: Record<string, { name: string; income: number; expense: number; sortDate: number }> = {};
    
    // Pre-fill months for Yearly view to ensure all months appear
    if (period === 'YEARLY') {
       for(let i=0; i<12; i++) {
         const d = new Date(currentDate.getFullYear(), i, 1);
         const key = d.toLocaleString('default', { month: 'short' });
         grouped[key] = { name: key, income: 0, expense: 0, sortDate: d.getTime() };
       }
    }

    filteredData.forEach(t => {
      const dateObj = new Date(t.date);
      let key = '';
      let sortDate = 0;

      if (period === 'YEARLY') {
         key = dateObj.toLocaleString('default', { month: 'short' });
         // For sorting, use the first day of that month in the current year
         sortDate = new Date(currentDate.getFullYear(), dateObj.getMonth(), 1).getTime();
      } else {
         // Weekly, Monthly, and Custom (Daily grouping)
         key = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
         
         if (period === 'CUSTOM') {
            key = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' });
         }
         sortDate = dateObj.getTime();
      }

      if (!grouped[key]) grouped[key] = { name: key, income: 0, expense: 0, sortDate };
      
      if (t.type === TransactionType.INCOME) grouped[key].income += t.amount;
      else grouped[key].expense += t.amount;
    });

    // Sort chronologically
    return Object.values(grouped).sort((a, b) => a.sortDate - b.sortDate);
  }, [filteredData, period, currentDate]);

  // 4. Data for Category Comparison Bar Chart
  const categoryComparisonData = useMemo(() => {
    const grouped: Record<string, { name: string; income: number; expense: number }> = {};
    
    let dataToProcess = filteredData;
    if (selectedCategories.length > 0) {
      dataToProcess = filteredData.filter(t => selectedCategories.includes(t.category));
    }

    dataToProcess.forEach(t => {
      if (!grouped[t.category]) {
        grouped[t.category] = { name: t.category, income: 0, expense: 0 };
      }
      
      if (t.type === TransactionType.INCOME) {
        grouped[t.category].income += t.amount;
      } else {
        grouped[t.category].expense += t.amount;
      }
    });

    return Object.values(grouped).sort((a, b) => (b.income + b.expense) - (a.income + a.expense));
  }, [filteredData, selectedCategories]);

  // 5. --- FILTERED EXPENSE DATA FOR PIE CHART & TABLE ---
  const filteredExpenseData = useMemo(() => {
    let expenses = filteredData.filter(t => t.type === TransactionType.EXPENSE);
    if (selectedCategories.length > 0) {
      expenses = expenses.filter(t => selectedCategories.includes(t.category));
    }
    return expenses;
  }, [filteredData, selectedCategories]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenseData.forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.keys(map).map(key => ({ name: key, value: map[key] })).sort((a, b) => b.value - a.value);
  }, [filteredExpenseData]);

  const topExpenses = useMemo(() => {
    return filteredExpenseData
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredExpenseData]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  const downloadCSV = () => {
    const safeLabel = getPeriodLabel().replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // Helper to escape CSV strings to handle commas and quotes
    const escapeCsv = (str: string | number) => {
        if (typeof str === 'number') return str;
        return `"${String(str).replace(/"/g, '""')}"`;
    };

    if (viewMode === 'ACCOUNTING') {
      // --- Download Laporan Laba Rugi (Summary) ---
      const rows = [];
      rows.push([escapeCsv("LAPORAN LABA RUGI")]);
      rows.push([escapeCsv(`Periode: ${getPeriodLabel()}`)]);
      rows.push([]);
      
      rows.push([escapeCsv("PENDAPATAN USAHA"), ""]);
      if (accountingData.incomeList.length > 0) {
        accountingData.incomeList.forEach(item => {
          rows.push([escapeCsv(item.name), item.amount]);
        });
      } else {
        rows.push([escapeCsv("(Tidak ada pendapatan)"), 0]);
      }
      rows.push([escapeCsv("TOTAL PENDAPATAN"), stats.income]);
      rows.push([]);

      rows.push([escapeCsv("BEBAN USAHA"), ""]);
      if (accountingData.expenseList.length > 0) {
        accountingData.expenseList.forEach(item => {
          rows.push([escapeCsv(item.name), item.amount]);
        });
      } else {
         rows.push([escapeCsv("(Tidak ada beban)"), 0]);
      }
      rows.push([escapeCsv("TOTAL BEBAN"), stats.expense]);
      rows.push([]);
      
      rows.push([escapeCsv("LABA BERSIH"), stats.profit]);

      const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(',')).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Laporan_Laba_Rugi_${safeLabel}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } else {
      // --- Download Data Transaksi Mentah (Existing) ---
      const headers = ["Tanggal", "Tipe", "Kategori", "Deskripsi", "Merchant", "Jumlah"];
      const rows = filteredData.map(t => [
        escapeCsv(t.date),
        escapeCsv(t.type),
        escapeCsv(t.category),
        escapeCsv(t.description),
        escapeCsv(t.merchant || ''),
        t.amount
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Laporan_Transaksi_${safeLabel}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleAnalyze = async () => {
    if (filteredData.length === 0) return;
    setIsAnalyzing(true);
    try {
        const result = await getReportAnalysis(filteredData, getPeriodLabel());
        if (result.summary) {
            setAnalysisPoints(result.summary);
        }
    } catch (e) {
        alert("Gagal menganalisis laporan. Coba lagi nanti.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in print:p-0 print:space-y-4 pb-20 md:pb-0">
      {/* Controls Header - Responsive */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-4 print:hidden">
        
        {/* Period Selector */}
        <div className="w-full lg:w-auto overflow-x-auto no-scrollbar">
          <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
            {(['WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap flex-1 ${
                  period === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p === 'WEEKLY' ? 'Mingguan' : p === 'MONTHLY' ? 'Bulanan' : p === 'YEARLY' ? 'Tahunan' : 'Kustom'}
              </button>
            ))}
          </div>
        </div>

        {/* Date Navigation */}
        <div className="w-full lg:w-auto flex justify-center order-first lg:order-none">
           {period === 'CUSTOM' ? (
             <div className="w-full flex flex-col sm:flex-row items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                <input 
                  type="date" 
                  value={customRange.start}
                  onChange={(e) => setCustomRange({...customRange, start: e.target.value})}
                  className="w-full sm:w-auto outline-none text-slate-700 text-sm font-medium bg-transparent border-b border-transparent focus:border-indigo-500 transition-colors"
                />
                <span className="text-slate-400 font-medium hidden sm:inline">-</span>
                <input 
                  type="date" 
                  value={customRange.end}
                  onChange={(e) => setCustomRange({...customRange, end: e.target.value})}
                  className="w-full sm:w-auto outline-none text-slate-700 text-sm font-medium bg-transparent border-b border-transparent focus:border-indigo-500 transition-colors"
                />
             </div>
           ) : (
             <div className="w-full flex items-center gap-4 bg-white border border-slate-200 rounded-lg px-2 py-1.5 shadow-sm justify-between lg:justify-center">
                <button onClick={() => navigateDate('prev')} className="p-2 hover:bg-slate-50 rounded-full text-slate-500">
                  <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-2 min-w-[150px] justify-center font-bold text-slate-700 text-sm md:text-base">
                  <Calendar size={18} className="text-indigo-500" />
                  <span>{getPeriodLabel()}</span>
                </div>
                <button onClick={() => navigateDate('next')} className="p-2 hover:bg-slate-50 rounded-full text-slate-500">
                  <ChevronRight size={20} />
                </button>
             </div>
           )}
        </div>

        {/* Actions */}
        <div className="w-full lg:w-auto flex flex-wrap gap-2 justify-center lg:justify-end">
           {/* View Mode Toggle */}
           <div className="flex bg-slate-100 p-1 rounded-lg">
             <button 
                onClick={() => setViewMode('VISUAL')}
                className={`p-2 rounded-md transition-all ${viewMode === 'VISUAL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Tampilan Visual"
             >
                <PieChartIcon size={18} />
             </button>
             <button 
                onClick={() => setViewMode('ACCOUNTING')}
                className={`p-2 rounded-md transition-all ${viewMode === 'ACCOUNTING' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Tampilan Akuntansi"
             >
                <TableProperties size={18} />
             </button>
           </div>

           <div className="relative" ref={filterRef}>
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg font-medium transition-colors text-sm ${selectedCategories.length > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <Filter size={16} /> 
              <span className="hidden sm:inline">{selectedCategories.length > 0 ? `${selectedCategories.length}` : 'Filter'}</span>
            </button>

            {isFilterOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 animate-fade-in-up">
                <div className="flex justify-between items-center p-2 mb-2 border-b border-slate-100">
                  <span className="text-sm font-bold text-slate-700">Pilih Kategori</span>
                  {selectedCategories.length > 0 && (
                    <button onClick={clearFilter} className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 font-medium">
                      <RefreshCw size={12} /> Reset
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                  {Object.values(Category).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-slate-50 transition-colors text-left"
                    >
                      <span className="text-slate-700">{cat}</span>
                      {selectedCategories.includes(cat) && <Check size={16} className="text-indigo-600" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={downloadCSV}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            title="Download CSV"
          >
            <Download size={18} />
          </button>
          
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            title="Ekspor ke PDF"
          >
            <FileText size={18} />
          </button>

          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-lg shadow-indigo-200"
            title="Print"
          >
            <Printer size={18} />
          </button>
        </div>
      </div>

      {/* --- ACCOUNTING VIEW --- */}
      {viewMode === 'ACCOUNTING' ? (
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-100 min-h-[600px] print:shadow-none print:border-none print:p-0">
            <div className="text-center mb-8 border-b-2 border-slate-800 pb-6">
                <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-widest mb-1">Laporan Laba Rugi</h1>
                <p className="text-slate-500 font-medium uppercase text-sm tracking-wide">{getPeriodLabel()}</p>
            </div>

            <div className="max-w-3xl mx-auto space-y-8 font-mono text-sm md:text-base">
                {/* Revenue Section */}
                <div>
                    <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-200 pb-1">PENDAPATAN USAHA</h3>
                    <div className="space-y-2 pl-4">
                        {accountingData.incomeList.map(item => (
                            <div key={item.name} className="flex justify-between">
                                <span className="text-slate-600">{item.name}</span>
                                <span className="font-medium text-slate-800">{formatCurrency(item.amount)}</span>
                            </div>
                        ))}
                        {accountingData.incomeList.length === 0 && (
                             <div className="text-slate-400 italic">Tidak ada pendapatan</div>
                        )}
                    </div>
                    <div className="flex justify-between mt-4 pt-2 border-t border-slate-300 font-bold text-lg">
                        <span className="text-slate-900">Total Pendapatan</span>
                        <span className="text-emerald-700">{formatCurrency(stats.income)}</span>
                    </div>
                </div>

                {/* Expense Section */}
                <div>
                    <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-200 pb-1">BEBAN USAHA</h3>
                    <div className="space-y-2 pl-4">
                        {accountingData.expenseList.map(item => (
                            <div key={item.name} className="flex justify-between">
                                <span className="text-slate-600">{item.name}</span>
                                <span className="font-medium text-slate-800">({formatCurrency(item.amount)})</span>
                            </div>
                        ))}
                         {accountingData.expenseList.length === 0 && (
                             <div className="text-slate-400 italic">Tidak ada beban</div>
                        )}
                    </div>
                    <div className="flex justify-between mt-4 pt-2 border-t border-slate-300 font-bold text-lg">
                        <span className="text-slate-900">Total Beban</span>
                        <span className="text-rose-700">({formatCurrency(stats.expense)})</span>
                    </div>
                </div>

                {/* Net Income */}
                <div className="mt-8 pt-4 border-t-2 border-slate-800">
                    <div className="flex justify-between items-center text-xl font-bold">
                        <span className="text-slate-900 uppercase">Laba Bersih</span>
                        <span className={`px-4 py-1 border-b-4 double-border ${stats.profit >= 0 ? 'border-emerald-600 text-emerald-700' : 'border-rose-600 text-rose-700'}`}>
                            {formatCurrency(stats.profit)}
                        </span>
                    </div>
                </div>

                <div className="mt-12 text-center text-xs text-slate-400 italic print:block hidden">
                    Dicetak secara otomatis oleh sistem LetsFinance
                </div>
            </div>
        </div>
      ) : (
      /* --- VISUAL VIEW (Existing) --- */
      <>
      {/* Print Header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Laporan Keuangan Visual</h1>
        <p className="text-slate-500">{getPeriodLabel()}</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:border-slate-300">
          <p className="text-sm text-slate-500 font-medium mb-1">Total Pemasukan</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.income)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:border-slate-300">
          <p className="text-sm text-slate-500 font-medium mb-1">Total Pengeluaran</p>
          <p className="text-2xl font-bold text-rose-600">{formatCurrency(stats.expense)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:border-slate-300">
          <p className="text-sm text-slate-500 font-medium mb-1">Arus Kas Bersih</p>
          <p className={`text-2xl font-bold ${stats.profit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
            {formatCurrency(stats.profit)}
          </p>
        </div>
      </div>

      {/* Charts Area */}
      {filteredData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block print:space-y-6">
          {/* Main Time Series Bar Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:break-inside-avoid print:border-slate-300">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Arus Kas (Semua Kategori)</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} tick={{fontSize: 12, fill: '#64748b'}} />
                  <RechartsTooltip formatter={(val: number) => formatCurrency(val)} cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="income" name="Pemasukan" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart Categories (Filtered) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:break-inside-avoid print:border-slate-300">
            <div className="flex flex-col justify-between items-start mb-2 gap-2">
              <h3 className="text-lg font-bold text-slate-800">Distribusi Pengeluaran</h3>
              {selectedCategories.length > 0 && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                  <Filter size={10} /> Filtered: {selectedCategories.length}
                </span>
              )}
            </div>
            
            {categoryData.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{fontSize: '11px', paddingTop: '10px'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-slate-400">
                <PieChart size={40} className="mb-2 opacity-20" />
                <p>Tidak ada data pengeluaran</p>
                {selectedCategories.length > 0 && <p className="text-xs mt-1">untuk kategori terpilih</p>}
              </div>
            )}
          </div>

          {/* Category Comparison Bar Chart */}
          <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:break-inside-avoid print:border-slate-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">Alokasi Pengeluaran Bulanan</h3>
              {selectedCategories.length > 0 && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">Filtered</span>
              )}
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryComparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} interval={0} angle={-45} textAnchor="end" height={60} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} tick={{fontSize: 12, fill: '#64748b'}} />
                  <RechartsTooltip formatter={(val: number) => formatCurrency(val)} cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                  <Bar dataKey="income" name="Pemasukan" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <Filter className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Tidak ada data di periode ini</h3>
          <p className="text-slate-500">Coba ubah filter periode atau tanggal.</p>
        </div>
      )}

      {/* Top Expenses Table (Filtered) */}
      {filteredExpenseData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden print:border-slate-300 print:break-inside-avoid">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800">5 Pengeluaran Terbesar</h3>
            {selectedCategories.length > 0 && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">Filtered View</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Tanggal</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Keterangan</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Merchant</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase">Kategori</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 uppercase text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topExpenses.map((t) => (
                  <tr key={t.id}>
                    <td className="p-4 text-sm text-slate-600">
                      {new Date(t.date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="p-4 font-medium text-slate-800">
                      {t.description}
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {t.merchant || '-'}
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {t.category}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-rose-600">
                      {formatCurrency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Analysis Section */}
      <div className="bg-gradient-to-br from-indigo-900 to-violet-900 rounded-2xl shadow-lg p-6 text-white overflow-hidden relative print:break-inside-avoid">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Sparkles size={100} />
        </div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <Sparkles className="text-yellow-300" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Ringkasan Analisis AI</h3>
                <p className="text-indigo-200 text-sm">Insight otomatis berdasarkan laporan periode ini</p>
              </div>
            </div>
            
            {!analysisPoints && !isAnalyzing && (
              <button 
                onClick={handleAnalyze}
                className="px-4 py-2 bg-white text-indigo-900 rounded-lg font-bold text-sm hover:bg-indigo-50 transition-colors shadow-lg active:scale-95"
              >
                Analisis Sekarang
              </button>
            )}
          </div>

          {isAnalyzing ? (
            <div className="py-8 flex flex-col items-center justify-center text-indigo-200">
                <Loader2 className="animate-spin mb-2" size={32} />
                <p>Membaca data laporan...</p>
            </div>
          ) : analysisPoints ? (
            <div className="space-y-3 animate-fade-in">
                {analysisPoints.map((point, idx) => (
                  <div key={idx} className="flex gap-3 bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-indigo-50 text-sm leading-relaxed">{point}</p>
                  </div>
                ))}
                <div className="mt-4 text-right">
                  <button onClick={handleAnalyze} className="text-xs text-indigo-300 hover:text-white underline">
                      Perbarui Analisis
                  </button>
                </div>
            </div>
          ) : (
            <div className="py-4 text-center text-indigo-200 text-sm bg-white/5 rounded-xl border border-white/5 border-dashed">
                <p>Klik tombol di atas untuk melihat tren dan anomali pada laporan ini.</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="hidden print:block text-center text-xs text-slate-400 mt-8">
        Dicetak dari LetsFinance pada {new Date().toLocaleString('id-ID')}
      </div>
      </>
      )}
    </div>
  );
});