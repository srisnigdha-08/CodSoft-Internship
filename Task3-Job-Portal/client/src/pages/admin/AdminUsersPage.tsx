import { useCallback, useState } from 'react';
import { adminApi } from '../../api';
import { ConfirmDialog } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { AsyncView, EmptyState, PageHeader, Pagination } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAction } from '../../hooks/useAction';
import { useAsync } from '../../hooks/useAsync';
import { formatDate, options, ROLE_LABELS } from '../../lib/format';
import type { User } from '../../types';

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const state = useAsync(
    useCallback(() => adminApi.users({ q, role, page, limit: 15 }), [q, role, page]),
  );
  const { run } = useAction();
  const [target, setTarget] = useState<User | null>(null);

  return (
    <>
      <PageHeader title="Users" subtitle="Deactivated users are signed out and cannot sign in." />
      <div className="toolbar">
        <SearchBox
          placeholder="Search name or email"
          onSearch={(value) => {
            setQ(value);
            setPage(1);
          }}
        />
        <label className="sort">
          <span>Role</span>
          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            {options(ROLE_LABELS).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <AsyncView state={state}>
        {(result) =>
          result.items.length === 0 ? (
            <EmptyState title="No users found" />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((user) => (
                      <tr key={user.id}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>{ROLE_LABELS[user.role]}</td>
                        <td>
                          <span className={`badge ${user.isActive ? 'job-active' : 'job-closed'}`}>
                            {user.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td>{formatDate(user.createdAt)}</td>
                        <td>
                          {user.id !== me?.id && (
                            <button
                              type="button"
                              className={`link-btn ${user.isActive ? 'danger' : ''}`}
                              onClick={() => setTarget(user)}
                            >
                              {user.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={result.meta} onChange={setPage} />
            </>
          )
        }
      </AsyncView>
      {target && (
        <ConfirmDialog
          title={target.isActive ? 'Deactivate user' : 'Activate user'}
          message={
            target.isActive
              ? `Deactivate ${target.name}? They will lose access immediately.`
              : `Restore access for ${target.name}?`
          }
          confirmLabel={target.isActive ? 'Deactivate' : 'Activate'}
          danger={target.isActive}
          onClose={() => setTarget(null)}
          onConfirm={async () => {
            const done = await run(
              () => adminApi.setUserActive(target.id, !target.isActive),
              target.isActive ? 'User deactivated.' : 'User activated.',
            );
            if (done) await state.reload();
          }}
        />
      )}
    </>
  );
}
