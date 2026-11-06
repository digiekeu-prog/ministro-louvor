import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AuthProvider, useAuth } from './store/AuthContext'
import { DataProvider, useData } from './store/DataContext'
import { LoginPage } from './pages/Login'
import { HomePage } from './pages/Home'
import { EscalasPage } from './pages/Escalas'
import { CultoEditorPage } from './pages/CultoEditor'
import { EscalaDetalhePage } from './pages/EscalaDetalhe'
import { EscalaPublicaPage } from './pages/EscalaPublica'
import { CopiaEscalaPage } from './pages/CopiaEscala'
import { MinhaEscalaPage } from './pages/MinhaEscala'
import { EquipePage } from './pages/Equipe'
import { PerfilPage } from './pages/Perfil'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, user } = useAuth()
  if (!session || !user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/app" replace />
  return <>{children}</>
}

function Shell() {
  const { session, user } = useAuth()
  return (
    <Routes>
      <Route
        path="/login"
        element={session && user ? <Navigate to="/app" replace /> : <LoginPage />}
      />
      {/* Escala pública: é o link que o ministro manda no WhatsApp (sem login) */}
      <Route path="/escala/:id" element={<EscalaPublicaPage />} />
      {/* Cópia da escala a partir do cache do aparelho (quando o banco está fora) */}
      <Route path="/copia/:id" element={<CopiaEscalaPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell>
              <HomePage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/app/escalas"
        element={
          <RequireAuth>
            <AppShell>
              <EscalasPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/app/escalas/nova"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AppShell>
                <CultoEditorPage />
              </AppShell>
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/app/escalas/:id"
        element={
          <RequireAuth>
            <AppShell>
              <EscalaDetalhePage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/app/escalas/:id/editar"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AppShell>
                <CultoEditorPage />
              </AppShell>
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/app/minha-escala"
        element={
          <RequireAuth>
            <AppShell>
              <MinhaEscalaPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/app/equipe"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AppShell>
                <EquipePage />
              </AppShell>
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/app/perfil"
        element={
          <RequireAuth>
            <AppShell>
              <PerfilPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

function Root() {
  return (
    <DataProvider>
      <AuthBridge>
        <Router>
          <Shell />
        </Router>
      </AuthBridge>
    </DataProvider>
  )
}

/** Mantém o AuthProvider com acesso aos membros do DataProvider. */
function AuthBridge({ children }: { children: React.ReactNode }) {
  const { members } = useData()
  return <AuthProvider members={members}>{children}</AuthProvider>
}

export default function App() {
  return <Root />
}
