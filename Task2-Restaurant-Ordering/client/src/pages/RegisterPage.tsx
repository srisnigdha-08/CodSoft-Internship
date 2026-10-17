import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UtensilsCrossed, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

interface RegisterPageProps {
  onNavigate: (page: string, param?: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
      });
      onNavigate('menu');
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-terracotta-600 to-amber-600 flex items-center justify-center text-white mx-auto shadow-md">
          <UtensilsCrossed className="w-6 h-6" />
        </div>
        <h1 className="font-display text-3xl font-bold text-charcoal-900">
          Create an Account
        </h1>
        <p className="text-xs text-stone-500">
          Join DineDesk to save favorites, place quick orders, and book tables
        </p>
      </div>

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
              Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm focus:ring-2 focus:ring-terracotta-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="priya@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm focus:ring-2 focus:ring-terracotta-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm focus:ring-2 focus:ring-terracotta-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">
              Password (Min 6 characters) *
            </label>
            <input
              type="password"
              required
              minLength={6}
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
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Sign Up</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 text-xs text-stone-500">
          <span>Already registered? </span>
          <button
            onClick={() => onNavigate('login')}
            className="text-terracotta-700 font-bold hover:underline"
          >
            Sign In Instead
          </button>
        </div>
      </div>
    </div>
  );
};
