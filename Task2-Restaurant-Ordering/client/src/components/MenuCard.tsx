import React from 'react';
import { MenuItem } from '../types';
import { useCart } from '../context/CartContext';
import { Plus, Minus, Clock, Eye, Sparkles } from 'lucide-react';

interface MenuCardProps {
  item: MenuItem;
  onQuickView: (item: MenuItem) => void;
}

export const MenuCard: React.FC<MenuCardProps> = ({ item, onQuickView }) => {
  const { items, addItem, updateQuantity } = useCart();

  const cartItem = items.find((ci) => ci.menuItem.id === item.id);
  const quantity = cartItem?.quantity || 0;

  return (
    <div className="group bg-white rounded-3xl overflow-hidden border border-cream-200/80 shadow-sm hover:shadow-xl hover:border-terracotta-200 transition-all duration-300 flex flex-col justify-between">
      <div>
        {/* Image Container with Consistent Aspect Ratio */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
          <img
            src={item.imageUrl}
            alt={item.name}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              !item.isAvailable ? 'grayscale opacity-60' : ''
            }`}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';
            }}
          />

          {/* Quick View Overlay Button */}
          <button
            onClick={() => onQuickView(item)}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white text-charcoal-900 shadow-md backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            title="Quick Details"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Dietary Tag & Availability */}
          <div className="absolute top-3 left-3 flex flex-col space-y-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide backdrop-blur-md shadow-sm ${
                item.isVegetarian
                  ? 'bg-emerald-500/90 text-white'
                  : 'bg-red-600/90 text-white'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  item.isVegetarian ? 'bg-white' : 'bg-white'
                }`}
              />
              {item.isVegetarian ? 'PURE VEG' : 'NON-VEG'}
            </span>

            {!item.isAvailable && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-900/80 text-white tracking-wider uppercase backdrop-blur-md">
                Sold Out
              </span>
            )}
          </div>

          {/* Preparation Time Badge */}
          <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/60 text-white backdrop-blur-md flex items-center space-x-1">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{item.preparationTimeMinutes} min</span>
          </div>
        </div>

        {/* Content Details */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3
              onClick={() => onQuickView(item)}
              className="font-display text-lg font-bold text-charcoal-900 hover:text-terracotta-700 cursor-pointer transition-colors line-clamp-1"
            >
              {item.name}
            </h3>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed line-clamp-2 mb-4">
            {item.description}
          </p>
        </div>
      </div>

      {/* Pricing and Cart Actions Footer */}
      <div className="p-5 pt-0 flex items-center justify-between border-t border-cream-100 mt-2">
        <div>
          <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-medium">Price</span>
          <span className="font-display text-xl font-bold text-charcoal-900">
            ₹{Number(item.price).toFixed(2)}
          </span>
        </div>

        {item.isAvailable ? (
          quantity > 0 ? (
            <div className="flex items-center space-x-2 bg-cream-200/80 rounded-full p-1 border border-cream-300">
              <button
                onClick={() => updateQuantity(item.id, quantity - 1)}
                className="w-7 h-7 rounded-full bg-white hover:bg-stone-100 text-charcoal-800 flex items-center justify-center transition-colors shadow-xs"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-bold text-charcoal-900 px-1.5 min-w-[18px] text-center">
                {quantity}
              </span>
              <button
                onClick={() => updateQuantity(item.id, quantity + 1)}
                className="w-7 h-7 rounded-full bg-terracotta-700 hover:bg-terracotta-800 text-white flex items-center justify-center transition-colors shadow-xs"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => addItem(item, 1)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-bold bg-terracotta-700 hover:bg-terracotta-800 text-white shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          )
        ) : (
          <button
            disabled
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-stone-200 text-stone-400 cursor-not-allowed"
          >
            Unavailable
          </button>
        )}
      </div>
    </div>
  );
};
