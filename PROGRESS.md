# Rankev — Tiến độ & Tài liệu bàn giao

> Cập nhật: 2026-08-16. File này để Claude Code (và người mới) đọc ở phiên sau.
> **Ngôn ngữ làm việc: tiếng Việt.**

## 1. Tổng quan hệ thống

Rankev là nền tảng "rank everything" — người dùng tạo và tham gia các loại nội dung tương tác:
- **Rankie** — bình chọn/xếp hạng, có kết quả realtime (WebSocket).
- **Path** — truyện phân nhánh nhiều kết thúc (ending), có unlock + companions.
- **Deck** — bộ câu hỏi ở 2 chế độ: **Survey** (khảo sát) và **Exam** (bài thi có chấm điểm).

Ba repo trên máy:
- `rankev-backend` (thư mục này) — API server.
- `../rankev-web` — web app (React + Vite), deploy Vercel.
- `../rankev-app` — mobile app (Expo/React Native).

## 2. Ngăn xếp kỹ thuật (technical decisions)

**Backend** (`rankev-backend`)
- Node.js 20+, **Fastify 4**, TypeScript (CommonJS).
- **Drizzle ORM** + **PostgreSQL 15**. Schema: `src/db/schema.ts`.
- JWT auth (access + refresh), **Zod** validation (`src/lib/validate.ts` → `parse()`).
- Plugin: `@fastify/websocket`, `@fastify/multipart`, `@fastify/static`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cookie`, `@fastify/cors`.
- Cấu trúc: `src/modules/<tên>/<tên>.routes.ts` + `.service.ts`, đăng ký trong `src/app.ts`.
- Module hiện có: auth, users, posts, rankies, paths, decks, feed, rankups, series, sessions, **live**, uploads, moderation, legal, comments, bookmarks.

**Frontend web** (`../rankev-web`)
- React 18 **single-file** (`src/rankev_app.jsx` — rất lớn), Vite, recharts, lucide-react.
- API client: `src/api.js` — **plain fetch**, base URL từ env (`VITE_API_URL`), tự refresh token. Default export gom mọi client (`auth, posts, rankies, paths, decks, ..., live`).
- Nguyên tắc: giữ **mock data làm fallback offline**; `isApiId(id)` (regex UUID) phân biệt dữ liệu thật vs mock để bật/tắt hành vi gọi API thật.
- Mapper `protoToCreatePayload` / `apiXToProto` chuyển đổi giữa shape prototype ↔ payload/view backend.

## 3. Hạ tầng & triển khai

- **Frontend**: Vercel — **tự deploy khi push** lên repo web.
- **Backend**: Railway — **PHẢI redeploy thủ công** sau khi push.
- **DB**: Railway Postgres (dùng public proxy URL).
- **Ảnh upload**: Railway Volume tại `/app/uploads`. Đã sửa Cloudflare CORP: `crossOriginResourcePolicy: { policy: 'cross-origin' }` (nếu không trình duyệt chặn `<img>` từ domain backend).

### ⚠️ Quy trình chạy migration (QUAN TRỌNG — hay quên)

Migration KHÔNG tự chạy (start command chỉ chạy server). Runner: `dist/db/migrate.js`, forward-only, tracking trong bảng `schema_migrations`.

Railway chạy Custom Start Command **KHÔNG qua shell**, nên `&&` KHÔNG nối lệnh được (chỉ lệnh đầu chạy → container dừng → 502 loop). Vì vậy quy trình 2 bước:
1. Đổi **Custom Start Command** → `node dist/db/migrate.js` → **Redeploy**. Xem log báo `Applied N migration(s)`.
2. Đổi lại → `node dist/server.js` → **Redeploy**. Server chạy bình thường, cột/bảng mới đã có.

(502 tạm thời ở bước 1 là bình thường vì container chỉ chạy migrate rồi thoát.)

## 4. Đã hoàn thành gần đây (theo commit)

**Backend** (HEAD `e976ce7`):
- `e976ce7` — **Live presentation sessions** (người thật join bằng mã).
- `3fbe775` — persist rankie vote marker (sticker "đã bình chọn" tùy chỉnh) — migration 0006.
- `69fcf1e` — `GET /series/mine` (danh sách series của user cho chapter picker).
- `4a63d7c` — lộ `correct` của deck cho chủ sở hữu (để sửa đề thi).
- `2444959` — `updatePath` + `updateDeck` (sửa câu hỏi/đáp án/ending).

**Frontend** (HEAD `a3f75eb`):
- `a3f75eb` — UI live session: participant join-by-code + màn presenter theo dõi trực tiếp.
- `c92785e` — sửa review phiên thi: hiện học sinh + phân phối điểm thi thực tế (bỏ 25% phẳng).
- `92663e8` — gửi + khôi phục sticker vote marker.

### Tính năng "Phiên trình chiếu trực tiếp — người thật" (feature chính vừa xong)

Thay bot mô phỏng bằng **người tham gia thật join bằng mã**. Đã verify end-to-end trên live.

- **DB**: migration `0007_live_sessions.sql` — thêm cột `presentation_sessions.code` + bảng `live_participants` (id, session_id FK cascade, name, answers jsonb, score, correct_count, total_gradable, submitted_at, joined_at).
- **Backend** `src/modules/live/`:
  - `POST /live-sessions` (auth, chỉ tác giả) → trả `{ id, code, postId }`, code 6 ký tự (bỏ ký tự dễ nhầm).
  - `GET /live-sessions/code/:code` (public) → trả deck **KHÔNG kèm cờ `correct`** (chống gian lận).
  - `POST /live-sessions/:id/join` (public) → `{ participantId }`.
  - `POST /live-sessions/:id/participants/:pid/answers` (public) → server **chấm lại exam** vs `deck_options.correct`.
  - `GET /live-sessions/:id/results` (auth, chỉ chủ) → `{ joined, submitted, avgScore, participants[] }`, để poll.
  - `POST /live-sessions/:id/end` (auth).
- **Frontend** (`rankev_app.jsx`):
  - `LiveJoinView` — participant, vào qua URL `?join=CODE`, **không cần đăng nhập** (early return trước authGate). Phase: code → name → answer → done.
  - `LivePresenterView` — chủ: hiện mã + link `origin/?join=CODE` (copy được), poll `api.live.results` mỗi 3s, danh sách người thật + điểm sắp theo score, nút "Kết thúc phiên".
  - Deck THẬT (`isApiId`) → nút Trình chiếu mở `livePresent`; deck mock → presenter cũ (bot).
  - `api.live` client trong `api.js`.
- **Giới hạn hiện tại**: MVP dùng **polling 3s** (đủ cho lớp học); chỉ hỗ trợ **Deck (Survey/Exam)**, chưa hỗ trợ Rankie/Path.

## 5. Các bước tiếp theo (đề xuất)

- [ ] **Realtime cho live session**: thay polling 3s bằng WebSocket (server đã có hạ tầng `@fastify/websocket` + `ws.routes`) để presenter thấy người tham gia tức thì.
- [ ] Mở rộng live session cho **Rankie** (bình chọn trực tiếp) và **Path**.
- [ ] Màn participant thấy **bảng xếp hạng/kết quả** sau khi nộp (hiện chỉ báo "đã nộp").
- [ ] Chống trùng: 1 người nộp nhiều lần / quản lý reconnection.
- [ ] Xem lại các câu hỏi mở còn treo trong memory `rankev-open-questions` (spec §6).

## 6. Ghi chú vận hành

- Tài khoản test live: `live_8r0nb@example.com` / `LiveTest123!`.
- Sau khi push backend → **nhớ Redeploy Railway thủ công**.
- Có thêm migration → **chạy quy trình 2 bước ở §3**.
- Test nhiều người tham gia: mở nhiều tab/thiết bị với link `?join=MÃ`, mỗi tab một tên.
