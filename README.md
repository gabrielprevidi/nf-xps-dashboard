# Painel de Notas Fiscais — XPS LOG

Dashboard de produção para controle do faturamento de armazenagem: cadastro de NFS-e
(manual ou por PDF), cálculo de impostos e comissão de indicação, conciliação com o
contas a receber do financeiro e alertas de meses sem nota ou em atraso.

Substitui o protótipo single-file, com banco de dados real (Supabase/Postgres) e login.

## Estrutura

```
supabase/schema.sql   ← schema completo do banco (rodar no SQL Editor do Supabase)
app/                  ← aplicação web (Vite + React + TypeScript + Tailwind)
app/tests/            ← regressão dos parsers de PDF contra as 9 notas reais
```

## Como rodar

```bash
cd app
npm install
npm run dev           # abre em http://localhost:5173
```

Sem credenciais configuradas o app abre em tela de setup, com opção de
**modo demonstração** (dados de exemplo em memória, nada é salvo).

## Configuração do Supabase (uma vez)

1. Crie um projeto em https://supabase.com (região São Paulo).
2. No **SQL Editor**, cole e execute o conteúdo de `supabase/schema.sql`
   (idempotente — pode rodar de novo sem quebrar). Ele cria as tabelas
   `emitentes`, `clientes`, `notas_fiscais`, `contas_receber`, `configuracoes`,
   já com as duas filiais (Vinhedo e Osasco) e RLS habilitado.
3. Em **Authentication → Users → Add user**, cadastre e-mail e senha de quem vai usar
   o painel (marque "Auto confirm user").
4. Em **Project Settings → API**, copie a URL e a chave `anon public` e crie
   `app/.env.local`:

   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=chave_anon_publica
   ```

5. Reinicie o `npm run dev`.

## Regras de negócio

- **Comissão de indicação**: `valor líquido × taxa%` (líquido = valor − ISS − IBS − CBS −
  outras retenções). Taxa padrão 4%, editável em Configurações (persistida no banco).
- **Prazo**: nota e cobrança do período M até **10 dias** após o fim do mês M
  (configurável). Alimenta o alerta de meses pendentes e a conciliação.
- **Status da nota**: sem chave de acesso = `pendente` (aguardando Ambiente Nacional).
- **Conciliação**: casa nota × título pelo nº do documento (só dígitos), tolerância de
  R$ 0,01 no valor; lançamentos sem nota viram "órfãos".

## Importações

- **PDF de NFS-e** (leiautes Vinhedo e Osasco): 1 arquivo abre o formulário para
  revisão; vários arquivos entram direto (merge por número, não duplica).
- **CSV do financeiro** ("Lançamentos a Receber", separador `;`, Latin-1): merge por
  Sequência — reimportar o relatório atualizado não duplica.

## Parsers de PDF — atenção

Os regexes foram calibrados para a saída do **pdf.js 3.11.174** (itens unidos por
`\n`). Não troque a lib/versão de extração sem rodar a regressão:

```bash
cd app && npm test    # 9 notas reais em tests/fixtures
```

Cada nova prefeitura/leiaute exige um parser novo calibrado contra PDFs reais
(`app/src/domain/nfseParser.ts`).
