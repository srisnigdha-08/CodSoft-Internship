import { useState } from 'react';
import { errorText } from '../../api/client';
import { ResourceView } from '../../components/Feedback';
import { PageHeader, Pagination, ProductImage } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useResource } from '../../hooks/useResource';
import { useToast } from '../../hooks/useToast';
import { vendorService } from '../../services';
import type { Product } from '../../types';
import { ApprovalNotice } from './VendorDashboardPage';

function StockRow({ product, editable, onAdjusted }: { product: Product; editable: boolean; onAdjusted(): void }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');

  const apply = async (direction: 1 | -1) => {
    const units = Number(amount);
    if (!Number.isInteger(units) || units <= 0) {
      toast('Enter a whole number greater than zero', 'error');
      return;
    }
    try {
      await vendorService.adjustStock(product._id, direction * units);
      setAmount('');
      onAdjusted();
    } catch (error) {
      toast(errorText(error), 'error');
    }
  };

  return (
    <tr>
      <td className="cell-product">
        <ProductImage src={product.images[0]} alt="" className="thumb" />
        {product.name}
      </td>
      <td>{product.sku}</td>
      <td className="num">
        <span className={product.stock <= 5 ? 'low-stock' : ''}>{product.stock}</span>
      </td>
      <td className="cell-actions">
        {editable && (
          <>
            <input
              type="number"
              min="1"
              step="1"
              className="stock-input"
              aria-label={`Units to adjust for ${product.name}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button type="button" className="btn btn-ghost btn-small" onClick={() => void apply(1)}>
              Add
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => void apply(-1)}>
              Remove
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

export function VendorInventoryPage() {
  const { session } = useAuth();
  const [page, setPage] = useState(1);
  const products = useResource(`vendor-inventory-${page}`, () => vendorService.products({ page, limit: 20 }));
  const editable = session?.vendor?.approvalStatus === 'APPROVED';

  return (
    <>
      <PageHeader title="Inventory" subtitle="Adjustments are applied atomically, so they cannot overwrite a concurrent sale." />
      <ApprovalNotice />
      <ResourceView resource={products}>
        {(result) => (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th className="num">In stock</th>
                    <th>Adjust</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((product) => (
                    <StockRow key={product._id} product={product} editable={editable} onAdjusted={products.reload} />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={result.page} totalPages={result.totalPages} onChange={setPage} />
          </>
        )}
      </ResourceView>
    </>
  );
}
