import React, { useEffect, useState } from 'react';
import { MenuItem, MenuCategory } from '../types';
import { api } from '../services/api';
import { MenuCard } from '../components/MenuCard';
import { QuickViewModal } from '../components/QuickViewModal';
import { useCart } from '../context/CartContext';
import { Search, Sparkles, Filter, ShoppingBag, ArrowRight } from 'lucide-react';

interface MenuPageProps {
  initialCategory?: string;
  onNavigate: (page: string, param?: string) => void;
}

export const MenuPage: React.FC<MenuPageProps> = ({ initialCategory, onNavigate }) => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quickViewItem, setQuickViewItem] = useState<MenuItem | null>(null);

  const { itemCount, total } = useCart();

  useEffect(() => {
    async function fetchMenu() {
      setLoading(true);
      try {
        const [cats, menuItems] = await Promise.all([
          api.getCategories(),
          api.getMenuItems({
            category: selectedCategory !== 'all' ? selectedCategory : undefined,
            search: searchTerm.trim() || undefined,
            vegetarian: vegOnly ? true : undefined,
          }),
        ]);
        setCategories(cats);
        setItems(menuItems);
      } catch (err) {
        console.error('Failed to fetch menu:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMenu();
  }, [selectedCategory, searchTerm, vegOnly]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="px-3 py-1 rounded-full bg-terracotta-100 text-terracotta-800 text-xs font-bold uppercase tracking-wider inline-flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-terracotta-600" />
          <span>Interactive Digital Menu</span>
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-charcoal-900">
          Curated Dining Selections
        </h1>
        <p className="text-sm text-stone-600 leading-relaxed">
          Every dish is prepared fresh to order. Customize items with special kitchen notes, review allergen indicators, and order directly to your table or doorstep.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-cream-200/90 shadow-sm space-y-4">
        {/* Search & Dietary Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by dish name, spice, or ingredient..."
              className="w-full pl-11 pr-4 py-2.5 rounded-full border border-cream-300 bg-cream-50/50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            />
          </div>

          {/* Pure Veg Filter Toggle */}
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <span className="text-xs font-bold text-stone-700">Vegetarian Only</span>
              <div
                onClick={() => setVegOnly(!vegOnly)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                  vegOnly ? 'bg-emerald-600' : 'bg-stone-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                    vegOnly ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            </label>
          </div>
        </div>

        {/* Categories Tab Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none pt-2 border-t border-cream-100">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-terracotta-700 text-white shadow-sm'
                : 'bg-cream-100 text-charcoal-800 hover:bg-cream-200'
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.slug
                  ? 'bg-terracotta-700 text-white shadow-sm'
                  : 'bg-cream-100 text-charcoal-800 hover:bg-cream-200'
              }`}
            >
              <span>{cat.name}</span>
              {cat._count?.items !== undefined && (
                <span className="ml-1.5 opacity-70">({cat._count.items})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="bg-white rounded-3xl h-84 animate-pulse border border-cream-200" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-cream-200 max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 rounded-full bg-cream-100 text-stone-400 mx-auto flex items-center justify-center">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="font-display text-xl font-bold text-charcoal-900">No Dishes Found</h3>
          <p className="text-xs text-stone-500">
            We couldn't find any dishes matching your current search or dietary filters. Try clearing your filters.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSearchTerm('');
              setVegOnly(false);
            }}
            className="px-5 py-2 rounded-full bg-terracotta-700 text-white text-xs font-bold hover:bg-terracotta-800"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              onQuickView={(it) => setQuickViewItem(it)}
            />
          ))}
        </div>
      )}

      {/* Floating Bottom Cart Bar when items exist */}
      {itemCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-lg w-full px-4 animate-in slide-in-from-bottom-6 duration-300">
          <div className="bg-charcoal-950 text-white rounded-2xl p-4 shadow-2xl border border-charcoal-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-terracotta-600 text-white flex items-center justify-center font-bold">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-stone-400 font-medium">
                  {itemCount} item{itemCount > 1 ? 's' : ''} added
                </p>
                <p className="font-display text-base font-bold text-white">
                  ₹{total.toFixed(2)}
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('cart')}
              className="px-5 py-2.5 rounded-xl bg-terracotta-600 hover:bg-terracotta-700 text-white font-bold text-xs flex items-center space-x-2 transition-all"
            >
              <span>View Cart & Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Quick View Details Modal */}
      <QuickViewModal
        item={quickViewItem}
        onClose={() => setQuickViewItem(null)}
      />
    </div>
  );
};
