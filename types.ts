
export enum TransactionType {
  INCOME = 'Pemasukan',
  EXPENSE = 'Pengeluaran',
}

// Default constants for initialization, but app will use dynamic state
export enum Category {
  FOOD = 'Makanan & Minuman',
  TRANSPORT = 'Transportasi',
  UTILITIES = 'Listrik & Air',
  INVENTORY = 'Stok Barang',
  SALES = 'Penjualan',
  SALARY = 'Gaji Karyawan',
  MARKETING = 'Pemasaran',
  OTHER = 'Lainnya',
}

export interface Account {
  id: string;
  name: string;
  type: 'CASH' | 'BANK' | 'E-WALLET';
  initialBalance: number;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  merchant?: string;
  accountId?: string; // Optional for backward compatibility
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
}

export interface Invoice {
  id: string;
  clientName: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  status: 'Draft' | 'Sent' | 'Paid';
}

export interface AIAnalysisResult {
  merchant: string;
  date: string;
  amount: number;
  category: string;
  items?: string[];
}

export type ViewState = 'DASHBOARD' | 'TRANSACTIONS' | 'INVOICE' | 'AI_ADVISOR' | 'REPORTS' | 'SETTINGS';
