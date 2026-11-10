import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorText } from '../../api/client';
import { EmptyState, ResourceView } from '../../components/Feedback';
import { PageHeader, Pagination, ProductImage, StatusBadge } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useResource } from '../../hooks/useResource';
import { useToast } from '../../hooks/useToast';
import { vendorService } from '../../services';
import type { Product } from '../../types';
import { money } from '../../utils/format';
import { ApprovalNotice } from './VendorDashboardPage';

export function VendorProductsPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const products = useResource(`vendor-products-${page}`, () => vendorService.products({ page, limit: 20 }));
  const approved = session?.vendor?.approvalStatus === 'APPROVED';

  const toggleActive = async (product: Product) => {
    try {
      if (product.isActive) await vendorService.deactivateProduct(product._id);
      else await vendorService.updateProduct(product._id, { isActive: true });
      toast(`${product.name} ${product.isActive ? 'deactivated' : 'activated'}`);
      products.reload();
    } catch (error) {
      toast(errorText(error), 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Products"
        action={
          approved && (
            <Link to="/vendor/products/new" className="btn btn-primary">
              Add product
            </Link>
          )
        }
      />
      <ApprovalNotice />
      <ResourceView resource={products}>
        {(result) =>
          result.items.length === 0 ? (
            <EmptyState title="No products yet">Add your first product to start selling.</EmptyState>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th className="num">Price</th>
                      <th className="num">Stock</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((product) => (
                      <tr key={product._id}>
                        <td className="cell-product">
                          <ProductImage src={product.images[0]} alt="" className="thumb" />
                          {product.name}
                        </td>
                        <td>{product.sku}</td>
                        <td>{product.category?.name}</td>
                        <td className="num">{money(product.price)}</td>
                        <td className="num">{product.stock}</td>
                        <td>
                          <StatusBadge status={product.isActive ? 'ACTIVE' : 'INACTIVE'} />
                        </td>
                        <td className="cell-actions">
                          {approved && (
                            <>
                              <Link to={`/vendor/products/${product._id}/edit`} className="btn btn-ghost btn-small">
                                Edit
                              </Link>
                              <button type="button" className="btn btn-ghost btn-small" onClick={() => void toggleActive(product)}>
                                {product.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            </>
                          )}
                        </td>
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
