import { useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { useData } from '../state/DataContext'
import { formatCnpj } from '../lib/format'
import type { Perfil, Tomador } from '../domain/types'

export function ConfigView() {
  const { config, updateConfig, emitentes, tomadores, canEdit, isAdmin } = useData()
  const [rate, setRate] = useState(String(config.commissionRate))
  const [prazo, setPrazo] = useState(String(config.prazoDias))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      await updateConfig({
        commissionRate: parseFloat(rate) || 0,
        prazoDias: parseInt(prazo, 10) || 10,
      })
      setMsg('Configurações salvas.')
    } catch (err) {
      setMsg('Erro ao salvar: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <form onSubmit={save} className="card p-5 space-y-4">
        <h2 className="heading text-base">Regras de negócio</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Taxa de comissão padrão (%)</label>
            <input
              className="field tabular-nums"
              type="number"
              step="0.01"
              min="0"
              value={rate}
              disabled={!canEdit}
              onChange={(e) => setRate(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-3">
              Aplicada sobre o valor líquido pós-impostos, para clientes sem taxa própria cadastrada abaixo.
            </p>
          </div>
          <div>
            <label className="field-label">Prazo de emissão e cobrança (dias)</label>
            <input
              className="field tabular-nums"
              type="number"
              min="1"
              value={prazo}
              disabled={!canEdit}
              onChange={(e) => setPrazo(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-3">Dias após o fim do mês do período de referência.</p>
          </div>
        </div>
        {canEdit ? (
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar configurações'}
            </button>
            {msg && <span className={`text-sm font-semibold ${msg.startsWith('Erro') ? 'text-critical' : 'text-good-deep'}`}>{msg}</span>}
          </div>
        ) : (
          <p className="text-xs text-ink-3">Seu usuário não tem permissão para alterar essas configurações.</p>
        )}
      </form>

      <div className="card p-5">
        <h2 className="heading text-base mb-1">Comissão por cliente</h2>
        <p className="text-xs text-ink-3 mb-3">
          Defina uma taxa própria para um cliente quando ela existir — o padrão acima é usado quando o campo
          fica em branco.
        </p>
        {tomadores.length === 0 ? (
          <p className="text-sm text-ink-3">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {tomadores.map((t) => (
              <ClientRateRow key={t.key} tomador={t} defaultRate={config.commissionRate} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </div>

      <div className="card p-5">
        <h2 className="heading text-base mb-3">Emitentes (filiais)</h2>
        <ul className="space-y-2">
          {emitentes.map((e) => (
            <li key={e.id} className="flex items-baseline justify-between gap-3 text-sm border-b border-hairline/70 pb-2 last:border-0">
              <div>
                <div className="font-semibold">{e.razaoSocial}</div>
                <div className="text-xs text-ink-3">
                  {e.municipio} · Insc. Municipal {e.inscMunicipal ?? '—'}
                </div>
              </div>
              <span className="tabular-nums text-ink-2 text-xs">{formatCnpj(e.cnpj)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-3">
          As notas importadas por PDF identificam a filial automaticamente pelo CNPJ do prestador.
        </p>
      </div>

      {isAdmin && <UsuariosCard />}
    </div>
  )
}

function ClientRateRow({
  tomador,
  defaultRate,
  canEdit,
}: {
  tomador: Tomador
  defaultRate: number
  canEdit: boolean
}) {
  const { clientes, setClienteCommissionRate } = useData()
  const cliente = clientes.find((c) => c.cnpj === tomador.key)
  const [value, setValue] = useState(cliente?.commissionRate != null ? String(cliente.commissionRate) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const persisted = cliente?.commissionRate != null ? String(cliente.commissionRate) : ''
  const dirty = value !== persisted

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const trimmed = value.trim()
      await setClienteCommissionRate(tomador.cnpj, trimmed === '' ? null : parseFloat(trimmed))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 text-sm border-b border-hairline/70 pb-2 last:border-0">
      <div className="min-w-0">
        <div className="font-semibold truncate">{tomador.nome}</div>
        <div className="text-xs text-ink-3 tabular-nums">{tomador.cnpj || '—'}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <input
            className="field tabular-nums w-24 pr-6"
            type="number"
            step="0.01"
            min="0"
            placeholder={`${defaultRate}`}
            value={value}
            disabled={!canEdit}
            onChange={(e) => setValue(e.target.value)}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-3">%</span>
        </div>
        {canEdit && (
          <button
            className="btn-ghost px-2.5 py-1.5 text-xs"
            disabled={!dirty || saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Salvando…' : saved ? 'Salvo' : 'Salvar'}
          </button>
        )}
      </div>
    </li>
  )
}

const emptyInvite = { email: '', nome: '', podeLer: true, podeIncluir: false, podeAlterar: false, isAdmin: false }

function UsuariosCard() {
  const { perfis, myPerfil, inviteUser } = useData()
  const [showInvite, setShowInvite] = useState(false)
  const [invite, setInvite] = useState(emptyInvite)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      await inviteUser(invite)
      setInvite(emptyInvite)
      setShowInvite(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="heading text-base">Usuários</h2>
        <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setShowInvite((s) => !s)}>
          <UserPlus size={14} /> Convidar usuário
        </button>
      </div>
      <p className="text-xs text-ink-3 mb-3">
        Leitura, inclusão e alteração são independentes — marque a combinação certa para cada pessoa.
        Administrador tem acesso total, independente das outras caixas.
      </p>

      {showInvite && (
        <form onSubmit={submitInvite} className="mb-4 p-3.5 rounded-lg bg-ink/3 space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="field-label">E-mail</label>
              <input
                className="field"
                type="email"
                required
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">Nome</label>
              <input
                className="field"
                value={invite.nome}
                onChange={(e) => setInvite({ ...invite, nome: e.target.value })}
              />
            </div>
          </div>
          <PermCheckboxes value={invite} onChange={setInvite} />
          {error && <div className="text-sm text-critical font-semibold">{error}</div>}
          <div className="flex items-center gap-2">
            <button type="submit" className="btn-primary" disabled={sending}>
              {sending ? 'Enviando convite…' : 'Enviar convite'}
            </button>
            <button type="button" className="btn-cancel" onClick={() => setShowInvite(false)}>
              Cancelar
            </button>
          </div>
          <p className="text-xs text-ink-3">
            A pessoa recebe um e-mail do Supabase para definir a senha e acessar o painel.
          </p>
        </form>
      )}

      {perfis.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhum usuário cadastrado ainda.</p>
      ) : (
        <ul className="space-y-3">
          {perfis.map((p) => (
            <UsuarioRow key={p.id} perfil={p} isSelf={p.id === myPerfil?.id} />
          ))}
        </ul>
      )}
    </div>
  )
}

interface Perms {
  podeLer: boolean
  podeIncluir: boolean
  podeAlterar: boolean
  isAdmin: boolean
}

function PermCheckboxes<T extends Perms>({ value, onChange }: { value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          className="size-3.5 accent-[#c1791f]"
          checked={value.podeLer}
          onChange={(e) => onChange({ ...value, podeLer: e.target.checked })}
        />
        Leitura
      </label>
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          className="size-3.5 accent-[#c1791f]"
          checked={value.podeIncluir}
          onChange={(e) => onChange({ ...value, podeIncluir: e.target.checked })}
        />
        Inclusão
      </label>
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          className="size-3.5 accent-[#c1791f]"
          checked={value.podeAlterar}
          onChange={(e) => onChange({ ...value, podeAlterar: e.target.checked })}
        />
        Alteração
      </label>
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          className="size-3.5 accent-[#c1791f]"
          checked={value.isAdmin}
          onChange={(e) => onChange({ ...value, isAdmin: e.target.checked })}
        />
        Administrador
      </label>
    </div>
  )
}

function UsuarioRow({ perfil, isSelf }: { perfil: Perfil; isSelf: boolean }) {
  const { updatePerfilPermissoes, removeUser } = useData()
  const [perms, setPerms] = useState({
    podeLer: perfil.podeLer,
    podeIncluir: perfil.podeIncluir,
    podeAlterar: perfil.podeAlterar,
    isAdmin: perfil.isAdmin,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const dirty =
    perms.podeLer !== perfil.podeLer ||
    perms.podeIncluir !== perfil.podeIncluir ||
    perms.podeAlterar !== perfil.podeAlterar ||
    perms.isAdmin !== perfil.isAdmin

  async function handleSave() {
    setSaving(true)
    try {
      await updatePerfilPermissoes(perfil.id, perms)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="border-b border-hairline/70 pb-3 last:border-0">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="font-semibold truncate">
            {perfil.nome || perfil.email} {isSelf && <span className="text-ink-3 font-normal">(você)</span>}
          </div>
          <div className="text-xs text-ink-3 truncate">{perfil.email}</div>
        </div>
        {!isSelf &&
          (confirmDelete ? (
            <button
              className="btn-danger px-2.5 py-1.5 text-xs shrink-0"
              onClick={() => void removeUser(perfil.id)}
            >
              Confirmar exclusão?
            </button>
          ) : (
            <button
              className="p-1.5 rounded hover:bg-critical/10 text-critical cursor-pointer shrink-0"
              title="Excluir usuário"
              onClick={() => {
                setConfirmDelete(true)
                setTimeout(() => setConfirmDelete(false), 3000)
              }}
            >
              <Trash2 size={15} />
            </button>
          ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <PermCheckboxes value={perms} onChange={(v) => setPerms(v)} />
        {dirty && (
          <button className="btn-ghost px-2.5 py-1.5 text-xs" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Salvando…' : saved ? 'Salvo' : 'Salvar'}
          </button>
        )}
      </div>
    </li>
  )
}
