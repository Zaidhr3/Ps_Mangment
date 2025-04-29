import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Clock, StopCircle, Plus, Minus, AlertCircle, Timer, Loader2 } from 'lucide-react';
import { supabase, Device, Session } from '../../lib/supabase';
import useSound from 'use-sound';

export default function DeviceManagement() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeSessions, setActiveSessions] = useState<Record<string, Session>>({});
  const [showEndSessionModal, setShowEndSessionModal] = useState<string | null>(null);
  const [showStartSessionModal, setShowStartSessionModal] = useState<string | null>(null);
  const [discount, setDiscount] = useState<number>(0);
  const [sessionDuration, setSessionDuration] = useState<number>(60);
  const [isOpenSession, setIsOpenSession] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [expiredSessions, setExpiredSessions] = useState<Set<string>>(new Set());
  const [extraTime, setExtraTime] = useState<Record<string, string>>({});

  // Load alarm sound for session expiration
  const [playAlarm] = useSound('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', {
    volume: 1.0,
    interrupt: true
  });

  useEffect(() => {
    checkAuth();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      loadInitialData();
    } catch (err) {
      console.error('Auth check error:', err);
      navigate('/login');
    }
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([fetchDevices(), fetchActiveSessions()]);
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('حدث خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('name');
      
      if (error) throw error;
      if (!data) throw new Error('No data returned');

      setDevices(data);
    } catch (err) {
      console.error('Error fetching devices:', err);
      throw err;
    }
  };

  const fetchActiveSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'active');
      
      if (error) throw error;

      const sessionsMap: Record<string, Session> = {};
      data?.forEach(session => {
        sessionsMap[session.device_id] = session;
      });
      setActiveSessions(sessionsMap);
    } catch (err) {
      console.error('Error fetching active sessions:', err);
      throw err;
    }
  };

  const formatJordanTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Amman',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const calculateSessionCost = (session: Session, device: Device): number => {
    if (!session.start_time) return 0;

    const start = new Date(session.start_time);
    let end: Date;
    
    if (!isOpenSession && session.end_time && expiredSessions.has(session.id)) {
      end = new Date(session.end_time);
    } else {
      end = session.end_time ? new Date(session.end_time) : new Date();
      
      if (!isOpenSession && session.end_time && new Date() > new Date(session.end_time)) {
        end = new Date(session.end_time);
      }
    }
    
    const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    
    let baseCost: number;
    
    if (isOpenSession) {
      baseCost = totalMinutes * 0.025;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const remainingMinutes = totalMinutes % 60;
      
      baseCost = hours * 1.5;
      baseCost += (remainingMinutes * 0.025);
    }
    
    const hours = totalMinutes / 60;
    const extraControllersCost = session.extra_controllers * device.extra_controller_rate * hours;

    return Math.round((baseCost + extraControllersCost) * 100) / 100;
  };

  const startSession = async (deviceId: string) => {
    if (isStartingSession) return;
    setIsStartingSession(true);
    setError(null);

    try {
      const device = devices.find(d => d.id === deviceId);
      if (!device) throw new Error('Device not found');
      if (device.status !== 'available') throw new Error('Device is not available');

      const startTime = new Date();
      const endTime = isOpenSession ? null : new Date(startTime.getTime() + sessionDuration * 60 * 1000);

      const { error: deviceError } = await supabase
        .from('devices')
        .update({ status: 'occupied' })
        .eq('id', deviceId);

      if (deviceError) throw deviceError;

      const initialCost = calculateSessionCost({
        id: '',
        device_id: deviceId,
        start_time: startTime.toISOString(),
        end_time: endTime?.toISOString() || null,
        extra_controllers: 0,
        status: 'active',
        total_cost: 0,
        discount_amount: 0,
        final_amount: 0,
        customer_name: customerName || null
      }, device);

      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .insert([{
          device_id: deviceId,
          start_time: startTime.toISOString(),
          end_time: endTime?.toISOString() || null,
          extra_controllers: 0,
          status: 'active',
          total_cost: initialCost,
          discount_amount: 0,
          final_amount: initialCost,
          customer_name: customerName || null
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      setDevices(prev => prev.map(d => 
        d.id === deviceId ? { ...d, status: 'occupied' } : d
      ));

      setActiveSessions(prev => ({
        ...prev,
        [deviceId]: sessionData
      }));

      setShowStartSessionModal(null);
      setCustomerName('');
      setSessionDuration(60);
      setIsOpenSession(true);
    } catch (err) {
      console.error('Error starting session:', err);
      setError('حدث خطأ في بدء الجلسة');
      
      try {
        await supabase
          .from('devices')
          .update({ status: 'available' })
          .eq('id', deviceId);
      } catch (revertErr) {
        console.error('Error reverting device status:', revertErr);
      }
    } finally {
      setIsStartingSession(false);
    }
  };

  const updateExtraControllers = async (deviceId: string, increment: boolean) => {
    try {
      const session = activeSessions[deviceId];
      const device = devices.find(d => d.id === deviceId);
      if (!session || !device) return;

      if (expiredSessions.has(session.id)) return;

      const newCount = increment 
        ? session.extra_controllers + 1 
        : Math.max(0, session.extra_controllers - 1);

      const newCost = calculateSessionCost({ ...session, extra_controllers: newCount }, device);

      const { error } = await supabase
        .from('sessions')
        .update({ 
          extra_controllers: newCount,
          total_cost: newCost,
          final_amount: newCost * (1 - (session.discount_amount / 100))
        })
        .eq('id', session.id);

      if (error) throw error;

      setActiveSessions(prev => ({
        ...prev,
        [deviceId]: {
          ...session,
          extra_controllers: newCount,
          total_cost: newCost,
          final_amount: newCost * (1 - (session.discount_amount / 100))
        }
      }));
    } catch (err) {
      console.error('Error updating extra controllers:', err);
      setError('حدث خطأ في تحديث عدد الأيادي الإضافية');
    }
  };

  const endSession = async (deviceId: string) => {
    if (isEndingSession) return;
    setIsEndingSession(true);
    try {
      const session = activeSessions[deviceId];
      const device = devices.find(d => d.id === deviceId);
      if (!session || !device) return;

      const endTime = new Date().toISOString();
      const totalCost = calculateSessionCost({ ...session, end_time: endTime }, device);
      const discountAmount = (discount / 100) * totalCost;
      const finalAmount = totalCost - discountAmount;

      const { error: sessionError } = await supabase
        .from('sessions')
        .update({
          end_time: endTime,
          status: 'completed',
          total_cost: totalCost,
          discount_amount: discountAmount,
          final_amount: finalAmount
        })
        .eq('id', session.id);

      if (sessionError) throw sessionError;

      const { error: deviceError } = await supabase
        .from('devices')
        .update({ status: 'available' })
        .eq('id', deviceId);

      if (deviceError) throw deviceError;

      setActiveSessions(prev => {
        const newSessions = { ...prev };
        delete newSessions[deviceId];
        return newSessions;
      });

      setDevices(prev => prev.map(d => 
        d.id === deviceId ? { ...d, status: 'available' } : d
      ));

      setShowEndSessionModal(null);
      setDiscount(0);
      setExpiredSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(session.id);
        return newSet;
      });
      setExtraTime(prev => {
        const newTimes = { ...prev };
        delete newTimes[session.id];
        return newTimes;
      });
    } catch (err) {
      console.error('Error ending session:', err);
      setError('حدث خطأ في إنهاء الجلسة');
    } finally {
      setIsEndingSession(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      Object.entries(activeSessions).forEach(([deviceId, session]) => {
        if (session.status === 'active') {
          const device = devices.find(d => d.id === deviceId);
          if (!device) return;

          if (!isOpenSession && session.end_time) {
            const now = new Date();
            const endTime = new Date(session.end_time);
            
            if (now >= endTime && !expiredSessions.has(session.id)) {
              setExpiredSessions(prev => new Set([...prev, session.id]));
              playAlarm();
              
              const startExtra = new Date(endTime);
              setExtraTime(prev => ({
                ...prev,
                [session.id]: formatDuration(startExtra.toISOString())
              }));
              return;
            }
          }

          if (!expiredSessions.has(session.id)) {
            const newCost = calculateSessionCost(session, device);
            if (newCost !== session.total_cost) {
              setActiveSessions(prev => ({
                ...prev,
                [deviceId]: { 
                  ...session, 
                  total_cost: newCost,
                  final_amount: newCost * (1 - (session.discount_amount / 100))
                }
              }));

              supabase
                .from('sessions')
                .update({ 
                  total_cost: newCost,
                  final_amount: newCost * (1 - (session.discount_amount / 100))
                })
                .eq('id', session.id)
                .then(({ error }) => {
                  if (error) {
                    console.error('Error updating session cost:', error);
                  }
                });
            }
          }
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSessions, devices, isOpenSession, expiredSessions, playAlarm]);

  const getDeviceStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'occupied': return 'bg-red-500';
      case 'maintenance': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const formatCountdown = (endTime: string): string => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return '00:00:00';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (startTime: string): string => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
            onClick={loadInitialData}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen animated-bg">
      <div className="glass-card border-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="bg-white/20 p-2 rounded-lg">
                <Monitor className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">إدارة الأجهزة والجلسات</h1>
            </div>
            <div className="bg-white/20 px-4 py-2 rounded-lg">
              <span className="text-lg font-bold text-white">{formatJordanTime(currentTime)}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map(device => {
            const session = activeSessions[device.id];
            const isActive = session?.status === 'active';
            const isExpired = session && expiredSessions.has(session.id);
            const isTimedSession = session && session.end_time !== null;
            
            return (
              <div key={device.id} className="glass-card rounded-xl overflow-hidden hover-effect">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-3 h-3 rounded-full ${getDeviceStatusColor(device.status)}`} />
                    <h3 className="text-xl font-semibold text-white">{device.name}</h3>
                  </div>

                  <div className="space-y-4">
                    {session ? (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/80">نوع الجلسة:</span>
                          <span className={`font-medium ${isTimedSession ? 'text-orange-300' : 'text-blue-300'}`}>
                            {isTimedSession ? 'محددة' : 'مفتوحة'}
                          </span>
                        </div>

                        {isTimedSession && (
                          <div className="text-sm text-white/80 text-right">
                            المدة المحددة: {session.end_time && 
                              Math.round((new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / (1000 * 60))
                            } دقيقة
                          </div>
                        )}
                        
                        {session.customer_name && (
                          <div className="text-sm text-white/80 text-right">
                            العميل: {session.customer_name}
                          </div>
                        )}
                        
                        <div className="glass-card p-3 rounded-lg">
                          <div className="flex items-center justify-between text-sm text-white/80 mb-2">
                            <span>وقت البدء:</span>
                            <span className="font-mono">
                              {new Date(session.start_time).toLocaleTimeString('en-US', {
                                timeZone: 'Asia/Amman',
                                hour12: false
                              })}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between text-sm text-white/80">
                            <span>{isOpenSession ? 'المدة:' : isExpired ? 'الوقت الإضافي:' : 'الوقت المتبقي:'}</span>
                            <span className={`font-mono font-bold ${isExpired ? 'text-red-300' : 'text-white'}`}>
                              {isOpenSession 
                                ? formatDuration(session.start_time)
                                : isExpired
                                  ? extraTime[session.id]
                                  : session.end_time && formatCountdown(session.end_time)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm text-white/80">
                          <span>التكلفة الحالية:</span>
                          <span className="font-semibold text-white">
                            {session.total_cost.toFixed(2)} دينار
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm text-white/80">
                          <span>الأيادي الإضافية:</span>
                          <div className="flex items-center space-x-2 rtl:space-x-reverse">
                            <button
                              onClick={() => updateExtraControllers(device.id, false)}
                              className="p-1 rounded-full hover:bg-white/10 disabled:opacity-50 text-white"
                              disabled={isExpired}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="text-white">{session.extra_controllers}</span>
                            <button
                              onClick={() => updateExtraControllers(device.id, true)}
                              className="p-1 rounded-full hover:bg-white/10 disabled:opacity-50 text-white"
                              disabled={isExpired}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {isExpired && (
                          <div className="bg-red-500/20 text-red-300 p-2 rounded-lg text-center text-sm animate-pulse">
                            انتهى وقت الجلسة
                          </div>
                        )}

                        <button
                          onClick={() => setShowEndSessionModal(device.id)}
                          className="w-full py-2 px-4 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center gap-2 hover-effect"
                          disabled={isEndingSession}
                        >
                          {isEndingSession && <Loader2 className="w-4 h-4 animate-spin" />}
                          <StopCircle className="w-5 h-5" />
                          إنهاء الجلسة
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowStartSessionModal(device.id)}
                        className="w-full py-2 px-4 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors hover-effect"
                      >
                        بدء جلسة جديدة
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showStartSessionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4 text-right">بدء جلسة جديدة</h3>
            
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="اسم العميل (اختياري)"
                  className="w-full glass-input rounded-lg text-right"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 rtl:space-x-reverse">
                <input
                  type="checkbox"
                  id="openSession"
                  checked={isOpenSession}
                  onChange={(e) => setIsOpenSession(e.target.checked)}
                  className="rounded text-white/20"
                />
                <label htmlFor="openSession" className="text-sm text-white/80">
                  جلسة مفتوحة
                </label>
              </div>

              {!isOpenSession && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white/80 text-right">
                    مدة الجلسة (بالدقائق)
                  </label>
                  <input
                    type="number"
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(Math.max(1, parseInt(e.target.value)))}
                    className="w-full glass-input rounded-lg text-right"
                    min="1"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 rtl:space-x-reverse mt-6">
                <button
                  onClick={() => setShowStartSessionModal(null)}
                  className="px-4 py-2 text-white/80 hover:bg-white/10 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => startSession(showStartSessionModal)}
                  disabled={isStartingSession}
                  className={`px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2 hover-effect ${
                    isStartingSession ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isStartingSession && <Loader2 className="w-4 h-4 animate-spin" />}
                  بدء الجلسة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEndSessionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4 text-right">إنهاء الجلسة</h3>
            
            <div className="space-y-4">
              <div className="glass-card p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/80">وقت البدء:</span>
                  <span className="font-mono text-white">
                    {new Date(activeSessions[showEndSessionModal]?.start_time).toLocaleTimeString('en-US', {
                      timeZone: 'Asia/Amman',
                      hour12: false
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/80">المدة:</span>
                  <span className="font-mono text-white">
                    {formatDuration(activeSessions[showEndSessionModal]?.start_time)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white/80">التكلفة الإجمالية:</span>
                <span className="font-bold text-white">
                  {activeSessions[showEndSessionModal]?.total_cost.toFixed(2)} دينار
                </span>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/80 text-right">
                  نسبة الخصم (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-full glass-input rounded-lg text-right"
                />
              </div>

              <div className="flex items-center justify-between font-bold">
                <span className="text-white">المبلغ النهائي:</span>
                <span className="text-green-300">
                  {(activeSessions[showEndSessionModal]?.total_cost * (1 - discount / 100)).toFixed(2)} دينار
                </span>
              </div>

              <div className="flex justify-end space-x-2 rtl:space-x-reverse">
                <button
                  onClick={() => setShowEndSessionModal(null)}
                  className="px-4 py-2 text-white/80 hover:bg-white/10 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => endSession(showEndSessionModal)}
                  disabled={isEndingSession}
                  className={`px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2 hover-effect ${
                    isEndingSession ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isEndingSession && <Loader2 className="w-4 h-4 animate-spin" />}
                  إنهاء الجلسة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}