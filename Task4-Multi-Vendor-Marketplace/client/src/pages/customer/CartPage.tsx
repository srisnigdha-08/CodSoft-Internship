import { Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { errorText } from '../../api/client';
import { EmptyState, Spinner } from '../../components/Feedback';
import { orderTotalRows, TotalsTable } from '../../components/OrderDetailsView';
import { PageHeader, ProductImage, QuantityStepper } from '../../components/ui';
import { useCart } from '../../hooks/useCart';
import { useToast } from '../../hooks/useToast';
import type { CartItem } from '../../types';
import { money } from '../../utils/format';

const ISSUE_TEXT = {
  UNAVAILABLE: 'No longer available. Remove this item to continue.',
  INSUFFICIENT_STOCK: 'Not enough stock for this quantity.',
};

function CartLine({ item }: { item: CartItem }) {
  const { updateItem, removeItem } = useCart();
  const { toast } = useToast();
  const report = (request: Promise<void>) => void request.catch((error: unknown) => toast(errorText(error), 'error'));

  return (
    <li>
      <ProductImage src={item.image} alt="" className="thumb" />
      <div className="line-item-info">
        <Link to={`/products/${item.productId}`}>{item.name}</Link>
        <span className="muted small">{money(item.unitPrice)} each</span>
        {item.issue && <span className="issue">{ISSUE_TEXT[item.issue]}</span>}
      </div>
      <QuantityStepper
        value={item.quantity}
        max={Math.max(Math.min(item.stock, 99), item.quantity)}
        label={`Quantity of ${item.name}`}
        disabled={item.issue === 'UNAVAILABLE'}
        onChange={(quantity) => report(updateItem(item.productId, quantity))}
      />
      <strong className="line-total">{money(item.lineTotal)}</strong>
      <button type="button" className="icon-btn" aria-label={`Remove ${item.name}`} onClick={() => report(removeItem(item.productId))}>
        <Trash2 size={17} aria-hidden="true" />
      </button>
    </li>
  );
}

export function CartPage() {
  const { cart, refresh } = useCart();

  // Stock and prices may have changed since the cart was last fetched.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!cart) return <Spinner />;
  if (cart.vendors.length === 0) {
    return (
      <EmptyState title="Your cart is empty">
        <Link to="/products">Browse products</Link>
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader
        title="Your cart"
        subtitle={`${cart.itemCount} items from ${cart.vendors.length} ${cart.vendors.length === 1 ? 'store' : 'stores'}. Each store ships separately.`}
      />
      <div className="order-layout">
        <div className="stack">
          {cart.vendors.map((group) => (
            <section key={group.vendor._id} className="card" aria-label={`Items from ${group.vendor.businessName}`}>
              <div className="card-title-row">
                <h2 className="card-heading">
                  <Link to={`/vendors/${group.vendor._id}`}>{group.vendor.businessName}</Link>
                </h2>
              </div>
              <ul className="line-items line-items-editable">
                {group.items.map((item) => (
                  <CartLine key={item.productId} item={item} />
                ))}
              </ul>
              <p className="muted small vendor-subtotal">
                Store subtotal {money(group.totals.subtotal)} · Delivery{' '}
                {group.totals.deliveryFee === 0 ? 'free' : money(group.totals.deliveryFee)}
              </p>
            </section>
          ))}
        </div>
        <aside className="card stack">
          <h2 className="card-heading">Order summary</h2>
          <TotalsTable rows={orderTotalRows(cart.totals)} />
          <p className="muted small">Delivery is charged per store and is free on store subtotals of ₹999 or more.</p>
          {cart.canCheckout ? (
            <Link to="/customer/checkout" className="btn btn-primary btn-block">
              Proceed to checkout
            </Link>
          ) : (
            <p className="issue">Resolve the highlighted items to check out.</p>
          )}
        </aside>
      </div>
    </>
  );
}
