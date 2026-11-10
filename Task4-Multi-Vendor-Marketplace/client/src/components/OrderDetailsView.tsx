import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Order, Payment, VendorOrder, VendorOrderStatus } from '../types';
import { money, shortDate, titleCase } from '../utils/format';
import { ProductImage, StatusBadge } from './ui';

const STEPS: VendorOrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

export function FulfillmentTracker({ status }: { status: VendorOrderStatus }) {
  if (status === 'CANCELLED') {
    return <p className="muted small">This shipment was cancelled.</p>;
  }
  const currentIndex = STEPS.indexOf(status);
  return (
    <ol className="tracker" aria-label={`Fulfillment progress: ${titleCase(status)}`}>
      {STEPS.map((step, index) => (
        <li key={step} className={index <= currentIndex ? 'done' : ''} aria-current={index === currentIndex ? 'step' : undefined}>
          <span className="tracker-dot">{index <= currentIndex && <Check size={12} aria-hidden="true" />}</span>
          <span className="tracker-label">{titleCase(step)}</span>
        </li>
      ))}
    </ol>
  );
}

export function OrderItems({ items, reviewLinks }: { items: VendorOrder['items']; reviewLinks: boolean }) {
  return (
    <ul className="line-items">
      {items.map((item) => (
        <li key={item.productId}>
          <ProductImage src={item.image} alt="" className="thumb" />
          <div className="line-item-info">
            <Link to={`/products/${item.productId}`}>{item.name}</Link>
            <span className="muted small">
              {item.quantity} × {money(item.unitPrice)}
            </span>
            {reviewLinks && (
              <Link to={`/products/${item.productId}#reviews`} className="small">
                Write a review
              </Link>
            )}
          </div>
          <strong>{money(item.lineTotal)}</strong>
        </li>
      ))}
    </ul>
  );
}

export function TotalsTable({ rows }: { rows: { label: string; value: number; strong?: boolean }[] }) {
  return (
    <dl className="totals">
      {rows.map((row) => (
        <div key={row.label} className={row.strong ? 'totals-strong' : ''}>
          <dt>{row.label}</dt>
          <dd>{money(row.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export const orderTotalRows = (totals: { subtotal: number; tax: number; deliveryFee: number; grandTotal: number }) => [
  { label: 'Items subtotal', value: totals.subtotal },
  { label: 'Tax (18%)', value: totals.tax },
  { label: 'Delivery', value: totals.deliveryFee },
  { label: 'Total', value: totals.grandTotal, strong: true },
];

interface OrderDetailsViewProps {
  order: Order;
  payment: Payment | null;
  isCustomerView: boolean;
  actions?: ReactNode;
}

export function OrderDetailsView({ order, payment, isCustomerView, actions }: OrderDetailsViewProps) {
  const { shippingAddress: address, contact } = order;
  return (
    <div className="order-layout">
      <div className="stack">
        <h2 className="section-title">Shipments by vendor</h2>
        {order.vendorOrders.map((vendorOrder) => (
          <section className="card" key={vendorOrder._id} aria-label={`Shipment from ${vendorOrder.vendorName}`}>
            <div className="card-title-row">
              <h3>
                <Link to={`/vendors/${vendorOrder.vendorId}`}>{vendorOrder.vendorName}</Link>
              </h3>
              <StatusBadge status={vendorOrder.status} />
            </div>
            <FulfillmentTracker status={vendorOrder.status} />
            <OrderItems items={vendorOrder.items} reviewLinks={isCustomerView && vendorOrder.status === 'DELIVERED'} />
            <p className="muted small vendor-subtotal">
              Shipment total {money(vendorOrder.total)} (items {money(vendorOrder.subtotal)}, tax {money(vendorOrder.tax)},
              delivery {money(vendorOrder.deliveryFee)})
            </p>
          </section>
        ))}
      </div>
      <aside className="stack">
        <section className="card">
          <h3>Order summary</h3>
          <TotalsTable rows={orderTotalRows(order)} />
          {actions}
        </section>
        <section className="card">
          <div className="card-title-row">
            <h3>Payment</h3>
            <StatusBadge status={order.paymentStatus} />
          </div>
          <p className="simulated-tag">SIMULATED PAYMENT</p>
          {payment?.reference && <p className="muted small">Reference {payment.reference}</p>}
          {payment?.failureReason && <p className="muted small">{payment.failureReason}</p>}
          {payment && payment.refundedAmount > 0 && <p className="small">Refunded {money(payment.refundedAmount)}</p>}
        </section>
        <section className="card">
          <h3>Delivery details</h3>
          <p>
            {contact.fullName}
            <br />
            {address.line1}
            {address.line2 && (
              <>
                <br />
                {address.line2}
              </>
            )}
            <br />
            {address.city}, {address.state} {address.postalCode}
          </p>
          <p className="muted small">
            {contact.phone}
            <br />
            {contact.email}
            <br />
            Placed {shortDate(order.createdAt)}
          </p>
        </section>
      </aside>
    </div>
  );
}
