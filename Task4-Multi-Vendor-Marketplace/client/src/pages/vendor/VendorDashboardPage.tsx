import { ResourceView } from '../../components/Feedback';
import { PageHeader, StatCard, StatusBadge } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useResource } from '../../hooks/useResource';
import { vendorService } from '../../services';
import { money } from '../../utils/format';

export function ApprovalNotice() {
  const { session } = useAuth();
  const status = session?.vendor?.approvalStatus;
  if (!status || status === 'APPROVED') return null;
  return (
    <div className="banner banner-warn" role="status">
      Your store is {status.toLowerCase()}. It cannot add or change products, and customers cannot see them.
    </div>
  );
}

export function VendorDashboardPage() {
  const { session } = useAuth();
  const stats = useResource('vendor-dashboard', vendorService.dashboard);
  return (
    <>
      <PageHeader
        title={session?.vendor?.businessName ?? 'Your store'}
        subtitle="Store performance at a glance."
        action={session?.vendor && <StatusBadge status={session.vendor.approvalStatus} />}
      />
      <ApprovalNotice />
      <ResourceView resource={stats}>
        {(data) => (
          <div className="stat-grid">
            <StatCard label="Revenue" value={money(data.revenue)} hint="Item sales, excluding cancelled" />
            <StatCard label="Total orders" value={data.totalOrders} />
            <StatCard label="Open orders" value={data.pendingOrders} hint="Not yet delivered" />
            <StatCard label="Completed orders" value={data.completedOrders} />
            <StatCard label="Cancelled orders" value={data.cancelledOrders} />
            <StatCard label="Total products" value={data.totalProducts} />
            <StatCard label="Active products" value={data.activeProducts} />
            <StatCard label="Low stock" value={data.lowStockProducts} hint="5 or fewer left" />
          </div>
        )}
      </ResourceView>
    </>
  );
}
