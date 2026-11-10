import { Link } from 'react-router-dom';
import { ResourceView } from '../../components/Feedback';
import { PageHeader, StatCard } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { adminService } from '../../services';
import { money } from '../../utils/format';

export function AdminDashboardPage() {
  const stats = useResource('admin-dashboard', adminService.dashboard);
  return (
    <>
      <PageHeader title="Marketplace overview" />
      <ResourceView resource={stats}>
        {(data) => (
          <div className="stack">
            {data.pendingVendors > 0 && (
              <div className="banner banner-warn" role="status">
                {data.pendingVendors} {data.pendingVendors === 1 ? 'store is' : 'stores are'} waiting for approval.{' '}
                <Link to="/admin/vendors?status=PENDING">Review now</Link>
              </div>
            )}
            <div className="stat-grid">
              <StatCard label="Revenue" value={money(data.revenue)} hint="Paid orders, net of refunds" />
              <StatCard label="Orders" value={data.orders} />
              <StatCard label="Users" value={data.users} />
              <StatCard label="Vendors" value={data.vendors} />
              <StatCard label="Pending vendors" value={data.pendingVendors} />
              <StatCard label="Products" value={data.products} hint={`${data.activeProducts} active`} />
            </div>
          </div>
        )}
      </ResourceView>
    </>
  );
}
