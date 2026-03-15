/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useMemo, Component } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  FileText, 
  Plus, 
  Search, 
  LogOut, 
  LogIn,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  History,
  CreditCard,
  BarChart3,
  Calendar,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  orderBy, 
  getDocFromServer,
  increment,
  writeBatch
} from 'firebase/firestore';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, db } from './firebase';
import { Customer, Product, Invoice, Payment, InvoiceItem, Category, Unit } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Firestore Error Handling
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In a real app, we might show a toast here
}

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="bg-white p-8 rounded-[32px] shadow-xl max-w-md w-full text-center">
            <AlertCircle className="text-red-500 w-16 h-16 mx-auto mb-4" />
            <h2 className="text-2xl font-serif font-bold mb-2">Đã có lỗi xảy ra</h2>
            <p className="text-gray-600 mb-6">Ứng dụng gặp sự cố không mong muốn. Vui lòng tải lại trang.</p>
            <pre className="text-xs bg-gray-100 p-4 rounded-xl mb-6 overflow-auto text-left max-h-40">
              {this.state.error?.message || JSON.stringify(this.state.error)}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-[#5A5A40] text-white rounded-full font-bold"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'products' | 'invoices' | 'payments' | 'reports'>('dashboard');
  
  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Connection Test
  useEffect(() => {
    if (user) {
      const testConnection = async () => {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.");
          }
        }
      };
      testConnection();
    }
  }, [user]);

  // Real-time Data Listeners
  useEffect(() => {
    if (!user) return;

    const unsubCustomers = onSnapshot(collection(db, 'customers'), 
      (snapshot) => {
        setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'customers')
    );

    const unsubProducts = onSnapshot(collection(db, 'products'), 
      (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    const unsubCategories = onSnapshot(collection(db, 'categories'), 
      (snapshot) => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'categories')
    );

    const unsubUnits = onSnapshot(collection(db, 'units'), 
      (snapshot) => {
        setUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'units')
    );

    const unsubInvoices = onSnapshot(query(collection(db, 'invoices'), orderBy('date', 'desc')), 
      (snapshot) => {
        setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'invoices')
    );

    const unsubPayments = onSnapshot(query(collection(db, 'payments'), orderBy('date', 'desc')), 
      (snapshot) => {
        setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
    );

    return () => {
      unsubCustomers();
      unsubProducts();
      unsubCategories();
      unsubUnits();
      unsubInvoices();
      unsubPayments();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#5A5A40]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0] p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[32px] shadow-xl max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-[#5A5A40] rounded-full flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-[#1a1a1a] mb-2">Quản lý Bán hàng</h1>
          <p className="text-gray-500 mb-8">Vui lòng đăng nhập để quản lý doanh thu và công nợ của bạn.</p>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-[#5A5A40] text-white py-4 rounded-full font-medium hover:bg-[#4A4A30] transition-colors"
          >
            <LogIn size={20} />
            Đăng nhập với Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex flex-col lg:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="text-white w-6 h-6" />
          </div>
          <span className="font-serif font-bold text-xl">SalesManager</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Tổng quan" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={<Users size={20} />} 
            label="Khách hàng" 
            active={activeTab === 'customers'} 
            onClick={() => setActiveTab('customers')} 
          />
          <NavItem 
            icon={<Package size={20} />} 
            label="Sản phẩm" 
            active={activeTab === 'products'} 
            onClick={() => setActiveTab('products')} 
          />
          <NavItem 
            icon={<FileText size={20} />} 
            label="Hóa đơn" 
            active={activeTab === 'invoices'} 
            onClick={() => setActiveTab('invoices')} 
          />
          <NavItem 
            icon={<CreditCard size={20} />} 
            label="Thanh toán" 
            active={activeTab === 'payments'} 
            onClick={() => setActiveTab('payments')} 
          />
          <NavItem 
            icon={<BarChart3 size={20} />} 
            label="Báo cáo" 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')} 
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors rounded-xl"
          >
            <LogOut size={20} />
            <span className="font-medium">Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Bottom Nav - Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 flex justify-around items-center z-40">
        <MobileNavItem 
          icon={<LayoutDashboard size={20} />} 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
        />
        <MobileNavItem 
          icon={<Users size={20} />} 
          active={activeTab === 'customers'} 
          onClick={() => setActiveTab('customers')} 
        />
        <MobileNavItem 
          icon={<Package size={20} />} 
          active={activeTab === 'products'} 
          onClick={() => setActiveTab('products')} 
        />
        <MobileNavItem 
          icon={<FileText size={20} />} 
          active={activeTab === 'invoices'} 
          onClick={() => setActiveTab('invoices')} 
        />
        <MobileNavItem 
          icon={<CreditCard size={20} />} 
          active={activeTab === 'payments'} 
          onClick={() => setActiveTab('payments')} 
        />
        <MobileNavItem 
          icon={<BarChart3 size={20} />} 
          active={activeTab === 'reports'} 
          onClick={() => setActiveTab('reports')} 
        />
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8">
        <header className="flex justify-between items-center mb-6 lg:mb-8">
          <div>
            <h2 className="text-xl lg:text-2xl font-serif font-bold text-[#1a1a1a]">
              {activeTab === 'dashboard' && 'Bảng điều khiển'}
              {activeTab === 'customers' && 'Quản lý Khách hàng'}
              {activeTab === 'products' && 'Danh mục Sản phẩm'}
              {activeTab === 'invoices' && 'Hóa đơn & Công nợ'}
              {activeTab === 'payments' && 'Lịch sử Thanh toán'}
              {activeTab === 'reports' && 'Báo cáo Doanh thu'}
            </h2>
            <p className="text-gray-500 text-xs lg:text-sm">Chào mừng trở lại, {user.displayName}</p>
          </div>
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="hidden md:flex items-center bg-white px-4 py-2 rounded-full border border-gray-200">
              <Search size={18} className="text-gray-400" />
              <input type="text" placeholder="Tìm kiếm..." className="bg-transparent border-none focus:ring-0 text-sm ml-2 w-48" />
            </div>
            <button onClick={handleLogout} className="lg:hidden p-2 text-gray-400 hover:text-red-500">
              <LogOut size={20} />
            </button>
            <img src={user.photoURL || ''} alt="Avatar" className="w-8 h-8 lg:w-10 lg:h-10 rounded-full border-2 border-white shadow-sm" />
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <Dashboard customers={customers} invoices={invoices} />}
          {activeTab === 'customers' && <CustomersView customers={customers} invoices={invoices} payments={payments} />}
          {activeTab === 'products' && <ProductsView products={products} categories={categories} units={units} invoices={invoices} />}
          {activeTab === 'invoices' && <InvoicesView invoices={invoices} customers={customers} products={products} units={units} />}
          {activeTab === 'payments' && <PaymentsView payments={payments} customers={customers} />}
          {activeTab === 'reports' && <ReportsView invoices={invoices} />}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
        active ? "bg-[#5A5A40] text-white shadow-lg shadow-[#5A5A40]/20" : "text-gray-500 hover:bg-gray-100"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

function MobileNavItem({ icon, active, onClick }: { icon: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-3 rounded-2xl transition-all duration-200",
        active ? "bg-[#5A5A40] text-white shadow-lg shadow-[#5A5A40]/20" : "text-gray-400"
      )}
    >
      {icon}
    </button>
  );
}

// --- Views ---

function Dashboard({ customers, invoices }: { customers: Customer[], invoices: Invoice[] }) {
  const stats = useMemo(() => {
    const totalRevenue = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
    const totalDebt = customers.reduce((acc, cust) => acc + cust.totalDebt, 0);
    const totalPaid = invoices.reduce((acc, inv) => acc + inv.paidAmount, 0);
    const activeCustomers = customers.length;

    return { totalRevenue, totalDebt, totalPaid, activeCustomers };
  }, [customers, invoices]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Tổng doanh thu" value={stats.totalRevenue} icon={<TrendingUp className="text-emerald-500" />} color="bg-emerald-50" />
        <StatCard title="Tổng nợ khách hàng" value={stats.totalDebt} icon={<AlertCircle className="text-red-500" />} color="bg-red-50" />
        <StatCard title="Đã thu hồi" value={stats.totalPaid} icon={<CheckCircle2 className="text-blue-500" />} color="bg-blue-50" />
        <StatCard title="Khách hàng" value={stats.activeCustomers} icon={<Users className="text-amber-500" />} color="bg-amber-50" isNumber />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-[32px] shadow-sm">
          <h3 className="text-lg font-serif font-bold mb-6 flex items-center gap-2">
            <History size={20} className="text-[#5A5A40]" />
            Hóa đơn gần đây
          </h3>
          <div className="space-y-4">
            {invoices.slice(0, 5).map(invoice => (
              <div key={invoice.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div>
                  <p className="font-bold text-sm">{invoice.customerName}</p>
                  <p className="text-xs text-gray-400">{format(new Date(invoice.date), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#5A5A40]">{invoice.totalAmount.toLocaleString()}đ</p>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider",
                    invoice.status === 'paid' ? "bg-emerald-100 text-emerald-700" : 
                    invoice.status === 'partial' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  )}>
                    {invoice.status === 'paid' ? 'Đã trả' : invoice.status === 'partial' ? 'Trả một phần' : 'Còn nợ'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] shadow-sm">
          <h3 className="text-lg font-serif font-bold mb-6 flex items-center gap-2">
            <Users size={20} className="text-[#5A5A40]" />
            Khách nợ nhiều nhất
          </h3>
          <div className="space-y-4">
            {customers
              .filter(c => c.totalDebt > 0)
              .sort((a, b) => b.totalDebt - a.totalDebt)
              .slice(0, 5)
              .map(customer => (
                <div key={customer.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold">
                      {customer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{customer.name}</p>
                      <p className="text-xs text-gray-400">{customer.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{customer.totalDebt.toLocaleString()}đ</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Tổng nợ</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ title, value, icon, color, isNumber = false }: { title: string, value: number, icon: React.ReactNode, color: string, isNumber?: boolean }) {
  return (
    <div className="bg-white p-4 lg:p-6 rounded-[32px] shadow-sm border border-gray-100">
      <div className={cn("w-10 h-10 lg:w-12 lg:h-12 rounded-2xl flex items-center justify-center mb-3 lg:mb-4", color)}>
        {icon}
      </div>
      <p className="text-gray-400 text-xs lg:text-sm font-medium">{title}</p>
      <p className="text-xl lg:text-2xl font-serif font-bold mt-1">
        {isNumber ? value : `${value.toLocaleString()}đ`}
      </p>
    </div>
  );
}

function CustomersView({ customers, invoices, payments }: { customers: Customer[], invoices: Invoice[], payments: Payment[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showPay, setShowPay] = useState<Customer | null>(null);
  const [showDetails, setShowDetails] = useState<Customer | null>(null);
  const [detailTab, setDetailTab] = useState<'invoices' | 'payments'>('invoices');
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'debt-desc' | 'debt-asc'>('name');

  const filteredCustomers = useMemo(() => {
    let result = customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone.includes(searchTerm)
    );

    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'vi');
      } else if (sortBy === 'debt-desc') {
        return b.totalDebt - a.totalDebt;
      } else if (sortBy === 'debt-asc') {
        return a.totalDebt - b.totalDebt;
      }
      return 0;
    });

    return result;
  }, [customers, searchTerm, sortBy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'customers'), {
        ...formData,
        totalDebt: 0,
        lastPurchaseDate: new Date().toISOString()
      });
      setShowAdd(false);
      setFormData({ name: '', phone: '', address: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'customers');
    }
  };

  const handlePayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPay || !payAmount) return;

    try {
      const batch = writeBatch(db);
      const amount = Number(payAmount);

      // 1. Update Customer Debt
      const customerRef = doc(db, 'customers', showPay.id);
      batch.update(customerRef, {
        totalDebt: increment(-amount)
      });

      // 2. Create Payment Record
      const paymentRef = doc(collection(db, 'payments'));
      batch.set(paymentRef, {
        customerId: showPay.id,
        customerName: showPay.name,
        date: new Date().toISOString(),
        amount: amount,
        method: 'transfer',
        note: payNote || 'Thanh toán nợ trực tiếp'
      });

      await batch.commit();
      setShowPay(null);
      setPayAmount('');
      setPayNote('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'payments/debt');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h3 className="text-xl font-serif font-bold">Danh sách Khách hàng ({filteredCustomers.length})</h3>
        <div className="flex flex-wrap w-full md:w-auto gap-3">
          <div className="flex-1 md:flex-none relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Tìm tên hoặc SĐT..." 
              className="w-full md:w-64 pl-12 pr-4 py-3 rounded-full border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative flex-1 md:flex-none">
            <Filter size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <select 
              className="w-full md:w-48 pl-12 pr-8 py-3 rounded-full border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] text-sm appearance-none bg-white"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="name">Sắp xếp: Tên A-Z</option>
              <option value="debt-desc">Sắp xếp: Nợ nhiều nhất</option>
              <option value="debt-asc">Sắp xếp: Nợ ít nhất</option>
            </select>
          </div>
          <button 
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-[#5A5A40] text-white px-6 py-3 rounded-full hover:bg-[#4A4A30] transition-all whitespace-nowrap"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Thêm khách hàng</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => (
          <div key={customer.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-[#5A5A40] font-bold text-xl">
                {customer.name.charAt(0)}
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase font-bold">Công nợ</p>
                <p className={cn("font-bold text-lg", customer.totalDebt > 0 ? "text-red-500" : "text-emerald-500")}>
                  {customer.totalDebt.toLocaleString()}đ
                </p>
              </div>
            </div>
            <h4 
              className="font-bold text-lg cursor-pointer hover:text-[#5A5A40] transition-colors"
              onClick={() => setShowDetails(customer)}
            >
              {customer.name}
            </h4>
            <p className="text-gray-500 text-sm mb-4">{customer.phone}</p>
            
            <div className="flex gap-2 mb-4">
              {customer.totalDebt > 0 && (
                <button 
                  onClick={() => setShowPay(customer)}
                  className="flex-1 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
                >
                  Thu nợ
                </button>
              )}
              <button 
                onClick={() => setShowDetails(customer)}
                className="flex-1 py-2 bg-gray-50 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors"
              >
                Chi tiết
              </button>
            </div>

            <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
              <span className="text-xs text-gray-400">Mua gần nhất: {format(new Date(customer.lastPurchaseDate), 'dd/MM/yyyy')}</span>
              <ChevronRight size={18} className="text-gray-300" />
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            className="bg-white p-6 lg:p-8 rounded-t-[32px] lg:rounded-[32px] max-w-md w-full h-full lg:h-auto overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl lg:text-2xl font-serif font-bold">Thêm khách hàng mới</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 p-2 lg:hidden">Đóng</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input 
                  required
                  type="tel" 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                <textarea 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                  rows={3}
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-full border border-gray-200 font-medium hover:bg-gray-50">Hủy</button>
                <button type="submit" className="flex-1 py-3 rounded-full bg-[#5A5A40] text-white font-medium hover:bg-[#4A4A30]">Lưu lại</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showPay && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            className="bg-white p-6 lg:p-8 rounded-t-[32px] lg:rounded-[32px] max-w-md w-full h-full lg:h-auto overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl lg:text-2xl font-serif font-bold">Thu nợ khách hàng</h3>
              <button onClick={() => setShowPay(null)} className="text-gray-400 hover:text-gray-600 p-2 lg:hidden">Đóng</button>
            </div>
            <p className="text-gray-500 mb-6 text-sm">Khách hàng: <span className="font-bold text-gray-700">{showPay.name}</span></p>
            
            <div className="bg-red-50 p-4 rounded-2xl mb-6">
              <p className="text-[10px] text-red-400 uppercase font-bold">Tổng nợ hiện tại</p>
              <p className="text-xl lg:text-2xl font-serif font-bold text-red-600">{showPay.totalDebt.toLocaleString()}đ</p>
            </div>

            <form onSubmit={handlePayDebt} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền thu</label>
                <div className="relative">
                  <DollarSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    required
                    type="number" 
                    max={showPay.totalDebt}
                    className="w-full pl-12 pr-4 py-3 lg:py-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] text-lg lg:text-xl font-bold"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (tùy chọn)</label>
                <textarea 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] text-sm"
                  rows={2}
                  placeholder="Ví dụ: Anh A trả tiền mặt..."
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPay(null)} className="flex-1 py-3 rounded-full border border-gray-200 font-medium hover:bg-gray-50">Hủy</button>
                <button type="submit" className="flex-1 py-3 rounded-full bg-emerald-600 text-white font-medium hover:bg-emerald-700">Xác nhận</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            className="bg-white p-6 lg:p-8 rounded-t-[32px] lg:rounded-[32px] max-w-4xl w-full h-full lg:h-auto overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6 lg:mb-8">
              <h3 className="text-xl lg:text-2xl font-serif font-bold">Chi tiết khách hàng</h3>
              <button onClick={() => setShowDetails(null)} className="text-gray-400 hover:text-gray-600 p-2">Đóng</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Customer Info */}
              <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-[32px] border border-gray-100">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-[#5A5A40] font-bold text-2xl mb-4 shadow-sm">
                    {showDetails.name.charAt(0)}
                  </div>
                  <h4 className="text-xl font-bold mb-1">{showDetails.name}</h4>
                  <p className="text-gray-500 mb-4">{showDetails.phone}</p>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Địa chỉ:</span>
                      <span className="font-medium text-right">{showDetails.address || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Tổng nợ hiện tại:</span>
                      <span className="font-bold text-red-500">{showDetails.totalDebt.toLocaleString()}đ</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowPay(showDetails);
                      setShowDetails(null);
                    }}
                    className="w-full mt-6 py-3 bg-[#5A5A40] text-white rounded-full font-bold text-sm hover:bg-[#4A4A30] transition-all"
                  >
                    Thu nợ ngay
                  </button>
                </div>
              </div>

              {/* History Tabs */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex gap-4 border-b border-gray-100">
                  <button 
                    onClick={() => setDetailTab('invoices')}
                    className={cn(
                      "pb-4 px-2 text-sm font-bold transition-all relative",
                      detailTab === 'invoices' ? "text-[#5A5A40]" : "text-gray-400"
                    )}
                  >
                    Lịch sử mua hàng
                    {detailTab === 'invoices' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
                  </button>
                  <button 
                    onClick={() => setDetailTab('payments')}
                    className={cn(
                      "pb-4 px-2 text-sm font-bold transition-all relative",
                      detailTab === 'payments' ? "text-[#5A5A40]" : "text-gray-400"
                    )}
                  >
                    Lịch sử thanh toán
                    {detailTab === 'payments' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
                  </button>
                </div>

                <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden">
                  {detailTab === 'invoices' ? (
                    <div className="max-h-[400px] overflow-y-auto">
                      {invoices.filter(inv => inv.customerId === showDetails.id).length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">Chưa có lịch sử mua hàng</div>
                      ) : (
                        <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-bold sticky top-0">
                            <tr>
                              <th className="px-6 py-3">Ngày</th>
                              <th className="px-6 py-3 text-right">Tổng tiền</th>
                              <th className="px-6 py-3 text-center">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {invoices
                              .filter(inv => inv.customerId === showDetails.id)
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .map(inv => (
                                <tr key={inv.id}>
                                  <td className="px-6 py-4 text-gray-500">{format(new Date(inv.date), 'dd/MM/yyyy')}</td>
                                  <td className="px-6 py-4 font-bold text-right">{inv.totalAmount.toLocaleString()}đ</td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={cn(
                                      "text-[8px] px-2 py-0.5 rounded-full uppercase font-bold",
                                      inv.status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                    )}>
                                      {inv.status === 'paid' ? 'Đã trả' : 'Nợ'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto">
                      {payments.filter(p => p.customerId === showDetails.id).length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">Chưa có lịch sử thanh toán</div>
                      ) : (
                        <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] font-bold sticky top-0">
                            <tr>
                              <th className="px-6 py-3">Ngày</th>
                              <th className="px-6 py-3">Ghi chú</th>
                              <th className="px-6 py-3 text-right">Số tiền</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {payments
                              .filter(p => p.customerId === showDetails.id)
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .map(p => (
                                <tr key={p.id}>
                                  <td className="px-6 py-4 text-gray-500">{format(new Date(p.date), 'dd/MM/yyyy')}</td>
                                  <td className="px-6 py-4 text-gray-400 text-xs italic">{p.note}</td>
                                  <td className="px-6 py-4 font-bold text-emerald-600 text-right">+{p.amount.toLocaleString()}đ</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function ProductsView({ products, categories, units, invoices }: { products: Product[], categories: Category[], units: Unit[], invoices: Invoice[] }) {
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'categories' | 'units'>('products');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [showDetails, setShowDetails] = useState<Product | null>(null);
  const [showEdit, setShowEdit] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price-desc' | 'price-asc' | 'stock-asc'>('name');
  
  const [productForm, setProductForm] = useState({ name: '', price: '', unitId: '', categoryId: '', stock: '' });
  const [editForm, setEditForm] = useState({ name: '', price: '', unitId: '', categoryId: '', stock: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [unitForm, setUnitForm] = useState({ name: '' });

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      categories.find(c => c.id === p.categoryId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'vi');
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'stock-asc') return (a.stock || 0) - (b.stock || 0);
      return 0;
    });

    return result;
  }, [products, searchTerm, sortBy, categories]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'products'), {
        name: productForm.name,
        price: Number(productForm.price),
        unitId: productForm.unitId,
        categoryId: productForm.categoryId,
        stock: productForm.stock ? Number(productForm.stock) : 0
      });
      setShowAddProduct(false);
      setProductForm({ name: '', price: '', unitId: '', categoryId: '', stock: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'products');
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEdit) return;
    try {
      const productRef = doc(db, 'products', showEdit.id);
      await updateDoc(productRef, {
        name: editForm.name,
        price: Number(editForm.price),
        unitId: editForm.unitId,
        categoryId: editForm.categoryId,
        stock: Number(editForm.stock)
      });
      setShowEdit(null);
      if (showDetails?.id === showEdit.id) {
        setShowDetails({ ...showDetails, ...editForm, price: Number(editForm.price), stock: Number(editForm.stock) });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'products');
    }
  };

  const openEdit = (product: Product) => {
    setEditForm({
      name: product.name,
      price: product.price.toString(),
      unitId: product.unitId,
      categoryId: product.categoryId,
      stock: (product.stock || 0).toString()
    });
    setShowEdit(product);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'categories'), { name: categoryForm.name });
      setShowAddCategory(false);
      setCategoryForm({ name: '' });
      // If adding from product modal, auto-select it
      if (showAddProduct) {
        setProductForm(prev => ({ ...prev, categoryId: docRef.id }));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'categories');
    }
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'units'), { name: unitForm.name });
      setShowAddUnit(false);
      setUnitForm({ name: '' });
      // If adding from product modal, auto-select it
      if (showAddProduct) {
        setProductForm(prev => ({ ...prev, unitId: docRef.id }));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'units');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-gray-200 pb-px overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveSubTab('products')}
          className={cn(
            "pb-4 px-2 text-xs lg:text-sm font-medium transition-colors relative whitespace-nowrap",
            activeSubTab === 'products' ? "text-[#5A5A40]" : "text-gray-400 hover:text-gray-600"
          )}
        >
          Sản phẩm
          {activeSubTab === 'products' && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
        </button>
        <button 
          onClick={() => setActiveSubTab('categories')}
          className={cn(
            "pb-4 px-2 text-xs lg:text-sm font-medium transition-colors relative whitespace-nowrap",
            activeSubTab === 'categories' ? "text-[#5A5A40]" : "text-gray-400 hover:text-gray-600"
          )}
        >
          Danh mục
          {activeSubTab === 'categories' && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
        </button>
        <button 
          onClick={() => setActiveSubTab('units')}
          className={cn(
            "pb-4 px-2 text-xs lg:text-sm font-medium transition-colors relative whitespace-nowrap",
            activeSubTab === 'units' ? "text-[#5A5A40]" : "text-gray-400 hover:text-gray-600"
          )}
        >
          Đơn vị tính
          {activeSubTab === 'units' && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
        </button>
      </div>

      {activeSubTab === 'products' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-xl font-serif font-bold">Danh sách Sản phẩm ({filteredProducts.length})</h3>
            <div className="flex flex-wrap w-full md:w-auto gap-3">
              <div className="flex-1 md:flex-none relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Tìm tên hoặc danh mục..." 
                  className="w-full md:w-64 pl-12 pr-4 py-3 rounded-full border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="relative flex-1 md:flex-none">
                <Filter size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <select 
                  className="w-full md:w-48 pl-12 pr-8 py-3 rounded-full border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] text-sm appearance-none bg-white"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="name">Tên A-Z</option>
                  <option value="price-desc">Giá cao nhất</option>
                  <option value="price-asc">Giá thấp nhất</option>
                  <option value="stock-asc">Tồn kho ít nhất</option>
                </select>
              </div>
              <button 
                onClick={() => setShowAddProduct(true)}
                className="flex items-center gap-2 bg-[#5A5A40] text-white px-6 py-3 rounded-full hover:bg-[#4A4A30] transition-all whitespace-nowrap"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Thêm sản phẩm</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[32px] shadow-sm overflow-hidden border border-gray-100">
            {/* Desktop Table */}
            <table className="w-full text-left hidden md:table">
              <thead>
                <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-8 py-4 font-bold">Tên sản phẩm</th>
                  <th className="px-8 py-4 font-bold">Danh mục</th>
                  <th className="px-8 py-4 font-bold">Tồn kho</th>
                  <th className="px-8 py-4 font-bold">Giá bán</th>
                  <th className="px-8 py-4 font-bold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                    <td 
                      className="px-8 py-4 font-bold text-gray-700 cursor-pointer hover:text-[#5A5A40]"
                      onClick={() => setShowDetails(product)}
                    >
                      {product.name}
                    </td>
                    <td className="px-8 py-4 text-gray-500">
                      {categories.find(c => c.id === product.categoryId)?.name || 'Chưa phân loại'}
                    </td>
                    <td className="px-8 py-4">
                      <span className={cn(
                        "font-medium",
                        (product.stock || 0) <= 5 ? "text-red-500" : "text-gray-500"
                      )}>
                        {product.stock || 0} {units.find(u => u.id === product.unitId)?.name || ''}
                      </span>
                    </td>
                    <td className="px-8 py-4 font-bold text-[#5A5A40]">{product.price.toLocaleString()}đ</td>
                    <td className="px-8 py-4 text-right space-x-2">
                      <button 
                        onClick={() => openEdit(product)}
                        className="text-xs font-bold text-gray-400 hover:text-blue-500 bg-gray-50 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Sửa
                      </button>
                      <button 
                        onClick={() => setShowDetails(product)}
                        className="text-xs font-bold text-gray-400 hover:text-[#5A5A40] bg-gray-50 hover:bg-[#5A5A40]/10 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredProducts.map(product => (
                <div 
                  key={product.id} 
                  className="p-4 flex justify-between items-center cursor-pointer active:bg-gray-50"
                  onClick={() => setShowDetails(product)}
                >
                  <div>
                    <p className="font-bold text-gray-700">{product.name}</p>
                    <p className="text-xs text-gray-400">
                      {categories.find(c => c.id === product.categoryId)?.name || 'Chưa phân loại'} • {units.find(u => u.id === product.unitId)?.name || '-'}
                    </p>
                    <p className={cn(
                      "text-[10px] font-bold mt-1",
                      (product.stock || 0) <= 5 ? "text-red-500" : "text-emerald-600"
                    )}>
                      Tồn: {product.stock || 0}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <p className="font-bold text-[#5A5A40]">{product.price.toLocaleString()}đ</p>
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'categories' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-serif font-bold">Danh mục Hàng hóa ({categories.length})</h3>
            <button 
              onClick={() => setShowAddCategory(true)}
              className="flex items-center gap-2 bg-[#5A5A40] text-white px-6 py-3 rounded-full hover:bg-[#4A4A30] transition-all"
            >
              <Plus size={20} />
              Thêm danh mục
            </button>
          </div>

          {categories.length === 0 ? (
            <div className="bg-white p-12 rounded-[32px] border border-dashed border-gray-200 text-center">
              <Package className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500">Chưa có danh mục nào. Hãy thêm danh mục đầu tiên!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(category => (
                <div key={category.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <span className="font-bold text-gray-700">{category.name}</span>
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                    {products.filter(p => p.categoryId === category.id).length} sản phẩm
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'units' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-serif font-bold">Đơn vị tính ({units.length})</h3>
            <button 
              onClick={() => setShowAddUnit(true)}
              className="flex items-center gap-2 bg-[#5A5A40] text-white px-6 py-3 rounded-full hover:bg-[#4A4A30] transition-all"
            >
              <Plus size={20} />
              Thêm đơn vị
            </button>
          </div>

          {units.length === 0 ? (
            <div className="bg-white p-12 rounded-[32px] border border-dashed border-gray-200 text-center">
              <Package className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500">Chưa có đơn vị tính nào. Hãy thêm đơn vị đầu tiên!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {units.map(unit => (
                <div key={unit.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
                  <span className="font-bold text-gray-700">{unit.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            className="bg-white p-6 lg:p-8 rounded-t-[32px] lg:rounded-[32px] max-w-md w-full h-full lg:h-auto overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl lg:text-2xl font-serif font-bold">Thêm sản phẩm mới</h3>
              <button onClick={() => setShowAddProduct(false)} className="text-gray-400 hover:text-gray-600 p-2 lg:hidden">Đóng</button>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên sản phẩm</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                  value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giá bán</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                    value={productForm.price}
                    onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">Đơn vị tính</label>
                    <button 
                      type="button"
                      onClick={() => setShowAddUnit(true)}
                      className="text-xs text-[#5A5A40] hover:underline"
                    >
                      + Thêm mới
                    </button>
                  </div>
                  <select 
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                    value={productForm.unitId}
                    onChange={e => setProductForm({ ...productForm, unitId: e.target.value })}
                  >
                    <option value="">Chọn đơn vị</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Danh mục</label>
                  <button 
                    type="button"
                    onClick={() => setShowAddCategory(true)}
                    className="text-xs text-[#5A5A40] hover:underline"
                  >
                    + Thêm mới
                  </button>
                </div>
                <select 
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                  value={productForm.categoryId}
                  onChange={e => setProductForm({ ...productForm, categoryId: e.target.value })}
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng tồn kho ban đầu</label>
                <input 
                  type="number" 
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                  value={productForm.stock}
                  onChange={e => setProductForm({ ...productForm, stock: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddProduct(false)} className="flex-1 py-3 rounded-full border border-gray-200 font-medium hover:bg-gray-50">Hủy</button>
                <button type="submit" className="flex-1 py-3 rounded-full bg-[#5A5A40] text-white font-medium hover:bg-[#4A4A30]">Lưu sản phẩm</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            className="bg-white p-6 lg:p-8 rounded-t-[32px] lg:rounded-[32px] max-w-4xl w-full h-full lg:h-auto overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6 lg:mb-8">
              <h3 className="text-xl lg:text-2xl font-serif font-bold">Chi tiết sản phẩm</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => openEdit(showDetails)}
                  className="text-xs font-bold text-[#5A5A40] bg-[#5A5A40]/10 px-4 py-2 rounded-full hover:bg-[#5A5A40]/20 transition-all"
                >
                  Sửa thông tin
                </button>
                <button onClick={() => setShowDetails(null)} className="text-gray-400 hover:text-gray-600 p-2">Đóng</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Product Info Summary */}
              <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-[32px] border border-gray-100">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-[#5A5A40] mb-4 shadow-sm">
                    <Package size={32} />
                  </div>
                  <h4 className="text-xl font-bold mb-1">{showDetails.name}</h4>
                  <p className="text-gray-500 mb-4">
                    {categories.find(c => c.id === showDetails.categoryId)?.name || 'Chưa phân loại'}
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Giá bán:</span>
                      <span className="font-bold text-[#5A5A40]">{showDetails.price.toLocaleString()}đ</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Đơn vị:</span>
                      <span className="font-medium">{units.find(u => u.id === showDetails.unitId)?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-3 border-t border-gray-200">
                      <span className="text-gray-400">Tồn kho hiện tại:</span>
                      <span className={cn(
                        "font-bold",
                        (showDetails.stock || 0) <= 5 ? "text-red-500" : "text-emerald-600"
                      )}>
                        {showDetails.stock || 0} {units.find(u => u.id === showDetails.unitId)?.name || ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#5A5A40]/5 p-6 rounded-[32px] border border-[#5A5A40]/10">
                  <h5 className="text-sm font-bold text-[#5A5A40] mb-3 uppercase tracking-wider">Thống kê nhanh</h5>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Tổng số lượng đã bán</p>
                      <p className="text-xl font-serif font-bold">
                        {invoices.reduce((acc, inv) => {
                          const item = inv.items.find(i => i.productId === showDetails.id);
                          return acc + (item?.quantity || 0);
                        }, 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Doanh thu từ sản phẩm này</p>
                      <p className="text-xl font-serif font-bold text-emerald-600">
                        {invoices.reduce((acc, inv) => {
                          const item = inv.items.find(i => i.productId === showDetails.id);
                          return acc + (item?.total || 0);
                        }, 0).toLocaleString()}đ
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction History */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-700">Lịch sử giao dịch</h4>
                </div>
                
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                          <th className="px-4 py-3">Ngày</th>
                          <th className="px-4 py-3">Khách hàng</th>
                          <th className="px-4 py-3 text-right">Số lượng</th>
                          <th className="px-4 py-3 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {invoices
                          .filter(inv => inv.items.some(i => i.productId === showDetails.id))
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map(inv => {
                            const item = inv.items.find(i => i.productId === showDetails.id)!;
                            return (
                              <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-gray-500">{format(new Date(inv.date), 'dd/MM/yyyy')}</td>
                                <td className="px-4 py-3 font-medium text-gray-700">{inv.customerName}</td>
                                <td className="px-4 py-3 text-right font-bold text-gray-700">{item.quantity}</td>
                                <td className="px-4 py-3 text-right font-bold text-[#5A5A40]">{item.total.toLocaleString()}đ</td>
                              </tr>
                            );
                          })}
                        {invoices.filter(inv => inv.items.some(i => i.productId === showDetails.id)).length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">Chưa có giao dịch nào cho sản phẩm này</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showEdit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            className="bg-white p-6 lg:p-8 rounded-t-[32px] lg:rounded-[32px] max-w-md w-full h-full lg:h-auto overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl lg:text-2xl font-serif font-bold">Sửa sản phẩm</h3>
              <button onClick={() => setShowEdit(null)} className="text-gray-400 hover:text-gray-600 p-2 lg:hidden">Đóng</button>
            </div>
            <form onSubmit={handleEditProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên sản phẩm</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giá bán</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                    value={editForm.price}
                    onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tồn kho</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                    value={editForm.stock}
                    onChange={e => setEditForm({ ...editForm, stock: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị tính</label>
                <select 
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                  value={editForm.unitId}
                  onChange={e => setEditForm({ ...editForm, unitId: e.target.value })}
                >
                  <option value="">Chọn đơn vị</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
                <select 
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                  value={editForm.categoryId}
                  onChange={e => setEditForm({ ...editForm, categoryId: e.target.value })}
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEdit(null)} className="flex-1 py-3 rounded-full border border-gray-200 font-medium hover:bg-gray-50">Hủy</button>
                <button type="submit" className="flex-1 py-3 rounded-full bg-[#5A5A40] text-white font-medium hover:bg-[#4A4A30]">Cập nhật</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showAddCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            className="bg-white p-6 lg:p-8 rounded-t-[32px] lg:rounded-[32px] max-w-md w-full h-full lg:h-auto overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl lg:text-2xl font-serif font-bold">Thêm danh mục mới</h3>
              <button onClick={() => setShowAddCategory(false)} className="text-gray-400 hover:text-gray-600 p-2 lg:hidden">Đóng</button>
            </div>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên danh mục</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                  value={categoryForm.name}
                  onChange={e => setCategoryForm({ name: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddCategory(false)} className="flex-1 py-3 rounded-full border border-gray-200 font-medium hover:bg-gray-50">Hủy</button>
                <button type="submit" className="flex-1 py-3 rounded-full bg-[#5A5A40] text-white font-medium hover:bg-[#4A4A30]">Lưu danh mục</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showAddUnit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            className="bg-white p-6 lg:p-8 rounded-t-[32px] lg:rounded-[32px] max-w-md w-full h-full lg:h-auto overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl lg:text-2xl font-serif font-bold">Thêm đơn vị tính mới</h3>
              <button onClick={() => setShowAddUnit(false)} className="text-gray-400 hover:text-gray-600 p-2 lg:hidden">Đóng</button>
            </div>
            <form onSubmit={handleAddUnit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên đơn vị</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent"
                  value={unitForm.name}
                  onChange={e => setUnitForm({ name: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddUnit(false)} className="flex-1 py-3 rounded-full border border-gray-200 font-medium hover:bg-gray-50">Hủy</button>
                <button type="submit" className="flex-1 py-3 rounded-full bg-[#5A5A40] text-white font-medium hover:bg-[#4A4A30]">Lưu đơn vị</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function InvoicesView({ invoices, customers, products, units }: { invoices: Invoice[], customers: Customer[], products: Product[], units: Unit[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentNote, setPaymentNote] = useState('');

  const totalAmount = useMemo(() => cart.reduce((acc, item) => acc + item.total, 0), [cart]);
  const debtAmount = totalAmount - Number(paidAmount);

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price } : item));
    } else {
      setCart([...cart, { productId: product.id, productName: product.name, quantity: 1, price: product.price, total: product.price }]);
    }
  };

  const handleCreateInvoice = async () => {
    if (!selectedCustomer || cart.length === 0) return;

    const customer = customers.find(c => c.id === selectedCustomer);
    if (!customer) return;

    const status = Number(paidAmount) >= totalAmount ? 'paid' : Number(paidAmount) > 0 ? 'partial' : 'debt';

    try {
      const batch = writeBatch(db);
      
      // 1. Create Invoice
      const invoiceRef = doc(collection(db, 'invoices'));
      batch.set(invoiceRef, {
        customerId: selectedCustomer,
        customerName: customer.name,
        date: new Date().toISOString(),
        items: cart,
        totalAmount,
        paidAmount: Number(paidAmount),
        debtAmount,
        status
      });

      // 2. Update Customer Debt
      const customerRef = doc(db, 'customers', selectedCustomer);
      batch.update(customerRef, {
        totalDebt: increment(debtAmount),
        lastPurchaseDate: new Date().toISOString()
      });

      // 3. Update Product Stock
      cart.forEach(item => {
        const productRef = doc(db, 'products', item.productId);
        batch.update(productRef, {
          stock: increment(-item.quantity)
        });
      });

      // 4. Create Payment record if paidAmount > 0
      if (Number(paidAmount) > 0) {
        const paymentRef = doc(collection(db, 'payments'));
        batch.set(paymentRef, {
          invoiceId: invoiceRef.id,
          customerId: selectedCustomer,
          date: new Date().toISOString(),
          amount: Number(paidAmount),
          method: 'cash',
          note: paymentNote || 'Thanh toán khi mua hàng'
        });
      }

      await batch.commit();
      setShowAdd(false);
      setCart([]);
      setSelectedCustomer('');
      setPaidAmount('0');
      setPaymentNote('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'invoices/batch');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-serif font-bold">Lịch sử Hóa đơn</h3>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-[#5A5A40] text-white px-6 py-3 rounded-full hover:bg-[#4A4A30] transition-all"
        >
          <Plus size={20} />
          Tạo hóa đơn mới
        </button>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm overflow-hidden border border-gray-100">
        {/* Desktop Table */}
        <table className="w-full text-left hidden md:table">
          <thead>
            <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-8 py-4 font-bold">Khách hàng</th>
              <th className="px-8 py-4 font-bold">Ngày lập</th>
              <th className="px-8 py-4 font-bold text-right">Tổng tiền</th>
              <th className="px-8 py-4 font-bold text-right">Còn nợ</th>
              <th className="px-8 py-4 font-bold text-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.map(invoice => (
              <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-8 py-4 font-bold text-gray-700">{invoice.customerName}</td>
                <td className="px-8 py-4 text-gray-500 text-sm">{format(new Date(invoice.date), 'dd/MM/yyyy HH:mm')}</td>
                <td className="px-8 py-4 font-bold text-right">{invoice.totalAmount.toLocaleString()}đ</td>
                <td className="px-8 py-4 font-bold text-red-500 text-right">{invoice.debtAmount.toLocaleString()}đ</td>
                <td className="px-8 py-4 text-center">
                  <span className={cn(
                    "text-[10px] px-3 py-1 rounded-full uppercase font-bold tracking-wider",
                    invoice.status === 'paid' ? "bg-emerald-100 text-emerald-700" : 
                    invoice.status === 'partial' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  )}>
                    {invoice.status === 'paid' ? 'Đã trả' : invoice.status === 'partial' ? 'Trả một phần' : 'Còn nợ'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {invoices.map(invoice => (
            <div key={invoice.id} className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-700">{invoice.customerName}</p>
                  <p className="text-xs text-gray-400">{format(new Date(invoice.date), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <span className={cn(
                  "text-[8px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider",
                  invoice.status === 'paid' ? "bg-emerald-100 text-emerald-700" : 
                  invoice.status === 'partial' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                )}>
                  {invoice.status === 'paid' ? 'Đã trả' : invoice.status === 'partial' ? 'Trả 1 phần' : 'Còn nợ'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tổng: <span className="font-bold text-gray-700">{invoice.totalAmount.toLocaleString()}đ</span></span>
                <span className="text-gray-500">Nợ: <span className="font-bold text-red-500">{invoice.debtAmount.toLocaleString()}đ</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            className="bg-white p-6 lg:p-8 rounded-t-[32px] lg:rounded-[32px] max-w-4xl w-full h-full lg:h-auto overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6 lg:mb-8">
              <h3 className="text-xl lg:text-2xl font-serif font-bold">Tạo hóa đơn bán hàng</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 p-2">Đóng</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Left: Product Selection */}
              <div className="space-y-4 lg:space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Chọn khách hàng</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] text-sm"
                    value={selectedCustomer}
                    onChange={e => setSelectedCustomer(e.target.value)}
                  >
                    <option value="">-- Chọn khách hàng --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Chọn sản phẩm</label>
                  <div className="grid grid-cols-1 gap-2 max-h-48 lg:max-h-64 overflow-y-auto pr-2">
                    {products.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left"
                      >
                        <div>
                          <p className="font-bold text-sm">{p.name}</p>
                          <p className="text-[10px] text-gray-400">{p.price.toLocaleString()}đ / {units.find(u => u.id === p.unitId)?.name || '-'}</p>
                        </div>
                        <Plus size={16} className="text-[#5A5A40]" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Cart & Summary */}
              <div className="bg-gray-50 p-4 lg:p-6 rounded-[24px] flex flex-col">
                <h4 className="font-bold mb-4 flex items-center gap-2 text-sm lg:text-base">
                  <Package size={18} />
                  Chi tiết đơn hàng
                </h4>
                
                <div className="flex-1 space-y-3 mb-6 overflow-y-auto max-h-40 lg:max-h-48">
                  {cart.length === 0 && <p className="text-gray-400 text-xs text-center py-8 italic">Chưa có sản phẩm nào</p>}
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <div className="flex-1">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-[10px] text-gray-400">{item.quantity} x {item.price.toLocaleString()}đ</p>
                      </div>
                      <p className="font-bold">{item.total.toLocaleString()}đ</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <div className="flex justify-between font-bold text-base lg:text-lg">
                    <span>Tổng cộng:</span>
                    <span className="text-[#5A5A40]">{totalAmount.toLocaleString()}đ</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Khách trả</label>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="number" 
                          className="w-full pl-8 pr-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] text-sm"
                          value={paidAmount}
                          onChange={e => setPaidAmount(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ghi chú</label>
                      <input 
                        type="text" 
                        placeholder="Ghi chú..."
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] text-sm"
                        value={paymentNote}
                        onChange={e => setPaymentNote(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Còn nợ:</span>
                    <span className="font-bold text-red-500">{debtAmount.toLocaleString()}đ</span>
                  </div>

                  <button 
                    disabled={!selectedCustomer || cart.length === 0}
                    onClick={handleCreateInvoice}
                    className="w-full py-3 lg:py-4 rounded-full bg-[#5A5A40] text-white font-bold hover:bg-[#4A4A30] disabled:opacity-50 disabled:cursor-not-allowed mt-2 transition-all text-sm"
                  >
                    Xác nhận & Xuất hóa đơn
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function PaymentsView({ payments, customers }: { payments: Payment[], customers: Customer[] }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-serif font-bold">Lịch sử Thanh toán ({payments.length})</h3>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm overflow-hidden border border-gray-100">
        {/* Desktop Table */}
        <table className="w-full text-left hidden md:table">
          <thead>
            <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-8 py-4 font-bold">Khách hàng</th>
              <th className="px-8 py-4 font-bold">Ngày thanh toán</th>
              <th className="px-8 py-4 font-bold">Phương thức</th>
              <th className="px-8 py-4 font-bold">Ghi chú</th>
              <th className="px-8 py-4 font-bold text-right">Số tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.map(payment => (
              <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-8 py-4 font-bold text-gray-700">
                  {customers.find(c => c.id === payment.customerId)?.name || 'Khách hàng ẩn'}
                </td>
                <td className="px-8 py-4 text-gray-500 text-sm">{format(new Date(payment.date), 'dd/MM/yyyy HH:mm')}</td>
                <td className="px-8 py-4">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 uppercase font-bold">
                    {payment.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                  </span>
                </td>
                <td className="px-8 py-4 text-gray-500 text-sm italic">
                  {payment.note || '-'}
                </td>
                <td className="px-8 py-4 font-bold text-emerald-600 text-right">+{payment.amount.toLocaleString()}đ</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {payments.map(payment => (
            <div key={payment.id} className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-700">
                    {customers.find(c => c.id === payment.customerId)?.name || 'Khách hàng ẩn'}
                  </p>
                  <p className="text-xs text-gray-400">{format(new Date(payment.date), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <p className="font-bold text-emerald-600">+{payment.amount.toLocaleString()}đ</p>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 uppercase font-bold">
                  {payment.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                </span>
                <p className="text-xs text-gray-400 italic truncate max-w-[150px]">{payment.note || '-'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function ReportsView({ invoices }: { invoices: Invoice[] }) {
  const [timeframe, setTimeframe] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const reportData = useMemo(() => {
    const data: any[] = [];
    const currentYearInvoices = invoices.filter(inv => new Date(inv.date).getFullYear() === selectedYear);

    if (timeframe === 'month') {
      for (let i = 0; i < 12; i++) {
        const monthInvoices = currentYearInvoices.filter(inv => new Date(inv.date).getMonth() === i);
        data.push({
          name: `Tháng ${i + 1}`,
          revenue: monthInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0),
          paid: monthInvoices.reduce((acc, inv) => acc + inv.paidAmount, 0),
          debt: monthInvoices.reduce((acc, inv) => acc + inv.debtAmount, 0),
        });
      }
    } else if (timeframe === 'quarter') {
      for (let i = 0; i < 4; i++) {
        const quarterInvoices = currentYearInvoices.filter(inv => {
          const month = new Date(inv.date).getMonth();
          return Math.floor(month / 3) === i;
        });
        data.push({
          name: `Quý ${i + 1}`,
          revenue: quarterInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0),
          paid: quarterInvoices.reduce((acc, inv) => acc + inv.paidAmount, 0),
          debt: quarterInvoices.reduce((acc, inv) => acc + inv.debtAmount, 0),
        });
      }
    } else {
      // Year comparison (last 5 years)
      for (let i = selectedYear - 4; i <= selectedYear; i++) {
        const yearInvoices = invoices.filter(inv => new Date(inv.date).getFullYear() === i);
        data.push({
          name: `${i}`,
          revenue: yearInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0),
          paid: yearInvoices.reduce((acc, inv) => acc + inv.paidAmount, 0),
          debt: yearInvoices.reduce((acc, inv) => acc + inv.debtAmount, 0),
        });
      }
    }

    return data;
  }, [invoices, timeframe, selectedYear]);

  const totals = useMemo(() => {
    return reportData.reduce((acc, curr) => ({
      revenue: acc.revenue + curr.revenue,
      paid: acc.paid + curr.paid,
      debt: acc.debt + curr.debt
    }), { revenue: 0, paid: 0, debt: 0 });
  }, [reportData]);

  const COLORS = ['#5A5A40', '#10B981', '#EF4444'];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex w-full md:w-auto bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
          <button 
            onClick={() => setTimeframe('month')}
            className={cn("flex-1 md:flex-none px-3 lg:px-6 py-2 rounded-xl text-xs lg:text-sm font-bold transition-all", timeframe === 'month' ? "bg-[#5A5A40] text-white" : "text-gray-400 hover:text-gray-600")}
          >
            Tháng
          </button>
          <button 
            onClick={() => setTimeframe('quarter')}
            className={cn("flex-1 md:flex-none px-3 lg:px-6 py-2 rounded-xl text-xs lg:text-sm font-bold transition-all", timeframe === 'quarter' ? "bg-[#5A5A40] text-white" : "text-gray-400 hover:text-gray-600")}
          >
            Quý
          </button>
          <button 
            onClick={() => setTimeframe('year')}
            className={cn("flex-1 md:flex-none px-3 lg:px-6 py-2 rounded-xl text-xs lg:text-sm font-bold transition-all", timeframe === 'year' ? "bg-[#5A5A40] text-white" : "text-gray-400 hover:text-gray-600")}
          >
            Năm
          </button>
        </div>

        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gray-400" />
            <span className="text-xs text-gray-400 font-bold uppercase">Năm</span>
          </div>
          <select 
            className="bg-transparent border-none focus:ring-0 text-sm font-bold pr-8"
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
          >
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
          <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">Tổng doanh thu</p>
          <p className="text-2xl font-serif font-bold text-[#5A5A40]">{totals.revenue.toLocaleString()}đ</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
          <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">Đã thu tiền</p>
          <p className="text-2xl font-serif font-bold text-emerald-600">{totals.paid.toLocaleString()}đ</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
          <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">Còn nợ (Công nợ mới)</p>
          <p className="text-2xl font-serif font-bold text-red-500">{totals.debt.toLocaleString()}đ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
          <h4 className="text-lg font-serif font-bold mb-8 flex items-center gap-2">
            <TrendingUp size={20} className="text-[#5A5A40]" />
            Biểu đồ Doanh thu & Thu hồi
          </h4>
          <div className="h-[300px] lg:h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value.toLocaleString()}đ`, '']}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                <Bar dataKey="revenue" name="Doanh thu" fill="#5A5A40" radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid" name="Đã thu" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="debt" name="Nợ mới" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
          <h4 className="text-lg font-serif font-bold mb-8 flex items-center gap-2">
            <Filter size={20} className="text-[#5A5A40]" />
            Tỷ lệ Thanh toán
          </h4>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Đã thu', value: totals.paid },
                    { name: 'Nợ mới', value: totals.debt }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#10B981" />
                  <Cell fill="#EF4444" />
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toLocaleString()}đ`} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 space-y-4">
            <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl">
              <span className="text-sm font-bold text-emerald-700">Tỷ lệ thu hồi</span>
              <span className="text-lg font-serif font-bold text-emerald-700">
                {totals.revenue > 0 ? ((totals.paid / totals.revenue) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-red-50 rounded-2xl">
              <span className="text-sm font-bold text-red-700">Tỷ lệ nợ mới</span>
              <span className="text-lg font-serif font-bold text-red-700">
                {totals.revenue > 0 ? ((totals.debt / totals.revenue) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
