import React, { useState } from 'react';
import { Transaction } from '../types';
import { getFinancialAdvice } from '../services/geminiService';
import { Sparkles, Loader2, Lightbulb, TrendingUp } from 'lucide-react';

interface AIAdvisorProps {
  transactions: Transaction[];
}

export const AIAdvisor: React.FC<AIAdvisorProps> = ({ transactions }) => {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<{ analysis: string; tips: string[] } | null>(null);

  const handleGenerateAdvice = async () => {
    if (transactions.length === 0) {
      alert("Belum ada data transaksi untuk dianalisis.");
      return;
    }
    setLoading(true);
    try {
      const result = await getFinancialAdvice(transactions);
      setAdvice(result);
    } catch (e) {
      alert("Gagal menghubungi konsultan AI. Coba lagi nanti.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center justify-center gap-2">
          <Sparkles className="text-indigo-500" fill="currentColor" /> 
          Konsultan AI Cerdas
        </h2>
        <p className="text-slate-500">Dapatkan analisis mendalam dan saran strategis untuk keuangan Anda.</p>
      </div>

      {!advice && !loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lightbulb className="text-indigo-600" size={40} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Siap Menganalisis Data Anda</h3>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">
            AI kami akan membaca riwayat transaksi Anda untuk menemukan pola pengeluaran dan peluang penghematan.
          </p>
          <button 
            onClick={handleGenerateAdvice}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
          >
            Minta Saran Sekarang
          </button>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
          <p className="text-slate-600 font-medium">Sedang menganalisis neraca keuangan...</p>
          <p className="text-slate-400 text-sm mt-2">Menyiapkan strategi terbaik untuk Anda.</p>
        </div>
      )}

      {advice && !loading && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="bg-indigo-900 text-white rounded-2xl p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <TrendingUp size={120} />
            </div>
            <h3 className="text-xl font-bold mb-4 relative z-10">Analisis Keuangan</h3>
            <p className="leading-relaxed opacity-90 relative z-10 whitespace-pre-wrap">{advice.analysis}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
             {advice.tips.map((tip, idx) => (
               <div key={idx} className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
                 <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold mb-4">
                   {idx + 1}
                 </div>
                 <p className="text-slate-700 font-medium">{tip}</p>
               </div>
             ))}
          </div>

          <div className="text-center mt-8">
            <button 
              onClick={handleGenerateAdvice}
              className="text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
            >
              Perbarui Analisis
            </button>
          </div>
        </div>
      )}
    </div>
  );
};