import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionType } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

// Helper to convert file to base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      let encoded = reader.result?.toString().replace(/^data:(.*,)?/, '');
      if (encoded) {
        if ((encoded.length % 4) > 0) {
          encoded += '='.repeat(4 - (encoded.length % 4));
        }
        resolve(encoded);
      } else {
        reject(new Error("Failed to encode file"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

export const scanReceiptWithGemini = async (base64Image: string, mimeType: string) => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          {
            text: "Analisis gambar struk belanja ini. Ekstrak data berikut dalam format JSON: merchant (nama toko), date (YYYY-MM-DD), amount (total angka saja), category (pilih satu yang paling cocok: 'Stok Barang', 'Makanan & Minuman', 'Transportasi', 'Listrik & Air', 'Pemasaran', 'Lainnya'). Jika tidak terbaca, estimasi yang terbaik."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchant: { type: Type.STRING },
            date: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            description: { type: Type.STRING, description: "Ringkasan item yang dibeli" }
          },
          required: ["merchant", "amount", "category"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error scanning receipt:", error);
    throw error;
  }
};

export const getFinancialAdvice = async (transactions: Transaction[]) => {
  try {
    // Summarize data to save tokens
    const summary = transactions.slice(0, 50).map(t => `${t.date}: ${t.type} - Rp${t.amount} (${t.category})`).join('\n');

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Bertindaklah sebagai konsultan keuangan senior untuk UMKM di Indonesia. 
      Berikut adalah riwayat transaksi terakhir (maksimal 50):
      ${summary}
      
      Berikan analisis singkat dan 3 saran taktis yang bisa langsung diterapkan untuk meningkatkan keuntungan atau mengurangi biaya. 
      Gunakan bahasa Indonesia yang profesional namun mudah dimengerti. 
      Format output dalam JSON dengan struktur: { "analysis": string, "tips": string[] }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            tips: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error getting advice:", error);
    throw error;
  }
};

export const getReportAnalysis = async (transactions: Transaction[], periodLabel: string) => {
  try {
    const income = transactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
    // Increased sample size for better context
    const summaryList = transactions.slice(0, 50).map(t => `${t.date}: ${t.type} - Rp${t.amount} (${t.category})`).join('\n');

    const prompt = `Bertindaklah sebagai analis keuangan bisnis. 
    Analisis data keuangan berikut untuk periode: ${periodLabel}.
    
    Ringkasan Periode Ini:
    - Total Pemasukan: Rp${income}
    - Total Pengeluaran: Rp${expense}
    - Arus Kas Bersih: Rp${income - expense}
    
    Data Transaksi (Sampel 50 data terbaru):
    ${summaryList}

    Tugas: Berikan ringkasan analisis yang berisi 2-3 poin utama mengenai:
    1. Tren keuangan (apakah pemasukan/pengeluaran meningkat/menurun).
    2. Anomali (apakah ada pengeluaran besar yang tidak biasa).
    3. Insight singkat untuk efisiensi.

    Gunakan bahasa Indonesia yang profesional, ringkas, dan langsung pada intinya.
    Format output JSON: { "summary": ["poin 1", "poin 2", "poin 3"] }`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error getting report analysis:", error);
    throw error;
  }
};