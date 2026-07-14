import { useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useData } from '../state/DataContext'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-navy-2 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-accent text-white font-black text-lg">
            XPS
          </div>
          <h1 className="mt-3 text-white text-xl font-bold">Painel de Notas Fiscais</h1>
          <p className="text-white/60 text-sm">XPS LOG · faturamento, comissão e conciliação</p>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </div>
  )
}

/** Tela exibida enquanto o .env.local não tem as credenciais do Supabase */
export function SetupView() {
  const { enterDemo } = useData()
  return (
    <Shell>
      <h2 className="font-bold mb-2">Conexão com o banco pendente</h2>
      <p className="text-sm text-ink-2 leading-relaxed">
        As credenciais do Supabase ainda não foram configuradas. Crie o arquivo{' '}
        <code className="bg-ink/6 px-1 rounded text-[12px]">app/.env.local</code> com:
      </p>
      <pre className="mt-3 bg-navy-2 text-white/90 rounded-lg p-3 text-xs overflow-x-auto">
{`VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=chave_anon_publica`}
      </pre>
      <p className="mt-3 text-sm text-ink-2 leading-relaxed">
        Os valores estão em <b>Project Settings → API</b> no painel do Supabase. Depois de salvar, reinicie o
        servidor de desenvolvimento.
      </p>
      <button className="btn-ghost w-full justify-center mt-4" onClick={enterDemo}>
        Explorar demonstração com dados de exemplo
      </button>
    </Shell>
  )
}

export function LoginView() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!supabaseConfigured) return <SetupView />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error)
      setError(
        /invalid/i.test(error.message)
          ? 'E-mail ou senha inválidos.'
          : error.message,
      )
    setBusy(false)
  }

  return (
    <Shell>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="field-label">E-mail</label>
          <input
            className="field"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="field-label">Senha</label>
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="text-sm text-critical font-semibold">{error}</div>}
        <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="text-xs text-ink-3 text-center">
          Usuários são cadastrados pelo administrador no painel do Supabase (Authentication → Users).
        </p>
      </form>
    </Shell>
  )
}
