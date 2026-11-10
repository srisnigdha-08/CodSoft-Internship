import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errorText } from '../../api/client';
import { ErrorBanner, ResourceView } from '../../components/Feedback';
import { OrderDetailsView } from '../../components/OrderDetailsView';
import { PageHeader, StatusBadge } from '../../components/ui';
import { useCart } from '../../hooks/useCart';
import { useResource } from '../../hooks/useResource';
import { orderService } from '../../services';

export function OrderDetailsPage() {
  const { id = '' } = useParams();
  const { refresh } = useCart();
  const detail = useResource(`order-${id}`, () => orderService.get(id));
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    setError(null);
    try {
      await orderService.cancel(id);
      await refresh();
      detail.reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <ResourceView resource={detail}>
      {({ order, payment }) => (
        <>
          <PageHeader title={`Order ${order.orderNumber}`} action={<StatusBadge status={order.status} />} />
          <ErrorBanner message={error} />
          <OrderDetailsView
            order={order}
            payment={payment}
            isCustomerView
            actions={
              order.paymentStatus === 'PENDING' && (
                <div className="stack">
                  <Link to={`/customer/orders/${order._id}/pay`} className="btn btn-primary btn-block">
                    Complete payment
                  </Link>
                  <button type="button" className="btn btn-ghost btn-block" onClick={() => void cancel()}>
                    Cancel order
                  </button>
                </div>
              )
            }
          />
        </>
      )}
    </ResourceView>
  );
}
