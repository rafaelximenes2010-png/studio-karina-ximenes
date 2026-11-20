# Auditoria de qualidade — Etapa 12 (dez verificações)

- **Versão:** 2.0.0 · **Branch:** `studio-v2` · **Data:** 20/11/2026
- **Ambiente de teste:** Google Chrome (Playwright) emulando iPhone 13 (390×844, toque), servidor local HTTP.
- **Execuções:** 21/21 testes unitários · 24/24 etapas de ponta a ponta (3 execuções seguidas) · verificação estática de PWA e de marca.
- Evidências: `docs/evidencias/` (capturas e `relatorio-e2e.json`). O CI guarda as evidências de cada execução como artefato.

> Não foram feitos testes em iPhone/Android físicos nem no site publicado (o deploy ocorre após aprovação do PR). Esses itens estão marcados como **não executado** onde se aplicam.

| # | Verificação | Procedimento | Esperado | Obtido | Status |
|---|---|---|---|---|---|
| 1 | Logomarca oficial | `scripts/check_brand.py` refaz o enquadramento a partir de `logo-original.jpg` e compara pixel a pixel com cada ícone; diagnóstico no app | Ícones derivados do original, sem redesenho | Diferença média 0,00/255 em 6 ícones; original 487×452 carregado no app | ✅ Aprovado |
| 2 | Ícone iOS | `check-pwa.mjs` lê o PNG; e2e carrega o `apple-touch-icon` no navegador | 180×180 PNG, URL válida | 180×180, carregado | ✅ Aprovado (instalação em iPhone físico: **não executado**) |
| 3 | Ícones Android/desktop | Manifesto: tamanhos declarados × reais; maskable com zona segura (logo em 72%) | 192, 512 e maskable | 192/512 *any* + 192/512 *maskable*, dimensões conferem | ✅ Aprovado |
| 4 | Abertura | e2e captura a abertura; CSS com `prefers-reduced-motion` | Fade + escala ~1,4 s, sem animação com movimento reduzido | Abertura com logo exibida e removida após ~2,6 s; regra de movimento reduzido presente | ✅ Aprovado |
| 5 | Navegação | e2e percorre as 5 abas, voltar, folhas e atalhos | Todas respondem, aba ativa marcada | 5/5 abas com `aria-current`, rotas internas OK | ✅ Aprovado |
| 6 | Editor | e2e: abrir arte → adicionar texto → desfazer/refazer → paleta → camadas → formato → arrastar | Tudo funcional | 6 camadas, formato trocado preservando edições | ✅ Aprovado |
| 7 | Exportação | e2e baixa PNG e PDF; compara pixels da exportação com a prévia | Story/post/PDF corretos e iguais à prévia | PNG 1080×1080; PDF válido; diferença prévia×exportação 2,11/255 (antialias) | ✅ Aprovado |
| 8 | Persistência | e2e recarrega a página e reabre o projeto | Projeto e edições mantidos | Mantidos (bug de sobrescrita encontrado e corrigido — ver abaixo) | ✅ Aprovado |
| 9 | Segurança | Varredura de segredos no CI; CSP; PIN (PBKDF2) testado com PIN errado/certo; IA só via backend com código de acesso e origem permitida | Sem segredos; acesso protegido | 0 segredos; CSP sem scripts inline; PIN bloqueia e libera corretamente | ✅ Aprovado (autenticação em servidor/Supabase: **não implementada** — ver pendências) |
| 10 | Publicação | CI: testes → build só com arquivos do app → deploy → confere `commit.txt` e HTTP 200 dos arquivos principais; e2e offline | Deploy bloqueado em falha; site corresponde ao commit | Workflow pronto; app abriu offline no teste | ⏳ Deploy **não executado** (aguarda aprovação do PR) |

## Correções feitas durante a auditoria
1. **Perda de edições (crítico):** em navegações rápidas, uma instância antiga do editor podia regravar a versão anterior do projeto ao sair. Corrigido no roteador (descarta telas montadas fora de hora) e no salvamento (só grava quando há mudança pendente). Coberto por teste unitário e pelo e2e (3× seguidas).
2. **Trocar formato/paleta apagava edições:** agora o layout é refeito preservando textos, fotos, enquadramentos e camadas adicionadas. Coberto por teste.
3. **Contraste:** texto claro sobre forma clara após trocar paleta; agora as cores seguem o papel de cada camada. Teste garante contraste ≥ 4,5:1 (WCAG AA) em todas as paletas.
4. **Editor no celular:** botão Exportar saía da tela e o painel transbordava; corrigido.
5. **Filtros de foto no iPhone:** o Safari não aplica filtros de canvas de forma confiável; filtros passaram a ser aplicados pixel a pixel (iguais em qualquer aparelho).
6. **Ícones antigos:** vinham de um JPEG de 150 px embutido em SVG e eram regenerados a cada deploy; agora derivam do original em alta e não são regenerados no deploy.

## Pendências
- Testes em aparelhos físicos (iPhone/Android) e no endereço publicado após o merge.
- Busca no Crossref/PubMed e banco de imagens Wikimedia: implementados, mas **não testados aqui** (a rede do ambiente de desenvolvimento bloqueia essas APIs). O app mostra mensagem clara em caso de falha.
- IA do Frankie: backend pronto em `worker/`; requer publicar o Worker e cadastrar a chave (ver `worker/README.md`). Sem isso, funciona o modo assistido.
- Contas/sincronização entre aparelhos (Supabase), publicação automática nas redes (APIs oficiais) e empacotamento para lojas: fases futuras.
- Política de privacidade e termos: rascunhos com `[A PREENCHER]` para revisão jurídica.
