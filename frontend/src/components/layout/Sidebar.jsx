import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ROLES, ROLE_LABELS } from '@/lib/constants'
import {
  LayoutDashboard,
  Package,
  Layers,
  FileText,
  Settings,
  BarChart3,
  ScrollText,
  ChevronDown,
  LogOut,
  User,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground'
  }`

const subNavLinkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 pl-10 text-sm transition-colors ${
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground'
  }`

export default function Sidebar({ onClose }) {
  const { user, logout, hasRole } = useAuth()
  const location = useLocation()
  const [masterDataOpen, setMasterDataOpen] = useState(
    location.pathname.startsWith('/products') || location.pathname.startsWith('/boms')
  )

  const isMasterDataActive =
    location.pathname.startsWith('/products') || location.pathname.startsWith('/boms')

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* ── Logo ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-5">
        <NavLink to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">Δ</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">DeltaPLM</span>
        </NavLink>
        {/* Close button — mobile only */}
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      {/* ── Navigation ────────────────────────────────────── */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {/* Dashboard */}
        <NavLink to="/" end className={navLinkClass}>
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </NavLink>

        {/* Master Data — collapsible group */}
        <div>
          <button
            onClick={() => setMasterDataOpen(!masterDataOpen)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              isMasterDataActive && !masterDataOpen
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <span className="flex items-center gap-3">
              <Package className="h-4 w-4" />
              Master Data
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                masterDataOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          <div
            className={`overflow-hidden transition-all duration-200 ${
              masterDataOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="mt-1 space-y-1">
              <NavLink to="/products" className={subNavLinkClass}>
                Products
              </NavLink>
              <NavLink to="/boms" className={subNavLinkClass}>
                Bill of Materials
              </NavLink>
            </div>
          </div>
        </div>

        {/* ECOs */}
        <NavLink to="/ecos" className={navLinkClass}>
          <FileText className="h-4 w-4" />
          ECOs
        </NavLink>

        {/* ECO Stages — Admin only */}
        {hasRole([ROLES.ADMIN]) && (
          <NavLink to="/stages" className={navLinkClass}>
            <Settings className="h-4 w-4" />
            ECO Stages
          </NavLink>
        )}

        {/* Reports */}
        <NavLink to="/reports" className={navLinkClass}>
          <BarChart3 className="h-4 w-4" />
          Reports
        </NavLink>

        {/* Audit Log — Admin & Approver */}
        {hasRole([ROLES.ADMIN, ROLES.APPROVER]) && (
          <NavLink to="/audit" className={navLinkClass}>
            <ScrollText className="h-4 w-4" />
            Audit Log
          </NavLink>
        )}
      </nav>

      {/* ── User Section ──────────────────────────────────── */}
      <Separator className="bg-sidebar-border" />
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : user?.username || 'User'}
            </p>
            <Badge variant="secondary" className="mt-0.5 text-xs font-normal">
              {ROLE_LABELS[user?.role] || user?.role || 'Unknown'}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={logout}
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
