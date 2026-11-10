import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { errorText } from '../../api/client';
import { ErrorBanner, ResourceView } from '../../components/Feedback';
import { Field, PageHeader, ProductImage } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { useToast } from '../../hooks/useToast';
import { catalogService, vendorService } from '../../services';
import type { Category, Product } from '../../types';

function ProductForm({ product, categories }: { product: Product | null; categories: Category[] }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [stock, setStock] = useState('0');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '');
  const [imagesText, setImagesText] = useState(product?.images.join('\n') ?? '');
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const images = imagesText.split('\n').map((line) => line.trim()).filter(Boolean);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const body = { name, description, price: Number(price), sku, categoryId, images, isActive };
    try {
      if (product) await vendorService.updateProduct(product._id, body);
      else await vendorService.createProduct({ ...body, stock: Number(stock) });
      toast(product ? 'Product updated' : 'Product created');
      navigate('/vendor/products');
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <form className="card stack narrow" onSubmit={(e) => void submit(e)}>
      <ErrorBanner message={error} />
      <Field label="Product name">
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
      </Field>
      <Field label="Description">
        <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required minLength={10} />
      </Field>
      <div className="form-row">
        <Field label="Price (₹)">
          <input type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
        <Field label="SKU">
          <input value={sku} onChange={(e) => setSku(e.target.value)} required minLength={2} maxLength={40} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Category">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        {!product && (
          <Field label="Opening stock">
            <input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} required />
          </Field>
        )}
      </div>
      <Field label="Image URLs" hint="One per line, up to 8. Use http(s) links or paths such as /catalog/products/item.svg.">
        <textarea rows={3} value={imagesText} onChange={(e) => setImagesText(e.target.value)} />
      </Field>
      {images.length > 0 && (
        <div className="image-preview-row">
          {images.map((image) => (
            <ProductImage key={image} src={image} alt="Preview" className="thumb" />
          ))}
        </div>
      )}
      <label className="check">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Visible to customers
      </label>
      <button type="submit" className="btn btn-primary">
        {product ? 'Save changes' : 'Create product'}
      </button>
    </form>
  );
}

export function VendorProductFormPage() {
  const { id } = useParams();
  const data = useResource(`product-form-${id ?? 'new'}`, async () => ({
    categories: await catalogService.categories(),
    product: id ? await vendorService.product(id) : null,
  }));

  return (
    <>
      <PageHeader title={id ? 'Edit product' : 'Add product'} />
      <ResourceView resource={data}>
        {({ product, categories }) => <ProductForm product={product} categories={categories} />}
      </ResourceView>
    </>
  );
}
