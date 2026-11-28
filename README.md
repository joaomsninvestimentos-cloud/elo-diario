# Elo Diário

Diário pessoal em PWA, pensado para uso no celular e no tablet: escreve-se à mão com
caneta (stylus) ou com o dedo, o traço respeita a pressão da caneta, o desenho fica
salvo como parte da página e pode ser convertido em texto.

**Situação:** aplicativo funcional com login, banco em nuvem, sincronização entre
aparelhos e OCR local. Falta apenas criar o projeto no Supabase e publicar (passo a
passo abaixo) para usar de verdade.

---

## O que já está pronto

| Recurso | Estado |
| --- | --- |
| Escrita à mão com caneta/stylus e **pressão** | ✅ |
| Rejeição de palma (depois de usar a caneta, o dedo apoia) | ✅ |
| Borracha, desfazer, cores e 4 espessuras | ✅ |
| Página com texto + desenho juntos | ✅ |
| Salvar o desenho como imagem PNG | ✅ |
| **Escrita à mão → texto** (OCR local, Tesseract em português) | ✅ |
| Login por e-mail e senha | ✅ |
| Banco em nuvem com isolamento por conta (RLS) | ✅ |
| Sincronização entre celulares e tablet, com mesclagem por campo | ✅ |
| Funciona offline (IndexedDB + service worker) | ✅ |
| Backup/restauração em arquivo JSON | ✅ |
| **Bloqueio por PIN** (4–8 dígitos, PBKDF2) | ✅ |
| **Biometria** do aparelho para desbloquear | ✅ |
| Hospedagem HTTPS automática (GitHub Pages) | ✅ |

## Como o desenho é guardado

Cada traço é uma lista de pontos com `x`, `y` normalizados (0–1) e a pressão `p`.
Guardar vetores, em vez de uma imagem, permite:

- redesenhar nítido em qualquer tela e em qualquer zoom;
- editar depois (desfazer, apagar traços, mudar de cor);
- sincronizar pouco dado entre os aparelhos;
- reamostrar o desenho em alta resolução na hora de gerar o PNG ou de rodar o OCR.

A imagem do traço é gerada sob demanda — o PNG que você baixa é renderizado em
1200 × 1600 a partir dos vetores.

## Como a sincronização evita perder anotações

Cada campo da página (título, texto, desenho) tem seu próprio carimbo de tempo.
Quando os dois aparelhos editaram a mesma página, a mesclagem escolhe **o campo mais
recente de cada lado** — então editar o texto no celular e desenhar no tablet no
mesmo minuto não perde nenhum dos dois. Só vai para a nuvem o que realmente difere,
o que evita o vaivém infinito entre aparelhos. Há testes cobrindo esses casos:
`npm test`.

---

## Colocando no ar (uma vez, ~15 minutos)

### 1. Criar o banco no Supabase

1. Crie uma conta em <https://supabase.com> e um projeto novo (plano gratuito serve).
   Guarde a senha do banco que ele pedir.
2. Abra **SQL Editor → New query**, cole todo o conteúdo de
   [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
   Isso cria a tabela `notes` e as regras que impedem uma conta de ver as páginas de outra.
3. Em **Project Settings → API**, copie **Project URL** e a chave **anon public**.
4. Em **Authentication → Providers → Email**, deixe o e-mail/senha ativos.
   Para uso pessoal, desligue **Confirm email** (Authentication → Sign In / Providers →
   Email) se não quiser confirmar por e-mail a cada aparelho.

### 2. Rodar no seu computador

```bash
npm install
cp .env.example .env      # cole a URL e a anon key do Supabase
npm run dev               # abra o endereço mostrado, de preferência pelo IP da rede
```

Para testar no celular e no tablet na mesma rede, use `npm run dev -- --host` e abra
`http://SEU-IP-LOCAL:5173` nos aparelhos.

### 3. Publicar com HTTPS

1. Envie o código para o GitHub (branch `main`).
2. No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Em **Settings → Secrets and variables → Actions → New repository secret**, crie:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Cada push em `main` publica sozinho em `https://SEU-USUARIO.github.io/elo-diario/`.
5. Abra esse endereço no celular e no tablet e use **Adicionar à tela inicial** para
   instalar como aplicativo.

> A chave `anon` pode ficar no build: ela é pública por design. Quem protege os dados é
> o Row Level Security do Postgres — cada conta só alcança as próprias linhas.
> **Nunca** coloque a chave `service_role` no app nem no repositório.

### Credenciais e dados pessoais

- `.env` está no `.gitignore` e não é versionado; só `.env.example` (sem valores) vai
  para o GitHub.
- Nenhuma senha, chave privada ou página de diário é versionada. O banco e o backup
  ficam fora do Git.

---

## Estrutura

```
src/
  lib/
    ink.ts        renderização do traço com pressão, exportação PNG
    ocr.ts        pré-tratamento da imagem + Tesseract (português)
    db.ts         IndexedDB (páginas + metadados de sincronização)
    sync.ts       mesclagem por campo e envio/recebimento no Supabase
    auth.tsx      sessão, login, cadastro
  components/     InkCanvas, cartão de página, painel de ajustes
  screens/        Login, Início, Editor
supabase/schema.sql   tabela + RLS
.github/workflows/deploy.yml   build e publicação no GitHub Pages
```

## Comandos

```bash
npm run dev        # desenvolvimento
npm test           # testes da mesclagem e do desenho
npm run typecheck  # verificação de tipos
npm run build      # build de produção em dist/
```

## Bloqueio do app

Em **⚙ Ajustes → Bloqueio do app** dá para ativar um PIN de 4 a 8 dígitos.

- O PIN **nunca é guardado**: fica salvo só um resumo PBKDF2-SHA256 (210 mil iterações)
  com salt aleatório de 16 bytes, e a comparação é feita em tempo constante.
- Opcionalmente cadastre a **biometria** do aparelho (WebAuthn, autenticador de
  plataforma) — é só um atalho local; o PIN continua valendo e é o que libera em
  aparelho novo.
- Trava ao abrir o app e também depois de 1, 5 ou 15 minutos em segundo plano
  (ou a cada saída, na opção "Só ao fechar").
- **Esqueci o PIN**: o bloqueio é desligado e o acesso é refeito pelo login da conta.
  Os dados continuam lá — o bloqueio protege a tela, não substitui a senha da conta.

## Limitações conhecidas

- O OCR é o Tesseract, que trabalha bem com **letra de forma**. Em cursiva muito
  emendada a precisão cai; o plano é oferecer, no futuro, reconhecimento por IA em
  nuvem para caligrafia cursiva.
- A primeira vez que se usa "Virar texto", o aparelho baixa o modelo de português
  (~2 MB). Depois disso funciona offline.
- Conflitos são resolvidos por campo, não por mesclagem de traços no mesmo desenho:
  se dois aparelhos desenharem na mesma página antes de sincronizar, o desenho mais
  recente prevalece.

## Ideias para as próximas etapas

- Busca dentro do texto reconhecido por OCR
- Marcações e etiquetas por página
- Exportar o diário inteiro em PDF
- Bloqueio por biometria/PIN ao abrir o app
- Reconhecimento de caligrafia cursiva por IA
