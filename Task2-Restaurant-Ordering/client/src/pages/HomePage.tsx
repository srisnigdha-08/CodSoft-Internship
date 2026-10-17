import React, { useEffect, useState } from 'react';
import { MenuItem, MenuCategory } from '../types';
import { api } from '../services/api';
import { MenuCard } from '../components/MenuCard';
import { QuickViewModal } from '../components/QuickViewModal';
import {
  ArrowRight,
  Sparkles,
  Utensils,
  Clock,
  ShieldCheck,
  Award,
  ChevronRight,
  Flame,
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (page: string, param?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [featuredItems, setFeaturedItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickViewItem, setQuickViewItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [items, cats] = await Promise.all([
          api.getMenuItems({ available: true }),
          api.getCategories(),
        ]);
        // Pick top 4 signature items for home showcase
        setFeaturedItems(items.slice(0, 4));
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load home data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Headline & Action */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-terracotta-100 text-terracotta-800 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-terracotta-600" />
                <span>Modern Dining Redefined</span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-charcoal-900 tracking-tight leading-[1.15]">
                Culinary Artistry, Delivered with Precision.
              </h1>

              <p className="text-base sm:text-lg text-stone-600 max-w-xl leading-relaxed">
                Welcome to <span className="font-semibold text-charcoal-900">DineDesk</span>. Explore our seasonal menu crafted with farm-to-table ingredients, reserve your favorite table in real time, or track your gourmet order right to your doorstep.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => onNavigate('menu')}
                  className="px-7 py-3.5 rounded-full bg-terracotta-700 hover:bg-terracotta-800 text-white font-bold text-sm flex items-center space-x-2 shadow-lg shadow-terracotta-700/25 transition-all hover:scale-102 active:scale-98"
                >
                  <Utensils className="w-4 h-4" />
                  <span>Explore Digital Menu</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onNavigate('reserve')}
                  className="px-7 py-3.5 rounded-full bg-white hover:bg-cream-100 text-charcoal-900 border border-cream-300 font-bold text-sm transition-all hover:border-terracotta-300 shadow-sm"
                >
                  Reserve a Table
                </button>
              </div>

              {/* Feature Highlights Ticker */}
              <div className="grid grid-cols-3 gap-4 pt-8 border-t border-cream-300/60 max-w-lg">
                <div>
                  <p className="font-display text-2xl font-bold text-charcoal-900">100%</p>
                  <p className="text-xs text-stone-500 font-medium">Fresh Ingredients</p>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-charcoal-900">&lt; 20m</p>
                  <p className="text-xs text-stone-500 font-medium">Avg Prep Time</p>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-terracotta-700">4.9 ★</p>
                  <p className="text-xs text-stone-500 font-medium">Guest Satisfaction</p>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Stack */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md">
                {/* Decorative glow */}
                <div className="absolute -top-6 -left-6 w-72 h-72 bg-terracotta-200/50 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-6 -right-6 w-72 h-72 bg-amber-200/50 rounded-full blur-3xl pointer-events-none" />

                {/* Primary Food Photo */}
                <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/5] bg-stone-100">
                  <img
                    src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1000&q=80"
                    alt="Signature Charcoal Kebabs & Gourmet Dishes"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/70 via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 text-white">
                    <span className="px-2.5 py-1 rounded-full bg-terracotta-600/90 text-[11px] font-bold tracking-wider uppercase backdrop-blur-sm mb-2 inline-block">
                      Chef Special
                    </span>
                    <h3 className="font-display text-xl font-bold">Wood-Fired Tandoor & Grill</h3>
                    <p className="text-xs text-stone-200 mt-1">Marinated with secret family spices</p>
                  </div>
                </div>

                {/* Floating Dish Badge Card */}
                <div className="absolute -bottom-6 -left-6 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-cream-200 flex items-center space-x-3.5 max-w-xs">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0">
                    <img
                      src="https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=300&q=80"
                      alt="Butter Chicken"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1">
                      <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span className="text-[11px] font-bold text-amber-700 uppercase">Most Popular</span>
                    </div>
                    <p className="text-xs font-bold text-charcoal-900 line-clamp-1">Butter Chicken Royale</p>
                    <p className="text-xs font-semibold text-terracotta-700">₹440.00</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-xs font-bold tracking-wider uppercase text-terracotta-700 block mb-1">
              Curated Offerings
            </span>
            <h2 className="font-display text-3xl font-bold text-charcoal-900">
              Explore Our Categories
            </h2>
          </div>
          <button
            onClick={() => onNavigate('menu')}
            className="text-xs font-bold text-terracotta-700 hover:text-terracotta-800 flex items-center space-x-1"
          >
            <span>View Full Menu</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => onNavigate('menu', cat.slug)}
              className="group cursor-pointer bg-white rounded-2xl p-6 border border-cream-200 hover:border-terracotta-300 shadow-xs hover:shadow-lg transition-all duration-300 text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-cream-100 group-hover:bg-terracotta-50 flex items-center justify-center text-terracotta-700 mb-4 transition-colors">
                <Utensils className="w-6 h-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-charcoal-900 group-hover:text-terracotta-700 transition-colors">
                {cat.name}
              </h3>
              <p className="text-xs text-stone-500 line-clamp-2 mt-1.5 leading-relaxed">
                {cat.description || 'Explore savory seasonal creations handcrafted daily.'}
              </p>
              <span className="text-[11px] font-bold text-terracotta-700 mt-4 inline-flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                <span>View items</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Signature Dishes */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-xs font-bold tracking-wider uppercase text-terracotta-700 block mb-1">
              Chef Highlights
            </span>
            <h2 className="font-display text-3xl font-bold text-charcoal-900">
              Signature Dishes
            </h2>
          </div>
          <button
            onClick={() => onNavigate('menu')}
            className="text-xs font-bold text-terracotta-700 hover:text-terracotta-800 flex items-center space-x-1"
          >
            <span>See All ({featuredItems.length})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white rounded-3xl h-80 animate-pulse border border-cream-200" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredItems.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                onQuickView={(it) => setQuickViewItem(it)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Table Reservation Callout Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-charcoal-950 via-charcoal-900 to-terracotta-900 text-white p-8 sm:p-12 shadow-2xl border border-charcoal-800">
          <div className="max-w-xl space-y-4">
            <span className="px-3 py-1 rounded-full bg-white/10 text-amber-400 text-xs font-bold tracking-wider uppercase inline-block">
              Intimate Dining & Celebrations
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Reserve Your Table in Seconds.
            </h2>
            <p className="text-sm text-stone-300 leading-relaxed">
              Planning a romantic evening, business luncheon, or family gathering? Select your preferred date, time slot, and seating area with instant confirmation.
            </p>
            <div className="pt-2">
              <button
                onClick={() => onNavigate('reserve')}
                className="px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-600 text-charcoal-950 font-bold text-sm shadow-md transition-all active:scale-95"
              >
                Book a Reservation Now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick View Modal */}
      <QuickViewModal
        item={quickViewItem}
        onClose={() => setQuickViewItem(null)}
      />
    </div>
  );
};
