import { useAuth } from '@/contexts/AuthContext'

/**
 * Conditionally renders children based on user role.
 * If the user's role is not in `roles`, renders fallback or nothing.
 *
 * @param {string[]} roles - Allowed roles
 * @param {React.ReactNode} children
 * @param {React.ReactNode} fallback - What to render if role is not allowed
 */
export default function RoleGuard({ roles, children, fallback = null }) {
  const { hasRole } = useAuth()

  if (!hasRole(roles)) {
    return fallback
  }

  return children
}
