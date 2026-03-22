// ── Role Definitions ────────────────────────────────────────────
export const ROLES = {
  ENGINEERING: 'engineering',
  APPROVER: 'approver',
  OPERATIONS: 'operations',
  ADMIN: 'admin',
}

export const ROLE_LABELS = {
  [ROLES.ENGINEERING]: 'Engineering',
  [ROLES.APPROVER]: 'Approver',
  [ROLES.OPERATIONS]: 'Operations',
  [ROLES.ADMIN]: 'Admin',
}

// ── ECO Statuses ────────────────────────────────────────────────
export const ECO_STATUS = {
  NEW: 'new',
  APPROVAL: 'approval',
  APPROVED: 'approved',
  APPLIED: 'applied',
  REJECTED: 'rejected',
}

export const ECO_STATUS_LABELS = {
  [ECO_STATUS.NEW]: 'Draft',
  [ECO_STATUS.APPROVAL]: 'In Approval',
  [ECO_STATUS.APPROVED]: 'Ready',
  [ECO_STATUS.APPLIED]: 'Applied',
  [ECO_STATUS.REJECTED]: 'Rejected',
}

// Maps status → tailwind classes for badges
export const ECO_STATUS_STYLES = {
  [ECO_STATUS.NEW]: 'bg-secondary text-secondary-foreground',
  [ECO_STATUS.APPROVAL]: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  [ECO_STATUS.APPROVED]: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  [ECO_STATUS.APPLIED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  [ECO_STATUS.REJECTED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

// ── ECO Types ───────────────────────────────────────────────────
export const ECO_TYPE = {
  PRODUCT: 'product',
  BOM: 'bom',
}

export const ECO_TYPE_LABELS = {
  [ECO_TYPE.PRODUCT]: 'Product',
  [ECO_TYPE.BOM]: 'Bill of Materials',
}

// ── Change Types ────────────────────────────────────────────────
export const CHANGE_TYPE = {
  ADD: 'add',
  REMOVE: 'remove',
  MODIFY: 'modify',
}

// ── Navigation Config ───────────────────────────────────────────
// Roles that can access specific features
export const ACCESS = {
  CREATE_ECO: [ROLES.ENGINEERING, ROLES.ADMIN],
  MANAGE_STAGES: [ROLES.ADMIN],
  VIEW_AUDIT: [ROLES.ADMIN, ROLES.APPROVER],
  EDIT_MASTER_DATA: [ROLES.ENGINEERING, ROLES.ADMIN],
  APPROVE_ECO: [ROLES.APPROVER, ROLES.ADMIN],
}
