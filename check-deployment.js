#!/usr/bin/env node
// Kiểm tra nhanh sau khi deploy. Node 18+ (dùng global fetch), không cần cài gì.
//
// Cách chạy:
//   API_URL=https://rankev-api.up.railway.app WEB_URL=https://rankev.vercel.app node check-deployment.js
// Hoặc truyền qua tham số:
//   node check-deployment.js https://rankev-api.up.railway.app https://rankev.vercel.app

const API = (process.argv[2] || process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const WEB = (process.argv[3] || process.env.WEB_URL || '').replace(/\/$/, '');

let pass = 0;
let fail = 0;
const ok = (m) => { console.log('  \x1b[32m✅\x1b[0m ' + m); pass++; };
const no = (m) => { console.log('  \x1b[31m❌\x1b[0m ' + m); fail++; };

async function main() {
  console.log(`\nRankev — kiểm tra deploy\n  API: ${API}\n  WEB: ${WEB || '(bỏ qua — không đặt WEB_URL)'}\n`);

  // 1) Health
  try {
    const r = await fetch(`${API}/health`);
    const j = await r.json();
    if (r.ok && j.status === 'ok') ok(`/health → status ok (uptime ${Math.round(j.uptime || 0)}s)`);
    else no(`/health → phản hồi bất thường: ${JSON.stringify(j)}`);
  } catch (e) { no(`/health → không gọi được: ${e.message}`); }

  // 2) Register (tài khoản test ngẫu nhiên → tránh trùng)
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const cred = { handle: `check_${suffix}`, name: 'Deploy Check', email: `check_${suffix}@example.com`, password: 'CheckDeploy123!' };
  let accessToken = null;
  try {
    const r = await fetch(`${API}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cred),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 201 && j.accessToken) { ok('/auth/register → 201 + accessToken'); accessToken = j.accessToken; }
    else no(`/auth/register → ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  } catch (e) { no(`/auth/register → lỗi: ${e.message}`); }

  // 3) Login
  try {
    const r = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cred.email, password: cred.password }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.accessToken) { ok('/auth/login → accessToken'); accessToken = j.accessToken; }
    else no(`/auth/login → ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  } catch (e) { no(`/auth/login → lỗi: ${e.message}`); }

  // 4) Feed (cần token)
  try {
    const r = await fetch(`${API}/feed?limit=5`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
    const j = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(j.items)) ok(`/feed → items[] (${j.items.length} bài)`);
    else no(`/feed → ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  } catch (e) { no(`/feed → lỗi: ${e.message}`); }

  // 5 + 6) Frontend (chỉ khi có WEB_URL)
  if (WEB) {
    try {
      const r = await fetch(WEB);
      const html = await r.text();
      if (r.ok && /<title>[^<]*Rankev/i.test(html)) ok('WEB / → HTML có <title>Rankev');
      else no(`WEB / → không thấy <title>Rankev (status ${r.status})`);
    } catch (e) { no(`WEB / → lỗi: ${e.message}`); }

    try {
      const r = await fetch(`${WEB}/manifest.json`);
      const j = await r.json();
      if (r.ok && j.name === 'Rankev') ok('WEB /manifest.json → JSON hợp lệ (name Rankev)');
      else no(`WEB /manifest.json → bất thường: ${JSON.stringify(j).slice(0, 120)}`);
    } catch (e) { no(`WEB /manifest.json → lỗi: ${e.message}`); }
  }

  console.log(`\nKết quả: \x1b[32m${pass} pass\x1b[0m · ${fail ? `\x1b[31m${fail} fail\x1b[0m` : '0 fail'}\n`);
  process.exit(fail ? 1 : 0);
}

main();
