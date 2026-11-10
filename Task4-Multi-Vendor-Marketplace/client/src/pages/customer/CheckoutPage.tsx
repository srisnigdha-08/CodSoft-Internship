import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorText } from '../../api/client';
import { AddressFields, cleanAddress, emptyAddress } from '../../components/AddressFields';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Feedback';
import { orderTotalRows, TotalsTable } from '../../components/OrderDetailsView';
import { Field, PageHeader } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { orderService } from '../../services';
import { money } from '../../utils/format';

export function CheckoutPage() {
  const { session } = useAuth();
  const { cart, refresh } = useCart();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(session?.user.name ?? '');
  const [phone, setPhone] = useState(session?.user.phone ?? '');
  const [address, setAddress] = useState(emptyAddress);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!cart) return <Spinner />;
  if (cart.vendors.length === 0 && !busy) {
    return (
      <EmptyState title="Nothing to check out">
        <Link to="/products">Browse products</Link>
      </EmptyState>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const order = await orderService.place({ fullName, phone, address: cleanAddress(address) });
      navigate(`/customer/orders/${order._id}/pay`, { replace: true });
      await refresh();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
      await refresh();
    }
  };

  return (
    <>
      <PageHeader title="Checkout" subtitle="Your stock is reserved when you continue to payment." />
      <form className="order-layout" onSubmit={(e) => void submit(e)}>
        <section className="card stack">
          <h2 className="card-heading">Delivery details</h2>
          <ErrorBanner message={error} />
          <p className="muted small">Signed in as {session?.user.email}.</p>
          <div className="form-row">
            <Field label="Full name">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} autoComplete="name" />
            </Field>
            <Field label="Phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" placeholder="+91 90000 00000" />
            </Field>
          </div>
          <AddressFields value={address} onChange={setAddress} />
        </section>
        <aside className="card stack">
          <h2 className="card-heading">Order summary</h2>
          <ul className="summary-vendors">
            {cart.vendors.map((group) => (
              <li key={group.vendor._id}>
                <strong>{group.vendor.businessName}</strong>
                {group.items.map((item) => (
                  <div key={item.productId} className="summary-line">
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <span>{money(item.lineTotal)}</span>
                  </div>
                ))}
              </li>
            ))}
          </ul>
          <TotalsTable rows={orderTotalRows(cart.totals)} />
          <p className="simulated-tag">SIMULATED PAYMENT</p>
          <p className="muted small">The next step is a demonstration. No real payment is taken and no card details are requested.</p>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !cart.canCheckout}>
            {busy ? 'Placing order…' : 'Place order and continue'}
          </button>
        </aside>
      </form>
    </>
  );
}
