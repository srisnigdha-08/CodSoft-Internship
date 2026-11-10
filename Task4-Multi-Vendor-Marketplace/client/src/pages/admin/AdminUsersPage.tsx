import { useState, type FormEvent } from 'react';
import { errorText } from '../../api/client';
import { ResourceView } from '../../components/Feedback';
import { PageHeader, Pagination, StatusBadge } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useResource } from '../../hooks/useResource';
import { useToast } from '../../hooks/useToast';
import { adminService } from '../../services';
import type { User } from '../../types';
import { titleCase } from '../../utils/format';

export function AdminUsersPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const users = useResource(`admin-users-${page}-${q}`, () => adminService.users({ page, q }));

  const update = async (user: User, body: Parameters<typeof adminService.updateUser>[1]) => {
    try {
      await adminService.updateUser(user._id, body);
      toast(`${user.name} updated`);
      users.reload();
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
      <PageHeader title="Users" subtitle="You cannot change your own role or status." />
      <form className="toolbar" onSubmit={search} role="search">
        <input name="q" type="search" placeholder="Name or email" aria-label="Search users" />
        <button type="submit" className="btn btn-ghost">
          Search
        </button>
      </form>
      <ResourceView resource={users}>
        {(result) => (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((user) => {
                    const isSelf = user._id === session?.user._id;
                    return (
                      <tr key={user._id}>
                        <td>
                          {user.name}
                          {isSelf && <span className="muted small"> (you)</span>}
                        </td>
                        <td>{user.email}</td>
                        <td>{titleCase(user.role)}</td>
                        <td>
                          <StatusBadge status={user.status} />
                        </td>
                        <td className="cell-actions">
                          {!isSelf && user.role !== 'VENDOR' && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-small"
                              onClick={() => void update(user, { role: user.role === 'ADMIN' ? 'CUSTOMER' : 'ADMIN' })}
                            >
                              {user.role === 'ADMIN' ? 'Make customer' : 'Make admin'}
                            </button>
                          )}
                          {!isSelf && (
                            <button
                              type="button"
                              className={user.status === 'ACTIVE' ? 'btn btn-danger btn-small' : 'btn btn-primary btn-small'}
                              onClick={() => void update(user, { status: user.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE' })}
                            >
                              {user.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
