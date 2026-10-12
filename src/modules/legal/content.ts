/**
 * NỘI DUNG PHÁP LÝ của Rankev — nguồn DUY NHẤT (web, app iOS/Android và URL khai báo với
 * App Store / Google Play đều đọc từ đây). Văn bản dựng theo cách các mạng xã hội lớn tổ chức
 * (Điều khoản · Quyền riêng tư · Tiêu chuẩn cộng đồng · Bản quyền · An toàn trẻ em · Cookie ·
 * Xoá tài khoản) và theo yêu cầu của Apple (1.2, 5.1.1) / Google Play (UGC, CSAE, Data deletion).
 *
 * ⚠ Trước khi ra mắt: đặt SUPPORT_EMAIL (Render env) thành email thật và nhờ luật sư rà soát
 * (đặc biệt Nghị định 147/2024/NĐ-CP về mạng xã hội và Luật Bảo vệ dữ liệu cá nhân 2025).
 */
export const APP_NAME = 'Rankev';
export const UPDATED = '12/10/2026';

export interface LegalDoc {
  slug: string;
  title: string;
  summary: string;
  body: (ctx: { email: string }) => string;
}

const A = APP_NAME;

// ---------------------------------------------------------------------------------------------
const TERMS: LegalDoc = {
  slug: 'terms',
  title: 'Điều khoản sử dụng',
  summary: 'Thoả thuận giữa bạn và Rankev khi dùng ứng dụng.',
  body: ({ email }) => `<h1>Điều khoản sử dụng</h1>
<p class="muted">Bằng việc tạo tài khoản hoặc sử dụng ${A}, bạn đồng ý với Điều khoản này, <a href="/legal/community">Tiêu chuẩn cộng đồng</a> và <a href="/legal/privacy">Chính sách quyền riêng tư</a>.</p>
<div class="box"><b>Tóm tắt nhanh</b>
<ul>
  <li>Bạn từ đủ 13 tuổi; dưới 16 tuổi cần cha mẹ/người giám hộ đồng ý.</li>
  <li>Nội dung bạn đăng là của bạn — bạn chịu trách nhiệm về nó.</li>
  <li><b>Không khoan nhượng</b> với nội dung xấu và người dùng lạm dụng.</li>
  <li>Bạn có thể báo cáo, chặn, ẩn nội dung bất cứ lúc nào; báo cáo được xem xét trong 24 giờ.</li>
  <li>Bạn có thể tải dữ liệu của mình và xoá tài khoản ngay trong ứng dụng.</li>
</ul></div>

<h2>1. Dịch vụ của chúng tôi</h2>
<p>${A} là mạng xã hội bình chọn và xếp hạng: bạn tạo và tham gia Rankie (bình chọn), Path (trắc nghiệm tính cách), Survey/Exam, giải đấu và series; bình luận, nhắn tin, trình chiếu trực tiếp. Chúng tôi có thể thêm, thay đổi hoặc ngừng tính năng để cải thiện dịch vụ.</p>

<h2>2. Tài khoản</h2>
<ul>
  <li>Bạn phải từ đủ 13 tuổi. Nếu dưới 16 tuổi, cha mẹ/người giám hộ cần đồng ý và giám sát việc sử dụng; dưới 18 tuổi một số tính năng có thể bị giới hạn.</li>
  <li>Thông tin đăng ký phải trung thực; không mạo danh cá nhân, tổ chức hay thương hiệu khác.</li>
  <li>Bạn chịu trách nhiệm giữ an toàn mật khẩu và mọi hoạt động dưới tài khoản của mình; báo ngay cho chúng tôi nếu tài khoản bị xâm nhập.</li>
  <li>Không tạo tài khoản ảo, không mua bán/chuyển nhượng tài khoản, không dùng bot hay công cụ tự động để thổi phồng lượt bình chọn, RankUp, lượt theo dõi.</li>
</ul>

<h2>3. Nội dung của bạn</h2>
<ul>
  <li>Bạn giữ quyền sở hữu với bài viết, bình luận, tin nhắn, ảnh và video bạn tạo.</li>
  <li>Khi đăng công khai, bạn cấp cho ${A} quyền không độc quyền, miễn phí, có thể cấp phép lại cho nhà cung cấp hạ tầng, trên toàn thế giới để lưu trữ, hiển thị, phân phối và giới thiệu nội dung đó <b>chỉ trong phạm vi vận hành dịch vụ</b>. Quyền này chấm dứt khi bạn xoá nội dung hoặc tài khoản (trừ bản người khác đã chia sẻ, hoặc phần pháp luật yêu cầu lưu giữ).</li>
  <li>Bạn cam kết có đủ quyền với hình ảnh, video, nhạc, nhãn hiệu trong nội dung của mình và không vi phạm bản quyền, quyền riêng tư hay quyền hình ảnh của người khác (xem <a href="/legal/copyright">Bản quyền</a>).</li>
  <li>Kết quả bình chọn phản ánh ý kiến người tham gia, không phải quan điểm của ${A} và không phải khảo sát khoa học.</li>
</ul>

<h2>4. Quy tắc ứng xử</h2>
<p>Bạn phải tuân thủ <a href="/legal/community">Tiêu chuẩn cộng đồng</a>. Tóm lại, nghiêm cấm: quấy rối, bắt nạt, thù ghét; bạo lực, tự gây hại; nội dung tình dục, <b>mọi nội dung tình dục hoá trẻ em</b> (xem <a href="/legal/child-safety">An toàn trẻ em</a>); xếp hạng hạ nhục hoặc làm lộ thông tin cá nhân của người thật; lừa đảo, spam, gian lận phiếu; nội dung vi phạm pháp luật Việt Nam hoặc nơi bạn sinh sống.</p>
<p>Không can thiệp kỹ thuật vào dịch vụ: không dò quét lỗ hổng trái phép, không thu thập dữ liệu tự động (scraping), không vượt rào giới hạn tốc độ, không phát tán mã độc.</p>

<h2>5. Báo cáo, kiểm duyệt &amp; thực thi</h2>
<ul>
  <li>Mọi bài viết, bình luận, tin nhắn, hồ sơ đều có nút <b>Báo cáo</b>. Bạn có thể <b>Chặn</b>, <b>Tắt thông báo</b> hoặc <b>Ẩn</b> bất cứ lúc nào.</li>
  <li>Đội ngũ ${A} xem xét báo cáo <b>trong vòng 24 giờ</b>. Tuỳ mức độ, chúng tôi có thể gỡ nội dung, hạn chế tính năng hoặc <b>khoá tài khoản</b>; vi phạm nghiêm trọng (an toàn trẻ em, đe doạ bạo lực, lừa đảo) bị khoá ngay và có thể được chuyển cơ quan chức năng.</li>
  <li>Người báo cáo được thông báo kết quả xử lý trong ứng dụng.</li>
  <li>Nếu cho rằng bị xử lý nhầm, bạn có thể <b>kháng nghị</b> trong 30 ngày qua <a href="mailto:${email}">${email}</a>; chúng tôi phản hồi trong 7 ngày làm việc.</li>
</ul>

<h2>6. Bình chọn, giải đấu &amp; trình chiếu</h2>
<ul>
  <li>Mỗi người một phiếu cho mỗi câu hỏi/trận (trừ khi người tạo cho phép chọn nhiều hoặc không giới hạn). Phiếu gian lận bị loại khỏi kết quả.</li>
  <li>Người tạo giải đấu chịu trách nhiệm về lịch thi đấu và cách xác định người thắng họ đã chọn.</li>
  <li>Người tạo phiên trình chiếu chịu trách nhiệm về nội dung trình chiếu và người tham gia của phiên đó.</li>
  <li>Điểm Exam chỉ mang tính giải trí/tham khảo; điểm chính thức là lần làm đầu tiên, các lần sau là luyện tập.</li>
</ul>

<h2>7. Quyền sở hữu trí tuệ của ${A}</h2>
<p>Tên, logo, giao diện, mã nguồn của ${A} thuộc về chúng tôi. Không sao chép, dịch ngược hoặc dùng cho mục đích thương mại khi chưa được đồng ý bằng văn bản.</p>

<h2>8. Dữ liệu của bạn</h2>
<p>Cách chúng tôi thu thập và dùng dữ liệu được nêu trong <a href="/legal/privacy">Chính sách quyền riêng tư</a>. Bạn có thể <b>tải bản sao dữ liệu</b> (Hồ sơ → ⚙ Cài đặt → Tải thông tin của bạn) và <b>xoá tài khoản</b> bất cứ lúc nào (xem <a href="/legal/delete-account">Xoá tài khoản</a>).</p>

<h2>9. Chấm dứt</h2>
<ul>
  <li>Bạn có thể ngừng sử dụng và xoá tài khoản bất cứ lúc nào.</li>
  <li>Chúng tôi có thể tạm khoá hoặc chấm dứt tài khoản vi phạm Điều khoản/Tiêu chuẩn cộng đồng, hoặc khi pháp luật yêu cầu.</li>
</ul>

<h2>10. Giới hạn trách nhiệm</h2>
<p>Dịch vụ được cung cấp “nguyên trạng”. Trong phạm vi pháp luật cho phép, ${A} không chịu trách nhiệm về nội dung do người dùng tạo, gián đoạn dịch vụ hoặc thiệt hại gián tiếp phát sinh từ việc sử dụng ứng dụng. Không điều khoản nào loại trừ quyền của người tiêu dùng mà pháp luật không cho phép loại trừ.</p>

<h2>11. Mua trong ứng dụng</h2>
<p>Hiện ${A} miễn phí. Nếu sau này có tính năng trả phí, việc thanh toán, gia hạn và hoàn tiền tuân theo chính sách của Apple App Store / Google Play.</p>

<h2>12. Thay đổi điều khoản</h2>
<p>Khi Điều khoản thay đổi quan trọng, chúng tôi thông báo trong ứng dụng ít nhất 7 ngày trước khi áp dụng. Tiếp tục sử dụng sau ngày áp dụng nghĩa là bạn đồng ý với bản mới.</p>

<h2>13. Luật áp dụng</h2>
<p>Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Tranh chấp được ưu tiên giải quyết bằng thương lượng; nếu không thành, đưa ra Toà án có thẩm quyền tại Việt Nam.</p>

<h2>14. Điều khoản với Apple</h2>
<p>Điều khoản này là thoả thuận giữa bạn và ${A}, không phải với Apple. Apple không chịu trách nhiệm về ứng dụng hay nội dung của nó, không có nghĩa vụ bảo trì/hỗ trợ, và là bên thụ hưởng thứ ba của điều khoản này, có quyền thực thi điều khoản với bạn.</p>`,
};

// ---------------------------------------------------------------------------------------------
const PRIVACY: LegalDoc = {
  slug: 'privacy',
  title: 'Chính sách quyền riêng tư',
  summary: 'Dữ liệu chúng tôi thu thập, lý do, ai thấy và quyền của bạn.',
  body: ({ email }) => `<h1>Chính sách quyền riêng tư</h1>
<p class="muted">${A} tôn trọng quyền riêng tư của bạn và tuân thủ Luật Bảo vệ dữ liệu cá nhân, Nghị định 13/2023/NĐ-CP và các quy định liên quan. Trang này giải thích dữ liệu chúng tôi thu thập, lý do, ai thấy và quyền của bạn.</p>
<div class="box"><b>Cam kết của chúng tôi</b>
<ul>
  <li>Chúng tôi <b>không bán</b> dữ liệu cá nhân của bạn và không chia sẻ để quảng cáo.</li>
  <li>Không theo dõi bạn qua ứng dụng/trang web của bên khác.</li>
  <li>Thông tin nhân khẩu học bạn đặt <b>Ẩn</b> không hiện trên hồ sơ — chỉ dùng ẩn danh, gộp chung cho thống kê.</li>
  <li>Bạn có thể <b>tải bản sao</b>, sửa và <b>xoá</b> dữ liệu ngay trong ứng dụng.</li>
</ul></div>

<h2>1. Dữ liệu chúng tôi thu thập</h2>
<ul>
  <li><b>Tài khoản:</b> email, tên hiển thị, @handle, ảnh đại diện, mật khẩu (đã băm, chúng tôi không đọc được) hoặc định danh đăng nhập Google/Facebook/Apple.</li>
  <li><b>Hồ sơ tuỳ chọn:</b> ngày sinh, giới tính, nghề nghiệp, tiểu sử — kèm thiết lập Ẩn/Công khai cho từng mục.</li>
  <li><b>Nội dung:</b> bài viết, lựa chọn bình chọn, câu trả lời Path/Survey/Exam, bình luận, tin nhắn, ảnh/video tải lên, mục đã lưu.</li>
  <li><b>Tương tác:</b> theo dõi/RankUp, chặn, tắt thông báo, ẩn bài, báo cáo, lượt xem.</li>
  <li><b>Kỹ thuật tối thiểu:</b> loại thiết bị, phiên bản ứng dụng, nhật ký lỗi, địa chỉ IP (bảo mật, chống gian lận).</li>
</ul>
<p>Chúng tôi <b>không</b> thu thập danh bạ, vị trí chính xác, dữ liệu sức khoẻ, sinh trắc học hay tài chính. Ứng dụng chỉ xin quyền ảnh/camera khi bạn chủ động chọn ảnh để đăng.</p>

<h2>2. Mục đích &amp; cơ sở xử lý</h2>
<ul>
  <li><b>Cung cấp dịch vụ</b> (thực hiện hợp đồng): hiển thị bảng tin, đếm phiếu, chấm điểm, gửi tin nhắn và thông báo, đặt lại mật khẩu.</li>
  <li><b>Thống kê theo nhóm</b> (sự đồng ý của bạn khi điền nhân khẩu học): ví dụ “% người 18–24 tuổi chọn A” — luôn <b>gộp và ẩn danh</b>, không hiện từng người.</li>
  <li><b>An toàn cộng đồng</b> (lợi ích chính đáng/nghĩa vụ pháp lý): phát hiện spam, phiếu gian lận, xử lý báo cáo, bảo vệ trẻ em.</li>
  <li><b>Cải thiện sản phẩm</b> dựa trên số liệu tổng hợp.</li>
</ul>
<p>Chúng tôi không dùng dữ liệu của bạn để ra quyết định tự động gây ảnh hưởng pháp lý đến bạn, và không dùng để huấn luyện mô hình AI của bên thứ ba.</p>

<h2>3. Ai thấy dữ liệu của bạn</h2>
<ul>
  <li><b>Công khai:</b> tên, @handle, ảnh đại diện, tiểu sử, bài viết công khai, bình luận, các mục nhân khẩu học bạn đặt Công khai.</li>
  <li><b>Theo link / Chỉ mình tôi:</b> bài “Theo link” không hiện trên bảng tin; bài “Chỉ mình tôi” chỉ bạn xem được.</li>
  <li><b>Người tạo bài:</b> thấy kết quả tổng hợp; trong phiên trình chiếu của họ có thể thấy câu trả lời kèm tên bạn nhập khi tham gia.</li>
  <li><b>Tin nhắn:</b> chỉ người trong cuộc trò chuyện thấy. Chúng tôi chỉ xem tin nhắn khi có báo cáo vi phạm hoặc yêu cầu pháp lý.</li>
  <li><b>Nhà cung cấp hạ tầng</b> (xử lý theo chỉ dẫn của chúng tôi, có thể đặt máy chủ ngoài Việt Nam): Render (máy chủ ứng dụng), Neon (cơ sở dữ liệu), Cloudinary (lưu ảnh/video), Vercel (trang web), Resend (gửi email), Google/Facebook/Apple (khi bạn chọn đăng nhập bằng họ).</li>
  <li><b>Cơ quan nhà nước</b> khi có yêu cầu hợp pháp, hoặc khi cần bảo vệ tính mạng, an toàn của người dùng.</li>
</ul>

<h2>4. Chuyển dữ liệu ra nước ngoài</h2>
<p>Một số nhà cung cấp hạ tầng nêu trên đặt máy chủ ngoài Việt Nam (ví dụ Hoa Kỳ). Khi sử dụng ${A}, bạn đồng ý cho việc chuyển dữ liệu này nhằm vận hành dịch vụ; chúng tôi lập hồ sơ đánh giá tác động chuyển dữ liệu theo quy định và chỉ chọn nhà cung cấp có cam kết bảo mật tương đương.</p>

<h2>5. Lưu trữ &amp; bảo mật</h2>
<ul>
  <li>Dữ liệu được mã hoá khi truyền (HTTPS/TLS); mật khẩu và mã đặt lại mật khẩu chỉ lưu dạng băm.</li>
  <li>Dữ liệu được lưu khi tài khoản còn hoạt động. Khi bạn xoá tài khoản, dữ liệu cá nhân bị xoá trong tối đa 30 ngày (kể cả bản sao lưu); nhật ký kỹ thuật tối đa 90 ngày.</li>
  <li>Nếu xảy ra sự cố lộ lọt dữ liệu, chúng tôi thông báo cho cơ quan có thẩm quyền trong 72 giờ và cho người dùng bị ảnh hưởng theo quy định.</li>
</ul>

<h2>6. Quyền của bạn</h2>
<ul>
  <li><b>Xem &amp; sửa</b> hồ sơ, đổi Ẩn/Công khai: Hồ sơ → ⚙ Cài đặt.</li>
  <li><b>Tải bản sao dữ liệu</b> (file JSON): Hồ sơ → ⚙ Cài đặt → <b>Tải thông tin của bạn</b>.</li>
  <li><b>Xoá</b> từng bài, bình luận, tin nhắn; <b>xoá tài khoản</b> vĩnh viễn ngay trong ứng dụng (xem <a href="/legal/delete-account">Xoá tài khoản</a>).</li>
  <li><b>Rút lại đồng ý, phản đối hoặc hạn chế xử lý, khiếu nại:</b> gửi email tới <a href="mailto:${email}">${email}</a>; chúng tôi phản hồi trong tối đa 72 giờ và giải quyết trong thời hạn luật định. Bạn cũng có quyền khiếu nại tới cơ quan bảo vệ dữ liệu cá nhân (Bộ Công an).</li>
</ul>

<h2>7. Trẻ em</h2>
<p>${A} không dành cho người dưới 13 tuổi; người từ 13 đến dưới 16 tuổi cần cha mẹ/người giám hộ đồng ý. Nếu phát hiện tài khoản của trẻ dưới 13 tuổi, chúng tôi sẽ xoá tài khoản đó. Xem thêm <a href="/legal/child-safety">Tiêu chuẩn an toàn trẻ em</a>.</p>

<h2>8. Cookie &amp; lưu trữ trên thiết bị</h2>
<p>Chúng tôi chỉ lưu những gì cần để ứng dụng chạy (phiên đăng nhập, giao diện sáng/tối…), không dùng cookie quảng cáo. Chi tiết: <a href="/legal/cookies">Cookie &amp; lưu trữ</a>.</p>

<h2>9. Thay đổi chính sách</h2>
<p>Khi có thay đổi quan trọng, chúng tôi thông báo trong ứng dụng trước khi áp dụng và xin lại sự đồng ý nếu pháp luật yêu cầu.</p>`,
};

// ---------------------------------------------------------------------------------------------
const COMMUNITY: LegalDoc = {
  slug: 'community',
  title: 'Tiêu chuẩn cộng đồng',
  summary: 'Điều được và không được đăng, cách chúng tôi xử lý vi phạm.',
  body: ({ email }) => `<h1>Tiêu chuẩn cộng đồng</h1>
<p class="muted">${A} là nơi để mọi người bày tỏ lựa chọn, tranh luận vui vẻ và khám phá cộng đồng đang nghĩ gì. Tiêu chuẩn này áp dụng cho <b>mọi thứ</b> trên ${A}: bài viết, lựa chọn trong bình chọn, ảnh/video, bình luận, tin nhắn, tên và ảnh hồ sơ, giải đấu, phiên trình chiếu.</p>
<div class="box"><b>Giá trị của chúng tôi</b>
<ul>
  <li><b>An toàn</b> — không ai bị đe doạ, hạ nhục hay gặp nguy hiểm vì một cuộc bình chọn.</li>
  <li><b>Tôn trọng</b> — tranh luận về lựa chọn, không công kích con người.</li>
  <li><b>Trung thực</b> — một người, một tài khoản, phiếu thật.</li>
  <li><b>Tự do biểu đạt</b> — mọi chủ đề đều có thể bình chọn, miễn không gây hại.</li>
</ul></div>

<h2>1. Bạo lực &amp; nguy hiểm</h2>
<ul>
  <li>Không đe doạ, kêu gọi hoặc cổ vũ bạo lực; không ca ngợi khủng bố, tổ chức tội phạm, tội ác hàng loạt.</li>
  <li>Không hướng dẫn chế tạo vũ khí, chất nổ, ma tuý; không mua bán hàng cấm (vũ khí, ma tuý, động vật hoang dã, hàng giả…).</li>
  <li>Không đăng nội dung bạo lực, máu me gây sốc. Nội dung thời sự có giá trị thông tin cần cảnh báo rõ.</li>
</ul>

<h2>2. Tự tử &amp; tự gây hại</h2>
<ul>
  <li>Không cổ vũ, hướng dẫn hay thách thức tự tử, tự gây hại, rối loạn ăn uống.</li>
  <li>Chia sẻ trải nghiệm để tìm hỗ trợ được chấp nhận. Nếu bạn hoặc ai đó đang gặp nguy hiểm, hãy gọi <b>115</b> (cấp cứu) hoặc liên hệ người thân ngay. Chúng tôi có thể liên hệ cơ quan chức năng khi có nguy cơ tính mạng.</li>
</ul>

<h2>3. An toàn trẻ em</h2>
<p><b>Không khoan nhượng</b> với mọi nội dung tình dục hoá trẻ em, dụ dỗ trẻ em (grooming), hay khai thác trẻ em dưới bất kỳ hình thức nào — kể cả tranh vẽ, ảnh tạo bằng AI. Nội dung bị gỡ, tài khoản bị khoá vĩnh viễn và báo cáo cơ quan chức năng. Không tổ chức bình chọn/xếp hạng ngoại hình của trẻ vị thành niên. Xem <a href="/legal/child-safety">Tiêu chuẩn an toàn trẻ em</a>.</p>

<h2>4. Quấy rối &amp; bắt nạt</h2>
<ul>
  <li>Không xúc phạm, lăng mạ, đe doạ, dồn ép hay kêu gọi người khác “tấn công” một người.</li>
  <li>Không gửi tin nhắn không mong muốn lặp đi lặp lại, kể cả sau khi bị chặn (bằng tài khoản khác).</li>
  <li>Không chế giễu bệnh tật, khuyết tật, ngoại hình, nạn nhân của bi kịch.</li>
</ul>

<h2>5. Thù ghét</h2>
<p>Không công kích, hạ thấp hay kêu gọi loại trừ con người dựa trên chủng tộc, dân tộc, quốc tịch, tôn giáo, giới tính, bản dạng giới, xu hướng tính dục, khuyết tật, bệnh tật, tuổi tác, hoàn cảnh. Không dùng biểu tượng, khẩu hiệu của nhóm thù ghét.</p>

<h2>6. Bình chọn &amp; xếp hạng NGƯỜI THẬT</h2>
<p>Đây là quy tắc riêng của ${A}, vì một cuộc bình chọn có thể làm tổn thương thật:</p>
<ul>
  <li>✅ Được: bình chọn về <b>người của công chúng</b> trong vai trò công khai (cầu thủ, ca sĩ, nhân vật lịch sử, sản phẩm, đội tuyển…).</li>
  <li>✅ Được: bình chọn giữa bạn bè khi <b>mọi người trong đó đồng ý</b> và nội dung tích cực (vd “ai hát hay nhất nhóm”).</li>
  <li>❌ Không: xếp hạng ngoại hình, cơ thể, “độ xấu”, “độ ngu” của <b>cá nhân bình thường</b>; bình chọn nhằm bêu riếu, “bóc phốt”, tẩy chay một người cụ thể.</li>
  <li>❌ Không: đặt tên, ảnh, trường lớp, nơi làm việc của người không phải công chúng vào lựa chọn khi họ chưa đồng ý.</li>
</ul>

<h2>7. Quyền riêng tư</h2>
<ul>
  <li>Không đăng thông tin cá nhân của người khác (số điện thoại, địa chỉ, giấy tờ, tài khoản ngân hàng, ảnh riêng tư) — kể cả trong lựa chọn bình chọn hay ảnh chụp màn hình.</li>
  <li>Không đăng ảnh/video nhạy cảm của người khác khi chưa được đồng ý; không quay lén.</li>
</ul>

<h2>8. Nội dung tình dục</h2>
<p>Không đăng ảnh khoả thân, hành vi tình dục, nội dung khiêu dâm hay gạ gẫm tình dục. Nội dung giáo dục giới tính, y tế, nghệ thuật được cân nhắc theo ngữ cảnh nhưng không được hiện ảnh rõ bộ phận nhạy cảm.</p>

<h2>9. Tính xác thực, spam &amp; gian lận</h2>
<ul>
  <li><b>Mạo danh:</b> không giả làm cá nhân, tổ chức, thương hiệu, hay nhân viên ${A}. Tài khoản fan/nhại phải ghi rõ trong tên hoặc tiểu sử.</li>
  <li><b>Gian lận phiếu:</b> không dùng nhiều tài khoản, bot, mua bán phiếu/RankUp/lượt theo dõi, hay tổ chức “cày phiếu” bằng công cụ.</li>
  <li><b>Spam:</b> không đăng hàng loạt nội dung trùng lặp, quảng cáo không mong muốn, đường link lừa nhấp.</li>
  <li><b>Lừa đảo:</b> không lừa đảo tài chính, đa cấp, “việc nhẹ lương cao”, giả mạo trúng thưởng, xin mật khẩu/mã OTP.</li>
  <li><b>Thông tin sai lệch gây hại:</b> không đăng tin sai về sức khoẻ, thiên tai, bầu cử có thể gây nguy hiểm thực tế; không giả mạo kết quả bình chọn.</li>
</ul>

<h2>10. Sở hữu trí tuệ</h2>
<p>Chỉ đăng nội dung bạn tạo ra hoặc có quyền dùng. Xem <a href="/legal/copyright">Chính sách bản quyền</a> để gửi yêu cầu gỡ nội dung vi phạm.</p>

<h2>11. Nội dung vi phạm pháp luật</h2>
<p>Không đăng nội dung vi phạm pháp luật Việt Nam, bao gồm nội dung chống phá Nhà nước, xâm phạm an ninh quốc gia, trật tự an toàn xã hội, thuần phong mỹ tục, hoặc xúc phạm danh dự, nhân phẩm của tổ chức, cá nhân.</p>

<h2>12. Cách chúng tôi thực thi</h2>
<ul>
  <li><b>Báo cáo:</b> bấm ⋯ → <b>Báo cáo</b> trên bài, bình luận, tin nhắn hoặc hồ sơ, chọn lý do. Danh tính người báo cáo không được tiết lộ cho người bị báo cáo.</li>
  <li><b>Xem xét trong 24 giờ</b> bởi đội ngũ kiểm duyệt của ${A}; nội dung nghiêm trọng được ưu tiên.</li>
  <li><b>Biện pháp</b> (tuỳ mức độ và tái phạm): nhắc nhở → gỡ nội dung → khoá tài khoản. Vi phạm nghiêm trọng (an toàn trẻ em, đe doạ bạo lực, lừa đảo, khủng bố) bị <b>khoá ngay</b> và có thể báo cơ quan chức năng.</li>
  <li><b>Thông báo:</b> người báo cáo nhận kết quả xử lý trong mục Thông báo.</li>
  <li><b>Kháng nghị:</b> nếu bài của bạn bị gỡ hoặc tài khoản bị khoá nhầm, gửi email tới <a href="mailto:${email}">${email}</a> trong 30 ngày, kèm @handle và mô tả. Chúng tôi xem xét lại toàn bộ vụ việc và phản hồi trong 7 ngày làm việc.</li>
</ul>

<h2>13. Tự bảo vệ mình</h2>
<ul>
  <li><b>Chặn:</b> người bị chặn không xem bài, không bình luận, không nhắn tin cho bạn.</li>
  <li><b>Tắt thông báo:</b> không thấy bài của một người nữa mà họ không biết.</li>
  <li><b>Ẩn bài / “Không quan tâm”:</b> bớt nội dung bạn không muốn thấy.</li>
  <li><b>Riêng tư:</b> đặt bài “Theo link” hoặc “Chỉ mình tôi”; đặt Ẩn cho thông tin nhân khẩu học.</li>
</ul>`,
};

// ---------------------------------------------------------------------------------------------
const COPYRIGHT: LegalDoc = {
  slug: 'copyright',
  title: 'Bản quyền & sở hữu trí tuệ',
  summary: 'Cách gửi yêu cầu gỡ nội dung vi phạm bản quyền, nhãn hiệu.',
  body: ({ email }) => `<h1>Bản quyền &amp; sở hữu trí tuệ</h1>
<p class="muted">${A} tôn trọng quyền sở hữu trí tuệ và yêu cầu người dùng làm điều tương tự, theo Luật Sở hữu trí tuệ Việt Nam và các điều ước quốc tế mà Việt Nam tham gia.</p>

<h2>1. Nội dung bạn được đăng</h2>
<ul>
  <li>Nội dung do chính bạn tạo, hoặc bạn đã được chủ sở hữu cho phép.</li>
  <li>Trích dẫn ngắn, ảnh/logo dùng để <b>nhận diện</b> lựa chọn trong bình chọn (vd logo đội bóng, bìa album) với mục đích bình luận, thông tin — miễn không gây hiểu nhầm là sản phẩm chính thức và không xâm phạm quyền lợi hợp pháp của chủ sở hữu. Chủ sở hữu vẫn có quyền yêu cầu gỡ.</li>
  <li>Không đăng lại phim, nhạc, sách, khoá học, phần mềm có bản quyền; không bán hàng giả, hàng nhái nhãn hiệu.</li>
</ul>

<h2>2. Gửi yêu cầu gỡ nội dung vi phạm</h2>
<p>Nếu bạn là chủ sở hữu (hoặc được uỷ quyền) và cho rằng nội dung trên ${A} vi phạm quyền của mình, gửi email tới <a href="mailto:${email}">${email}</a> với tiêu đề “Yêu cầu gỡ nội dung — bản quyền”, gồm:</p>
<ol>
  <li>Họ tên, thông tin liên hệ của bạn (và tư cách đại diện, nếu là người được uỷ quyền).</li>
  <li>Mô tả tác phẩm/nhãn hiệu bị vi phạm, kèm bằng chứng quyền sở hữu (giấy chứng nhận, đường dẫn bản gốc…).</li>
  <li>Đường dẫn chính xác tới nội dung vi phạm trên ${A} (nút Chia sẻ → Sao chép liên kết).</li>
  <li>Cam đoan rằng thông tin là chính xác và bạn có quyền gửi yêu cầu.</li>
</ol>
<p>Chúng tôi xử lý trong <b>tối đa 3 ngày làm việc</b>: gỡ hoặc hạn chế nội dung nếu yêu cầu hợp lệ và thông báo cho người đăng.</p>

<h2>3. Phản đối việc gỡ</h2>
<p>Nếu nội dung của bạn bị gỡ nhầm (bạn có quyền sử dụng), trả lời email thông báo trong 14 ngày kèm bằng chứng. Chúng tôi có thể khôi phục nội dung nếu bên yêu cầu không cung cấp căn cứ khởi kiện trong 10 ngày làm việc.</p>

<h2>4. Người vi phạm nhiều lần</h2>
<p>Tài khoản bị gỡ nội dung do vi phạm bản quyền nhiều lần sẽ bị khoá.</p>

<h2>5. Lạm dụng quy trình</h2>
<p>Gửi yêu cầu gỡ sai sự thật hoặc nhằm quấy rối người khác là vi phạm Tiêu chuẩn cộng đồng và có thể chịu trách nhiệm pháp lý.</p>`,
};

// ---------------------------------------------------------------------------------------------
const CHILD_SAFETY: LegalDoc = {
  slug: 'child-safety',
  title: 'Tiêu chuẩn an toàn trẻ em',
  summary: 'Không khoan nhượng với xâm hại & bóc lột tình dục trẻ em (CSAE).',
  body: ({ email }) => `<h1>Tiêu chuẩn an toàn trẻ em</h1>
<p class="muted">${A} <b>nghiêm cấm tuyệt đối</b> xâm hại và bóc lột tình dục trẻ em (CSAE), bao gồm tài liệu xâm hại tình dục trẻ em (CSAM). Trang này mô tả tiêu chuẩn của chúng tôi theo yêu cầu của Google Play, Apple App Store và pháp luật Việt Nam (Luật Trẻ em 2016).</p>

<h2>1. Nội dung và hành vi bị cấm</h2>
<ul>
  <li>Mọi hình ảnh, video, văn bản, tranh vẽ hay nội dung tạo bằng AI mô tả, tình dục hoá hoặc khai thác người dưới 18 tuổi.</li>
  <li>Dụ dỗ, làm quen với trẻ em nhằm mục đích tình dục (grooming), xin ảnh riêng tư, đề nghị gặp mặt.</li>
  <li>Tống tiền tình dục (sextortion), mua bán, quảng bá hoặc chỉ dẫn tới nội dung xâm hại trẻ em.</li>
  <li>Bình chọn, xếp hạng ngoại hình hoặc cơ thể của trẻ vị thành niên; chia sẻ thông tin định danh của trẻ em (trường, lớp, địa chỉ) không có sự đồng ý của cha mẹ.</li>
</ul>

<h2>2. Cách chúng tôi phòng ngừa</h2>
<ul>
  <li>Chỉ người từ đủ 13 tuổi được tạo tài khoản; từ 13 đến dưới 16 tuổi cần cha mẹ/người giám hộ đồng ý.</li>
  <li>Mọi người dùng có thể chặn, báo cáo người khác ngay trong tin nhắn, bình luận, hồ sơ.</li>
  <li>Báo cáo về an toàn trẻ em được <b>ưu tiên cao nhất</b> và xử lý ngay khi nhận.</li>
</ul>

<h2>3. Khi phát hiện vi phạm</h2>
<ul>
  <li>Gỡ nội dung ngay lập tức và <b>khoá vĩnh viễn</b> tài khoản liên quan.</li>
  <li>Lưu giữ chứng cứ theo quy định và <b>báo cáo cơ quan chức năng</b> (Bộ Công an; với nội dung quốc tế: Trung tâm Quốc gia về Trẻ em mất tích và bị bóc lột — NCMEC).</li>
  <li>Hợp tác đầy đủ với cơ quan điều tra.</li>
</ul>

<h2>4. Báo cáo</h2>
<ul>
  <li><b>Trong ứng dụng:</b> bấm ⋯ → <b>Báo cáo</b> → chọn “An toàn trẻ em”.</li>
  <li><b>Email đầu mối an toàn trẻ em:</b> <a href="mailto:${email}">${email}</a> (tiêu đề “An toàn trẻ em”).</li>
  <li><b>Tổng đài quốc gia bảo vệ trẻ em: 111</b> (miễn phí, 24/7). Khẩn cấp: <b>113</b>.</li>
</ul>
<p>Đầu mối phụ trách tuân thủ an toàn trẻ em của ${A} có thể được liên hệ qua email trên.</p>`,
};

// ---------------------------------------------------------------------------------------------
const COOKIES: LegalDoc = {
  slug: 'cookies',
  title: 'Cookie & lưu trữ trên thiết bị',
  summary: 'Những gì ứng dụng lưu trên máy bạn và lý do.',
  body: () => `<h1>Cookie &amp; lưu trữ trên thiết bị</h1>
<p class="muted">${A} chỉ lưu trên thiết bị của bạn những gì <b>cần thiết</b> để ứng dụng chạy. Chúng tôi <b>không</b> dùng cookie quảng cáo hay công cụ theo dõi của bên thứ ba.</p>

<h2>1. Những gì được lưu</h2>
<ul>
  <li><b>Phiên đăng nhập</b> (token truy cập/làm mới, cookie bảo mật httpOnly): để bạn không phải đăng nhập lại mỗi lần mở app. Bắt buộc.</li>
  <li><b>Tuỳ chọn hiển thị:</b> giao diện sáng/tối, bộ lọc, tab đang xem. Chức năng.</li>
  <li><b>Bản nháp &amp; lịch sử tìm kiếm</b> trên máy này: để bạn viết tiếp hoặc tìm lại nhanh. Bạn xoá được bất cứ lúc nào.</li>
  <li><b>Bộ nhớ đệm</b> ảnh và dữ liệu đã tải: để mở nhanh hơn và tiết kiệm dữ liệu di động.</li>
</ul>

<h2>2. Bên thứ ba</h2>
<p>Khi bạn chọn đăng nhập bằng Google, Facebook hoặc Apple, trang đăng nhập của họ có thể đặt cookie theo chính sách riêng của họ. Ảnh/video được phân phối qua Cloudinary. Ngoài ra không có bên thứ ba nào đặt cookie qua ${A}.</p>

<h2>3. Quản lý</h2>
<ul>
  <li><b>Đăng xuất</b> xoá phiên đăng nhập trên thiết bị.</li>
  <li>Trên web, bạn có thể xoá dữ liệu trang trong cài đặt trình duyệt; trên app, gỡ cài đặt ứng dụng sẽ xoá toàn bộ dữ liệu lưu trên máy.</li>
</ul>`,
};

// ---------------------------------------------------------------------------------------------
const DELETE_ACCOUNT: LegalDoc = {
  slug: 'delete-account',
  title: 'Xoá tài khoản & dữ liệu',
  summary: 'Cách xoá tài khoản, những gì bị xoá và thời hạn.',
  body: ({ email }) => `<h1>Xoá tài khoản &amp; dữ liệu ${A}</h1>
<p class="muted">Bạn có quyền xoá tài khoản ${A} và toàn bộ dữ liệu cá nhân bất cứ lúc nào, miễn phí.</p>

<h2>1. Xoá ngay trong ứng dụng (nhanh nhất)</h2>
<ol>
  <li>Mở ${A} → tab <b>Hồ sơ</b>.</li>
  <li>Bấm <b>⚙ Cài đặt</b> → <b>Xoá tài khoản</b>.</li>
  <li>Xác nhận. Tài khoản bị xoá <b>ngay lập tức</b> và bạn được đăng xuất.</li>
</ol>
<p>Muốn giữ lại bản sao trước khi xoá? Dùng <b>⚙ Cài đặt → Tải thông tin của bạn</b>.</p>

<h2>2. Không vào được ứng dụng?</h2>
<p>Gửi email từ địa chỉ đã đăng ký tới <a href="mailto:${email}">${email}</a> với tiêu đề “Yêu cầu xoá tài khoản”, kèm @handle. Chúng tôi xác minh và xoá trong tối đa 7 ngày làm việc.</p>

<h2>3. Những gì bị xoá</h2>
<ul>
  <li>Hồ sơ (email, tên, @handle, ảnh đại diện, ngày sinh, giới tính, nghề nghiệp, tiểu sử).</li>
  <li>Toàn bộ bài viết, giải đấu, series, bình luận, tin nhắn bạn đã gửi, mục đã lưu, RankUp, lịch sử tham gia.</li>
  <li>Phiếu bình chọn của bạn được <b>gỡ khỏi kết quả</b> các bài của người khác.</li>
</ul>

<h2>4. Những gì có thể được giữ lại</h2>
<ul>
  <li>Số liệu thống kê đã <b>ẩn danh, gộp chung</b> (không thể liên kết lại với bạn), ví dụ tổng lượt chạm ở bình chọn “không giới hạn”.</li>
  <li>Bản sao lưu hệ thống: bị ghi đè trong tối đa 30 ngày.</li>
  <li>Nhật ký kỹ thuật: tối đa 90 ngày, chỉ để bảo mật.</li>
  <li>Thông tin pháp luật yêu cầu lưu giữ (ví dụ liên quan vụ việc đang được cơ quan chức năng điều tra).</li>
</ul>
<p>Nội dung người khác đã chủ động lưu riêng (ảnh chụp màn hình…) nằm ngoài khả năng kiểm soát của chúng tôi.</p>`,
};

export const LEGAL_DOCS: LegalDoc[] = [TERMS, PRIVACY, COMMUNITY, COPYRIGHT, CHILD_SAFETY, COOKIES, DELETE_ACCOUNT];
export const legalDoc = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug) || null;
