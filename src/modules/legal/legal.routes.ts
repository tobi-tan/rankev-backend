import type { FastifyInstance } from 'fastify';

/**
 * Public legal pages. Apple requires a reachable Privacy Policy URL and (for
 * accounts) Terms/EULA. These are served as simple self-contained HTML so the
 * app can link to `${API_URL}/legal/privacy`. Replace the placeholder company
 * details before public launch.
 */

const APP_NAME = 'Rankev';
const CONTACT_EMAIL = 'support@rankev.example.com';
const UPDATED = '2026-08-08';

function page(title: string, body: string): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · ${APP_NAME}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:0 auto;padding:24px;line-height:1.6;color:#1a1a1a;background:#fff}
  h1{font-size:26px} h2{font-size:19px;margin-top:28px} a{color:#6c5ce7}
  .muted{color:#666;font-size:14px}
</style></head><body>${body}
<p class="muted">Cập nhật: ${UPDATED} · Liên hệ: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</body></html>`;
}

export default async function legalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/legal/privacy', async (_req, reply) => {
    reply.type('text/html').send(
      page(
        'Chính sách quyền riêng tư',
        `<h1>Chính sách quyền riêng tư</h1>
<p>${APP_NAME} tôn trọng quyền riêng tư của bạn. Trang này mô tả dữ liệu chúng tôi thu thập và cách sử dụng.</p>
<h2>Dữ liệu thu thập</h2>
<ul>
  <li>Thông tin tài khoản: email, tên hiển thị, handle.</li>
  <li>Nội dung bạn tạo: bài bình chọn, phiếu bầu, bình luận.</li>
  <li>Dữ liệu kỹ thuật tối thiểu để vận hành dịch vụ.</li>
</ul>
<h2>Cách sử dụng</h2>
<p>Dữ liệu chỉ dùng để cung cấp và cải thiện dịch vụ. Chúng tôi không bán dữ liệu cá nhân.</p>
<h2>Xoá tài khoản &amp; dữ liệu</h2>
<p>Bạn có thể xoá tài khoản bất cứ lúc nào trong ứng dụng (Hồ sơ → Xoá tài khoản). Khi xoá, toàn bộ dữ liệu liên quan sẽ bị xoá vĩnh viễn.</p>
<h2>Liên hệ</h2>
<p>Mọi thắc mắc về quyền riêng tư, liên hệ <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`,
      ),
    );
  });

  app.get('/legal/terms', async (_req, reply) => {
    reply.type('text/html').send(
      page(
        'Điều khoản sử dụng',
        `<h1>Điều khoản sử dụng</h1>
<p>Bằng việc sử dụng ${APP_NAME}, bạn đồng ý với các điều khoản dưới đây.</p>
<h2>Quy tắc nội dung</h2>
<p>Nghiêm cấm nội dung quấy rối, thù ghét, bạo lực, khiêu dâm, spam hoặc vi phạm pháp luật. Chúng tôi áp dụng chính sách <strong>không khoan nhượng</strong> với nội dung lạm dụng.</p>
<h2>Kiểm duyệt</h2>
<p>Người dùng có thể báo cáo nội dung và chặn người dùng khác. Nội dung vi phạm và tài khoản vi phạm có thể bị gỡ/khoá.</p>
<h2>Tài khoản</h2>
<p>Bạn chịu trách nhiệm giữ an toàn tài khoản của mình và cho mọi hoạt động dưới tài khoản đó.</p>
<h2>Liên hệ</h2>
<p>Liên hệ <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`,
      ),
    );
  });
}
