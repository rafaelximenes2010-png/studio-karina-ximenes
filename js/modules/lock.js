// Acesso protegido por PIN (proteção local do aparelho — não substitui conta/autenticação em servidor).
import { t } from '../lib/i18n.js';
import { prefs } from '../lib/store.js';
import { h, logoSrc } from '../ui.js';

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
export async function hashPin(pin, saltB64) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 }, key, 256);
  return { hash: b64(bits), salt: b64(salt) };
}
export async function setPin(pin) { const r = await hashPin(pin); prefs.set({ pinHash: r.hash, pinSalt: r.salt, pinFails: 0 }); sessionStorage.setItem('sk-unlocked', '1'); }
export function clearPin() { prefs.set({ pinHash: '', pinSalt: '', pinFails: 0 }); }
export const isLocked = () => !!prefs.get().pinHash && !sessionStorage.getItem('sk-unlocked');

/** Mostra a tela de acesso e resolve quando desbloqueado */
export function lockScreen() {
  return new Promise((resolve) => {
    const el = h(`<div id="lock" role="dialog" aria-modal="true" aria-label="${t('Acesso protegido')}" style="position:fixed;inset:0;z-index:2000;background:radial-gradient(circle at 50% 30%,#FFFDF8,#E7ECE3);display:grid;place-items:center;padding:24px">
      <form style="width:min(340px,100%);text-align:center">
        <img src="${logoSrc}" alt="" style="width:120px;height:120px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 3px #A8834F">
        <h1 style="font-family:var(--serif);color:#435B49;margin:16px 0 4px">Studio Karina</h1>
        <p class="small" style="color:#5C6A5F;margin:0 0 18px">${t('Digite seu PIN para entrar')}</p>
        <input class="input" type="password" inputmode="numeric" autocomplete="current-password" pattern="[0-9]*" maxlength="8" id="pin" style="text-align:center;font-size:26px;letter-spacing:10px;background:#fff;color:#2B3128" aria-label="PIN" autofocus>
        <p id="err" class="small" style="color:#A4453A;min-height:22px;margin:8px 0"></p>
        <button class="btn block">${t('Entrar')}</button>
        <p class="xs" style="color:#7C887E;margin-top:16px">${t('Esqueceu o PIN? Por segurança, só é possível redefinir apagando os dados deste aparelho (faça backups).')}</p>
        <button type="button" class="btn sm ghost" id="reset" style="margin-top:4px">${t('Redefinir aparelho')}</button>
      </form></div>`);
    document.body.appendChild(el);
    const inp = el.querySelector('#pin'); setTimeout(() => inp.focus(), 100);
    el.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const p = prefs.get(); const wait = (p.pinUntil || 0) - Date.now();
      if (wait > 0) { el.querySelector('#err').textContent = t('Muitas tentativas. Aguarde {s}s.', { s: Math.ceil(wait / 1000) }); return; }
      const { hash } = await hashPin(inp.value, p.pinSalt);
      if (hash === p.pinHash) { prefs.set({ pinFails: 0, pinUntil: 0 }); sessionStorage.setItem('sk-unlocked', '1'); el.remove(); resolve(); return; }
      const fails = (p.pinFails || 0) + 1; prefs.set({ pinFails: fails, pinUntil: fails >= 5 ? Date.now() + 30000 * (fails - 4) : 0 });
      inp.value = ''; el.querySelector('#err').textContent = t('PIN incorreto');
    };
    el.querySelector('#reset').onclick = async () => {
      if (!confirm(t('Isso apaga TODOS os dados do Studio neste aparelho. Continuar?'))) return;
      const { wipeAll } = await import('../lib/store.js'); await wipeAll(); sessionStorage.clear(); location.reload();
    };
  });
}
