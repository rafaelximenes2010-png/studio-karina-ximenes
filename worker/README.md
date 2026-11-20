# Frankie — backend seguro de IA (Cloudflare Worker)

O app nunca guarda chaves de IA. O Frankie chama este Worker, que guarda a chave como **segredo** e aplica:
código de acesso, origem permitida (só o site do Studio), limite diário de uso e regras éticas (CFP) no comando do sistema.

## Publicar (uma vez, ~10 minutos)

1. Crie uma conta gratuita em https://dash.cloudflare.com (pode ser a mesma do SOLA — este é um **Worker separado**, não interfere no SOLA).
2. No computador, com Node.js instalado:
   ```bash
   npm install -g wrangler
   cd worker
   wrangler login
   wrangler secret put ANTHROPIC_API_KEY   # cole a chave da API (console.anthropic.com)
   wrangler secret put ACCESS_CODE         # invente um código forte; ele vai no app
   wrangler deploy
   ```
3. O comando mostra um endereço como `https://frankie-studio-karina.SEU-USUARIO.workers.dev`.
4. No app: **Perfil → Ajustes → Frankie · IA** → cole o endereço e o código de acesso → Salvar.

## Limite diário (opcional)
```bash
wrangler kv namespace create RATE
```
Cole o `id` no `wrangler.toml` (bloco `kv_namespaces`) e rode `wrangler deploy` de novo.

## Segurança
- A chave fica só no Cloudflare (segredo). Nunca a coloque no app ou no GitHub.
- Troque o `ACCESS_CODE` se suspeitar de vazamento: `wrangler secret put ACCESS_CODE`.
- `ALLOWED_ORIGIN` bloqueia chamadas de outros sites.
