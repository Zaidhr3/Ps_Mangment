import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('يرجى إضافة متغيرات البيئة الخاصة بـ Supabase');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Device = {
  id: string;
  name: string;
  type: 'external' | 'internal' | 'vip';
  status: 'available' | 'occupied' | 'maintenance';
  hourly_rate: number;
  extra_controller_rate: number;
  location: string;
};

export type Session = {
  id: string;
  device_id: string;
  start_time: string;
  end_time: string | null;
  extra_controllers: number;
  status: 'active' | 'completed';
  total_cost: number;
  discount_amount: number;
  final_amount: number;
  customer_name?: string;
};

export type User = {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: 'market' | 'coffee';
  created_at: string;
};

export type Sale = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount_amount: number;
  final_amount: number;
  created_at: string;
};

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: 'rent' | 'electricity' | 'water' | 'other';
  date: string;
  created_at: string;
};

export type Debt = {
  id: string;
  customer_name: string;
  amount: number;
  description: string | null;
  status: 'pending' | 'paid';
  paid_at: string | null;
  created_at: string;
};

export type DailySummary = {
  id: string;
  date: string;
  sessions_revenue: number;
  sales_revenue: number;
  expenses_total: number;
  discounts_total: number;
  net_income: number;
  created_at: string;
};