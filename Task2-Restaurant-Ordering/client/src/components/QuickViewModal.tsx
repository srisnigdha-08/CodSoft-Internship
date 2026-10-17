import React, { useState } from 'react';
import { MenuItem } from '../types';
import { useCart } from '../context/CartContext';
import { X, Clock, Plus, Minus, ShoppingBag, Check } from 'lucide-react';

interface QuickViewModalProps {
  item: MenuItem | null;
  onClose: () => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({ item, onClose }) => {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [added, setAdded] = useState(false);

  if (!item) return null;

  const handleAddToCart = () => {
    addItem(item, quantity, specialInstructions.trim() || undefined);
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-cream-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 hover:bg-white text-charcoal-800 shadow-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Image */}
        <div className="relative h-64 w-full bg-stone-100">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between text-white">
            <div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide backdrop-blur-md mb-2 ${
                  item.isVegetarian ? 'bg-emerald-600/90' : 'bg-red-600/90'
                }`}
              >
                {item.isVegetarian ? 'PURE VEGETARIAN' : 'NON-VEGETARIAN'}
              </span>
              <h2 className="font-display text-2xl font-bold">{item.name}</h2>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-xs font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{item.preparationTimeMinutes} min</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          <div>
            <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
              Description & Ingredients
            </h4>
            <p className="text-sm text-stone-700 leading-relaxed">{item.description}</p>
          </div>

          {/* Special Cooking Instructions */}
          <div>
            <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
              Kitchen Instructions (Optional)
            </label>
            <input
              type="text"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. Less spicy, dressing on the side, extra crispy..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-cream-300 bg-cream-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            />
          </div>

          {/* Actions & Price Footer */}
          <div className="pt-3 border-t border-cream-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-stone-500 uppercase font-medium block">
                Total Price
              </span>
              <span className="font-display text-2xl font-bold text-charcoal-900">
                ₹{(Number(item.price) * quantity).toFixed(2)}
              </span>
            </div>

            {item.isAvailable ? (
              <div className="flex items-center space-x-4">
                {/* Quantity Stepper */}
                <div className="flex items-center space-x-2 bg-cream-200 rounded-full p-1 border border-cream-300">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-full bg-white hover:bg-stone-100 text-charcoal-900 flex items-center justify-center font-bold"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-bold text-charcoal-900 px-2">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 rounded-full bg-terracotta-700 hover:bg-terracotta-800 text-white flex items-center justify-center font-bold"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={added}
                  className={`px-5 py-2.5 rounded-full text-sm font-bold flex items-center space-x-2 transition-all shadow-md active:scale-95 ${
                    added
                      ? 'bg-emerald-600 text-white'
                      : 'bg-terracotta-700 hover:bg-terracotta-800 text-white'
                  }`}
                >
                  {added ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Added!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Add to Cart</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <span className="px-4 py-2 rounded-full text-xs font-bold bg-stone-200 text-stone-500">
                Item Sold Out
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
