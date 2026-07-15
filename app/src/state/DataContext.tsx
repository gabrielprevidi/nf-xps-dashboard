import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Cliente, Config, Emitente, ImportLote, Nota, Recebivel, Tomador } from '../domain/types'
import { supabase } from '../lib/supabase'
import * as api from '../data/api'
import { SEED_CLIENTES, SEED_EMITENTES, SEED_NOTAS, SEED_RECEBIVEIS } from '../data/seed'
import { normalizeCnpj } from '../lib/format'

interface DataState {
  session: Session | null
  authReady: boolean
  /** modo demonstração: dados de exemplo em memória, nada é salvo */
  demoMode: boolean
  enterDemo: () => void
  loading: boolean
  error: string | null
  notas: Nota[]
  recebiveis: Recebivel[]
  importLotes: ImportLote[]
  emitentes: Emitente[]
  clientes: Cliente[]
  config: Config
  tomadores: Tomador[]
  activeTomador: string // 'todos' ou CNPJ normalizado
  setActiveTomador: (k: string) => void
  /** notas do cliente ativo (ou todas) */
  tabNotas: Nota[]
  /** taxa de comissão efetiva para um tomadorKey (a do cliente, quando existir; senão a padrão) */
  commissionRateFor: (key: string) => number
  /** rate = null remove a taxa própria do cliente e volta a usar a padrão */
  setClienteCommissionRate: (cnpj: string, rate: number | null) => Promise<void>
  reload: () => Promise<void>
  saveNota: (n: Nota) => Promise<void>
  removeNota: (numero: number) => Promise<void>
  /** importa um CSV como um novo lote, identificado pelo nome do arquivo */
  importRecebiveis: (rows: Recebivel[], nomeArquivo: string) => Promise<void>
  /** exclui um lote de importação inteiro (e os lançamentos ainda vinculados a ele) */
  removeImportLote: (id: string) => Promise<void>
  updateConfig: (cfg: Config) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<DataState | null>(null)

export const tomadorKey = (n: Nota): string =>
  normalizeCnpj(n.tomadorCnpj) || 'sem-cnpj-' + n.tomadorNome

export function computeTomadores(notas: Nota[]): Tomador[] {
  const map = new Map<string, Tomador>()
  notas.forEach((n) => {
    const key = tomadorKey(n)
    if (!map.has(key)) map.set(key, { key, cnpj: n.tomadorCnpj, nome: n.tomadorNome, count: 0, total: 0 })
    const e = map.get(key)!
    e.count++
    e.total += n.valorTotal
  })
  return [...map.values()].sort((a, b) => b.total - a.total)
}

const DEFAULT_CONFIG: Config = { commissionRate: 4, prazoDias: 10 }

export function DataProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notas, setNotas] = useState<Nota[]>([])
  const [recebiveis, setRecebiveis] = useState<Recebivel[]>([])
  const [importLotes, setImportLotes] = useState<ImportLote[]>([])
  const [emitentes, setEmitentes] = useState<Emitente[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [activeTomador, setActiveTomador] = useState('todos')
  const [demoMode, setDemoMode] = useState(false)

  const enterDemo = useCallback(() => {
    setNotas(SEED_NOTAS)
    setRecebiveis(SEED_RECEBIVEIS)
    setEmitentes(SEED_EMITENTES)
    setClientes(SEED_CLIENTES)
    setConfig(DEFAULT_CONFIG)
    setDemoMode(true)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const reload = useCallback(async () => {
    if (!supabase || !session || demoMode) return
    setLoading(true)
    setError(null)
    try {
      const [n, r, lotes, e, cli, c] = await Promise.all([
        api.fetchNotas(),
        api.fetchRecebiveis(),
        api.fetchImportLotes(),
        api.fetchEmitentes(),
        api.fetchClientes(),
        api.fetchConfig(),
      ])
      setNotas(n)
      setRecebiveis(r)
      setImportLotes(lotes)
      setEmitentes(e)
      setClientes(cli)
      setConfig(c)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (session) void reload()
  }, [session, reload])

  const saveNota = useCallback(
    async (n: Nota) => {
      if (demoMode) {
        setNotas((prev) => {
          const map = new Map(prev.map((x) => [x.numero, x]))
          map.set(n.numero, n)
          return [...map.values()]
        })
        return
      }
      await api.upsertNota(n)
      await reload()
    },
    [reload, demoMode],
  )

  const removeNota = useCallback(
    async (numero: number) => {
      if (!demoMode) await api.deleteNota(numero)
      setNotas((prev) => prev.filter((x) => x.numero !== numero))
    },
    [demoMode],
  )

  const importRecebiveis = useCallback(
    async (rows: Recebivel[], nomeArquivo: string) => {
      if (demoMode) {
        const loteId = 'demo-lote-' + Date.now()
        const tagged = rows.map((r) => ({ ...r, importacaoId: loteId }))
        setRecebiveis((prev) => {
          const map = new Map(prev.map((x) => [x.id, x]))
          tagged.forEach((r) => map.set(r.id, r))
          return [...map.values()]
        })
        setImportLotes((prev) => [
          { id: loteId, nomeArquivo, totalLinhas: rows.length, importadoEm: new Date().toISOString() },
          ...prev,
        ])
        return
      }
      const loteId = await api.createImportLote(nomeArquivo, rows.length)
      await api.upsertRecebiveis(rows, loteId)
      setRecebiveis(await api.fetchRecebiveis())
      setImportLotes(await api.fetchImportLotes())
    },
    [demoMode],
  )

  const removeImportLote = useCallback(
    async (id: string) => {
      if (!demoMode) await api.deleteImportLote(id)
      setImportLotes((prev) => prev.filter((l) => l.id !== id))
      setRecebiveis((prev) => prev.filter((r) => r.importacaoId !== id))
    },
    [demoMode],
  )

  const updateConfig = useCallback(
    async (cfg: Config) => {
      if (!demoMode) await api.saveConfig(cfg)
      setConfig(cfg)
    },
    [demoMode],
  )

  const setClienteCommissionRate = useCallback(
    async (cnpj: string, rate: number | null) => {
      const key = normalizeCnpj(cnpj)
      if (!demoMode) await api.updateClienteCommissionRate(cnpj, rate)
      setClientes((prev) => {
        const found = prev.some((c) => c.cnpj === key)
        if (!found) return prev
        return prev.map((c) => (c.cnpj === key ? { ...c, commissionRate: rate } : c))
      })
    },
    [demoMode],
  )

  const signOut = useCallback(async () => {
    if (demoMode) {
      setDemoMode(false)
      setNotas([])
      setRecebiveis([])
      setImportLotes([])
      setEmitentes([])
      setClientes([])
      return
    }
    await supabase?.auth.signOut()
    setNotas([])
    setRecebiveis([])
    setImportLotes([])
  }, [demoMode])

  const tomadores = useMemo(() => computeTomadores(notas), [notas])
  const tabNotas = useMemo(
    () => (activeTomador === 'todos' ? notas : notas.filter((n) => tomadorKey(n) === activeTomador)),
    [notas, activeTomador],
  )

  const commissionRateFor = useCallback(
    (key: string): number => {
      const cliente = clientes.find((c) => c.cnpj === key)
      return cliente?.commissionRate ?? config.commissionRate
    },
    [clientes, config.commissionRate],
  )

  const value: DataState = {
    session,
    authReady,
    demoMode,
    enterDemo,
    loading,
    error,
    notas,
    recebiveis,
    importLotes,
    emitentes,
    clientes,
    config,
    tomadores,
    activeTomador,
    setActiveTomador,
    tabNotas,
    commissionRateFor,
    setClienteCommissionRate,
    reload,
    saveNota,
    removeNota,
    importRecebiveis,
    removeImportLote,
    updateConfig,
    signOut,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData(): DataState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useData fora do DataProvider')
  return ctx
}
