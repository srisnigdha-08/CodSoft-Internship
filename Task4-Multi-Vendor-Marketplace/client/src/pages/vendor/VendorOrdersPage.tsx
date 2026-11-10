import { useState } from 'react';
import { errorText } from '../../api/client';
import { EmptyState, ResourceView } from '../../components/Feedback';
import { FulfillmentTracker, OrderItems } from '../../components/OrderDetailsView';
import { Field, PageHeader, Pagination, StatusBadge } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { useToast } from '../../hooks/useToast';
import { vendorService } from '../../services';
import type { VendorOrderStatus, VendorOrderView } from '../../types';
import { money, NEXT_FULFILLMENT_STEPS, shortDate, titleCase } from '../../utils/format';

const STATUSES: VendorOrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

function VendorOrderCard({ order, onChanged }: { order: VendorOrderView; onChanged(): void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const { fulfillment, contact, shippingAddress: address } = order;

  const update = async (status: VendorOrderStatus) => {
    setBusy(true);
    try {
      await vendorService.updateOrderStatus(order._id, status);
      toast(`${order.orderNumber} marked ${titleCase(status)}`);
      onChanged();
    } catch (error) {
      toast(errorText(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card stack" aria-label={`Order ${order.orderNumber}`}>
      <div className="card-title-row">
        <div>
          <h2 className="card-heading">{order.orderNumber}</h2>
          <p className="muted small">{shortDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={fulfillment.status} />
      </div>
      <FulfillmentTracker status={fulfillment.status} />
      <OrderItems items={fulfillment.items} reviewLinks={false} />
      <div className="vendor-order-footer">
        <div className="muted small">
          Ship to {contact.fullName}, {address.line1}, {address.city} {address.postalCode} · {contact.phone}
          <br />
          Your shipment total {money(fulfillment.total)}
        </div>
        <div className="cell-actions">
          {NEXT_FULFILLMENT_STEPS[fulfillment.status].map((next) => (
            <button
              key={next}
              type="button"
              disabled={busy}
              className={next === 'CANCELLED' ? 'btn btn-danger btn-small' : 'btn btn-primary btn-small'}
              onClick={() => void update(next)}
            >
              {next === 'CANCELLED' ? 'Cancel and refund' : `Mark ${titleCase(next)}`}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function VendorOrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const orders = useResource(`vendor-orders-${page}-${status}`, () => vendorService.orders({ page, limit: 10, status }));

  return (
    <>
      <PageHeader title="Orders" subtitle="Only your own shipments appear here." />
      <div className="toolbar">
        <Field label="Fulfillment status">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ResourceView resource={orders}>
        {(result) =>
          result.items.length === 0 ? (
            <EmptyState title="No orders found" />
          ) : (
            <div className="stack">
              {result.items.map((order) => (
                <VendorOrderCard key={order._id} order={order} onChanged={orders.reload} />
              ))}
              <Pagination page={result.page} totalPages={result.totalPages} onChange={setPage} />
            </div>
          )
        }
      </ResourceView>
    </>
  );
}
