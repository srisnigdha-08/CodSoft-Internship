import { useState, type FormEvent } from 'react';
import { errorText } from '../../api/client';
import { ErrorBanner, ResourceView } from '../../components/Feedback';
import { Field, PageHeader, StatusBadge } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { useToast } from '../../hooks/useToast';
import { adminService } from '../../services';
import type { Category } from '../../types';

function CategoryRow({ category, onChanged }: { category: Category; onChanged(): void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? '');

  const save = async (body: Parameters<typeof adminService.updateCategory>[1]) => {
    try {
      await adminService.updateCategory(category._id, body);
      setEditing(false);
      onChanged();
    } catch (error) {
      toast(errorText(error), 'error');
    }
  };

  return (
    <tr>
      <td>{editing ? <input aria-label="Category name" value={name} onChange={(e) => setName(e.target.value)} /> : category.name}</td>
      <td>
        {editing ? (
          <input aria-label="Category description" value={description} onChange={(e) => setDescription(e.target.value)} />
        ) : (
          category.description
        )}
      </td>
      <td>
        <StatusBadge status={category.isActive ? 'ACTIVE' : 'INACTIVE'} />
      </td>
      <td className="cell-actions">
        {editing ? (
          <button type="button" className="btn btn-primary btn-small" onClick={() => void save({ name, description })}>
            Save
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-small" onClick={() => void save({ isActive: !category.isActive })}>
          {category.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </td>
    </tr>
  );
}

export function AdminCategoriesPage() {
  const categories = useResource('admin-categories', adminService.categories);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await adminService.createCategory({ name, description });
      setName('');
      setDescription('');
      categories.reload();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <>
      <PageHeader title="Categories" />
      <form className="card inline-form" onSubmit={(e) => void create(e)}>
        <Field label="New category">
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </Field>
        <Field label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <button type="submit" className="btn btn-primary">
          Create
        </button>
      </form>
      <ErrorBanner message={error} />
      <ResourceView resource={categories}>
        {(items) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((category) => (
                  <CategoryRow key={category._id} category={category} onChanged={categories.reload} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ResourceView>
    </>
  );
}
