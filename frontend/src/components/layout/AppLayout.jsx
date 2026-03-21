import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'

/**
 * Main application layout shell.
 * Fixed sidebar on desktop, slide-out drawer on mobile.
 * Content area renders the matched child route via <Outlet />.
 */
export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Desktop Sidebar (fixed, always visible >= lg) ──── */}
      <aside className="hidden lg:flex lg:w-[260px] lg:flex-shrink-0 border-r border-sidebar-border">
        <div className="w-full">
          <Sidebar />
        </div>
      </aside>

      {/* ── Mobile Sidebar Overlay ─────────────────────────── */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="fixed inset-y-0 left-0 z-50 w-[280px] lg:hidden animate-in slide-in-from-left duration-200">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      {/* ── Main Content Area ──────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex items-center h-14 px-4 border-b border-border lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="ml-3 font-semibold">DeltaPLM</span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
