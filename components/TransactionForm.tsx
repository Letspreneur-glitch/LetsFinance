import React, { useState, useRef, useEffect } from 'react';
import { Transaction, TransactionType, Category, Account } from '../types';
import { Camera, Loader2, X, ArrowUpRight, ArrowDownRight, Sparkles, Calendar, ChevronLeft, ChevronRight, Wallet, Upload, Store, AlignLeft, ScanLine } from 'lucide-react';
import { scanReceiptWithGemini, fileToBase64 } from '../services/geminiService';

interface TransactionFormProps {
  accounts: Account[];
  expenseCategories: string[];
  incomeCategories: string[];
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onClose: () => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = React.memo(({ 
  accounts, expenseCategories, incomeCategories,
  onAddTransaction, onClose 
}) => {
  const [isScanning, setIsScanning] = useState(false);
  
  // Safe defaults
  const defaultExpense = expenseCategories.length > 0 ? expenseCategories[0] : 'Umum';
  const defaultIncome = incomeCategories.length > 0 ? incomeCategories[0] : 'Umum';
  const defaultAccount = accounts.length > 0 ? accounts[0].id : '';

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    type: TransactionType.EXPENSE,
    category: defaultExpense,
    description: '',
    merchant: '',
    accountId: defaultAccount
  });

  // Handle type change to update category correctly
  useEffect(() => {
    const currentList = formData.type === TransactionType.EXPENSE ? expenseCategories : incomeCategories;
    
    if (!currentList.includes(formData.category)) {
       setFormData(prev => ({
           ...prev,
           category: currentList.length > 0 ? currentList[0] : 'Umum'
       }));
    }
  }, [formData.type, expenseCategories, incomeCategories]);
  
  // Calendar State
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Dynamic theme based on transaction type
  const isExpense = formData.type === TransactionType.EXPENSE;
  // Colors
  const themeColor = isExpense ? 'rose' : 'emerald';
  const bgColor = isExpense ? 'bg-rose-50' : 'bg-emerald-50';
  const textColor = isExpense ? 'text-rose-600' : 'text-emerald-600';
  const borderColor = isExpense ? 'border-rose-200' : 'border-emerald-200';
  const focusRing = isExpense ? 'focus:ring-rose-500' : 'focus:ring-emerald-500';
  const buttonClass = isExpense 
    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' 
    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200';

  // Sync viewDate when popup opens
  useEffect(() => {
    if (showCalendar) {
      setViewDate(new Date(formData.date));
    }
  }, [showCalendar, formData.date]);

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await scanReceiptWithGemini(base64, file.type);
      
      setFormData(prev => ({
        ...prev,
        amount: result.amount ? String(result.amount) : prev.amount,
        merchant: result.merchant || prev.merchant,
        date: result.date || prev.date,
        description: result.description || `Pembelian di ${result.merchant || 'Toko'}`,
        category: result.category || prev.category, // Use scanned or keep existing
        type: TransactionType.EXPENSE 
      }));
    } catch (error) {
      alert("Gagal memindai struk. Silakan input manual.");
    } finally {
      setIsScanning(false);
      // Reset inputs so change event fires again if same file selected
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddTransaction({
      date: formData.date,
      amount: Number(formData.amount),
      type: formData.type,
      category: formData.category,
      description: formData.description,
      merchant: formData.merchant,
      accountId: formData.accountId || (accounts.length > 0 ? accounts[0].id : 'unknown')
    });
    onClose();
  };

  // Calendar Helpers
  const changeMonth = (offset: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
    setViewDate(newDate);
  };

  const selectDate = (day: number) => {
    const year = viewDate.getFullYear();
    const month = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    setFormData({ ...formData, date: `${year}-${month}-${d}` });
    setShowCalendar(false);
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="h-9 w-9" />);
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isSelected = dateStr === formData.date;
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      
      days.push(
        <button
          key={i}
          type="button"
          onClick={() => selectDate(i)}
          className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors
            ${isSelected 
              ? 'bg-indigo-600 text-white shadow-md' 
              : isToday 
                ? 'bg-indigo-50 text-indigo-600 font-bold border border-indigo-200'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
        >
          {i}
        </button>
      );
    }

    // Modal Style for Mobile, Popover for Desktop
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <span className="font-bold text-slate-700">Pilih Tanggal</span>
               <button onClick={() => setShowCalendar(false)} className="p-1 hover:bg-slate-200 rounded-full"><X size={18}/></button>
            </div>
            <div className="p-4">
                <div className="flex justify-between items-center mb-6">
                <button type="button" onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 border border-slate-200">
                    <ChevronLeft size={20} />
                </button>
                <span className="font-bold text-lg text-slate-800">
                    {viewDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                </span>
                <button type="button" onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 border border-slate-200">
                    <ChevronRight size={20} />
                </button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
                    <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase py-1">
                    {d}
                    </div>
                ))}
                </div>

                <div className="grid grid-cols-7 gap-1 place-items-center">
                {days}
                </div>
                
                <button 
                  onClick={() => setShowCalendar(false)}
                  className="w-full mt-6 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200"
                >
                    Batal
                </button>
            </div>
        </div>
      </div>
    );
  };

  const categories = isExpense ? expenseCategories : incomeCategories;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4 transition-all duration-300">
      <div className="bg-white w-full h-[95vh] md:h-auto md:max-h-[90vh] rounded-t-3xl md:rounded-3xl md:max-w-lg shadow-2xl overflow-hidden animate-fade-in-up flex flex-col relative">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 shrink-0">
          <h2 className="text-xl font-bold text-slate-800">Transaksi Baru</h2>
          <button 
            onClick={onClose} 
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="overflow-y-auto p-5 space-y-6 flex-1 bg-white">
          
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. Type Switcher */}
            <div className="flex bg-slate-100 p-1.5 rounded-xl shrink-0 relative">
               {/* Animated Background Slider can be added here for extra polish */}
              <button
                type="button"
                onClick={() => setFormData(prev => ({...prev, type: TransactionType.EXPENSE, category: expenseCategories[0] || 'Umum' }))}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${
                  isExpense 
                    ? 'bg-white text-rose-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ArrowDownRight size={18} />
                Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({...prev, type: TransactionType.INCOME, category: incomeCategories[0] || 'Umum' }))}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${
                  !isExpense 
                    ? 'bg-white text-emerald-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ArrowUpRight size={18} />
                Pemasukan
              </button>
            </div>

            {/* 2. Main Amount Input */}
            <div className={`p-6 rounded-2xl border transition-colors ${bgColor} ${borderColor}`}>
              <label className={`block text-xs font-bold uppercase mb-2 text-center ${textColor} tracking-wider opacity-80`}>
                Total Nominal
              </label>
              <div className="relative flex justify-center items-baseline gap-1">
                <span className={`text-2xl font-bold ${textColor} opacity-60`}>Rp</span>
                <input 
                  type="number" 
                  required
                  min="0"
                  placeholder="0"
                  autoFocus
                  className={`w-full text-center py-2 text-4xl font-bold bg-transparent outline-none placeholder-black/10 ${textColor}`}
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  inputMode="numeric" 
                />
              </div>
            </div>

            {/* 3. AI Scan & Date Row */}
            <div className="flex gap-3">
                {/* AI Scan Mini Button */}
                <div className="relative group flex-shrink-0">
                   <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isScanning}
                      className="h-full px-4 bg-indigo-50 border border-indigo-100 rounded-xl flex flex-col items-center justify-center gap-1 text-indigo-600 hover:bg-indigo-100 transition-colors"
                      title="Scan Struk AI"
                   >
                      {isScanning ? <Loader2 className="animate-spin" size={20} /> : <ScanLine size={20} />}
                      <span className="text-[10px] font-bold">SCAN AI</span>
                   </button>
                    {/* Hidden Inputs */}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleScanReceipt} />
                    <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleScanReceipt} />
                </div>

                {/* Date Picker */}
                <div 
                    onClick={() => setShowCalendar(true)}
                    className="flex-1 border border-slate-200 rounded-xl p-3 flex items-center justify-between hover:border-indigo-400 transition-colors cursor-pointer bg-white group"
                >
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Tanggal</span>
                        <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600">
                            {new Date(formData.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                    </div>
                    <Calendar size={18} className="text-slate-300 group-hover:text-indigo-500" />
                </div>
            </div>

            {/* 4. Account & Category */}
            <div className="grid grid-cols-2 gap-4">
                {/* Account */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                        <Wallet size={14} className="text-slate-400" />
                        <span className="text-[10px] uppercase font-bold text-slate-400">Akun / Dompet</span>
                    </div>
                    <select 
                        className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none"
                        value={formData.accountId}
                        onChange={e => setFormData({...formData, accountId: e.target.value})}
                    >
                        {accounts.map(acc => (
                           <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                    </select>
                </div>

                {/* Category */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                        <div className={`w-3 h-3 rounded-full ${isExpense ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                        <span className="text-[10px] uppercase font-bold text-slate-400">Kategori</span>
                    </div>
                    <select 
                        className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                    >
                        {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 5. Merchant & Description */}
            <div className="space-y-3">
                 <div className="relative">
                    <Store className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Nama Toko / Merchant (Opsional)"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium placeholder-slate-400"
                        value={formData.merchant}
                        onChange={e => setFormData({...formData, merchant: e.target.value})}
                    />
                 </div>

                 <div className="relative">
                    <AlignLeft className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                    <textarea 
                        rows={2}
                        placeholder="Catatan transaksi..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium placeholder-slate-400 resize-none"
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                 </div>
            </div>
            
            {/* Spacer for scroll */}
            <div className="h-16 md:h-4"></div>

            {/* Action Button - Sticky Bottom on Mobile */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 md:relative md:border-none md:p-0 md:bg-transparent">
              <button 
                type="submit" 
                className={`w-full py-3.5 rounded-xl text-white font-bold text-base shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2 ${buttonClass}`}
              >
                Simpan Transaksi
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
});