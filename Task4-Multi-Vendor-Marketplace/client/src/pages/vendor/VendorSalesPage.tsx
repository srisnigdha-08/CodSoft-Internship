import { useState } from 'react';
import { EmptyState, ResourceView } from '../../components/Feedback';
import { Field, PageHeader, StatCard } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { vendorService } from '../../services';
import type { VendorSales } from '../../types';
import { money } from '../../utils/format';

/** Gives every day in the period a slot so the time axis stays continuous. */
function continuousDays({ daily, days }: VendorSales): VendorSales['daily'] {
  const known = new Map(daily.map((day) => [day.date, day]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.now() - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10);
    return known.get(date) ?? { date, revenue: 0, orders: 0 };
  });
}

function DailyRevenueChart({ sales }: { sales: VendorSales }) {
  const daily = continuousDays(sales);
  const peak = Math.max(...daily.map((day) => day.revenue), 1);
  return (
    <figure className="bar-chart">
      <figcaption>Daily revenue, item sales only</figcaption>
      <div className="bar-chart-plot" role="img" aria-label="Bar chart of daily revenue. The same data is in the table below.">
        {daily.map((day) => (
          <div key={day.date} className="bar-slot" tabIndex={0}>
            {day.revenue > 0 && <div className="bar" style={{ height: `${Math.max((day.revenue / peak) * 100, 2)}%` }} />}
            <div className="bar-tip">
              <strong>{money(day.revenue)}</strong>
              <span>
                {day.date} · {day.orders} {day.orders === 1 ? 'order' : 'orders'}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="bar-chart-axis" aria-hidden="true">
        <span>{daily[0].date}</span>
        <span>{daily[daily.length - 1].date}</span>
      </div>
    </figure>
  );
}

export function VendorSalesPage() {
  const [days, setDays] = useState(30);
  const sales = useResource(`vendor-sales-${days}`, () => vendorService.sales(days));

  return (
    <>
      <PageHeader title="Sales" subtitle="Paid shipments, excluding cancellations." />
      <div className="toolbar">
        <Field label="Period">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </Field>
      </div>
      <ResourceView resource={sales}>
        {(data) =>
          data.daily.length === 0 ? (
            <EmptyState title="No sales in this period" />
          ) : (
            <div className="stack">
              <div className="stat-grid">
                <StatCard label="Revenue" value={money(data.totalRevenue)} />
                <StatCard label="Orders" value={data.totalOrders} />
              </div>
              <section className="card">
                <DailyRevenueChart sales={data} />
              </section>
              <div className="sales-tables">
                <section className="card">
                  <h2 className="card-heading">Top products</h2>
                  <div className="table-wrap flat">
                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th className="num">Units</th>
                          <th className="num">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topProducts.map((product) => (
                          <tr key={product.productId}>
                            <td>{product.name}</td>
                            <td className="num">{product.quantity}</td>
                            <td className="num">{money(product.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="card">
                  <h2 className="card-heading">Daily breakdown</h2>
                  <div className="table-wrap flat">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th className="num">Orders</th>
                          <th className="num">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.daily.map((day) => (
                          <tr key={day.date}>
                            <td>{day.date}</td>
                            <td className="num">{day.orders}</td>
                            <td className="num">{money(day.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          )
        }
      </ResourceView>
    </>
  );
}
