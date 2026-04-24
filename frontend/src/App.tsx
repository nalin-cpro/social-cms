import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'

import Login from './pages/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminClients from './pages/admin/Clients'
import AdminCampaignPlan from './pages/admin/CampaignPlan'
import AdminCalendar from './pages/admin/Calendar'
import AdminContentQueue from './pages/admin/ContentQueue'
import AdminOnboarding from './pages/admin/Onboarding'
import AdminPlan from './pages/admin/Plan'
import DesignerQueue from './pages/designer/Queue'
import DesignerRevisions from './pages/designer/Revisions'
import DesignerContentDetail from './pages/designer/ContentDetail'
import ClientReviewList from './pages/client/ReviewList'
import ClientReviewDetail from './pages/client/ReviewDetail'

function RoleGate({ allowed, children }: { allowed: string[]; children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-muted">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (!allowed.includes(user.role)) return <Navigate to="/login" replace />
  return children
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (user.role === 'designer') return <Navigate to="/designer/queue" replace />
  return <Navigate to="/client/review" replace />
}

export default function App() {
  return (
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />

        <Route path="/admin/dashboard" element={<RoleGate allowed={['admin']}><AdminDashboard /></RoleGate>} />
        <Route path="/admin/plan" element={<RoleGate allowed={['admin']}><AdminPlan /></RoleGate>} />
        <Route path="/admin/clients" element={<RoleGate allowed={['admin']}><AdminClients /></RoleGate>} />
        <Route path="/admin/campaigns" element={<RoleGate allowed={['admin']}><AdminCampaignPlan /></RoleGate>} />
        <Route path="/admin/calendar" element={<RoleGate allowed={['admin']}><AdminCalendar /></RoleGate>} />
        <Route path="/admin/queue" element={<RoleGate allowed={['admin']}><AdminContentQueue /></RoleGate>} />
        <Route path="/admin/onboarding" element={<RoleGate allowed={['admin']}><AdminOnboarding /></RoleGate>} />
        <Route path="/admin/suggestions" element={<RoleGate allowed={['admin']}><AdminPlan /></RoleGate>} />

        <Route path="/designer/plan" element={<RoleGate allowed={['admin', 'designer']}><AdminPlan /></RoleGate>} />
        <Route path="/designer/queue" element={<RoleGate allowed={['admin', 'designer']}><DesignerQueue /></RoleGate>} />
        <Route path="/designer/revisions" element={<RoleGate allowed={['admin', 'designer']}><DesignerRevisions /></RoleGate>} />
        <Route path="/designer/suggestions" element={<RoleGate allowed={['admin', 'designer']}><DesignerRevisions /></RoleGate>} />
        <Route path="/designer/content/:id" element={<RoleGate allowed={['admin', 'designer']}><DesignerContentDetail /></RoleGate>} />

        <Route path="/client/review" element={<RoleGate allowed={['client']}><ClientReviewList /></RoleGate>} />
        <Route path="/client/review/:id" element={<RoleGate allowed={['client']}><ClientReviewDetail /></RoleGate>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  )
}
