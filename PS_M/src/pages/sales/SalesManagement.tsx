import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Plus,
  Minus,
  Loader2,
  AlertCircle,
  DollarSign,
  Package,
  Coffee,
  Receipt,
  Clock,
  Trash2,
  Save,
  FileText,
} from 'lucide-react';
import { supabase, Product, Sale, Expense, Debt } from '../../lib/supabase';

type CartItem = {
  product: Product;
  quantity: number;
};

export default function SalesManagement() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'market' | 'coffee'>('market');
  const [discount, setDiscount] = useState<number>(0);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: 0,
    stock: 0,
    category: 'market' as 'market' | 'coffee',
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      fetchProducts();
    } catch (err) {
      console.error('Auth check error:', err);
      navigate('/login');
    }
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('حدث خطأ في تحميل المنتجات');
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.product.id === product.id);
      if (existingItem) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, increment: boolean) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQuantity = increment ? item.quantity + 1 : Math.max(1, item.quantity - 1);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => 
      sum + (item.product.price * item.quantity), 0
    );
    const discountAmount = (discount / 100) * subtotal;
    return {
      subtotal,
      discountAmount,
      total: subtotal - discountAmount
    };
  };

  const handleCheckout = async () => {
    try {
      const { subtotal, discountAmount, total } = calculateTotal();

      // Create sales records
      const salesPromises = cart.map(item => 
        supabase.from('sales').insert({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.price,
          total_price: item.product.price * item.quantity,
          discount_amount: (discountAmount / subtotal) * (item.product.price * item.quantity),
          final_amount: (item.product.price * item.quantity) * (1 - discount / 100)
        })
      );

      // Update product stock
      const stockPromises = cart.map(item =>
        supabase
          .from('products')
          .update({ stock: item.product.stock - item.quantity })
          .eq('id', item.product.id)
      );

      await Promise.all([...salesPromises, ...stockPromises]);

      // Clear cart and refresh products
      setCart([]);
      setDiscount(0);
      fetchProducts();
    } catch (err) {
      console.error('Error processing checkout:', err);
      setError('حدث خطأ في عملية البيع');
    }
  };

  const handleAddProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([newProduct])
        .select()
        .single();

      if (error) throw error;

      setProducts(prev => [...prev, data]);
      setShowAddProductModal(false);
      setNewProduct({
        name: '',
        price: 0,
        stock: 0,
        category: 'market',
      });
    } catch (err) {
      console.error('Error adding product:', err);
      setError('حدث خطأ في إضافة المنتج');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen animated-bg flex items-center justify-center">
        <div className="flex items-center space-x-2 rtl:space-x-reverse text-white">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>جاري تحميل البيانات...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen animated-bg flex items-center justify-center">
        <div className="glass-card p-4 rounded-lg flex items-center space-x-2 rtl:space-x-reverse text-white">
          <AlertCircle className="w-6 h-6" />
          <span>{error}</span>
          <button
            onClick={fetchProducts}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  const filteredProducts = products.filter(p => p.category === selectedCategory);
  const { subtotal, discountAmount, total } = calculateTotal();

  return (
    <div className="min-h-screen animated-bg">
      <div className="glass-card border-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="bg-white/20 p-2 rounded-lg">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">إدارة المبيعات</h1>
            </div>

            <div className="flex items-center space-x-4 rtl:space-x-reverse">
              <button
                onClick={() => setShowAddProductModal(true)}
                className="flex items-center px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
              >
                <Plus className="w-4 h-4 ml-2" />
                إضافة منتج
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Products Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-xl p-6">
              <div className="flex space-x-4 rtl:space-x-reverse mb-6">
                <button
                  onClick={() => setSelectedCategory('market')}
                  className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center space-x-2 rtl:space-x-reverse transition-all hover-effect ${
                    selectedCategory === 'market'
                      ? 'bg-white/20 text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/15'
                  }`}
                >
                  <Package className="w-5 h-5" />
                  <span>البقالة</span>
                </button>
                <button
                  onClick={() => setSelectedCategory('coffee')}
                  className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center space-x-2 rtl:space-x-reverse transition-all hover-effect ${
                    selectedCategory === 'coffee'
                      ? 'bg-white/20 text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/15'
                  }`}
                >
                  <Coffee className="w-5 h-5" />
                  <span>المشروبات</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={product.stock === 0}
                    className={`p-4 rounded-lg glass-card hover-effect ${
                      product.stock === 0
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-white/20'
                    } transition-all text-right`}
                  >
                    <h3 className="font-medium text-white">{product.name}</h3>
                    <div className="mt-1 text-sm text-white/80">
                      {product.price.toFixed(2)} دينار
                    </div>
                    <div className={`mt-1 text-sm ${
                      product.stock === 0 ? 'text-red-300' : 'text-white/60'
                    }`}>
                      المخزون: {product.stock}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cart Section */}
          <div className="space-y-6">
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Receipt className="w-5 h-5 ml-2" />
                سلة المشتريات
              </h2>

              <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-red-300 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <button
                          onClick={() => updateQuantity(item.product.id, false)}
                          className="p-1 rounded-full hover:bg-white/10"
                        >
                          <Minus className="w-4 h-4 text-white" />
                        </button>
                        <span className="w-8 text-center text-white">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, true)}
                          className="p-1 rounded-full hover:bg-white/10"
                          disabled={item.quantity >= item.product.stock}
                        >
                          <Plus className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-white">{item.product.name}</div>
                      <div className="text-sm text-white/80">
                        {(item.product.price * item.quantity).toFixed(2)} دينار
                      </div>
                    </div>
                  </div>
                ))}

                {cart.length === 0 && (
                  <div className="text-center text-white/60 py-8">
                    السلة فارغة
                  </div>
                )}

                {cart.length > 0 && (
                  <div className="border-t border-white/10 pt-4 space-y-4">
                    <div className="flex justify-between text-sm text-white/80">
                      <span>المجموع:</span>
                      <span>{subtotal.toFixed(2)} دينار</span>
                    </div>

                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={discount}
                        onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                        className="w-20 p-2 glass-input rounded-lg text-center"
                      />
                      <span className="text-sm text-white/80">% خصم</span>
                    </div>

                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-red-300">
                        <span>الخصم:</span>
                        <span>- {discountAmount.toFixed(2)} دينار</span>
                      </div>
                    )}

                    <div className="flex justify-between text-lg font-bold text-white">
                      <span>الإجمالي:</span>
                      <span>{total.toFixed(2)} دينار</span>
                    </div>

                    <button
                      onClick={handleCheckout}
                      className="w-full py-3 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center space-x-2 rtl:space-x-reverse hover-effect"
                    >
                      <DollarSign className="w-5 h-5" />
                      <span>إتمام البيع</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">إضافة منتج جديد</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-1">
                  اسم المنتج
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full glass-input rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-1">
                  السعر
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, price: Number(e.target.value) }))}
                  className="w-full glass-input rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-1">
                  الكمية
                </label>
                <input
                  type="number"
                  min="0"
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, stock: Number(e.target.value) }))}
                  className="w-full glass-input rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-1">
                  الفئة
                </label>
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, category: e.target.value as 'market' | 'coffee' }))}
                  className="w-full glass-input rounded-lg"
                >
                  <option value="market">البقالة</option>
                  <option value="coffee">المشروبات</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 rtl:space-x-reverse mt-6">
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 text-white/80 hover:bg-white/10 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleAddProduct}
                  className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors hover-effect"
                >
                  إضافة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}