import React, { useState, useEffect, useCallback } from 'react';
import { Transaction, ViewState, TransactionType, Invoice, Account } from './types';
import { Dashboard } from './components/Dashboard';
import { TransactionList } from './components/TransactionList';
import { TransactionForm } from './components/TransactionForm';
import { AIAdvisor } from './components/AIAdvisor';
import { InvoiceGenerator } from './components/InvoiceGenerator';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { LayoutDashboard, ReceiptText, Sparkles, PlusCircle, FileText, Menu, X, PieChart, Settings as SettingsIcon, TriangleAlert, ArrowRight, Trash2, Plus } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  // New State for Custom Setup
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Sync Warning State
  const [syncAlert, setSyncAlert] = useState<'NONE' | 'OLD' | null>(null);

  // -- CONFIRMATION MODAL STATE --
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDanger: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    isDanger: false,
  });

  // Store the pending action
  const [pendingAction, setPendingAction] = useState<{
    type: 'DELETE_TRANSACTION' | 'CLEAR_ALL_TRANSACTIONS' | 'RESET_DATA';
    payload?: string;
  } | null>(null);

  // Check Sync Status on Mount
  useEffect(() => {
    const checkSyncStatus = () => {
        const lastSyncTs = localStorage.getItem('letsfinance_last_sync_ts');
        if (!lastSyncTs) {
            setSyncAlert('NONE');
        } else {
            const lastDate = Number(lastSyncTs);
            const now = Date.now();
            const diffDays = (now - lastDate) / (1000 * 3600 * 24);
            
            // Alert if older than 3 days
            if (diffDays > 3) {
                setSyncAlert('OLD');
            } else {
                setSyncAlert(null);
            }
        }
    };
    
    checkSyncStatus();
  }, [view]);

  // Load Data
  useEffect(() => {
    // 1. Accounts
    let loadedAccounts: Account[] = [];
    const savedAccounts = localStorage.getItem('letsfinance_accounts');
    if (savedAccounts) {
      try { loadedAccounts = JSON.parse(savedAccounts); } catch (e) {}
    } 
    if (loadedAccounts.length === 0) {
      loadedAccounts = [
        { id: '1', name: 'Kas Tunai', type: 'CASH', initialBalance: 0 },
        { id: '2', name: 'Rekening Bank', type: 'BANK', initialBalance: 0 }
      ];
    }
    setAccounts(loadedAccounts);

    // 2. Transactions
    const savedTransactions = localStorage.getItem('letsfinance_transactions');
    if (savedTransactions) {
      try {
        let loadedTx: Transaction[] = JSON.parse(savedTransactions);
        // Migration: Ensure all transactions have an accountId
        const defaultAccountId = loadedAccounts[0]?.id || '1';
        let hasChanges = false;
        
        loadedTx = loadedTx.map(t => {
            if (!t.accountId) {
                hasChanges = true;
                return { ...t, accountId: defaultAccountId };
            }
            return t;
        });

        setTransactions(loadedTx);
        if (hasChanges) localStorage.setItem('letsfinance_transactions', JSON.stringify(loadedTx));
      } catch (e) { console.error("Failed to parse transactions"); }
    } else {
      const demoData: Transaction[] = [
        { id: '1', date: new Date().toISOString().split('T')[0], amount: 5000000, type: TransactionType.INCOME, category: 'Penjualan', description: 'Penjualan Mingguan', merchant: 'Toko', accountId: loadedAccounts[0]?.id },
      ];
      setTransactions(demoData);
    }

    // 3. Other Data
    const savedInvoices = localStorage.getItem('letsfinance_invoices');
    if (savedInvoices) try { setInvoices(JSON.parse(savedInvoices)); } catch (e) {}

    const savedExpCats = localStorage.getItem('letsfinance_exp_categories');
    if (savedExpCats) {
      try { setExpenseCategories(JSON.parse(savedExpCats)); } catch (e) {}
    } else {
      setExpenseCategories(['Makanan & Minuman', 'Transportasi', 'Listrik & Air', 'Stok Barang', 'Gaji Karyawan', 'Pemasaran', 'Lainnya']);
    }

    const savedIncCats = localStorage.getItem('letsfinance_inc_categories');
    if (savedIncCats) {
      try { setIncomeCategories(JSON.parse(savedIncCats)); } catch (e) {}
    } else {
      setIncomeCategories(['Penjualan', 'Investasi', 'Hadiah', 'Lainnya']);
    }
  }, []);

  // --- OPTIMIZED PERSISTENCE (DEBOUNCING) ---
  // Prevents lagging when typing or rapid state updates
  const useDebouncedEffect = (effect: () => void, deps: any[], delay: number) => {
    useEffect(() => {
      const handler = setTimeout(() => effect(), delay);
      return () => clearTimeout(handler);
    }, [...deps, delay]);
  };

  useDebouncedEffect(() => { localStorage.setItem('letsfinance_transactions', JSON.stringify(transactions)); }, [transactions], 800);
  useDebouncedEffect(() => { localStorage.setItem('letsfinance_invoices', JSON.stringify(invoices)); }, [invoices], 800);
  useDebouncedEffect(() => { localStorage.setItem('letsfinance_accounts', JSON.stringify(accounts)); }, [accounts], 800);
  useDebouncedEffect(() => { localStorage.setItem('letsfinance_exp_categories', JSON.stringify(expenseCategories)); }, [expenseCategories], 800);
  useDebouncedEffect(() => { localStorage.setItem('letsfinance_inc_categories', JSON.stringify(incomeCategories)); }, [incomeCategories], 800);

  // --- Handlers (Memoized) ---

  const addTransaction = useCallback((t: Omit<Transaction, 'id'>) => {
    const txData = { ...t };
    if (!txData.accountId && accounts.length > 0) {
        txData.accountId = accounts[0].id;
    }
    const newTransaction = { ...txData, id: Date.now().toString() };
    setTransactions(prev => [newTransaction, ...prev]);
  }, [accounts]);

  // Trigger Modal
  const requestDeleteTransaction = useCallback((id: string) => {
    setPendingAction({ type: 'DELETE_TRANSACTION', payload: id });
    setModalConfig({
      isOpen: true,
      title: 'Hapus Transaksi?',
      message: 'Transaksi ini akan dihapus permanen dari riwayat.',
      isDanger: false
    });
  }, []);

  const requestClearAll = useCallback(() => {
    if (transactions.length === 0) return;
    setPendingAction({ type: 'CLEAR_ALL_TRANSACTIONS' });
    setModalConfig({
      isOpen: true,
      title: 'Hapus Semua Data?',
      message: 'PERINGATAN: Seluruh riwayat transaksi akan dihapus. Pastikan Anda sudah backup data.',
      isDanger: true
    });
  }, [transactions.length]);

  const requestReset = useCallback(() => {
    setPendingAction({ type: 'RESET_DATA' });
    setModalConfig({
      isOpen: true,
      title: 'Reset Aplikasi?',
      message: 'Semua data transaksi, invoice, dan pengaturan akan dihapus dari browser ini. Aplikasi akan kembali ke pengaturan awal.',
      isDanger: true
    });
  }, []);

  // Execute Action
  const executeConfirm = () => {
    if (!pendingAction) return;

    if (pendingAction.type === 'DELETE_TRANSACTION' && pendingAction.payload) {
      setTransactions(prev => prev.filter(t => t.id !== pendingAction.payload));
    } else if (pendingAction.type === 'CLEAR_ALL_TRANSACTIONS') {
      setTransactions([]);
    } else if (pendingAction.type === 'RESET_DATA') {
      localStorage.clear();
      window.location.reload();
    }

    // Close Modal
    setModalConfig(prev => ({ ...prev, isOpen: false }));
    setPendingAction(null);
  };

  // Backup & Restore
  const handleImportData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.transactions || !Array.isArray(json.transactions)) throw new Error("Format file tidak valid.");
        
        setTransactions(json.transactions);
        if (json.invoices) setInvoices(json.invoices);
        if (json.accounts) setAccounts(json.accounts);
        if (json.expenseCategories) setExpenseCategories(json.expenseCategories);
        if (json.incomeCategories) setIncomeCategories(json.incomeCategories);
        alert("Data berhasil dipulihkan!");
      } catch (err) { alert("Gagal membaca file backup."); }
    };
    reader.readAsText(file);
  };

  const NavItem = ({ viewName, label, icon: Icon }: { viewName: ViewState, label: string, icon: any }) => (
    <button
      onClick={() => { setView(viewName); setIsMobileMenuOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        view === viewName ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon size={20} /> <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white p-4 flex justify-between items-center shadow-sm sticky top-0 z-20 print:hidden">
        <div className="flex items-center gap-2">
          <img src="https://imguh.com/images/2025/11/28/Gemini_Generated_Image_748fhg748fhg748f16548f7c41539f0e.png" alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-bold text-slate-800">LetsFinance</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 p-6 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:relative print:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="hidden md:flex items-center gap-3 mb-10 px-2">
          <img src="https://imguh.com/images/2025/11/28/Gemini_Generated_Image_748fhg748fhg748f16548f7c41539f0e.png" alt="Logo" className="w-10 h-10 rounded-xl shadow-lg shadow-indigo-600/20 object-cover" />
          <div>
            <h1 className="font-bold text-slate-900 text-lg leading-tight">LetsFinance</h1>
            <p className="text-xs text-slate-400 font-medium">UMKM & Personal</p>
          </div>
        </div>
        <nav className="space-y-2">
          <NavItem viewName="DASHBOARD" label="Dashboard" icon={LayoutDashboard} />
          <NavItem viewName="TRANSACTIONS" label="Transaksi" icon={ReceiptText} />
          <NavItem viewName="REPORTS" label="Laporan" icon={PieChart} />
          <NavItem viewName="INVOICE" label="Buat Invoice" icon={FileText} />
          <NavItem viewName="AI_ADVISOR" label="Konsultan AI" icon={Sparkles} />
          <div className="pt-4 mt-4 border-t border-slate-100">
             <NavItem viewName="SETTINGS" label="Pengaturan" icon={SettingsIcon} />
          </div>
        </nav>
        <div className="absolute bottom-6 left-6 right-6 hidden md:block">
          <button onClick={() => setShowAddModal(true)} className="w-full bg-slate-900 text-white py-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg hover:bg-slate-800 transition-transform active:scale-95">
            <PlusCircle size={20} /> Transaksi
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-[calc(100vh-60px)] md:h-screen print:h-auto print:overflow-visible relative pb-24 md:pb-8">
        <header className="flex justify-between items-center mb-8 print:hidden">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {view === 'DASHBOARD' && 'Ringkasan Keuangan'}
              {view === 'TRANSACTIONS' && 'Daftar Transaksi'}
              {view === 'REPORTS' && 'Laporan Keuangan'}
              {view === 'INVOICE' && 'Generator Invoice'}
              {view === 'AI_ADVISOR' && 'Analisis Cerdas'}
              {view === 'SETTINGS' && 'Pengaturan Aplikasi'}
            </h2>
            <p className="text-slate-500 text-sm">Kelola keuangan bisnis Anda dengan mudah.</p>
          </div>
          <div className="hidden md:flex items-center gap-3">
             <div className="text-right">
                <p className="text-sm font-bold text-slate-700">Halo, Owner</p>
                <p className="text-xs text-slate-400">UMKM Maju Jaya</p>
             </div>
             <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden border-2 border-white shadow-sm">
                <img src="https://picsum.photos/100/100" alt="Profile" className="w-full h-full object-cover" />
             </div>
          </div>
        </header>

        {syncAlert && (
            <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between gap-4 animate-fade-in ${syncAlert === 'NONE' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-orange-50 border-orange-200 text-orange-800'}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${syncAlert === 'NONE' ? 'bg-amber-100 text-amber-600' : 'bg-orange-100 text-orange-600'}`}>
                        <TriangleAlert size={20} />
                    </div>
                    <div>
                        <p className="font-bold text-sm">{syncAlert === 'NONE' ? 'Data Anda belum dicadangkan.' : 'Sinkronisasi data terakhir sudah lebih dari 3 hari.'}</p>
                        <p className="text-xs opacity-90">Hubungkan Google Drive untuk mencegah kehilangan data keuangan Anda.</p>
                    </div>
                </div>
                <button onClick={() => setView('SETTINGS')} className={`flex items-center gap-1 px-4 py-2 rounded-lg font-bold text-xs transition-colors whitespace-nowrap ${syncAlert === 'NONE' ? 'bg-amber-100 hover:bg-amber-200 text-amber-900' : 'bg-orange-100 hover:bg-orange-200 text-orange-900'}`}>
                    Backup Sekarang <ArrowRight size={14} />
                </button>
            </div>
        )}

        {view === 'DASHBOARD' && (
          <Dashboard transactions={transactions} accounts={accounts} onNavigateToReports={() => setView('REPORTS')} />
        )}
        {view === 'TRANSACTIONS' && (
            <TransactionList transactions={transactions} accounts={accounts} onDelete={requestDeleteTransaction} onClearAll={requestClearAll} />
        )}
        {view === 'REPORTS' && <Reports transactions={transactions} />}
        {view === 'INVOICE' && <InvoiceGenerator invoices={invoices} onUpdateInvoices={setInvoices} />}
        {view === 'AI_ADVISOR' && <AIAdvisor transactions={transactions} />}
        {view === 'SETTINGS' && (
          <Settings 
            transactions={transactions} invoices={invoices} accounts={accounts} setAccounts={setAccounts}
            expenseCategories={expenseCategories} setExpenseCategories={setExpenseCategories}
            incomeCategories={incomeCategories} setIncomeCategories={setIncomeCategories}
            onImport={handleImportData} onReset={requestReset} 
          />
        )}
      </main>

      {/* Floating Action Button (Mobile Only) */}
      <div className="md:hidden fixed bottom-6 right-6 z-40 print:hidden">
        <button 
            onClick={() => setShowAddModal(true)}
            className="w-14 h-14 bg-slate-900 text-white rounded-full shadow-xl shadow-slate-900/30 flex items-center justify-center active:scale-95 transition-transform"
        >
            <Plus size={28} strokeWidth={2.5} />
        </button>
      </div>

      {/* Modal Transaction Form */}
      {showAddModal && (
        <TransactionForm 
          accounts={accounts} expenseCategories={expenseCategories} incomeCategories={incomeCategories}
          onAddTransaction={addTransaction} onClose={() => setShowAddModal(false)} 
        />
      )}

      {/* Confirmation Modal */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
            <div className={`p-6 text-center ${modalConfig.isDanger ? 'bg-rose-50' : 'bg-white'}`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${modalConfig.isDanger ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                {modalConfig.isDanger ? <TriangleAlert size={32} /> : <Trash2 size={32} />}
              </div>
              <h3 className={`text-lg font-bold mb-2 ${modalConfig.isDanger ? 'text-rose-800' : 'text-slate-800'}`}>
                {modalConfig.title}
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">{modalConfig.message}</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setModalConfig(prev => ({...prev, isOpen: false}))}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors text-sm"
              >
                Batal
              </button>
              <button 
                onClick={executeConfirm}
                className={`flex-1 py-2.5 font-bold rounded-xl text-white transition-colors text-sm shadow-lg ${modalConfig.isDanger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
              >
                {modalConfig.isDanger ? 'Hapus' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;