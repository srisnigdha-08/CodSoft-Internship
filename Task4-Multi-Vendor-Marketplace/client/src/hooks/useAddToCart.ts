import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { errorText } from '../api/client';
import { useAuth } from './useAuth';
import { useCart } from './useCart';
import { useToast } from './useToast';

export function useAddToCart() {
  const { session } = useAuth();
  const { addItem } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);

  const role = session?.user.role;
  // Vendors and admins browse the catalog but do not buy.
  const canBuy = !role || role === 'CUSTOMER';

  const add = useCallback(
    async (productId: string, name: string, quantity = 1) => {
      if (!session) {
        navigate('/login', { state: { from: location.pathname + location.search } });
        return;
      }
      setBusy(true);
      try {
        await addItem(productId, quantity);
        toast(`${name} added to your cart`);
      } catch (error) {
        toast(errorText(error), 'error');
      } finally {
        setBusy(false);
      }
    },
    [session, addItem, toast, navigate, location],
  );

  return { add, busy, canBuy };
}
