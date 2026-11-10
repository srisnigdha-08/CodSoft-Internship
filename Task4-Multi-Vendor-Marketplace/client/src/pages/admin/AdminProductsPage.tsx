import { useState, type FormEvent } from 'react';
import { errorText } from '../../api/client';
import { ResourceView } from '../../components/Feedback';
import { PageHeader, Pagination, ProductImage, StatusBadge } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { useToast } from '../../hooks/useToast';
import { adminService } from '../../services';
import type { Product } from '../../types';
import { money } from '../../utils/format';

export function AdminProductsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const products = useResource(`admin-products-${page}-${q}`, () => adminService.products({ page, q }));

  const toggle = async (product: Product) => {
    try {
      await adminService.setProductActive(product._id, !product.isActive);
      products.reload();
    } catch (error) {
      toast(errorText(error), 'error');
    }
  };

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQ(String(new FormData(event.currentTarget).get('q') ?? '').trim());
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Products" subtitle="Every listing, including inactive items and suspended stores." />
      <form className="toolbar" onSubmit={search} role="search">
        <input name="q" type="search" placeholder="Name or SKU" aria-label="Search products" />
        <button type="submit" className="btn btn-ghost">
          Search
        </button>
      </form>
      <ResourceView resource={products}>
        {(result) => (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Vendor</th>
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
                      <td>{product.vendor?.businessName}</td>
                      <td>{product.category?.name}</td>
                      <td className="num">{money(product.price)}</td>
                      <td className="num">{product.stock}</td>
                      <td>
                        <StatusBadge status={product.isActive ? 'ACTIVE' : 'INACTIVE'} />
                      </td>
                      <td className="cell-actions">
                        <button type="button" className="btn btn-ghost btn-small" onClick={() => void toggle(product)}>
                          {product.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
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
