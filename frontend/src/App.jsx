import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/components/shared/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import Dashboard from '@/pages/Dashboard'
import ProductList from '@/pages/products/ProductList'
import ProductForm from '@/pages/products/ProductForm'
import BomList from '@/pages/bom/BomList'
import BomForm from '@/pages/bom/BomForm'
import EcoList from '@/pages/eco/EcoList'
import EcoForm from '@/pages/eco/EcoForm'
import EcoDetail from '@/pages/eco/EcoDetail'
import EcoComparison from '@/pages/eco/EcoComparison'
import StageSettings from '@/pages/stages/StageSettings'
import AuditLog from '@/pages/audit/AuditLog'
import Reports from '@/pages/reports/Reports'
import { ROLES } from '@/lib/constants'
import { Test } from '@/pages/Test'

function App() {
  return (
    <Routes>
      {/* ── Public Routes ──────────────────────────────── */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/test" element ={<Test />} />
      {/* ── Protected Routes (wrapped in AppLayout) ────── */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route path="/" element={<Dashboard />} />

        {/* Master Data — Phase 2 */}
        <Route path="/products" element={<ProductList />} />
        <Route path="/products/new" element={<ProductForm />} />
        <Route path="/products/:id" element={<ProductForm />} />
        <Route path="/boms" element={<BomList />} />
        <Route path="/boms/new" element={<BomForm />} />
        <Route path="/boms/:id" element={<BomForm />} />

        {/* ECOs — Phase 3 */}
        <Route path="/ecos" element={<EcoList />} />
        <Route path="/ecos/new" element={<EcoForm />} />
        <Route path="/ecos/:id" element={<EcoForm />} />

        {/* ECO Detail — Phase 5 */}
        <Route path="/ecos/:id/detail" element={<EcoDetail />} />

        {/* ECO Comparison — Phase 7 */}
        <Route path="/comparison/:ecoId" element={<EcoComparison />} />

        {/* ECO Stages — Phase 4 (Admin only) */}
        <Route
          path="/stages"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <StageSettings />
            </ProtectedRoute>
          }
        />

        {/* Reports — Phase 9 */}
        <Route path="/reports" element={<Reports />} />

        {/* Audit Log — Phase 8 (Admin & Approver) */}
        <Route
          path="/audit"
          element={
            <ProtectedRoute roles={[ROLES.ADMIN, ROLES.APPROVER]}>
              <AuditLog />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* ── Catch-all → Dashboard ──────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
