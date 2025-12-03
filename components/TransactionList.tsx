import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, Account } from '../types';
import { ArrowDownRight, ArrowUpRight, Search, Trash2, Calendar, Store, Filter, XCircle, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

type FilterType = 'ALL' | 'INCOME' | 'EXPENSE';
type SortOrder = 'NEWEST' | 'OLDEST' | 'HIGHEST' | 'LOWEST';

const ITEMS_PER_PAGE = 10;

export const TransactionList: React.FC<TransactionListProps> = React.memo(({ transactions, accounts, onDelete, onClearAll }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('NEWEST');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, sortOrder]);

  // Helper to find account name
  const getAccountName = (accountId?: string) => {
      if (!accountId) return '';
      const acc = accounts.find(a => a.id === accountId);
      return acc ? acc.name : '';
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const formatDateFriendly = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hari Ini';
    if (date.toDateString() === yesterday.toDateString()) return 'Kemarin';
    
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  // --- Filtering & Sorting Logic ---
  const processedTransactions = useMemo(() => {
    let result = transactions.filter(t => {
      const matchesSearch = 
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.merchant && t.merchant.toLowerCase().includes(searchTerm.toLowerCase())) ||
        t.amount.toString().includes(searchTerm);
      
      const matchesType = 
        filterType === 'ALL' || 
        (filterType === 'INCOME' && t.type === TransactionType.INCOME) || 
        (filterType === 'EXPENSE' && t.type === TransactionType.EXPENSE);

      return matchesSearch && matchesType;
    });

    result.sort((a, b) => {
      switch (sortOrder) {
        case 'NEWEST': return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'OLDEST': return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'HIGHEST': return b.amount - a.amount;
        case 'LOWEST': return a.amount - b.amount;
        default: return 0;
      }
    });

    return result;
  }, [transactions, searchTerm, filterType, sortOrder]);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(processedTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = useMemo(() => {
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      return processedTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedTransactions, currentPage]);

  // --- Grouping Logic (By Date) applied only to current page ---
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, { transactions: Transaction[], total: number }> = {};
    
    paginatedTransactions.forEach(t => {
      if (!groups[t.date]) {
        groups[t.date] = { transactions: [], total: 0 };
      }
      groups[t.date].transactions.push(t);
      
      // Calculate daily net (only for displayed items)
      if (t.type === TransactionType.INCOME) groups[t.date].total += t.amount;
      else groups[t.date].total -= t.amount;
    });

    return groups;
  }, [paginatedTransactions]);

  // Summary of displayed data (Filtered total, not just page)
  const viewSummary = useMemo(() => {
    const income = processedTransactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
    const expense = processedTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
    return { income, expense };
  }, [processedTransactions]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full animate-fade-in relative">
      
      {/* Header Area */}
      <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-20 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar size={20} className="text-indigo-600"/> 
                Riwayat Transaksi
            </h2>
            
            <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Cari transaksi..." 
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <XCircle size={14} fill="currentColor" className="text-slate-200" />
                        </button>
                    )}
                </div>
                <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 rounded-xl border transition-colors ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500'}`}
                >
                    <Filter size={18} />
                </button>
            </div>
        </div>

        {/* Extended Filters */}
        {showFilters && (
            <div className="flex flex-wrap gap-2 animate-fade-in pt-2">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {(['ALL', 'INCOME', 'EXPENSE'] as FilterType[]).map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                filterType === type 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {type === 'ALL' ? 'Semua' : type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-slate-400 font-medium">Urutkan:</span>
                    <select 
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                        className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2 outline-none text-slate-600"
                    >
                        <option value="NEWEST">Terbaru</option>
                        <option value="OLDEST">Terlama</option>
                        <option value="HIGHEST">Nominal Tertinggi</option>
                        <option value="LOWEST">Nominal Terendah</option>
                    </select>
                </div>
            </div>
        )}

        {/* View Summary Stats */}
        {(filterType !== 'ALL' || searchTerm) && (
             <div className="flex gap-4 text-xs font-medium pt-2 border-t border-slate-50">
                <span className="text-slate-500">Hasil: {processedTransactions.length} Transaksi</span>
                {filterType !== 'EXPENSE' && <span className="text-emerald-600">Masuk: {formatCurrency(viewSummary.income)}</span>}
                {filterType !== 'INCOME' && <span className="text-rose-600">Keluar: {formatCurrency(viewSummary.expense)}</span>}
             </div>
        )}
      </div>

      <div className="overflow-y-auto flex-1 bg-slate-50 p-4 space-y-6">
        {Object.keys(groupedTransactions).length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400">
             <div className="bg-white p-4 rounded-full shadow-sm mb-3">
                <Search size={32} className="text-slate-200"/>
             </div>
            <p>Tidak ada transaksi yang sesuai.</p>
            {searchTerm && <button onClick={() => setSearchTerm('')} className="text-indigo-500 text-sm font-bold mt-2 hover:underline">Hapus pencarian</button>}
          </div>
        ) : (
            // Render Groups
            Object.keys(groupedTransactions).map(dateKey => {
                const group = groupedTransactions[dateKey];
                return (
                    <div key={dateKey} className="animate-fade-in-up">
                        {/* Date Header */}
                        <div className="flex justify-between items-end mb-2 px-1">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                                {formatDateFriendly(dateKey)}
                            </h3>
                            {/* Daily Total (Optional here, simpler to keep clean) */}
                        </div>

                        {/* List Items */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
                            {group.transactions.map((t) => (
                                <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center group">
                                    <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                                        {/* Icon Box */}
                                        <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-lg ${
                                            t.type === TransactionType.INCOME 
                                            ? 'bg-emerald-100 text-emerald-600' 
                                            : 'bg-rose-100 text-rose-600'
                                        }`}>
                                            {t.type === TransactionType.INCOME 
                                                ? <ArrowDownRight size={20} /> 
                                                : <ArrowUpRight size={20} />
                                            }
                                        </div>

                                        {/* Text Info */}
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-800 text-sm truncate pr-2">
                                                {t.description}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase">
                                                    {t.category}
                                                </span>
                                                {t.merchant && (
                                                    <span className="flex items-center gap-1 truncate">
                                                        • <Store size={10} /> {t.merchant}
                                                    </span>
                                                )}
                                                {t.accountId && (
                                                    <span className="flex items-center gap-1 truncate text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                                                        <Wallet size={10} /> {getAccountName(t.accountId)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Amount & Action */}
                                    <div className="flex items-center gap-3 pl-2">
                                        <span className={`font-bold text-sm whitespace-nowrap ${
                                            t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-800'
                                        }`}>
                                            {t.type === TransactionType.INCOME ? '+' : ''}{formatCurrency(t.amount)}
                                        </span>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(t.id);
                                            }}
                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Hapus"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })
        )}
      </div>

      {/* Pagination & Footer */}
      <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10 flex flex-col gap-3">
        {processedTransactions.length > ITEMS_PER_PAGE && (
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                    <ChevronLeft size={20} className="text-slate-600" />
                </button>
                <span className="text-xs font-bold text-slate-500">
                    Halaman {currentPage} dari {totalPages}
                </span>
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                    <ChevronRight size={20} className="text-slate-600" />
                </button>
            </div>
        )}

        {transactions.length > 0 && (
            <button 
                onClick={onClearAll}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-rose-600 font-bold text-sm hover:bg-rose-50 transition-colors border border-dashed border-rose-200 hover:border-rose-300"
            >
                <Trash2 size={16} /> Bersihkan Semua Riwayat
            </button>
        )}
      </div>
    </div>
  );
});