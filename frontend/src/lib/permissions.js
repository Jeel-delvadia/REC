// RS-21 (§9.5): mirrors the permission matrix enforced server-side (backend/app/core/auth.py's
// require_role, and the scoping in rec_service.visible_to_clause). This file is UX only - it
// decides what to show, not what to allow. The backend is the real enforcement point; hiding a
// button here without a matching check there would be a security bug, not a UI one.
export const ROLES = ['registry_admin', 'regulator', 'auditor', 'plant_operator', 'buyer'];

// RS-22: what a signup form may offer as a choice. registry_admin is deliberately excluded -
// mirrors backend/app/core/auth.py's SELF_SERVICE_ROLES allowlist, which is the real
// enforcement (this list only controls what the dropdown shows; the backend would ignore a
// forged "registry_admin" request even if this list were wrong).
export const SELF_SERVICE_ROLES = ['auditor', 'regulator', 'plant_operator', 'buyer'];

const OVERSIGHT_ROLES = ['registry_admin', 'regulator', 'auditor'];
const ACTION_ROLES = ['registry_admin', 'auditor'];

export const ROLE_LABELS = {
  registry_admin: 'Registry Admin',
  regulator: 'Regulator',
  auditor: 'Auditor',
  plant_operator: 'Plant Operator',
  buyer: 'Buyer',
};

export function canTakeAuditActions(role) {
  return ACTION_ROLES.includes(role);
}

export function canIssueOrIngest(role) {
  return ACTION_ROLES.includes(role);
}

export function canViewOversightTools(role) {
  // Ledger integrity, provenance graph, data quality reports - internal investigation tooling
  // that plant_operator/buyer never see, matching the confirmed permission matrix.
  return OVERSIGHT_ROLES.includes(role);
}

export function canManageUsers(role) {
  return role === 'registry_admin';
}

export function isScopedRole(role) {
  return role === 'plant_operator' || role === 'buyer';
}

// RS-24: buyer-initiated REC acquisition, gated behind auditor/admin approval.
export function canBrowseMarketplace(role) {
  return role === 'buyer';
}

export function canReviewPurchaseRequests(role) {
  return ACTION_ROLES.includes(role);
}
