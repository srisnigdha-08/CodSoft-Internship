import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UtensilsCrossed, Sparkles, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onNavigate: (page: string, param?: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login, quickLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const user = await login(email.trim().toLowerCase(), password);
      if (user.role === 'ADMIN') {
        onNavigate('admin');
      } else if (user.role === 'KITCHEN_STAFF') {
        onNavigate('kitchen');
      } else {
        onNavigate('menu');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuick = async (role: 'CUSTOMER' | 'KITCHEN_STAFF' | 'ADMIN') => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const user = await quickLogin(role);
      if (role === 'ADMIN') onNavigate('admin');
      else if (role === 'KITCHEN_STAFF') onNavigate('kitchen');
      else onNavigate('menu');
    } catch (err: any) {
      setErrorMsg(err.message || 'Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-6">
      {/* Brand Icon & Heading */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-terracotta-600 to-amber-600 flex items-center justify-center text-white mx-auto shadow-md">
          <UtensilsCrossed className="w-6 h-6" />
        </div>
        <h1 className="font-display text-3xl font-bold text-charcoal-900">
          Sign In to DineDesk
        </h1>
        <p className="text-xs text-stone-500">
          Access your digital orders, table bookings, and restaurant tools
        </p>
      </div>

      {/* Quick Demo Login Card */}
      <div className="bg-cream-200/60 rounded-3xl p-5 border border-cream-300/80 space-y-3">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-charcoal-900">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>One-Click Evaluator Sign-In:</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleQuick('CUSTOMER')}
            className="px-3 py-2 rounded-xl bg-white hover:bg-cream-50 border border-cream-300 text-xs font-bold text-charcoal-900 shadow-xs"
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => handleQuick('KITCHEN_STAFF')}
            className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-xs font-bold text-amber-900 shadow-xs"
          >
            Kitchen Chef
          </button>
          <button
            type="button"
            onClick={() => handleQuick('ADMIN')}
            className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-300 text-xs font-bold text-stone-900 shadow-xs"
          >
            Admin
          </button>
        </div>
      </div>

      {/* Credentials Form */}
      <div className="bg-white rounded-3xl p-8 border border-cream-200 shadow-md space-y-5">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. customer@dinedesk.local"
              className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm focus:ring-2 focus:ring-terracotta-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm focus:ring-2 focus:ring-terracotta-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-terracotta-700 hover:bg-terracotta-800 disabled:bg-stone-300 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-md transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 text-xs text-stone-500">
          <span>Don't have an account? </span>
          <button
            onClick={() => onNavigate('register')}
            className="text-terracotta-700 font-bold hover:underline"
          >
            Create Customer Account
          </button>
        </div>
      </div>
    </div>
  );
};
