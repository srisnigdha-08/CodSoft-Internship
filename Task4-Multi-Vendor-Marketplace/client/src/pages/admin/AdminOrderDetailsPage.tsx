import { useParams } from 'react-router-dom';
import { ResourceView } from '../../components/Feedback';
import { OrderDetailsView } from '../../components/OrderDetailsView';
import { PageHeader, StatusBadge } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { orderService } from '../../services';

export function AdminOrderDetailsPage() {
  const { id = '' } = useParams();
  const detail = useResource(`admin-order-${id}`, () => orderService.get(id));
  return (
    <ResourceView resource={detail}>
      {({ order, payment }) => (
        <>
          <PageHeader title={`Order ${order.orderNumber}`} action={<StatusBadge status={order.status} />} />
          <OrderDetailsView order={order} payment={payment} isCustomerView={false} />
        </>
      )}
    </ResourceView>
  );
}
