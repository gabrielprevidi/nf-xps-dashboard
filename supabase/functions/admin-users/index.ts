// Edge Function: gerencia usuários do painel (convidar / excluir).
// Roda no servidor do Supabase — é o único lugar que pode usar a
// service_role key, que nunca deve chegar ao navegador.
//
// Deploy: supabase functions deploy admin-users
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já ficam disponíveis
// automaticamente no ambiente da função, não precisa configurar nada.)

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autenticado.' }, 401)

    // Cliente com o JWT de quem chamou, só para identificar o usuário e checar se é admin.
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Não autenticado.' }, 401)

    const { data: perfil } = await callerClient
      .from('perfis')
      .select('is_admin')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (!perfil?.is_admin) return json({ error: 'Apenas administradores podem gerenciar usuários.' }, 403)

    const body = await req.json()
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    if (body.action === 'invite') {
      const { email, nome, podeLer, podeIncluir, podeAlterar, isAdmin } = body
      if (!email || typeof email !== 'string') return json({ error: 'E-mail obrigatório.' }, 400)

      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email)
      if (inviteErr) return json({ error: inviteErr.message }, 400)

      const { error: perfilErr } = await admin.from('perfis').insert({
        id: invited.user.id,
        email,
        nome: nome || null,
        pode_ler: podeLer !== false,
        pode_incluir: !!podeIncluir,
        pode_alterar: !!podeAlterar,
        is_admin: !!isAdmin,
      })
      if (perfilErr) {
        // Desfaz o convite se não conseguir salvar o perfil, para não deixar usuário órfão.
        await admin.auth.admin.deleteUser(invited.user.id)
        return json({ error: perfilErr.message }, 400)
      }
      return json({ ok: true, id: invited.user.id })
    }

    if (body.action === 'delete') {
      const { userId } = body
      if (!userId || typeof userId !== 'string') return json({ error: 'userId obrigatório.' }, 400)
      if (userId === userData.user.id) return json({ error: 'Você não pode excluir seu próprio usuário.' }, 400)
      const { error: delErr } = await admin.auth.admin.deleteUser(userId)
      if (delErr) return json({ error: delErr.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
