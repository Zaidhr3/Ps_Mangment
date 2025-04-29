import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Gamepad2,
  Users,
  LogOut,
  MonitorPlay,
  ShoppingCart,
  BarChart3,
  Settings,
  Bell,
  Loader2,
  Clock,
  Sun,
  Moon,
} from 'lucide-react';

interface HomeProps {
  toggleTheme: () => void;
  isDark: boolean;
}

export default function Home({ toggleTheme, isDark }: HomeProps) {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [deviceStats, setDeviceStats] = useState({
    active: 0,
    total: 0
  });
  const [sessionStats, setSessionStats] = useState({
    external: 0,
    internal: 0,
    vip: 0,
    total: 0
  });
  const [nextEndingSession, setNextEndingSession] = useState<{
    deviceName: string;
    endTime: string;
    remainingTime: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);

  useEffect(() => {
    checkAuth();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        return;
      }

      if (userData) {
        setUserRole(userData.role as 'admin' | 'user');
      }

      fetchStats();
    } catch (err) {
      console.error('Auth check error:', err);
      navigate('/login');
    }
  };

  const fetchStats = async () => {
    try {
      const [deviceData, sessionData, nextSession] = await Promise.all([
        fetchDeviceStats(),
        fetchSessionStats(),
        fetchNextEndingSession()
      ]);

      setDeviceStats(deviceData);
      setSessionStats(sessionData);
      setNextEndingSession(nextSession);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDeviceStats = async () => {
    const { data: devices, error } = await supabase
      .from('devices')
      .select('status');

    if (error) throw error;

    return devices.reduce((acc, device) => ({
      active: acc.active + (device.status === 'occupied' ? 1 : 0),
      total: acc.total + 1
    }), { active: 0, total: 0 });
  };

  const fetchSessionStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        device_id,
        devices (
          type
        )
      `)
      .gte('created_at', today.toISOString());

    if (error) throw error;

    return sessions.reduce((acc, session) => ({
      external: acc.external + (session.devices.type === 'external' ? 1 : 0),
      internal: acc.internal + (session.devices.type === 'internal' ? 1 : 0),
      vip: acc.vip + (session.devices.type === 'vip' ? 1 : 0),
      total: acc.total + 1
    }), { external: 0, internal: 0, vip: 0, total: 0 });
  };

  const fetchNextEndingSession = async () => {
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        end_time,
        devices (
          name
        )
      `)
      .eq('status', 'active')
      .not('end_time', 'is', null)
      .order('end_time')
      .limit(1);

    if (error) throw error;
    if (!sessions || sessions.length === 0) return null;

    const session = sessions[0];
    const endTime = new Date(session.end_time);
    const now = new Date();
    const diff = endTime.getTime() - now.getTime();
    
    if (diff <= 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return {
      deviceName: session.devices.name,
      endTime: session.end_time,
      remainingTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    };
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const menuItems = [
    {
      title: 'إدارة الأجهزة والجلسات',
      icon: <MonitorPlay className="w-24 h-24 text-white" />,
      description: 'إدارة أجهزة البلايستيشن وجلسات اللعب',
      path: '/devices',
      bgColor: 'bg-gradient-to-br from-blue-600 to-blue-700',
      hoverColor: 'hover:from-blue-700 hover:to-blue-800',
      adminOnly: false
    },
    {
      title: 'إدارة الحسابات والمبيعات',
      icon: <ShoppingCart className="w-24 h-24 text-white" />,
      description: 'إدارة المبيعات والحسابات والمخزون',
      path: '/sales',
      bgColor: 'bg-gradient-to-br from-emerald-600 to-emerald-700',
      hoverColor: 'hover:from-emerald-700 hover:to-emerald-800',
      adminOnly: true
    },
    {
      title: 'التقارير والإحصائيات',
      icon: <BarChart3 className="w-24 h-24 text-white" />,
      description: 'عرض تقارير المبيعات والإحصائيات',
      path: '/reports',
      bgColor: 'bg-gradient-to-br from-purple-600 to-purple-700',
      hoverColor: 'hover:from-purple-700 hover:to-purple-800',
      adminOnly: true
    },
    {
      title: 'إعدادات النظام',
      icon: <Settings className="w-24 h-24 text-white" />,
      description: 'إدارة إعدادات النظام والصلاحيات',
      path: '/settings',
      bgColor: 'bg-gradient-to-br from-gray-600 to-gray-700',
      hoverColor: 'hover:from-gray-700 hover:to-gray-800',
      adminOnly: true
    },
  ];

  const filteredMenuItems = menuItems.filter(item => 
    !item.adminOnly || userRole === 'admin'
  );

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

  return (
    <div className="min-h-screen animated-bg">
      {/* Header */}
      <div className="glass-card border-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="bg-white/20 p-2 rounded-lg">
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">نظام إدارة محل البلايستيشن</h1>
            </div>
            
            <div className="flex items-center space-x-4 rtl:space-x-reverse">
              <button
                onClick={toggleTheme}
                className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
              >
                {isDark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <Bell className="w-6 h-6" />
                </button>
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 text-sm font-medium text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 ml-2" />
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">مرحباً بك في لوحة التحكم</h2>
          <p className="text-white/80">اختر من القائمة أدناه للوصول إلى الخدمات المتاحة</p>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          {filteredMenuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => navigate(item.path)}
              className="glass-card p-8 rounded-xl hover-effect"
            >
              <div className="flex items-center justify-center text-center flex-col">
                <div className="mb-4">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-white/80 text-xl">
                    {item.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">نظرة عامة</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">الأجهزة النشطة</p>
                  <h4 className="text-2xl font-bold text-white mt-1">
                    {deviceStats.active} / {deviceStats.total}
                  </h4>
                </div>
                <div className="bg-white/10 p-2 rounded-lg">
                  <MonitorPlay className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
            
            <div className="glass-card rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-white/80">عدد الجلسات اليوم</p>
                  <h4 className="text-2xl font-bold text-white mt-1">{sessionStats.total}</h4>
                </div>
                <div className="bg-white/10 p-2 rounded-lg">
                  <Gamepad2 className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-white/80">
                  <span>خارجي:</span>
                  <span className="font-medium">{sessionStats.external} جلسة</span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>داخلي:</span>
                  <span className="font-medium">{sessionStats.internal} جلسة</span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>VIP:</span>
                  <span className="font-medium">{sessionStats.vip} جلسة</span>
                </div>
              </div>
            </div>
            
            <div className="glass-card rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80">أقرب جهاز سينتهي</p>
                  {nextEndingSession ? (
                    <div className="mt-2">
                      <div className="text-lg font-bold text-white">
                        {nextEndingSession.deviceName}
                      </div>
                      <div className="flex items-center text-red-300 font-mono mt-1">
                        <Clock className="w-4 h-4 ml-1" />
                        {nextEndingSession.remainingTime}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-white/60 mt-2">
                      لا توجد جلسات نشطة
                    </div>
                  )}
                </div>
                <div className="bg-white/10 p-2 rounded-lg">
                  <Clock className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}