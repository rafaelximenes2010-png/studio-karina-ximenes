# Studio Karina Ximenes | Psicóloga

Aplicativo (PWA) de criação de conteúdo, identidade visual, pesquisa e comunicação em Psicologia —
**Logoterapia, fé cristã reformada, EMDR, Neurociência e cuidado com as pessoas**.

**App:** https://rafaelximenes2010-png.github.io/studio-karina-ximenes/
Instale no iPhone: Safari → Compartilhar → *Adicionar à Tela de Início*.

## O que tem

| Módulo | Destaques |
|---|---|
| **Início** | Saudação, programação da semana, sugestões do dia, projetos e documentos recentes, busca global |
| **Biblioteca** | 465 artes prontas, 30 modelos oficiais (10 categorias), ~47 mil combinações (frase × layout × paleta × formato), filtros por tema/paleta, prévia com variações, mídia própria |
| **Editor visual** | Story 1080×1920, post 1080×1350, quadrado 1080×1080 e carrossel; camadas de texto, foto, forma e logomarca; molduras (arco, círculo, folha, orgânico), filtros, reenquadramento com os dedos, guias de alinhamento, pinça, desfazer/refazer, autosave; exporta PNG/JPG/PDF idêntico à prévia |
| **Agenda** | Mês/semana/lista, status (ideia → publicado), filtros, legendas, lembretes .ics; **programação automática** dos próximos meses (estilo SOLA, sem repetir frases, com campanhas e datas); **Semana temática** (carrossel + posts da semana no mesmo tema) |
| **Frankie** | Assistente de textos (reflexões, revisão, legendas, títulos, roteiros, calendário, tradução PT/EN/ES), tons acolhedor/científico/reflexivo/institucional/educativo; modo assistido sem IA; **Minhas reflexões** viram artes e entram na próxima publicação |
| **Ciência** | Busca no Crossref e PubMed, cadastro manual/DOI, fichamento separando fonte, síntese (IA), interpretação profissional e reflexão pessoal/espiritual; bibliografia ABNT/APA |
| **Documentos** | Artigo, relatório, apostila, material psicoeducativo, apresentação, roteiro de aula, guia, e-book; capa institucional; referências; exporta PDF e Word (.docx) |
| **Perfil** | Ajustes (idioma PT/EN/ES, tema claro/escuro, assinatura), identidade visual, instalar/compartilhar, privacidade/ética (LGPD/CFP, backup, exclusão), administração e diagnóstico, tutorial, **PIN de acesso** |

## Identidade visual (fixa)
- A logomarca usada em **todo** o app é o arquivo original `assets/brand/logo-original.jpg` — sem redesenho.
- Os ícones (180, 192, 512, maskable, favicon) são gerados por `scripts/brand.py` **somente** a partir desse arquivo e conferidos no CI por `scripts/check_brand.py` (falha se divergirem do original).
- Toda arte exportada leva a logomarca: se a camada for removida, uma assinatura com a logo é aplicada automaticamente.
- Paleta: verde profundo `#435B49`, sálvia `#91A595`, creme `#F5EEE2`, dourado `#A8834F`, grafite `#33382F`. Fontes: Cormorant Garamond e Inter (OFL).

## Arquitetura
- HTML/CSS/JavaScript modular (ES modules), **sem etapa de build** — publicação direta no GitHub Pages; avaliado React/TypeScript/Vite e mantido JS puro para simplificar manutenção e deploy (a separação em `js/lib` puro + `js/modules` de interface permite migrar no futuro).
- Dados locais no aparelho (IndexedDB), backup/importação em JSON. Sem contas nem servidor próprio por enquanto.
- IA: backend seguro em Cloudflare Worker (`worker/`) — nenhuma chave no app. Veja `worker/README.md`.
- Offline: service worker com cache versionado (`sw.js`, atualizar com `python3 scripts/gen_sw.py <versão>`).

## Desenvolvimento
```bash
python3 -m http.server 8080          # servir localmente
npm test                             # testes unitários (21)
node scripts/check-pwa.mjs           # manifesto, ícones, SW
python3 scripts/check_brand.py       # ícones derivados da logo original
npm install && npx playwright install chromium && npm run e2e   # teste no navegador (24 etapas)
```
O workflow `.github/workflows/pages.yml` roda tudo isso e **só publica se passar**, depois confere o site publicado (HTTP 200 e commit correto).

## Ética
Sem promessa de cura, sem diagnóstico pelas redes, sem dados de pacientes, nenhuma referência inventada,
conteúdo de IA sinalizado e sempre revisado. Campanhas sensíveis trazem CVV 188 / Central 180.
Os textos de privacidade e termos são **rascunhos** com campos `[A PREENCHER]` para revisão jurídica.

Relatório de auditoria: [`docs/AUDITORIA.md`](docs/AUDITORIA.md)
