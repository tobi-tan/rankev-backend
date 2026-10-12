import type { FastifyInstance } from 'fastify';
import { env } from '../../env';
import { APP_NAME, LEGAL_DOCS, UPDATED, legalDoc } from './content';

/**
 * TRUNG TÂM CHÍNH SÁCH công khai (như Facebook/TikTok): /legal (mục lục) và /legal/<slug>.
 * Apple yêu cầu URL quyền riêng tư truy cập được + EULA cho nội dung người dùng tạo (1.2) +
 * xoá tài khoản trong app (5.1.1(v)); Google Play cần URL Tiêu chuẩn an toàn trẻ em (CSAE) và
 * URL yêu cầu xoá tài khoản. App web/iOS/Android đọc phần <body> của các trang này
 * (nguồn DUY NHẤT); `GET /legal/docs` trả danh sách để app dựng mục lục.
 * Nội dung: ./content.ts
 */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function page(title: string, body: string, current: string | null): string {
  const email = env.SUPPORT_EMAIL;
  const nav = LEGAL_DOCS.map((d) => (d.slug === current ? `<b>${esc(d.title)}</b>` : `<a href="/legal/${d.slug}">${esc(d.title)}</a>`)).join(' · ');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${APP_NAME}</title>
<style>
  :root{--fg:#1a1a1a;--muted:#666;--bg:#fff;--line:#e6e6e6;--accent:#b8860b}
  @media (prefers-color-scheme: dark){:root{--fg:#ececec;--muted:#9a9a9a;--bg:#121614;--line:#2a302c;--accent:#d4a84a}}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:720px;margin:0 auto;padding:20px 16px 40px;line-height:1.6;color:var(--fg);background:var(--bg);font-size:15px}
  h1{font-size:22px;margin:4px 0 6px} h2{font-size:17px;margin:26px 0 6px;padding-top:14px;border-top:1px solid var(--line)}
  a{color:var(--accent)} li{margin:4px 0} .muted{color:var(--muted);font-size:13px}
  .box{border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:12px 0}
  .doclist a{display:block;padding:12px 0;border-bottom:1px solid var(--line);text-decoration:none;color:var(--fg)}
  .doclist small{display:block;color:var(--muted)}
  nav.legal-nav{font-size:13px;color:var(--muted);margin-top:28px;padding-top:12px;border-top:1px solid var(--line)}
</style></head><body>${body}
<nav class="legal-nav">${nav}</nav>
<p class="muted">Cập nhật: ${UPDATED} · Liên hệ: <a href="mailto:${email}">${email}</a></p>
</body></html>`;
}

function hub(): string {
  const items = LEGAL_DOCS.map((d) => `<a href="/legal/${d.slug}">${esc(d.title)}<small>${esc(d.summary)}</small></a>`).join('');
  return `<h1>Trung tâm chính sách ${APP_NAME}</h1>
<p class="muted">Những cam kết của chúng tôi với bạn và các quy tắc chung để ${APP_NAME} an toàn, tôn trọng và trung thực.</p>
<div class="box"><b>Cam kết của ${APP_NAME}</b>
<ul>
  <li>Không bán dữ liệu cá nhân, không quảng cáo theo dõi bạn.</li>
  <li>Xem xét mọi báo cáo trong 24 giờ; không khoan nhượng với nội dung xâm hại trẻ em.</li>
  <li>Bạn tải được dữ liệu của mình và xoá tài khoản ngay trong ứng dụng.</li>
  <li>Thông báo trước khi thay đổi điều khoản quan trọng; luôn có kênh kháng nghị.</li>
</ul></div>
<div class="doclist">${items}</div>`;
}

export default async function legalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/legal', async (_req, reply) => {
    reply.type('text/html').send(page('Trung tâm chính sách', hub(), null));
  });

  // Danh sách văn bản (app dựng mục lục)
  app.get('/legal/docs', async () => ({
    updated: UPDATED,
    items: LEGAL_DOCS.map((d) => ({ slug: d.slug, title: d.title, summary: d.summary })),
  }));

  app.get<{ Params: { slug: string } }>('/legal/:slug', async (req, reply) => {
    const d = legalDoc(req.params.slug);
    if (!d) return reply.code(404).type('text/html').send(page('Không tìm thấy', '<h1>Không tìm thấy trang</h1><p><a href="/legal">Về Trung tâm chính sách</a></p>', null));
    reply.type('text/html').send(page(d.title, d.body({ email: env.SUPPORT_EMAIL }), d.slug));
  });
}
