/**
 * Account, subscription, and checkout.
 *
 * Supabase Auth handles sign-in in the browser and hands back an access token;
 * every call to the API carries that token and the backend re-verifies it. No
 * privileged key is used here — the publishable key can only reach the auth
 * endpoints, because every table denies access without the service role.
 *
 * The checkout panel is deliberately data-driven: plans and payment channels
 * both come from the database, so the owner edits them in the admin dashboard
 * without anyone touching this file.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.APP_CONFIG;
const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

let account = null;   // { profile, entitlement }
let catalogue = null; // { plans, paymentMethods }

/* ------------------------------------------------------------------ *
 * Session
 * ------------------------------------------------------------------ */

async function syncSession(session) {
  window.__authToken = session?.access_token ?? null;
  account = null;

  if (window.__authToken) {
    try {
      const res = await window.apiFetch('/api/me');
      if (res.ok) account = await res.json();
    } catch { /* offline: fall through to the signed-out view */ }
  }
  render();
}

supabase.auth.getSession().then(({ data }) => syncSession(data.session));
supabase.auth.onAuthStateChange((_event, session) => syncSession(session));

/* ------------------------------------------------------------------ *
 * Account bar
 * ------------------------------------------------------------------ */

function el(id) { return document.getElementById(id); }

function mountBar() {
  if (el('accountBar')) return el('accountBar');
  const bar = document.createElement('div');
  bar.id = 'accountBar';
  bar.dir = 'rtl';
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;'
    + 'display:flex;gap:10px;align-items:center;justify-content:flex-start;flex-wrap:wrap;'
    + 'padding:8px 14px;background:rgba(8,14,20,.92);backdrop-filter:blur(8px);'
    + 'border-bottom:1px solid rgba(0,229,255,.18);font-size:13px;color:#cfe9f2';
  document.body.prepend(bar);
  document.body.style.paddingTop = '48px';
  return bar;
}

function btn(label, onClick, primary = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = 'cursor:pointer;border-radius:8px;padding:6px 12px;font:inherit;'
    + (primary
      ? 'background:linear-gradient(90deg,#00e5ff,#0091ea);color:#04121a;border:0;font-weight:700'
      : 'background:transparent;color:#9fd6e6;border:1px solid rgba(0,229,255,.35)');
  b.onclick = onClick;
  return b;
}

function span(text, style = '') {
  const s = document.createElement('span');
  s.textContent = text;
  if (style) s.style.cssText = style;
  return s;
}

function render() {
  const bar = mountBar();
  bar.textContent = '';

  if (!account?.profile) {
    bar.append(span('غير مسجّل دخول'), btn('تسجيل الدخول', openAuthDialog, true));
    return;
  }

  const { profile, entitlement: e } = account;
  const status = document.createElement('span');

  if (e.hasSubscription) {
    const left = Math.max(0, e.monthlyAnalyses - e.usedThisPeriod);
    const days = Math.max(0, Math.ceil((new Date(e.expiresAt) - Date.now()) / 86400000));
    status.innerHTML = `<b style="color:#00e5ff">${e.planName}</b>`
      + ` — باقي <b>${left}</b> من ${e.monthlyAnalyses} تحليل · ينتهي خلال ${days} يوم`;
  } else {
    status.innerHTML = '<b style="color:#ff5c7a">ما في اشتراك فعّال</b>';
  }

  bar.append(status, btn(e.hasSubscription ? 'تجديد' : 'اشترك', openCheckout, !e.hasSubscription));
  if (profile.is_admin) bar.append(btn('لوحة الأدمن', () => { location.href = './admin.html'; }));
  bar.append(span(profile.email, 'opacity:.6;margin-inline-start:auto'),
    btn('خروج', () => supabase.auth.signOut()));
}

/* ------------------------------------------------------------------ *
 * Modal shell
 * ------------------------------------------------------------------ */

function openModal(title) {
  el('appModal')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'appModal';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;'
    + 'align-items:center;justify-content:center;background:rgba(2,8,12,.82);padding:16px';
  wrap.onclick = (ev) => { if (ev.target === wrap) wrap.remove(); };

  const card = document.createElement('div');
  card.dir = 'rtl';
  card.style.cssText = 'background:#0b1620;border:1px solid rgba(0,229,255,.25);'
    + 'border-radius:16px;padding:22px;max-width:560px;width:100%;max-height:86vh;'
    + 'overflow:auto;color:#dcf1f8';
  const h = document.createElement('h3');
  h.textContent = title;
  h.style.cssText = 'margin:0 0 14px;color:#00e5ff';
  card.append(h);

  wrap.append(card);
  document.body.append(wrap);
  return { wrap, card };
}

function notice(card, text, ok = false) {
  const p = document.createElement('p');
  p.className = 'app-notice';
  p.textContent = text;
  p.style.cssText = `margin:10px 0;padding:9px 11px;border-radius:8px;font-size:13px;
    background:${ok ? 'rgba(0,229,255,.10)' : 'rgba(255,92,122,.10)'};
    border:1px solid ${ok ? 'rgba(0,229,255,.35)' : 'rgba(255,92,122,.35)'}`;
  card.append(p);
  return p;
}

const field = 'padding:11px;border-radius:9px;border:1px solid rgba(0,229,255,.25);'
  + 'background:#07131b;color:#dcf1f8;font:inherit';

/* ------------------------------------------------------------------ *
 * Sign in / sign up
 * ------------------------------------------------------------------ */

function openAuthDialog() {
  const { wrap, card } = openModal('الدخول إلى حسابك');

  const form = document.createElement('form');
  form.style.cssText = 'display:flex;flex-direction:column;gap:10px';

  const email = Object.assign(document.createElement('input'),
    { type: 'email', required: true, placeholder: 'البريد الإلكتروني' });
  const password = Object.assign(document.createElement('input'),
    { type: 'password', required: true, minLength: 8, placeholder: 'كلمة السر (٨ خانات على الأقل)' });
  email.style.cssText = field;
  password.style.cssText = field;

  const run = (mode) => async (ev) => {
    ev?.preventDefault();
    card.querySelectorAll('.app-notice').forEach((p) => p.remove());
    if (!email.value.trim() || password.value.length < 8) {
      return notice(card, 'اكتب بريد صحيح وكلمة سر ٨ خانات على الأقل.');
    }

    const creds = { email: email.value.trim(), password: password.value };
    const { error } = mode === 'in'
      ? await supabase.auth.signInWithPassword(creds)
      : await supabase.auth.signUp(creds);

    if (error) return notice(card, error.message);
    if (mode === 'up') {
      return notice(card, 'تم إنشاء الحساب. إذا طُلب تأكيد البريد، افتح الرابط المُرسل لك.', true);
    }
    wrap.remove();
  };

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:10px;margin-top:4px';
  const signIn = btn('دخول', () => {}, true);
  signIn.type = 'submit';
  actions.append(signIn, btn('حساب جديد', run('up')));

  form.onsubmit = run('in');
  form.append(email, password, actions);
  card.append(form);
}

/* ------------------------------------------------------------------ *
 * Checkout — plans, payment channels, and the transfer claim
 * ------------------------------------------------------------------ */

async function openCheckout() {
  const { card } = openModal('الاشتراك');

  if (!catalogue) {
    const res = await window.apiFetch('/api/plans');
    catalogue = res.ok ? await res.json() : { plans: [], paymentMethods: [] };
  }
  const { plans, paymentMethods } = catalogue;

  const paid = plans.filter((p) => Number(p.price_usd) > 0);
  if (!paid.length) return notice(card, 'ما في باقات متاحة حالياً. تواصل معنا.');

  let chosenPlan = paid[0];
  let chosenMethod = paymentMethods[0] ?? null;

  /* ---- plans ---- */
  const planWrap = document.createElement('div');
  planWrap.style.cssText = 'display:grid;gap:10px;margin-bottom:16px';
  const paintPlans = () => {
    planWrap.textContent = '';
    for (const p of paid) {
      const on = p.id === chosenPlan.id;
      const item = document.createElement('button');
      item.type = 'button';
      item.onclick = () => { chosenPlan = p; paintPlans(); };
      item.style.cssText = `text-align:right;cursor:pointer;padding:13px;border-radius:12px;
        font:inherit;color:#dcf1f8;background:${on ? 'rgba(0,229,255,.10)' : '#07131b'};
        border:1px solid ${on ? '#00e5ff' : 'rgba(0,229,255,.18)'}`;
      const features = (p.features_ar || []).map((f) => `<li>${f}</li>`).join('');
      item.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
          <b style="font-size:16px">${p.name_ar}</b>
          <b style="color:#00e5ff">$${p.price_usd} / شهر</b>
        </div>
        <div style="opacity:.75;font-size:12.5px;margin-top:4px">${p.description_ar ?? ''}</div>
        <ul style="margin:8px 0 0;padding-inline-start:18px;font-size:12.5px;opacity:.85">${features}</ul>`;
      planWrap.append(item);
    }
  };
  paintPlans();
  card.append(planWrap);

  /* ---- payment channels: whatever the owner configured ---- */
  const payHead = document.createElement('h4');
  payHead.textContent = 'طرق الدفع';
  payHead.style.cssText = 'margin:6px 0 8px;color:#00e5ff;font-size:14px';
  card.append(payHead);

  if (!paymentMethods.length) {
    notice(card, 'ما في طريقة دفع مفعّلة بعد. فعّلها من لوحة الأدمن.');
  } else {
    const methodWrap = document.createElement('div');
    methodWrap.style.cssText = 'display:grid;gap:8px;margin-bottom:14px';
    const paintMethods = () => {
      methodWrap.textContent = '';
      for (const m of paymentMethods) {
        const on = m.id === chosenMethod?.id;
        const item = document.createElement('button');
        item.type = 'button';
        item.onclick = () => { chosenMethod = m; paintMethods(); };
        item.style.cssText = `text-align:right;cursor:pointer;padding:11px;border-radius:10px;
          font:inherit;color:#dcf1f8;background:${on ? 'rgba(0,229,255,.08)' : '#07131b'};
          border:1px solid ${on ? '#00e5ff' : 'rgba(0,229,255,.15)'}`;
        const rows = Object.entries(m.details || {})
          .filter(([, v]) => v && v !== '—')
          .map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:12px">
              <span style="opacity:.6">${k}</span><code style="direction:ltr">${v}</code></div>`)
          .join('');
        item.innerHTML = `<b>${m.label_ar}</b>
          <div style="margin-top:6px;font-size:12.5px">${rows
            || '<span style="opacity:.6">لم تُضف التفاصيل بعد</span>'}</div>
          ${m.instructions_ar
            ? `<div style="margin-top:6px;font-size:12px;opacity:.7">${m.instructions_ar}</div>` : ''}`;
        methodWrap.append(item);
      }
    };
    paintMethods();
    card.append(methodWrap);
  }

  /* ---- the claim ---- */
  const form = document.createElement('form');
  form.style.cssText = 'display:flex;flex-direction:column;gap:9px';

  const reference = Object.assign(document.createElement('input'),
    { required: true, placeholder: 'رقم الحوالة أو هاش العملية (TxID)' });
  reference.style.cssText = `${field};direction:ltr;text-align:left`;
  const note = Object.assign(document.createElement('textarea'),
    { rows: 2, placeholder: 'ملاحظة (اختياري)' });
  note.style.cssText = field;

  const send = btn('أرسل طلب التفعيل', () => {}, true);
  send.type = 'submit';

  form.onsubmit = async (ev) => {
    ev.preventDefault();
    send.disabled = true;
    card.querySelectorAll('.app-notice').forEach((p) => p.remove());

    const res = await window.apiFetch('/api/me/payment-request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        planId: chosenPlan.id,
        paymentMethodId: chosenMethod?.id ?? null,
        amount: chosenPlan.price_usd,
        reference: reference.value.trim(),
        note: note.value.trim(),
      }),
    });
    const data = await res.json().catch(() => null);
    send.disabled = false;

    if (!res.ok) return notice(card, data?.message || 'تعذّر إرسال الطلب.');
    notice(card, 'وصلنا طلبك. رح نفعّل اشتراكك أول ما نأكد التحويل.', true);
    form.remove();
  };

  form.append(reference, note, send);
  card.append(form);
  card.append(span('التفعيل يدوي بعد تأكيد التحويل — عادةً خلال ساعات.',
    'display:block;margin-top:12px;font-size:12px;opacity:.6'));
}

/* Let the page open these without importing the module. */
window.openAuthDialog = openAuthDialog;
window.openCheckout = openCheckout;
