import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ResourceView } from '../../components/Feedback';
import { PageHeader, Pagination, StatusBadge } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { orderService } from '../../services';
import { money, shortDate } from '../../utils/format';

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const orders = useResource(`orders-${page}`, () => orderService.list({ page, limit: 10 }));

  return (
    <>
      <PageHeader title="Your orders" />
      <ResourceView resource={orders}>
        {(result) =>
          result.items.length === 0 ? (
            <EmptyState title="No orders yet">
              <Link to="/products">Start shopping</Link>
            </EmptyState>
          ) : (
            <div className="stack">
              {result.items.map((order) => (
                <Link key={order._id} to={`/customer/orders/${order._id}`} className="card order-row">
                  <div>
                    <strong>{order.orderNumber}</strong>
                    <p className="muted small">{shortDate(order.createdAt)}</p>
                  </div>
                  <ul className="vendor-status-list">
                    {order.vendorOrders.map((vendorOrder) => (
                      <li key={vendorOrder._id}>
                        <span>{vendorOrder.vendorName}</span>
                        <StatusBadge status={vendorOrder.status} />
                      </li>
                    ))}
                  </ul>
                  <div className="order-row-end">
                    <strong>{money(order.grandTotal)}</strong>
                    <StatusBadge status={order.status} />
                  </div>
                </Link>
              ))}
              <Pagination page={result.page} totalPages={result.totalPages} onChange={setPage} />
            </div>
          )
        }
      </ResourceView>
    </>
  );
}
