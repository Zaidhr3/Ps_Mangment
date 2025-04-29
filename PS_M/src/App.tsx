import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import DeviceManagement from './pages/devices/DeviceManagement';
import SalesManagement from './pages/sales/SalesManagement';
import ReportsManagement from './pages/reports/ReportsManagement';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    checkUser();
    initTheme();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    } catch (error) {
      console.error('Error checking auth state:', error);
      setIsAuthenticated(false);
    }
  };

  const initTheme = () => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen animated-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white dark:border-gray-300"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/home" replace /> : <Login />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/home" replace /> : <Register />} />
          <Route path="/home" element={isAuthenticated ? <Home toggleTheme={toggleTheme} isDark={isDark} /> : <Navigate to="/login" replace />} />
          <Route path="/devices" element={isAuthenticated ? <DeviceManagement /> : <Navigate to="/login" replace />} />
          <Route path="/sales" element={isAuthenticated ? <SalesManagement /> : <Navigate to="/login" replace />} />
          <Route path="/reports" element={isAuthenticated ? <ReportsManagement /> : <Navigate to="/login" replace />} />
          <Route path="/" element={<Navigate to={isAuthenticated ? "/home" : "/login"} replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;