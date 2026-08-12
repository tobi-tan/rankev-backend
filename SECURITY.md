# Bảo mật & Hiệu năng — Rà soát

Tổng hợp các biện pháp đã áp dụng cho backend Rankev và khuyến nghị tiếp theo.

## Đã có (hardening)

### Xác thực & phiên
- **Mật khẩu**: bcrypt (12 vòng), không bao giờ trả về client.
- **Access token**: JWT ký `JWT_SECRET`, sống 15 phút.
- **Refresh token**: chuỗi ngẫu nhiên **opaque**, chỉ lưu **SHA-256 hash** trong DB → rò rỉ DB không replay được. **Xoay vòng** mỗi lần refresh (revoke cũ), **revoke** khi logout.
- **Rate limit** (`@fastify/rate-limit`): toàn cục 300 req/phút/IP; `/auth/register` + `/auth/login` **20/phút** (chống brute-force). Bỏ qua `/health` + `/uploads/*`.

### Đầu vào & truy vấn
- **Validation**: Zod cho mọi body/query/params (kiểu, độ dài, enum, biên số). Lỗi → 400 với chi tiết field.
- **SQL injection**: Drizzle ORM tham số hoá 100%; không nối chuỗi SQL.
- **Giới hạn payload**: JSON 1MB (mặc định Fastify); multipart **8MB**.

### Phân quyền
- Owner-check: `PATCH/DELETE /posts/:id`, series (mọi thao tác sửa), xoá comment.
- **Khoá comment theo ending** (`?ending=`): enforce server-side qua `path_unlocks` → client bị tamper không lộ được.
- **Kiểm duyệt**: report + block (lọc feed người bị chặn) + xoá tài khoản (cascade).
- **Chống gian lận Exam**: server chấm lại bằng `deck_options.correct`, **bỏ qua điểm client gửi**; `correct` không bao giờ lộ trong GET.

### HTTP headers (`@fastify/helmet`)
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, HSTS. CSP tắt (đây là API JSON; trang HTML duy nhất là legal tự chứa inline style).

### Uploads
- Allowlist MIME (png/jpeg/webp/gif), tên file **ngẫu nhiên** (không path traversal), yêu cầu auth, giới hạn 8MB.

### CORS
- `CORS_ORIGIN` cấu hình được (mặc định mở cho dev; đặt origin cụ thể ở production).

## Hiệu năng
- **Index**: phủ FK + cột truy vấn (feed `type,created_at,id`; author; rankie_options theo rankie; comments theo post; participations; rank_ups author; …).
- **Feed** batch query (gom options/counts/comments cho cả trang) — **không N+1**.
- **Phân trang keyset (cursor)** thay offset → ổn định + nhanh ở trang sâu.
- Realtime fan-out trong bộ nhớ (1 instance) — đủ cho dev.

## Khuyến nghị tiếp theo (chưa làm)
| Ưu tiên | Việc |
|---|---|
| Cao | **Uploads → S3** (hoặc persistent disk) cho production / nhiều instance (ổ đĩa host là ephemeral). |
| Cao | **Realtime → Redis pub/sub** khi scale >1 instance (hiện `src/realtime/hub.ts` in-memory). |
| Cao | **Rate-limit store → Redis** để dùng chung khi nhiều instance. |
| Trung | Job dọn `refresh_tokens` hết hạn/đã revoke định kỳ. |
| Trung | Endpoint **admin kiểm duyệt** (xem/xử lý `reports`) — hiện chỉ ghi nhận. |
| Trung | **Statement timeout** + tinh chỉnh pool `pg` cho production. |
| Trung | Xác minh email / đặt lại mật khẩu (ngoài spec). |
| Thấp | Giám sát/log tập trung (pino → shipper), error tracking (Sentry). |
| Thấp | Xoay `JWT_SECRET` có kế hoạch (access ngắn hạn nên rủi ro thấp). |

## Kiểm thử
`npm test` — 32 test (Vitest + `app.inject`) phủ auth, posts/rankie, path/deck (chấm điểm + chống gian lận), comments (+khoá ending), bookmarks, rankup, series, sessions, moderation, uploads. DB test riêng `rankev_test`.
