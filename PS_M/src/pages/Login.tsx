import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Gamepad2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    if (!email || !password) {
      setError('جميع الحقول مطلوبة');
      return false;
    }

    if (!email.includes('@')) {
      setError('البريد الإلكتروني غير صالح');
      return false;
    }

    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Login error:', signInError);
        if (signInError.message.includes('Invalid login credentials')) {
          setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        } else {
          setError('حدث خطأ في تسجيل الدخول');
        }
        return;
      }

      if (!user) {
        setError('لم يتم العثور على المستخدم');
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            { id: user.id, email: user.email, role: 'user' }
          ]);

        if (insertError) {
          console.error('Error creating user record:', insertError);
          setError('حدث خطأ في إعداد حساب المستخدم');
          return;
        }
      }

      navigate('/home');
    } catch (error: any) {
      console.error('Unexpected error:', error);
      setError('حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen animated-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Gaming Icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img
          src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/gamepad-2.svg"
          className="absolute top-10 left-10 w-24 h-24 text-white/10 animate-float"
          style={{ opacity: 0.1 }}
          alt=""
        />
        <img
          src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/monitor.svg"
          className="absolute bottom-10 right-10 w-24 h-24 text-white/10 animate-float-delayed"
          style={{ opacity: 0.1 }}
          alt=""
        />
        <img
          src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/controller.svg"
          className="absolute top-1/2 right-20 w-16 h-16 text-white/10 animate-float"
          style={{ opacity: 0.1 }}
          alt=""
        />
      </div>

      <div className="glass-card rounded-2xl p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-4">
            <Gamepad2 className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Friends PS</h1>
          <p className="text-white/80 mt-2">مرحباً بك مجدداً</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 text-red-300 p-4 rounded-lg text-center">
              {error}
            </div>
          )}
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-1 text-right">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="أدخل بريدك الإلكتروني"
              className="w-full glass-input rounded-lg p-3"
              dir="rtl"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-1 text-right">
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور"
              className="w-full glass-input rounded-lg p-3"
              dir="rtl"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin ml-2" />
                جاري تسجيل الدخول...
              </>
            ) : (
              'تسجيل الدخول'
            )}
          </button>

          <div className="text-center text-white/80">
            ليس لديك حساب؟{' '}
            <Link to="/register" className="text-white hover:text-white/90 underline">
              إنشاء حساب جديد
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}