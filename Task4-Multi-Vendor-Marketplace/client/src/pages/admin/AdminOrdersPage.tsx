import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ResourceView } from '../../components/Feedback';
import { Field, PageHeader, Pagination, StatusBadge } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { adminService } from '../../services';
import { money, shortDate, titleCase } from '../../utils/format';

export function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const [paymentStatus, setPaymentStatus] = useState('');
  const orders = useResource(`admin-orders-${page}-${paymentStatus}`, () => adminService.orders({ page, paymentStatus }));

  return (
    <>
      <PageHeader title="Orders" />
      <div className="toolbar">
        <Field label="Payment status">
          <select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {['PENDING', 'PAID', 'FAILED', 'REFUNDED'].map((value) => (
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
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Vendor fulfillment</th>
                      <th>Payment</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((order) => (
                      <tr key={order._id}>
                        <td>
                          <Link to={`/admin/orders/${order._id}`}>{order.orderNumber}</Link>
                          <br />
                          <span className="muted small">{shortDate(order.createdAt)}</span>
                        </td>
                        <td>
                          {order.contact.fullName}
                          <br />
                          <span className="muted small">{order.contact.email}</span>
                        </td>
                        <td>
                          <ul className="vendor-status-list">
                            {order.vendorOrders.map((vendorOrder) => (
                              <li key={vendorOrder._id}>
                                <span>{vendorOrder.vendorName}</span>
                                <StatusBadge status={vendorOrder.status} />
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td>
                          <StatusBadge status={order.paymentStatus} />
                        </td>
                        <td className="num">{money(order.grandTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={result.page} totalPages={result.totalPages} onChange={setPage} />
            </>
          )
        }
      </ResourceView>
    </>
  );
}
