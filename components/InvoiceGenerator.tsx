import React, { useState, useEffect } from 'react';
import { InvoiceItem, Invoice } from '../types';
import { Plus, Trash, Printer, Save, History, Edit, FilePlus, Trash2, Settings, Building2, Wallet } from 'lucide-react';

interface InvoiceGeneratorProps {
  invoices: Invoice[];
  onUpdateInvoices: (updatedInvoices: Invoice[]) => void;
}

interface BusinessProfile {
  name: string;
  address: string;
  email: string;
  phone: string;
  bankInfo: string;
  logoUrl?: string;
}

export const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({ invoices, onUpdateInvoices }) => {
  // View State
  const [activeTab, setActiveTab] = useState<'EDITOR' | 'HISTORY' | 'CONFIG'>('EDITOR');
  
  // Business Profile State
  const [profile, setProfile] = useState<BusinessProfile>({
    name: '',
    address: '',
    email: '',
    phone: '',
    bankInfo: ''
  });

  // Load Profile from Local Storage
  useEffect(() => {
    const savedProfile = localStorage.getItem('letsfinance_invoice_profile');
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
      } catch (e) { console.error("Failed to load invoice profile"); }
    } else {
        // Default filler if empty
        setProfile({
            name: 'Nama Bisnis Anda',
            address: 'Alamat Bisnis, Kota, Negara',
            email: 'email@bisnis.com',
            phone: '0812-3456-7890',
            bankInfo: 'Bank BCA 1234567890 a.n Nama Pemilik'
        });
    }
  }, []);

  // Form State
  const [currentId, setCurrentId] = useState<string>(''); // Empty string means new invoice
  const [clientName, setClientName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Sent' | 'Paid'>('Draft');
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', description: 'Jasa Konsultasi', quantity: 1, price: 500000 }
  ]);

  // Actions
  const handleSaveProfile = () => {
    localStorage.setItem('letsfinance_invoice_profile', JSON.stringify(profile));
    alert("Profil bisnis berhasil disimpan! Invoice akan menggunakan data ini.");
    setActiveTab('EDITOR');
  };

  const handleSave = () => {
    if (!clientName.trim()) {
      alert("Mohon isi nama klien terlebih dahulu.");
      return;
    }

    const invoiceData: Invoice = {
      id: currentId || Date.now().toString(),
      clientName,
      date: new Date().toISOString().split('T')[0],
      dueDate,
      items,
      status
    };

    let updatedInvoices;
    if (currentId) {
      // Update existing
      updatedInvoices = invoices.map(inv => inv.id === currentId ? invoiceData : inv);
      alert("Perubahan berhasil disimpan!");
    } else {
      // Create new
      updatedInvoices = [invoiceData, ...invoices];
      setCurrentId(invoiceData.id); // Set ID to switch mode to 'editing' this new invoice
      alert("Invoice baru berhasil disimpan!");
    }

    onUpdateInvoices(updatedInvoices);
  };

  const handleEdit = (invoice: Invoice) => {
    setCurrentId(invoice.id);
    setClientName(invoice.clientName);
    setDueDate(invoice.dueDate);
    setItems(invoice.items);
    setStatus(invoice.status);
    setActiveTab('EDITOR');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Yakin ingin menghapus invoice ini?")) {
      const updated = invoices.filter(inv => inv.id !== id);
      onUpdateInvoices(updated);
      if (currentId === id) handleNew();
    }
  };

  const handleNew = () => {
    setCurrentId('');
    setClientName('');
    setDueDate('');
    setStatus('Draft');
    setItems([{ id: Date.now().toString(), description: '', quantity: 1, price: 0 }]);
    setActiveTab('EDITOR');
  };

  // Item Logic
  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), description: '', quantity: 1, price: 0 }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20">
      {/* Top Controls (Hidden on Print) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-2 mb-6 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
        <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('EDITOR')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all flex-1 md:flex-none justify-center whitespace-nowrap ${
              activeTab === 'EDITOR' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FilePlus size={16} /> Editor
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all flex-1 md:flex-none justify-center whitespace-nowrap ${
              activeTab === 'HISTORY' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <History size={16} /> Riwayat ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab('CONFIG')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all flex-1 md:flex-none justify-center whitespace-nowrap ${
              activeTab === 'CONFIG' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings size={16} /> Setup Bisnis
          </button>
        </div>

        {activeTab === 'EDITOR' && (
          <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-x-auto">
             <button 
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              <FilePlus size={16} /> Baru
            </button>
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
            >
              <Save size={16} /> Simpan
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
            >
              <Printer size={16} /> Print / PDF
            </button>
          </div>
        )}
      </div>

      {activeTab === 'CONFIG' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden max-w-2xl mx-auto">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Building2 className="text-indigo-600"/> Setup Profil Bisnis
                </h2>
                <p className="text-slate-500 text-sm mt-1">Informasi ini akan ditampilkan pada kop dan footer invoice Anda.</p>
            </div>
            <div className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Bisnis / Perusahaan</label>
                    <input 
                        type="text" 
                        className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={profile.name}
                        onChange={e => setProfile({...profile, name: e.target.value})}
                        placeholder="Contoh: PT Maju Mundur"
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
                    <textarea 
                        rows={2}
                        className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                        value={profile.address}
                        onChange={e => setProfile({...profile, address: e.target.value})}
                        placeholder="Alamat kantor..."
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                        <input 
                            type="email" 
                            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={profile.email}
                            onChange={e => setProfile({...profile, email: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Nomor Telepon</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={profile.phone}
                            onChange={e => setProfile({...profile, phone: e.target.value})}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Info Pembayaran (Bank)</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            className="w-full p-2 pl-9 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={profile.bankInfo}
                            onChange={e => setProfile({...profile, bankInfo: e.target.value})}
                            placeholder="Bank BCA 123456 a.n ..."
                        />
                        <Wallet className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Akan ditampilkan di bagian bawah invoice.</p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button 
                        onClick={handleSaveProfile}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-md"
                    >
                        Simpan Profil
                    </button>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800">Riwayat Invoice</h2>
          </div>
          {invoices.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <History className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <p>Belum ada invoice yang disimpan.</p>
              <button onClick={() => setActiveTab('EDITOR')} className="mt-4 text-indigo-600 font-medium hover:underline">
                Buat Invoice Baru
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="p-4">Tanggal</th>
                    <th className="p-4">Klien</th>
                    <th className="p-4 text-right">Total</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => {
                     const invTotal = inv.items.reduce((s, i) => s + (i.quantity * i.price), 0);
                     return (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-sm text-slate-600">{new Date(inv.date).toLocaleDateString('id-ID')}</td>
                        <td className="p-4 font-medium text-slate-800">{inv.clientName}</td>
                        <td className="p-4 text-right font-mono text-sm">{formatCurrency(invTotal)}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                            inv.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleEdit(inv)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium"
                            >
                              <Edit size={14} /> Edit
                            </button>
                            <button 
                              onClick={(e) => handleDelete(inv.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                              title="Hapus"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                     );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'EDITOR' && (
        /* EDITOR VIEW */
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden print:shadow-none print:border-none">
          {/* Invoice Canvas */}
          <div className="p-8 md:p-12 print:p-0">
            <div className="flex flex-col-reverse md:flex-row justify-between items-start mb-12 gap-6">
              <div className="w-full md:w-auto">
                <h1 className="text-4xl font-bold text-indigo-900 mb-2">INVOICE</h1>
                <p className="text-slate-500 mb-4">#{currentId ? currentId.slice(-6) : 'DRAFT'}</p>
                
                {/* Status Selector (Editor Only) */}
                <div className="print:hidden inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
                  {(['Draft', 'Sent', 'Paid'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        status === s 
                          ? (s === 'Paid' ? 'bg-emerald-100 text-emerald-700' : s === 'Sent' ? 'bg-blue-100 text-blue-700' : 'bg-white shadow-sm text-slate-700') 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {/* Status Display (Print Only) */}
                <div className="hidden print:inline-block px-3 py-1 rounded-full border border-slate-300 text-sm font-bold text-slate-700 uppercase tracking-wide">
                  {status}
                </div>
              </div>

              <div className="text-right w-full md:w-auto">
                <h3 className="font-bold text-slate-800 text-lg">{profile.name || 'Nama Bisnis Anda'}</h3>
                <p className="text-slate-500 text-sm">{profile.address || 'Alamat Bisnis'}</p>
                <p className="text-slate-500 text-sm">{profile.email || 'email@bisnis.com'}</p>
                <p className="text-slate-500 text-sm">{profile.phone || '08xx-xxxx-xxxx'}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2 print:hidden">Ditagihkan Kepada</label>
                <input 
                  type="text" 
                  placeholder="Nama Klien / Perusahaan"
                  className="w-full text-lg font-bold text-slate-800 border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-transparent placeholder-slate-300"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                />
                <div className="mt-2 text-sm text-slate-500">
                   Klien yang terhormat
                </div>
              </div>
              <div className="text-right">
                <div className="mb-2">
                  <span className="text-slate-500 text-sm mr-4">Tanggal:</span>
                  <span className="font-medium text-slate-800">{new Date().toLocaleDateString('id-ID')}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-sm mr-4">Jatuh Tempo:</span>
                  <input 
                    type="date"
                    className="font-medium text-slate-800 border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none bg-transparent text-right"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <table className="w-full mb-8">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="text-left py-3 text-sm font-bold text-slate-600 uppercase">Deskripsi</th>
                  <th className="text-center py-3 text-sm font-bold text-slate-600 uppercase w-24">Qty</th>
                  <th className="text-right py-3 text-sm font-bold text-slate-600 uppercase w-40">Harga</th>
                  <th className="text-right py-3 text-sm font-bold text-slate-600 uppercase w-40">Total</th>
                  <th className="w-10 print:hidden"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3">
                      <input 
                        type="text" 
                        className="w-full outline-none bg-transparent font-medium text-slate-700"
                        placeholder="Nama barang / jasa"
                        value={item.description}
                        onChange={e => updateItem(item.id, 'description', e.target.value)}
                      />
                    </td>
                    <td className="py-3">
                      <input 
                        type="number" 
                        min="1"
                        className="w-full text-center outline-none bg-transparent text-slate-600"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                      />
                    </td>
                    <td className="py-3">
                      <input 
                        type="number" 
                        min="0"
                        className="w-full text-right outline-none bg-transparent text-slate-600"
                        value={item.price}
                        onChange={e => updateItem(item.id, 'price', Number(e.target.value))}
                      />
                    </td>
                    <td className="py-3 text-right font-semibold text-slate-800">
                      {new Intl.NumberFormat('id-ID').format(item.quantity * item.price)}
                    </td>
                    <td className="py-3 text-center print:hidden">
                      {items.length > 1 && (
                        <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                          <Trash size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button 
              onClick={addItem}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium text-sm mb-8 print:hidden"
            >
              <Plus size={16} /> Tambah Baris
            </button>

            <div className="flex justify-end border-t-2 border-slate-100 pt-6">
              <div className="w-64">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-500 font-medium">Subtotal</span>
                  <span className="text-slate-800 font-bold">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(total)}</span>
                </div>
                <div className="flex justify-between items-center text-xl mt-4 pt-4 border-t border-slate-100">
                  <span className="text-indigo-900 font-bold">TOTAL</span>
                  <span className="text-indigo-600 font-bold text-2xl">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(total)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-12 text-slate-400 text-sm text-center print:mt-24">
              <p>Terima kasih atas kepercayaan Anda.</p>
              {profile.bankInfo && <p>Pembayaran dapat ditransfer ke {profile.bankInfo}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};