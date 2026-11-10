import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { errorText } from '../../api/client';
import { ErrorBanner, ResourceView } from '../../components/Feedback';
import { orderTotalRows, TotalsTable } from '../../components/OrderDetailsView';
import { PageHeader } from '../../components/ui';
import { useCart } from '../../hooks/useCart';
import { useResource } from '../../hooks/useResource';
import { useToast } from '../../hooks/useToast';
import { orderService } from '../../services';

export function PaymentPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { refresh } = useCart();
  const { toast } = useToast();
  const order = useResource(`pay-${id}`, () => orderService.get(id));
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const settle = async (action: () => Promise<unknown>, onDone: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (failed) {
    return (
      <div className="auth-page">
        <div className="card auth-card" role="alert">
          <h1>Payment failed</h1>
          <p className="simulated-tag">SIMULATED PAYMENT</p>
          <p>Your stock reservation was released and your items are back in your cart.</p>
          <Link to="/customer/cart" className="btn btn-primary btn-block">
            Return to cart
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ResourceView resource={order}>
      {({ order: current }) =>
        current.paymentStatus !== 'PENDING' ? (
          <Navigate to={`/customer/orders/${id}`} replace />
        ) : (
          <div className="auth-page">
            <div className="card auth-card">
              <PageHeader title="Complete payment" subtitle={`Order ${current.orderNumber}`} />
              <p className="simulated-tag simulated-tag-large">SIMULATED PAYMENT</p>
              <p className="muted">This is a demonstration only. No money moves and no card details are collected. Choose how the attempt should end.</p>
              <ErrorBanner message={error} />
              <TotalsTable rows={orderTotalRows(current)} />
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={busy}
                onClick={() =>
                  void settle(
                    () => orderService.simulatePayment(id, 'SUCCESS'),
                    () => {
                      toast('Simulated payment successful');
                      navigate(`/customer/orders/${id}`, { replace: true });
                    },
                  )
                }
              >
                Simulate successful payment
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                disabled={busy}
                onClick={() => void settle(() => orderService.simulatePayment(id, 'FAILURE'), () => setFailed(true))}
              >
                Simulate failed payment
              </button>
            </div>
          </div>
        )
      }
    </ResourceView>
  );
}
