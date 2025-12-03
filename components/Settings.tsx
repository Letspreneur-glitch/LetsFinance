import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Trash2, Cloud, Database, RefreshCw, Key, LogIn, CheckCircle, Clock, Settings as SettingsIcon, Wallet, Plus, X, ArrowLeft, Tag, CreditCard, ChevronRight, Building2, PlusCircle, Edit2, Check, XCircle } from 'lucide-react';
import { Transaction, Invoice, Account } from '../types';

interface SettingsProps {
  transactions: Transaction[];
  invoices: Invoice[];
  accounts: Account[];
  setAccounts: (acc: Account[]) => void;
  expenseCategories: string[];
  setExpenseCategories: (cats: string[]) => void;
  incomeCategories: string[];
  setIncomeCategories: (cats: string[]) => void;
  onImport: (file: File) => void;
  onReset: () => void;
}

// Global declaration for Google API
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const BACKUP_FILENAME = 'letsfinance_backup_auto.json';

export const Settings: React.FC<SettingsProps> = ({ 
  transactions, invoices, 
  accounts, setAccounts,
  expenseCategories, setExpenseCategories,
  incomeCategories, setIncomeCategories,
  onImport, onReset 
}) => {
  const [activeTab, setActiveTab] = useState<'CONFIG' | 'DATA'>('CONFIG');
  const [configSection, setConfigSection] = useState<'MENU' | 'ACCOUNTS' | 'CATEGORIES'>('MENU');
  const [categoryType, setCategoryType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  
  // -- Setup State --
  const [newCategory, setNewCategory] = useState('');
  const [newAccount, setNewAccount] = useState<{ name: string; type: 'CASH' | 'BANK' | 'E-WALLET'; initialBalance: string }>({ name: '', type: 'CASH', initialBalance: '' });

  // -- Edit State --
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingAccountName, setEditingAccountName] = useState('');

  // -- Data Management State --
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gapiInited, setGapiInited] = useState(false);
  const [gisInited, setGisInited] = useState(false);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [clientId, setClientId] = useState(localStorage.getItem('gdrive_client_id') || '');
  const [apiKey, setApiKey] = useState(localStorage.getItem('gdrive_api_key') || '');
  const [showConfig, setShowConfig] = useState(false);

  // Initialize Google Scripts
  useEffect(() => {
    const script1 = document.createElement('script');
    script1.src = "https://apis.google.com/js/api.js";
    script1.async = true;
    script1.defer = true;
    script1.onload = () => setGapiInited(true);
    document.body.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = "https://accounts.google.com/gsi/client";
    script2.async = true;
    script2.defer = true;
    script2.onload = () => setGisInited(true);
    document.body.appendChild(script2);

    const savedSync = localStorage.getItem('letsfinance_last_sync');
    if(savedSync) setLastSyncTime(savedSync);

    return () => {
      document.body.removeChild(script1);
      document.body.removeChild(script2);
    };
  }, []);

  const saveConfig = () => {
    localStorage.setItem('gdrive_client_id', clientId);
    localStorage.setItem('gdrive_api_key', apiKey);
    alert("Konfigurasi disimpan. Silakan refresh halaman.");
    window.location.reload();
  };

  const initializeGapiClient = async () => {
    if(!clientId || !apiKey) {
      alert("Mohon masukkan Client ID dan API Key Google Cloud terlebih dahulu.");
      setShowConfig(true);
      return;
    }

    try {
      await window.gapi.client.init({
        apiKey: apiKey,
        discoveryDocs: [DISCOVERY_DOC],
      });
      
      const tClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            setIsConnected(true);
          }
        },
      });
      setTokenClient(tClient);
    } catch (err) {
      console.error("GAPI Init Error", err);
      alert("Gagal inisialisasi Google API. Cek Console & Konfigurasi.");
    }
  };

  const handleAuthClick = () => {
    if (!tokenClient) {
      initializeGapiClient();
      return;
    }
    
    if (window.gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
      tokenClient.requestAccessToken({prompt: ''});
    }
  };

  const prepareBackupData = () => {
    return JSON.stringify({
      transactions,
      invoices,
      accounts,
      expenseCategories,
      incomeCategories,
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0'
    }, null, 2);
  };

  const uploadToDrive = async () => {
    if (!isConnected) { alert("Mohon login ke Google Drive terlebih dahulu."); return; }
    setIsSyncing(true);
    try {
      const response = await window.gapi.client.drive.files.list({
        q: `name = '${BACKUP_FILENAME}' and trashed = false`,
        fields: 'files(id, name)',
      });
      const files = response.result.files;
      const fileContent = prepareBackupData();
      const fileMetadata = { name: BACKUP_FILENAME, mimeType: 'application/json' };
      const boundary = '-------314159265358979323846';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";
      const contentType = 'application/json';
      const multipartRequestBody = delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(fileMetadata) + delimiter + 'Content-Type: ' + contentType + '\r\n\r\n' + fileContent + close_delim;

      if (files && files.length > 0) {
        const fileId = files[0].id;
        await window.gapi.client.request({
          path: `/upload/drive/v3/files/${fileId}`,
          method: 'PATCH',
          params: { uploadType: 'multipart' },
          headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
          body: multipartRequestBody
        });
        alert("Backup berhasil diperbarui di Google Drive!");
      } else {
        await window.gapi.client.request({
          path: '/upload/drive/v3/files',
          method: 'POST',
          params: { uploadType: 'multipart' },
          headers: { 'Content-Type': 'multipart/related; boundary="' + boundary + '"' },
          body: multipartRequestBody
        });
        alert("Backup baru berhasil dibuat di Google Drive!");
      }
      
      const now = new Date();
      const nowStr = now.toLocaleString('id-ID');
      setLastSyncTime(nowStr);
      localStorage.setItem('letsfinance_last_sync', nowStr);
      localStorage.setItem('letsfinance_last_sync_ts', now.getTime().toString());

    } catch (err) {
      console.error("Upload Error", err);
      alert("Gagal upload ke Google Drive.");
    } finally {
      setIsSyncing(false);
    }
  };

  const restoreFromDrive = async () => {
    if (!isConnected) { alert("Mohon login ke Google Drive terlebih dahulu."); return; }
    setIsSyncing(true);
    try {
       const response = await window.gapi.client.drive.files.list({
        q: `name = '${BACKUP_FILENAME}' and trashed = false`,
        fields: 'files(id, name)',
      });
      const files = response.result.files;
      if (files && files.length > 0) {
        const fileId = files[0].id;
        const result = await window.gapi.client.drive.files.get({ fileId: fileId, alt: 'media' });
        const json = result.result;
        const blob = new Blob([JSON.stringify(json)], {type: 'application/json'});
        const file = new File([blob], BACKUP_FILENAME, {type: 'application/json'});
        if (confirm(`Backup ditemukan. Pulihkan data? Data saat ini akan ditimpa.`)) {
           onImport(file);
        }
      } else {
        alert("File backup tidak ditemukan.");
      }
    } catch (err) {
      alert("Gagal mengambil data dari Google Drive.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = () => {
    const dataStr = prepareBackupData();
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `letsfinance_backup_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (confirm("Data saat ini akan ditimpa dengan data dari file backup. Lanjutkan?")) {
        onImport(file);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- Configuration Handlers ---
  const addAccount = () => {
    if(!newAccount.name.trim()) {
        alert("Nama akun tidak boleh kosong");
        return;
    }
    const balance = newAccount.initialBalance === '' ? 0 : parseFloat(newAccount.initialBalance);
    
    if (isNaN(balance) || balance < 0) {
        alert("Saldo awal tidak valid. Harus angka positif.");
        return;
    }

    setAccounts([...accounts, { 
      id: Date.now().toString(), 
      name: newAccount.name, 
      type: newAccount.type as any, 
      initialBalance: balance 
    }]);
    setNewAccount({ name: '', type: 'CASH', initialBalance: '' });
  };

  const startEditAccount = (acc: Account) => {
    setEditingAccountId(acc.id);
    setEditingAccountName(acc.name);
  };

  const saveEditAccount = () => {
    if (editingAccountId && editingAccountName.trim()) {
      setAccounts(accounts.map(acc => 
        acc.id === editingAccountId ? { ...acc, name: editingAccountName } : acc
      ));
      setEditingAccountId(null);
      setEditingAccountName('');
    }
  };

  const removeAccount = (id: string) => {
      if (accounts.length <= 1) {
          alert("Anda harus menyisakan setidaknya satu akun agar sistem berjalan dengan baik.");
          return;
      }
      if (confirm("Hapus akun ini? Transaksi yang terkait mungkin akan kehilangan referensi nama akun.")) {
          setAccounts(accounts.filter(a => a.id !== id));
      }
  };

  const addCategory = () => {
    if (!newCategory.trim()) return;
    
    if (categoryType === 'EXPENSE') {
        if (!expenseCategories.includes(newCategory)) {
            setExpenseCategories([...expenseCategories, newCategory]);
        }
    } else {
        if (!incomeCategories.includes(newCategory)) {
            setIncomeCategories([...incomeCategories, newCategory]);
        }
    }
    setNewCategory('');
  };

  const removeCategory = (cat: string) => {
      if (categoryType === 'EXPENSE') {
          setExpenseCategories(expenseCategories.filter(c => c !== cat));
      } else {
          setIncomeCategories(incomeCategories.filter(c => c !== cat));
      }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-6 pb-24">
      
      {/* Top Nav Tabs */}
      <div className="flex bg-white rounded-xl shadow-sm border border-slate-100 p-1">
        <button
          onClick={() => { setActiveTab('CONFIG'); setConfigSection('MENU'); }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'CONFIG' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <SettingsIcon size={18} /> Konfigurasi
        </button>
        <button
          onClick={() => setActiveTab('DATA')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'DATA' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Database size={18} /> Data Backup
        </button>
      </div>

      {activeTab === 'CONFIG' && (
        <div className="space-y-6">
           
           {/* CONFIG MENU */}
           {configSection === 'MENU' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                <button 
                  onClick={() => setConfigSection('ACCOUNTS')}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all text-left group"
                >
                   <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Wallet size={28} />
                   </div>
                   <h3 className="text-lg font-bold text-slate-800 mb-1">Kelola Akun</h3>
                   <p className="text-sm text-slate-500">Tambah, edit, atau hapus dompet & bank.</p>
                   <div className="mt-4 flex items-center text-blue-600 text-sm font-bold">
                      Atur Akun <ChevronRight size={16} />
                   </div>
                </button>

                <button 
                  onClick={() => setConfigSection('CATEGORIES')}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all text-left group"
                >
                   <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Tag size={28} />
                   </div>
                   <h3 className="text-lg font-bold text-slate-800 mb-1">Kelola Kategori</h3>
                   <p className="text-sm text-slate-500">Sesuaikan kategori pemasukan dan pengeluaran.</p>
                   <div className="mt-4 flex items-center text-emerald-600 text-sm font-bold">
                      Atur Kategori <ChevronRight size={16} />
                   </div>
                </button>
             </div>
           )}

           {/* ACCOUNTS MANAGEMENT */}
           {configSection === 'ACCOUNTS' && (
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 animate-fade-in">
                <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                   <button onClick={() => setConfigSection('MENU')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                      <ArrowLeft size={20} />
                   </button>
                   <div>
                      <h3 className="font-bold text-slate-800">Daftar Akun & Dompet</h3>
                      <p className="text-xs text-slate-500">{accounts.length} Akun terdaftar</p>
                   </div>
                </div>
                
                <div className="p-6 space-y-4">
                   <div className="grid gap-3">
                      {accounts.map(acc => (
                        <div key={acc.id} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 bg-slate-50 transition-all hover:shadow-sm">
                           <div className="flex items-center gap-3 flex-1">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0 ${
                                acc.type === 'CASH' ? 'bg-emerald-500' : acc.type === 'BANK' ? 'bg-blue-500' : 'bg-purple-500'
                              }`}>
                                 {acc.type === 'CASH' ? <Wallet size={20}/> : acc.type === 'BANK' ? <Building2 size={20}/> : <CreditCard size={20}/>}
                              </div>
                              
                              <div className="flex-1">
                                 {editingAccountId === acc.id ? (
                                   <div className="flex items-center gap-2">
                                      <input 
                                        type="text" 
                                        className="border border-indigo-300 rounded px-2 py-1 text-sm font-bold text-slate-700 outline-none w-full"
                                        value={editingAccountName}
                                        onChange={(e) => setEditingAccountName(e.target.value)}
                                        autoFocus
                                      />
                                      <button onClick={saveEditAccount} className="p-1 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200"><Check size={16} /></button>
                                      <button onClick={() => setEditingAccountId(null)} className="p-1 bg-slate-100 text-slate-500 rounded hover:bg-slate-200"><X size={16} /></button>
                                   </div>
                                 ) : (
                                   <>
                                     <p className="font-bold text-slate-700">{acc.name}</p>
                                     <p className="text-xs text-slate-500">
                                        {acc.type === 'CASH' ? 'Tunai' : acc.type === 'BANK' ? 'Bank' : 'E-Wallet'} • Awal: Rp{acc.initialBalance.toLocaleString('id-ID')}
                                     </p>
                                   </>
                                 )}
                              </div>
                           </div>
                           
                           {editingAccountId !== acc.id && (
                             <div className="flex items-center gap-1">
                               <button 
                                  onClick={() => startEditAccount(acc)}
                                  className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="Edit Nama Akun"
                               >
                                  <Edit2 size={16} />
                               </button>
                               {accounts.length > 1 && (
                                 <button 
                                      onClick={() => removeAccount(acc.id)} 
                                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                      title="Hapus Akun"
                                 >
                                      <Trash2 size={16} />
                                 </button>
                               )}
                             </div>
                           )}
                        </div>
                      ))}
                   </div>

                   <div className="pt-6 mt-4 border-t border-slate-100">
                      <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <PlusCircle size={18} className="text-indigo-600"/> Tambah Akun Baru
                      </h4>
                      
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                         {/* Form Inputs (Same as before) */}
                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Nama Akun</label>
                            <input 
                                type="text" 
                                placeholder="Contoh: Dompet Utama, BCA, GoPay"
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-700"
                                value={newAccount.name}
                                onChange={e => setNewAccount({...newAccount, name: e.target.value})}
                            />
                         </div>

                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Tipe Akun</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'CASH', label: 'Tunai', icon: Wallet, color: 'bg-emerald-100 text-emerald-600 border-emerald-200' },
                                    { id: 'BANK', label: 'Bank', icon: Building2, color: 'bg-blue-100 text-blue-600 border-blue-200' },
                                    { id: 'E-WALLET', label: 'E-Wallet', icon: CreditCard, color: 'bg-purple-100 text-purple-600 border-purple-200' }
                                ].map((type) => (
                                    <button
                                        key={type.id}
                                        onClick={() => setNewAccount({...newAccount, type: type.id as any})}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                                            newAccount.type === type.id 
                                            ? `${type.color} ring-2 ring-offset-1 ring-indigo-500/30` 
                                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                                        }`}
                                    >
                                        <type.icon size={20} className="mb-1" />
                                        <span className="text-xs font-bold">{type.label}</span>
                                    </button>
                                ))}
                            </div>
                         </div>

                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Saldo Awal</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rp</span>
                                <input 
                                    type="number" 
                                    min="0"
                                    placeholder="0"
                                    className="w-full p-3 pl-10 bg-white border border-slate-200 rounded-xl text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder-slate-300"
                                    value={newAccount.initialBalance}
                                    onKeyDown={(e) => {
                                        if (e.key === '-' || e.key === 'e') e.preventDefault();
                                    }}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setNewAccount({...newAccount, initialBalance: val});
                                    }}
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-1 ml-1">
                                Masukkan saldo saat ini untuk memulai pencatatan.
                            </p>
                         </div>

                         <button 
                            onClick={addAccount} 
                            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98] mt-2"
                         >
                            <Plus size={18} /> Simpan Akun Baru
                         </button>
                      </div>
                   </div>
                </div>
             </div>
           )}

           {/* CATEGORIES MANAGEMENT */}
           {configSection === 'CATEGORIES' && (
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 animate-fade-in">
                <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                   <button onClick={() => setConfigSection('MENU')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                      <ArrowLeft size={20} />
                   </button>
                   <div>
                      <h3 className="font-bold text-slate-800">Daftar Kategori</h3>
                      <p className="text-xs text-slate-500">Atur label transaksi Anda</p>
                   </div>
                </div>

                <div className="p-6">
                   {/* Type Toggle */}
                   <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                      <button 
                        onClick={() => setCategoryType('EXPENSE')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                            categoryType === 'EXPENSE' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        Pengeluaran
                      </button>
                      <button 
                        onClick={() => setCategoryType('INCOME')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                            categoryType === 'INCOME' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
                        }`}
                      >
                        Pemasukan
                      </button>
                   </div>

                   <div className="flex flex-wrap gap-2 mb-6 min-h-[100px] content-start">
                      {(categoryType === 'EXPENSE' ? expenseCategories : incomeCategories).map(cat => (
                        <div key={cat} className={`inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg border text-sm font-medium ${
                            categoryType === 'EXPENSE' 
                            ? 'bg-rose-50 text-rose-700 border-rose-100' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                           {cat}
                           <button onClick={() => removeCategory(cat)} className="hover:bg-black/5 rounded p-0.5 transition-colors">
                              <X size={14}/>
                           </button>
                        </div>
                      ))}
                   </div>

                   <div className="flex gap-2">
                      <input 
                         type="text" 
                         placeholder={`Tambah Kategori ${categoryType === 'EXPENSE' ? 'Pengeluaran' : 'Pemasukan'}...`}
                         className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                         value={newCategory}
                         onChange={e => setNewCategory(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && addCategory()}
                      />
                      <button 
                        onClick={addCategory} 
                        className={`px-4 py-2 rounded-xl text-white shadow-md transition-colors flex items-center justify-center ${
                            categoryType === 'EXPENSE' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                         <Plus size={24} />
                      </button>
                   </div>
                </div>
             </div>
           )}

        </div>
      )}

      {activeTab === 'DATA' && (
        /* Data Management Tab */
        <div className="space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center justify-center gap-2">
                <Database className="text-indigo-500" /> 
                Backup & Restore
                </h2>
                <p className="text-slate-500">Amankan data Anda ke Google Drive atau simpan file lokal.</p>
            </div>

            {/* Google Drive Integration Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 md:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                        <Cloud className="text-blue-600" size={24} />
                    </div>
                    <div>
                    <h3 className="font-bold text-slate-800">Google Drive Sync</h3>
                    <p className="text-xs text-slate-500">Backup otomatis ke cloud pribadi</p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowConfig(!showConfig)}
                    className="text-slate-400 hover:text-slate-600"
                >
                    <Key size={18} />
                </button>
                </div>
                
                <div className="p-4 md:p-6 space-y-6">
                {/* Config Area */}
                {showConfig && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm mb-4 space-y-3">
                    <p className="font-bold text-slate-700">Konfigurasi API (Mode Pengembang)</p>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Google Client ID</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border rounded" 
                            value={clientId}
                            onChange={e => setClientId(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Google API Key</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border rounded" 
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                        />
                    </div>
                    <button onClick={saveConfig} className="bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-medium">Simpan Konfigurasi</button>
                    </div>
                )}

                {!isConnected ? (
                    <div className="text-center py-6">
                    <button 
                        onClick={handleAuthClick}
                        disabled={!gapiInited || !gisInited}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto justify-center"
                    >
                        <LogIn size={20} />
                        {(!gapiInited || !gisInited) ? 'Memuat Script...' : 'Hubungkan Google Drive'}
                    </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                        <CheckCircle size={20} />
                        <span className="font-medium text-sm">Terhubung ke Google Drive</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button 
                            onClick={uploadToDrive}
                            disabled={isSyncing}
                            className="flex flex-col items-center justify-center gap-2 p-6 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors group"
                        >
                            <div className="bg-white p-3 rounded-full shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                            {isSyncing ? <RefreshCw className="animate-spin" /> : <Upload />}
                            </div>
                            <span className="font-bold text-slate-700">Backup ke Cloud</span>
                        </button>

                        <button 
                            onClick={restoreFromDrive}
                            disabled={isSyncing}
                            className="flex flex-col items-center justify-center gap-2 p-6 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors group"
                        >
                            <div className="bg-white p-3 rounded-full shadow-sm text-indigo-600 group-hover:scale-110 transition-transform">
                            {isSyncing ? <RefreshCw className="animate-spin" /> : <Download />}
                            </div>
                            <span className="font-bold text-slate-700">Restore dari Cloud</span>
                        </button>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex items-center justify-center gap-3">
                        <div className={`p-2 rounded-full ${lastSyncTime ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                        <Clock size={18} />
                        </div>
                        <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sinkronisasi Terakhir</p>
                        <p className={`text-sm font-bold ${lastSyncTime ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                            {lastSyncTime ? lastSyncTime : 'Belum pernah sinkronisasi'}
                        </p>
                        </div>
                    </div>
                    </div>
                )}
                </div>
            </div>

            <div className="border-t border-slate-200 my-8"></div>

            {/* Manual File Section */}
            <h3 className="font-bold text-slate-800 mb-4">Backup Manual (File Lokal)</h3>
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-slate-300 transition-colors">
                <div className="mb-4">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Download size={16} className="text-emerald-500" />
                    Download JSON
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                    Simpan file backup ke komputer/HP Anda.
                    </p>
                </div>
                <button 
                    onClick={handleExport}
                    className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-lg font-bold hover:bg-slate-200 transition-colors text-sm"
                >
                    Download File
                </button>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-slate-300 transition-colors">
                <div className="mb-4">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Upload size={16} className="text-blue-500" />
                    Upload JSON
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                    Pulihkan data dari file JSON lokal.
                    </p>
                </div>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-lg font-bold hover:bg-slate-200 transition-colors text-sm"
                >
                    Pilih File
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".json"
                    className="hidden"
                />
                </div>
            </div>

            {/* Danger Zone */}
            <div className="mt-12 pt-8 border-t border-slate-200">
                <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <p className="font-bold text-rose-900">Hapus Semua Data Aplikasi</p>
                    <p className="text-sm text-rose-700">Tindakan ini tidak dapat dibatalkan. Semua transaksi dan invoice akan hilang permanen dari browser ini.</p>
                </div>
                <button 
                    onClick={onReset}
                    className="px-6 py-2 bg-white text-rose-600 border border-rose-200 font-bold rounded-lg hover:bg-rose-600 hover:text-white transition-colors whitespace-nowrap w-full md:w-auto"
                >
                    <Trash2 size={16} className="inline mr-2" />
                    Reset Data
                </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};