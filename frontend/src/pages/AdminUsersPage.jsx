import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, UserX } from 'lucide-react';
import { fetchUsers, setUserRole, fetchPlants } from '../api/client';
import { ROLES, ROLE_LABELS } from '../lib/permissions';
import Card from '../components/ui/Card';
import { LoadingState, EmptyState } from '../components/ui/States';
import BrandShieldIcon from '../components/ui/BrandShieldIcon';

// RS-21 (§9.5): registry_admin-only. The backend (require_role("registry_admin") on
// GET/PATCH /admin/users) is the actual enforcement - this page just wouldn't be reachable
// from the nav for anyone else, and would 403 on load if they typed the URL directly.
export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingEdits, setPendingEdits] = useState({}); // { [userId]: { role, plant_id } }
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [userList, plantList] = await Promise.all([fetchUsers(), fetchPlants()]);
      setUsers(userList);
      setPlants(plantList);
    } catch (err) {
      setError(err.message || 'Failed to load users - are you signed in as a registry admin?');
    } finally {
      setLoading(false);
    }
  };

  const editFor = (u) => pendingEdits[u.id] || { role: u.role, plant_id: u.plant_id };

  const updateEdit = (userId, patch) => {
    const base = pendingEdits[userId] || editFor(users.find((u) => u.id === userId) || { role: 'auditor', plant_id: null });
    setPendingEdits((prev) => ({ ...prev, [userId]: { ...base, ...patch } }));
  };

  const handleSave = async (u) => {
    const edit = editFor(u);
    try {
      setSavingId(u.id);
      setError(null);
      const updated = await setUserRole(u.id, edit.role, edit.role === 'plant_operator' ? edit.plant_id : null);
      setUsers((prev) => prev.map((row) => (row.id === u.id ? updated : row)));
      setPendingEdits((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
      setSavedId(u.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (err) {
      setError(err.message || `Failed to update role for ${u.email}`);
    } finally {
      setSavingId(null);
    }
  };

  const selectClass = 'bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--brand)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none transition-colors';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">User & Role Management</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          A new sign-in defaults to Auditor until you change it here.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-[#fef3f2] border border-[rgba(217,45,32,0.24)] text-[var(--risk-fraud)] text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card padding="p-0" className="overflow-hidden">
        {loading ? (
          <LoadingState label="Loading accounts…" />
        ) : users.length === 0 ? (
          <EmptyState icon={UserX} title="No accounts have signed in yet" description="A row appears here the first time someone logs in." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-tertiary)] text-[11px]">
                  <th className="py-2.5 px-4 font-medium">Email</th>
                  <th className="py-2.5 px-4 font-medium">Role</th>
                  <th className="py-2.5 px-4 font-medium">Plant</th>
                  <th className="py-2.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {users.map((u) => {
                  const edit = editFor(u);
                  const dirty = edit.role !== u.role || (edit.role === 'plant_operator' && edit.plant_id !== u.plant_id);
                  return (
                    <tr key={u.id} className="hover:bg-[var(--surface-sunken)] transition-colors">
                      <td className="py-3 px-4 font-mono text-[var(--text-primary)]">{u.email}</td>
                      <td className="py-3 px-4">
                        <select value={edit.role} onChange={(e) => updateEdit(u.id, { role: e.target.value })} className={selectClass}>
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        {edit.role === 'plant_operator' ? (
                          <select
                            value={edit.plant_id || ''}
                            onChange={(e) => updateEdit(u.id, { plant_id: e.target.value })}
                            className={`${selectClass} font-mono`}
                          >
                            <option value="">Select a plant...</option>
                            {plants.map((p) => (
                              <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">&mdash;</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {savedId === u.id ? (
                          <span className="inline-flex items-center gap-1.5 text-[var(--risk-genuine)] font-semibold">
                            <CheckCircle className="w-3.5 h-3.5" /> Saved
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSave(u)}
                            disabled={!dirty || savingId === u.id || (edit.role === 'plant_operator' && !edit.plant_id)}
                            className="btn btn-primary px-3 py-1.5 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <BrandShieldIcon className="w-3.5 h-3.5" />
                            {savingId === u.id ? 'Saving...' : 'Save'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
