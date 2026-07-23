import { useState } from 'react'
import { BarChart3, FileText, LogOut, RefreshCw, Scale, Settings } from 'lucide-react'
import { DataProvider, useData } from './state/DataContext'
import { LoginView } from './views/LoginView'
import { OverviewView } from './views/OverviewView'
import { NotasView } from './views/NotasView'
import { ConciliacaoView } from './views/ConciliacaoView'
import { ConfigView } from './views/ConfigView'
import { ClientTabs } from './components/ClientTabs'
import { Spinner } from './components/ui'

type View = 'overview' | 'notas' | 'conciliacao' | 'config'

const NAV: { id: View; label: string; icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Visão geral', icon: BarChart3 },
  { id: 'notas', label: 'Notas fiscais', icon: FileText },
  { id: 'conciliacao', label: 'Conciliação', icon: Scale },
  { id: 'config', label: 'Configurações', icon: Settings },
]

function Layout() {
  const {
    session,
    authReady,
    demoMode,
    loading,
    error,
    reload,
    signOut,
    tomadores,
    activeTomador,
    myPerfil,
    canRead,
  } = useData()
  const [view, setView] = useState<View>('overview')

  if (!authReady)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  if (!session && !demoMode) return <LoginView />

  // Ainda buscando o perfil de permissões deste usuário (primeiro carregamento após o login).
  if (!demoMode && loading && !myPerfil)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Carregando permissões…" />
      </div>
    )

  if (!demoMode && !canRead) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-md p-6 text-center">
          <h1 className="heading text-lg mb-2">Sem permissão de acesso</h1>
          <p className="text-sm text-ink-2 leading-relaxed">
            Seu usuário ({session?.user.email}) ainda não tem permissão de leitura liberada. Fale com o
            administrador do painel para configurar seu acesso em Configurações → Usuários.
          </p>
          <button className="btn-ghost mt-4" onClick={() => void signOut()}>
            Sair
          </button>
        </div>
      </div>
    )
  }

  const activeNome =
    activeTomador === 'todos'
      ? 'Todos os clientes'
      : tomadores.find((t) => t.key === activeTomador)?.nome ?? ''

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="no-print w-56 shrink-0 bg-navy-2 text-white flex flex-col">
        <div className="px-4 py-5 flex items-center gap-2.5">
          <img src="/logo.png" alt="XPS LOG" className="h-10 w-auto shrink-0" />
          <div className="font-mono text-[10px] uppercase tracking-wider text-accent leading-tight">
            Painel de
            <br />
            NFS-e
          </div>
        </div>
        <nav className="px-2.5 space-y-1 flex-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                view === id ? 'bg-accent text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="px-2.5 pb-4 space-y-1">
          <button
            onClick={() => void reload()}
            className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/8 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Recarregar dados
          </button>
          <button
            onClick={() => void signOut()}
            className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/8 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut size={15} />
            Sair
          </button>
          <div className="px-3 pt-1 text-[10px] text-white/35 truncate">
            {demoMode ? 'modo demonstração' : session?.user.email}
          </div>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 min-w-0">
        <header className="no-print sticky top-0 z-20 bg-page/90 backdrop-blur border-b border-hairline px-6 pt-4 pb-3 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="heading text-lg">
              {NAV.find((n) => n.id === view)?.label}
              <span className="text-ink-3 font-normal font-sans text-sm"> · {activeNome}</span>
            </h1>
            {loading && <Spinner label="Sincronizando…" />}
          </div>
          <ClientTabs />
        </header>

        <div className="px-6 py-5">
          {demoMode && (
            <div className="no-print card border-warn/50 bg-warn/8 px-4 py-2.5 mb-4 text-xs font-semibold text-warn-deep">
              Modo demonstração — dados de exemplo em memória; nada é salvo. Configure o Supabase para usar o
              painel de verdade.
            </div>
          )}
          {error && (
            <div className="no-print card border-critical/40 bg-critical/5 p-4 mb-4 text-sm text-critical font-semibold">
              Erro ao carregar dados: {error}
            </div>
          )}
          <div className={view === 'notas' ? '' : 'no-print'}>
            {view === 'overview' && <OverviewView />}
            {view === 'notas' && <NotasView />}
            {view === 'conciliacao' && <ConciliacaoView />}
            {view === 'config' && <ConfigView />}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <DataProvider>
      <Layout />
    </DataProvider>
  )
}
