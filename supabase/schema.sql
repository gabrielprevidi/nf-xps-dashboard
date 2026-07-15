-- =============================================================
-- Painel de Notas Fiscais XPS LOG — Schema Supabase (Postgres)
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- Pode ser executado mais de uma vez sem quebrar (idempotente).
-- =============================================================

-- ---------- EMITENTES (filiais que emitem NFS-e) ----------
create table if not exists public.emitentes (
  id           uuid primary key default gen_random_uuid(),
  razao_social text not null,
  cnpj         text not null unique,          -- somente dígitos
  insc_municipal text,
  municipio    text,
  created_at   timestamptz not null default now()
);

insert into public.emitentes (razao_social, cnpj, insc_municipal, municipio)
values
  ('XPS LOG LTDA',   '32771162000462', '000027432', 'Vinhedo'),
  ('XPS LOG EIRELI', '32771162000110', '138472',    'Osasco')
on conflict (cnpj) do nothing;

-- ---------- CLIENTES (tomadores) ----------
create table if not exists public.clientes (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  cnpj            text not null unique,            -- somente dígitos
  commission_rate numeric(6,2),                    -- taxa específica do cliente; null = usa a taxa padrão
  created_at      timestamptz not null default now()
);

-- idempotente: garante a coluna em bancos já criados antes desta alteração
alter table public.clientes add column if not exists commission_rate numeric(6,2);

-- ---------- NOTAS FISCAIS ----------
create table if not exists public.notas_fiscais (
  numero            bigint primary key,       -- chave natural (nº da nota)
  emitente_id       uuid references public.emitentes(id),
  cliente_id        uuid not null references public.clientes(id),
  data_emissao      timestamptz not null,
  periodo_label     text not null default 'Não especificado',
  periodo_info      boolean not null default false,
  sort_date         date not null,            -- 1º dia do mês de referência
  discriminacao     text,
  valor_total       numeric(14,2) not null,
  base_calculo_iss  numeric(14,2),
  aliquota          numeric(7,4),
  valor_iss         numeric(14,2) not null default 0,
  valor_ibs         numeric(14,2) not null default 0,
  valor_cbs         numeric(14,2) not null default 0,
  outras_ret_total  numeric(14,2) not null default 0,
  desc_servico      text,
  nbs               text,
  nbs_desc          text,
  cod_verificacao   text,
  chave_acesso      text,                     -- null = pendente no Ambiente Nacional
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_notas_cliente on public.notas_fiscais (cliente_id);
create index if not exists idx_notas_sort_date on public.notas_fiscais (sort_date);

-- ---------- CONTAS A RECEBER (importado do CSV do financeiro) ----------
create table if not exists public.contas_receber (
  id                   text primary key,      -- coluna "Sequência" do CSV
  cnpj_filial          text,
  filial               text,
  cnpj_cliente         text,                  -- somente dígitos
  cliente              text,
  num_documento        text,
  num_documento_digits bigint,                -- casa com notas_fiscais.numero
  emissao              date,
  vencimento           date,
  vencimento_original  date,
  competencia          text,
  valor_principal      numeric(14,2),
  juros_desc           numeric(14,2),
  valor_titulo         numeric(14,2),
  data_baixa           date,
  data_liquidacao      date,
  banco_pagto          text,
  conta_pagto          text,
  forma_pagto          text,
  observacoes          text,
  conta_contabil       text,
  status               text,
  email_fatura         text,
  imported_at          timestamptz not null default now()
);

create index if not exists idx_cr_doc_digits on public.contas_receber (num_documento_digits);
create index if not exists idx_cr_cnpj_cliente on public.contas_receber (cnpj_cliente);

-- ---------- CONFIGURAÇÕES (linha única) ----------
create table if not exists public.configuracoes (
  id              int primary key default 1 check (id = 1),
  commission_rate numeric(6,2) not null default 4,  -- taxa padrão, usada quando o cliente não tem uma específica
  prazo_dias      int not null default 10,
  updated_at      timestamptz not null default now()
);

insert into public.configuracoes (id) values (1) on conflict (id) do nothing;

-- ---------- updated_at automático ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_notas_updated on public.notas_fiscais;
create trigger trg_notas_updated before update on public.notas_fiscais
  for each row execute function public.set_updated_at();

drop trigger if exists trg_config_updated on public.configuracoes;
create trigger trg_config_updated before update on public.configuracoes
  for each row execute function public.set_updated_at();

-- ---------- SEGURANÇA (RLS): somente usuários logados ----------
alter table public.emitentes      enable row level security;
alter table public.clientes       enable row level security;
alter table public.notas_fiscais  enable row level security;
alter table public.contas_receber enable row level security;
alter table public.configuracoes  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['emitentes','clientes','notas_fiscais','contas_receber','configuracoes']
  loop
    execute format('drop policy if exists "authenticated_all" on public.%I', t);
    execute format(
      'create policy "authenticated_all" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
