import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, Account } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, DollarSign, CreditCard, Calendar, Filter } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  accounts: Account[];
  onNavigateToReports?: () => void;
}

const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899'];

type DashboardPeriod = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'ALL';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

export const Dashboard: React.FC<DashboardProps> = React.memo(({ transactions, accounts, onNavigateToReports }) => {
  const [period, setPeriod] = useState<DashboardPeriod>('THIS_MONTH');

  // 1. Filter Transactions based on selected period
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      
      switch (period) {
        case 'TODAY':
          return tDate >= startOfDay;
        case 'THIS_WEEK': {
          const day = now.getDay() || 7; // Get current day number, make Sunday 7
          if (day !== 1) now.setHours(-24 * (day - 1)); // Set to Monday
          now.setHours(0,0,0,0);
          return tDate >= now;
        }
        case 'THIS_MONTH':
          return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
        case 'LAST_MONTH': {
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          return tDate.getMonth() === lastMonth.getMonth() && tDate.getFullYear() === lastMonth.getFullYear();
        }
        case 'THIS_YEAR':
          return tDate.getFullYear() === now.getFullYear();
        case 'ALL':
        default:
          return true;
      }
    });
  }, [transactions, period]);

  // 2. Calculate Stats based on FILTERED transactions
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    const categoryMap: Record<string, number> = {};

    filteredTransactions.forEach(t => {
      if (t.type === TransactionType.INCOME) {
        income += t.amount;
      } else {
        expense += t.amount;
        categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
      }
    });

    const categoryData = Object.keys(categoryMap).map(key => ({
      name: key,
      value: categoryMap[key]
    })).sort((a, b) => b.value - a.value);

    return { income, expense, balance: income - expense, categoryData };
  }, [filteredTransactions]);

  // 3. Calculate Account Balances based on ALL transactions (Balances are always absolute)
  const accountBalances = useMemo(() => {
    return accounts.map(acc => {
        const accIncome = transactions
            .filter(t => t.accountId === acc.id && t.type === TransactionType.INCOME)
            .reduce((sum, t) => sum + t.amount, 0);
        const accExpense = transactions
            .filter(t => t.accountId === acc.id && t.type === TransactionType.EXPENSE)
            .reduce((sum, t) => sum + t.amount, 0);
        
        return {
            ...acc,
            currentBalance: (acc.initialBalance || 0) + accIncome - accExpense
        };
    });
  }, [transactions, accounts]);

  // 4. Calculate Total Assets (Sum of all account balances)
  const totalAssets = useMemo(() => {
    return accountBalances.reduce((sum, acc) => sum + acc.currentBalance, 0);
  }, [accountBalances]);

  // 5. Generate Chart Data (Dynamic grouping based on period)
  const chartData = useMemo(() => {
    const data: Record<string, { name: string; masuk: number; keluar: number; order: number }> = {};
    
    // Group by Month for Yearly/All view, Group by Day for others
    const isMonthlyView = period === 'THIS_YEAR' || period === 'ALL';

    if (isMonthlyView && period === 'THIS_YEAR') {
       // Pre-fill months
       for(let i=0; i<12; i++) {
          const d = new Date(new Date().getFullYear(), i, 1);
          const key = d.toLocaleString('default', { month: 'short' });
          data[key] = { name: key, masuk: 0, keluar: 0, order: i };
       }
    } else if (period === 'THIS_MONTH' || period === 'LAST_MONTH') {
       // Pre-fill days of month
       const now = new Date();
       const year = period === 'LAST_MONTH' && now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
       const month = period === 'LAST_MONTH' ? (now.getMonth() === 0 ? 11 : now.getMonth() - 1) : now.getMonth();
       const daysInMonth = new Date(year, month + 1, 0).getDate();
       
       for(let i=1; i<=daysInMonth; i++) {
          const d = new Date(year, month, i);
          const key = d.getDate().toString();
          data[key] = { name: key, masuk: 0, keluar: 0, order: i };
       }
    }

    filteredTransactions.forEach(t => {
        const tDate = new Date(t.date);
        let key = '';
        let order = 0;

        if (isMonthlyView) {
            key = tDate.toLocaleString('default', { month: 'short' });
            order = tDate.getMonth();
            // Append year if ALL to avoid collision
            if (period === 'ALL') {
                key = `${key} ${tDate.getFullYear().toString().substr(-2)}`;
                order = tDate.getTime();
            }
        } else {
            key = tDate.getDate().toString();
            order = tDate.getDate();
             // Append month if ALL/Weeks to avoid collision (simplified for this logic, mostly handles Month views)
             if (period === 'THIS_WEEK' || period === 'TODAY') {
                key = tDate.toLocaleDateString('id-ID', { weekday: 'short' });
                order = tDate.getDay() === 0 ? 7 : tDate.getDay(); // Mon=1
             }
        }

        if (!data[key]) data[key] = { name: key, masuk: 0, keluar: 0, order };

        if (t.type === TransactionType.INCOME) data[key].masuk += t.amount;
        else data[key].keluar += t.amount;
    });

    return Object.values(data).sort((a, b) => a.order - b.order);
  }, [filteredTransactions, period]);

  const getPeriodLabel = () => {
      switch(period) {
          case 'TODAY': return 'Hari Ini';
          case 'THIS_WEEK': return 'Minggu Ini';
          case 'THIS_MONTH': return 'Bulan Ini';
          case 'LAST_MONTH': return 'Bulan Lalu';
          case 'THIS_YEAR': return 'Tahun Ini';
          case 'ALL': return 'Semua Waktu';
          default: return '';
      }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-0">
      
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
         <div className="flex items-center gap-2 text-slate-700">
            <Filter size={20} className="text-indigo-500" />
            <span className="font-bold">Periode Analisis:</span>
         </div>
         <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
                <select 
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
                    className="w-full sm:w-48 p-2 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer text-slate-700"
                >
                    <option value="TODAY">Hari Ini</option>
                    <option value="THIS_WEEK">Minggu Ini</option>
                    <option value="THIS_MONTH">Bulan Ini</option>
                    <option value="LAST_MONTH">Bulan Lalu</option>
                    <option value="THIS_YEAR">Tahun Ini</option>
                    <option value="ALL">Semua Waktu</option>
                </select>
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
            {onNavigateToReports && (
                <button
                    onClick={onNavigateToReports}
                    className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-100 transition-colors whitespace-nowrap"
                >
                    <Filter size={16} className="rotate-90" /> Laporan
                </button>
            )}
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pemasukan ({getPeriodLabel()})</p>
            <p className="text-xl md:text-2xl font-bold text-slate-800">{formatCurrency(stats.income)}</p>
          </div>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-rose-100 rounded-full text-rose-600">
            <TrendingDown size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pengeluaran ({getPeriodLabel()})</p>
            <p className="text-xl md:text-2xl font-bold text-slate-800">{formatCurrency(stats.expense)}</p>
          </div>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 rounded-full text-blue-600">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Net Cash ({getPeriodLabel()})</p>
            <p className={`text-xl md:text-2xl font-bold ${stats.balance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
              {formatCurrency(stats.balance)}
            </p>
          </div>
        </div>
      </div>

      {/* Account Balances Row (Always All Time) */}
      <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CreditCard className="text-indigo-500" size={20} /> Dompet Saya
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-3 py-1 rounded-full flex items-center gap-1">
                Total Aset: <span className="font-bold text-slate-800">{formatCurrency(totalAssets)}</span>
            </span>
        </h3>
        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
            {accountBalances.map(acc => (
                <div key={acc.id} className="snap-start flex-none w-[220px] p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded bg-white border ${acc.type === 'CASH' ? 'text-emerald-600 border-emerald-100' : 'text-blue-600 border-blue-100'}`}>
                            {acc.type === 'CASH' ? 'TUNAI' : acc.type === 'BANK' ? 'BANK' : 'E-WALLET'}
                        </span>
                        <Wallet size={16} className="text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium truncate">{acc.name}</p>
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(acc.currentBalance)}</p>
                </div>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 h-80">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Tren Keuangan <span className="text-sm font-normal text-slate-400">({getPeriodLabel()})</span></h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} />
              <RechartsTooltip formatter={(value: number) => formatCurrency(value)} cursor={{fill: 'transparent'}} />
              <Bar dataKey="masuk" fill="#10B981" radius={[4, 4, 0, 0]} name="Pemasukan" barSize={20} />
              <Bar dataKey="keluar" fill="#EF4444" radius={[4, 4, 0, 0]} name="Pengeluaran" barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Categories Chart */}
        <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 h-80">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Alokasi Pengeluaran <span className="text-sm font-normal text-slate-400">({getPeriodLabel()})</span></h3>
          {stats.categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px'}} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <DollarSign size={40} className="mb-2 opacity-50" />
              <p>Belum ada data pengeluaran</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});