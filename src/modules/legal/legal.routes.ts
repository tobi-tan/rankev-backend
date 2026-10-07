import type { FastifyInstance } from 'fastify';

/**
 * Trang pháp lý công khai — Điều khoản & cam kết + Chính sách quyền riêng tư.
 * Apple yêu cầu URL quyền riêng tư truy cập được, EULA cho nội dung do người dùng tạo
 * (Guideline 1.2: không khoan nhượng nội dung xấu, báo cáo, chặn, xử lý trong 24 giờ)
 * và xoá tài khoản ngay trong app (5.1.1(v)). App web/iOS nhúng các trang này
 * (`${API_URL}/legal/terms`, `/legal/privacy`) nên đây là NGUỒN DUY NHẤT của nội dung.
 * Thay thông tin công ty / email liên hệ thật trước khi ra mắt.
 */

const APP_NAME = 'Rankev';
const CONTACT_EMAIL = 'support@rankev.example.com';
const UPDATED = '08/10/2026';

function page(title: string, body: string): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · ${APP_NAME}</title>
<style>
  :root{--fg:#1a1a1a;--muted:#666;--bg:#fff;--line:#e6e6e6;--accent:#b8860b}
  @media (prefers-color-scheme: dark){:root{--fg:#ececec;--muted:#9a9a9a;--bg:#121614;--line:#2a302c;--accent:#d4a84a}}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:720px;margin:0 auto;padding:20px 16px 40px;line-height:1.6;color:var(--fg);background:var(--bg);font-size:15px}
  h1{font-size:22px;margin:4px 0 6px} h2{font-size:17px;margin:26px 0 6px;padding-top:14px;border-top:1px solid var(--line)}
  a{color:var(--accent)} li{margin:4px 0} .muted{color:var(--muted);font-size:13px}
  .box{border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:12px 0}
</style></head><body>${body}
<p class="muted">Cập nhật: ${UPDATED} · Liên hệ: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</body></html>`;
}

const TERMS = `<h1>Điều khoản &amp; cam kết</h1>
<p class="muted">Bằng việc tạo tài khoản hoặc sử dụng ${APP_NAME}, bạn đồng ý với các điều khoản dưới đây và <a href="/legal/privacy">Chính sách quyền riêng tư</a>.</p>
<div class="box"><b>Tóm tắt nhanh</b>
<ul>
  <li>Bạn từ đủ 13 tuổi (dưới 18 tuổi cần có sự đồng ý của cha mẹ/người giám hộ).</li>
  <li>Nội dung bạn đăng là của bạn — bạn chịu trách nhiệm về nó.</li>
  <li><b>Không khoan nhượng</b> với nội dung xấu và người dùng lạm dụng.</li>
  <li>Bạn có thể báo cáo, chặn, ẩn nội dung bất cứ lúc nào; báo cáo được xem xét trong 24 giờ.</li>
  <li>Bạn có thể xoá tài khoản ngay trong ứng dụng.</li>
</ul></div>

<h2>1. Tài khoản</h2>
<ul>
  <li>Bạn phải từ đủ 13 tuổi. Nếu dưới 18 tuổi, bạn cần cha mẹ/người giám hộ đồng ý.</li>
  <li>Thông tin đăng ký phải trung thực; không mạo danh cá nhân, tổ chức hay thương hiệu khác.</li>
  <li>Bạn chịu trách nhiệm giữ an toàn mật khẩu và mọi hoạt động dưới tài khoản của mình.</li>
  <li>Mỗi người chỉ dùng tài khoản để bình chọn một cách trung thực; không tạo tài khoản ảo, không dùng bot hay công cụ tự động để thổi phồng lượt bình chọn, RankUp, lượt theo dõi.</li>
</ul>

<h2>2. Nội dung của bạn</h2>
<ul>
  <li>Bạn giữ quyền sở hữu với Rankie, Path, Survey, Exam, giải đấu, bình luận, tin nhắn, ảnh và video bạn tạo.</li>
  <li>Khi đăng công khai, bạn cấp cho ${APP_NAME} quyền không độc quyền, miễn phí, trên toàn thế giới để lưu trữ, hiển thị, phân phối và quảng bá nội dung đó trong phạm vi vận hành dịch vụ. Quyền này chấm dứt khi bạn xoá nội dung hoặc tài khoản (trừ bản sao đã được người khác chia sẻ hoặc lưu theo luật).</li>
  <li>Bạn cam kết có đủ quyền với hình ảnh, video, nhạc, nhãn hiệu trong nội dung của mình và không vi phạm bản quyền, quyền riêng tư hay quyền hình ảnh của người khác.</li>
  <li>Kết quả bình chọn phản ánh ý kiến người dùng, không phải quan điểm của ${APP_NAME}.</li>
</ul>

<h2>3. Quy tắc cộng đồng — không khoan nhượng</h2>
<p>Nghiêm cấm đăng, gửi hoặc tổ chức bình chọn về:</p>
<ul>
  <li>Quấy rối, bắt nạt, đe doạ, xúc phạm, kỳ thị hoặc kích động thù ghét dựa trên chủng tộc, dân tộc, tôn giáo, giới tính, xu hướng tính dục, khuyết tật…</li>
  <li>Bạo lực, khủng bố, tự gây hại, nội dung gây sốc.</li>
  <li>Nội dung khiêu dâm, tình dục; <b>mọi nội dung tình dục liên quan trẻ vị thành niên</b> (sẽ bị gỡ và báo cáo cơ quan chức năng).</li>
  <li>Bình chọn, xếp hạng nhằm hạ nhục, “bóc phốt” hoặc làm lộ thông tin cá nhân (doxxing) của một người cụ thể.</li>
  <li>Thông tin sai lệch gây hại, lừa đảo, spam, quảng cáo trái phép, mua bán hàng cấm.</li>
  <li>Nội dung vi phạm pháp luật Việt Nam hoặc nơi bạn sinh sống.</li>
</ul>

<h2>4. Báo cáo, chặn &amp; kiểm duyệt</h2>
<ul>
  <li>Mọi bài viết, bình luận, tin nhắn, hồ sơ đều có nút <b>Báo cáo</b>. Bạn có thể <b>Chặn</b> hoặc <b>Tắt thông báo</b> một người bất cứ lúc nào; người bị chặn không xem được bài, không bình luận, không nhắn tin cho bạn.</li>
  <li>Đội ngũ ${APP_NAME} xem xét báo cáo <b>trong vòng 24 giờ</b>; nội dung vi phạm bị gỡ và tài khoản vi phạm có thể bị cảnh cáo, hạn chế hoặc khoá vĩnh viễn.</li>
  <li>${APP_NAME} có thể lọc tự động và gỡ nội dung vi phạm mà không cần báo trước. Nếu cho rằng bị xử lý nhầm, bạn có thể khiếu nại qua email bên dưới.</li>
</ul>

<h2>5. Bình chọn, trình chiếu &amp; giải đấu</h2>
<ul>
  <li>Mỗi người một phiếu cho mỗi câu hỏi/trận (trừ khi người tạo cho phép chọn nhiều). Gian lận phiếu sẽ bị loại khỏi kết quả.</li>
  <li>Người tạo phiên trình chiếu chịu trách nhiệm về nội dung trình chiếu và người tham gia của phiên đó.</li>
  <li>Điểm Exam chỉ mang tính giải trí/tham khảo, không có giá trị chứng nhận.</li>
</ul>

<h2>6. Quyền sở hữu trí tuệ của ${APP_NAME}</h2>
<p>Tên, logo, giao diện, mã nguồn của ${APP_NAME} thuộc về chúng tôi. Không sao chép, dịch ngược, thu thập dữ liệu tự động (scraping) hoặc dùng cho mục đích thương mại khi chưa được đồng ý bằng văn bản.</p>
<p>Nếu bạn cho rằng nội dung trên ${APP_NAME} vi phạm bản quyền của mình, gửi thông báo kèm bằng chứng tới email bên dưới; chúng tôi sẽ xử lý nhanh chóng.</p>

<h2>7. Xoá tài khoản &amp; chấm dứt</h2>
<ul>
  <li>Bạn có thể xoá tài khoản ngay trong ứng dụng: <b>Hồ sơ → ⚙ Cài đặt → Xoá tài khoản</b>. Dữ liệu sẽ bị xoá vĩnh viễn, trừ phần pháp luật yêu cầu lưu giữ.</li>
  <li>Chúng tôi có thể tạm khoá hoặc chấm dứt tài khoản vi phạm điều khoản này.</li>
</ul>

<h2>8. Giới hạn trách nhiệm</h2>
<p>Dịch vụ được cung cấp “nguyên trạng”. Trong phạm vi pháp luật cho phép, ${APP_NAME} không chịu trách nhiệm về nội dung do người dùng tạo, gián đoạn dịch vụ hoặc thiệt hại gián tiếp phát sinh từ việc sử dụng ứng dụng.</p>

<h2>9. Mua trong ứng dụng</h2>
<p>Nếu ${APP_NAME} cung cấp tính năng trả phí, việc thanh toán, gia hạn và hoàn tiền tuân theo chính sách của Apple App Store / Google Play.</p>

<h2>10. Thay đổi điều khoản</h2>
<p>Khi điều khoản thay đổi quan trọng, chúng tôi sẽ thông báo trong ứng dụng. Tiếp tục sử dụng sau thông báo nghĩa là bạn đồng ý với bản mới.</p>

<h2>11. Luật áp dụng</h2>
<p>Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Tranh chấp được ưu tiên giải quyết bằng thương lượng.</p>

<h2>12. Điều khoản với Apple</h2>
<p>Điều khoản này là thoả thuận giữa bạn và ${APP_NAME}, không phải với Apple. Apple không chịu trách nhiệm về ứng dụng hay nội dung của nó, không có nghĩa vụ bảo trì/hỗ trợ, và là bên thụ hưởng thứ ba của điều khoản này, có quyền thực thi điều khoản với bạn.</p>`;

const PRIVACY = `<h1>Chính sách quyền riêng tư</h1>
<p class="muted">${APP_NAME} tôn trọng quyền riêng tư của bạn và tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. Trang này giải thích dữ liệu chúng tôi thu thập, lý do và quyền của bạn.</p>
<div class="box"><b>Tóm tắt nhanh</b>
<ul>
  <li>Chúng tôi <b>không bán</b> dữ liệu cá nhân của bạn.</li>
  <li>Thông tin nhân khẩu học (tuổi, giới tính, nghề) bạn đặt <b>Ẩn</b> sẽ không hiện trên hồ sơ — chỉ dùng ẩn danh, gộp chung cho thống kê.</li>
  <li>Không theo dõi bạn qua ứng dụng/trang web của bên khác để quảng cáo.</li>
  <li>Bạn có thể tải, sửa, xoá dữ liệu và xoá tài khoản bất cứ lúc nào.</li>
</ul></div>

<h2>1. Dữ liệu chúng tôi thu thập</h2>
<ul>
  <li><b>Tài khoản:</b> email, tên hiển thị, @handle, ảnh đại diện, mật khẩu (đã mã hoá) hoặc định danh đăng nhập Google/Facebook/Apple.</li>
  <li><b>Hồ sơ tuỳ chọn:</b> ngày sinh, giới tính, nghề nghiệp, tiểu sử — kèm thiết lập Ẩn/Công khai cho từng mục.</li>
  <li><b>Nội dung:</b> bài viết, lựa chọn bình chọn, câu trả lời Survey/Exam, bình luận, tin nhắn, ảnh/video tải lên, mục đã lưu.</li>
  <li><b>Tương tác:</b> theo dõi, RankUp, chặn, báo cáo, lượt xem.</li>
  <li><b>Kỹ thuật tối thiểu:</b> loại thiết bị, phiên bản ứng dụng, nhật ký lỗi, địa chỉ IP (chống gian lận, bảo mật).</li>
</ul>
<p>Chúng tôi không thu thập danh bạ, vị trí chính xác, dữ liệu sức khoẻ hay tài chính.</p>

<h2>2. Mục đích sử dụng</h2>
<ul>
  <li>Cung cấp dịch vụ: hiển thị bảng tin, đếm phiếu, chấm điểm Exam, gửi thông báo.</li>
  <li>Thống kê kết quả theo nhóm (ví dụ “% người 18–24 tuổi chọn A”) — luôn <b>gộp và ẩn danh</b>.</li>
  <li>An toàn cộng đồng: phát hiện spam, phiếu gian lận, xử lý báo cáo.</li>
  <li>Cải thiện sản phẩm dựa trên số liệu tổng hợp.</li>
</ul>

<h2>3. Ai thấy dữ liệu của bạn</h2>
<ul>
  <li><b>Công khai:</b> tên, @handle, ảnh đại diện, tiểu sử, bài viết công khai, bình luận, các mục nhân khẩu học bạn đặt Công khai.</li>
  <li><b>Theo link / Chỉ mình tôi:</b> bài đặt “Theo link” không hiện trên bảng tin; bài “Chỉ mình tôi” chỉ bạn xem được.</li>
  <li><b>Người tạo bài:</b> thấy kết quả tổng hợp; với Survey/Exam có thể thấy câu trả lời gắn tên nếu bạn tham gia phiên trình chiếu của họ.</li>
  <li><b>Nhà cung cấp dịch vụ</b> (máy chủ, lưu trữ ảnh/video, gửi email) — chỉ xử lý theo chỉ dẫn của chúng tôi.</li>
  <li><b>Cơ quan nhà nước</b> khi có yêu cầu hợp pháp.</li>
</ul>

<h2>4. Lưu trữ &amp; bảo mật</h2>
<p>Dữ liệu được mã hoá khi truyền (HTTPS), mật khẩu được băm. Dữ liệu được lưu trong thời gian tài khoản còn hoạt động; nhật ký kỹ thuật tối đa 90 ngày.</p>

<h2>5. Quyền của bạn</h2>
<ul>
  <li>Xem, sửa thông tin hồ sơ và đổi Ẩn/Công khai trong <b>Hồ sơ → ⚙ Cài đặt</b>.</li>
  <li>Xoá từng bài, bình luận, tin nhắn của mình.</li>
  <li><b>Xoá tài khoản</b> ngay trong ứng dụng: Hồ sơ → ⚙ Cài đặt → Xoá tài khoản. Toàn bộ dữ liệu cá nhân bị xoá vĩnh viễn trong tối đa 30 ngày.</li>
  <li>Yêu cầu bản sao dữ liệu hoặc rút lại đồng ý qua email bên dưới.</li>
</ul>

<h2>6. Trẻ em</h2>
<p>${APP_NAME} không dành cho người dưới 13 tuổi. Nếu phát hiện tài khoản của trẻ dưới 13 tuổi, chúng tôi sẽ xoá tài khoản đó.</p>

<h2>7. Thay đổi chính sách</h2>
<p>Khi có thay đổi quan trọng, chúng tôi sẽ thông báo trong ứng dụng trước khi áp dụng.</p>`;

export default async function legalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/legal/privacy', async (_req, reply) => {
    reply.type('text/html').send(page('Chính sách quyền riêng tư', PRIVACY));
  });

  app.get('/legal/terms', async (_req, reply) => {
    reply.type('text/html').send(page('Điều khoản & cam kết', TERMS));
  });
}
