import { useSearchParams } from 'react-router-dom';
import { errorText } from '../../api/client';
import { EmptyState, ResourceView } from '../../components/Feedback';
import { Field, PageHeader, Pagination, StatusBadge } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { useToast } from '../../hooks/useToast';
import { adminService } from '../../services';
import type { VendorApprovalStatus } from '../../types';
import { shortDate, titleCase } from '../../utils/format';

const ACTIONS: Record<VendorApprovalStatus, { status: VendorApprovalStatus; label: string; danger?: boolean }[]> = {
  PENDING: [
    { status: 'APPROVED', label: 'Approve' },
    { status: 'REJECTED', label: 'Reject', danger: true },
  ],
  APPROVED: [{ status: 'SUSPENDED', label: 'Suspend', danger: true }],
  SUSPENDED: [
    { status: 'APPROVED', label: 'Reactivate' },
    { status: 'REJECTED', label: 'Reject', danger: true },
  ],
  REJECTED: [{ status: 'APPROVED', label: 'Approve' }],
};

export function AdminVendorsPage() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const vendors = useResource(`admin-vendors-${status}-${page}`, () => adminService.vendors({ status, page }));

  const change = async (id: string, name: string, next: VendorApprovalStatus) => {
    try {
      await adminService.setVendorStatus(id, next);
      toast(`${name} is now ${titleCase(next).toLowerCase()}`);
      vendors.reload();
    } catch (error) {
      toast(errorText(error), 'error');
    }
  };

  return (
    <>
      <PageHeader title="Vendors" subtitle="Only approved stores can sell or appear to customers." />
      <div className="toolbar">
        <Field label="Approval status">
          <select value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}>
            <option value="">All</option>
            {Object.keys(ACTIONS).map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ResourceView resource={vendors}>
        {(result) =>
          result.items.length === 0 ? (
            <EmptyState title="No vendors found" />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Store</th>
                      <th>Owner</th>
                      <th>City</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((vendor) => (
                      <tr key={vendor._id}>
                        <td>{vendor.businessName}</td>
                        <td>
                          {vendor.owner?.name}
                          <br />
                          <span className="muted small">{vendor.owner?.email}</span>
                        </td>
                        <td>{vendor.address.city}</td>
                        <td>{shortDate(vendor.createdAt)}</td>
                        <td>
                          <StatusBadge status={vendor.approvalStatus} />
                        </td>
                        <td className="cell-actions">
                          {ACTIONS[vendor.approvalStatus].map((action) => (
                            <button
                              key={action.status}
                              type="button"
                              className={action.danger ? 'btn btn-danger btn-small' : 'btn btn-primary btn-small'}
                              onClick={() => void change(vendor._id, vendor.businessName, action.status)}
                            >
                              {action.label}
                            </button>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                onChange={(next) => setParams({ ...(status ? { status } : {}), page: String(next) })}
              />
            </>
          )
        }
      </ResourceView>
    </>
  );
}
