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

- [x] **Realtime cho live session** (xong): presenter theo dõi qua WebSocket, thấy người vào/nộp tức thì; poll 10s chỉ còn là fallback. Chi tiết ở §7.
- [ ] Mở rộng live session cho **Rankie** (bình chọn trực tiếp) và **Path**.
- [ ] Màn participant thấy **bảng xếp hạng/kết quả** sau khi nộp (hiện chỉ báo "đã nộp").
- [ ] Chống trùng: 1 người nộp nhiều lần / quản lý reconnection.
- [ ] Xem lại các câu hỏi mở còn treo trong memory `rankev-open-questions` (spec §6).

## 7. Realtime cho live session (vừa xong — chưa commit/deploy)

Thay polling 3s bằng WebSocket, tận dụng hạ tầng `src/realtime/` sẵn có. **Không có migration mới.**

- **Backend**
  - `src/realtime/hub.ts`: thêm room namespaced `live:<sessionId>` — `joinLive` / `leaveLive` / `broadcastLiveUpdate`.
  - `src/modules/live/live.service.ts`:
    - Tách `computeLiveResults(sessionId)` (không check quyền) — dùng chung cho HTTP `getLiveResults` (vẫn check host) và broadcast.
    - Thêm `assertLiveHost(sessionId, hostId)` — để WS xác minh chỉ chủ phiên mới subscribe (kết quả chứa đáp án).
    - Thêm `pushLiveUpdate(sessionId)` (fire-and-forget) — gọi sau `joinSession`, `submitLiveAnswers`, `endLiveSession` để đẩy snapshot mới cho presenter.
  - `src/realtime/ws.routes.ts`: thêm `subscribe_live` (cần token + đúng host → gửi snapshot ngay) và `unsubscribe_live`. Server → client: `{ type: 'live_update', sessionId, results }`. **Lưu ý**: toàn bộ thao tác DB trong `subscribe_live` được bọc `try/catch` — `sessionId` rác (không phải UUID) làm Postgres ném lỗi; nếu không bắt, unhandled rejection sẽ **sập cả server** (đã test).
- **Frontend** (`../rankev-web`)
  - `src/api.js`: `subscribeLive(sessionId, onUpdate)` trên WS dùng chung; xử lý `live_update`; re-subscribe khi reconnect; export trong default.
  - `src/rankev_app.jsx` `LivePresenterView`: dùng `api.subscribeLive` cho realtime, giữ poll **10s** làm fallback (trước là 3s).
- **Còn lại**: người tham gia (join/submit) vẫn dùng HTTP; chính hành động HTTP đó kích hoạt broadcast. Chưa cần đổi phía participant.
- **Kiểm thử**: `tsc --noEmit` sạch; test suite 31/32 pass (1 fail có sẵn: `posts PATCH metadata`, không liên quan). Đã smoke-test end-to-end trên backend **local**: create→byCode→join→submit→results OK; WS realtime OK (presenter nhận `live_update` tức thì khi có người join); sessionId rác không sập server. **Chưa commit, chưa Redeploy Railway.**
### Sửa kèm: chủ deck THẬT không trình chiếu được (owner detection)

Khi test UI phát hiện: nút Trình chiếu bị khóa ("Chủ bài chưa cho phép…") và `DeckView` bắt "hoàn thành bài mới được trình chiếu" **ngay cả với chủ bài**, vì frontend chỉ nhận owner qua `author?.id === "me"` (mock), còn deck thật có `author.id` là UUID → luôn bị coi là khách. Hệ quả: không vào được `LivePresenterView` thật → rơi vào presenter bot (`ExamPresenterView`, số liệu ảo).

- **Backend** `decks.serializer.ts`: `DeckView` thêm cờ `mine: boolean` (= `includeCorrect`, tức `viewerId === authorId`). Không cần migration.
- **Frontend** `rankev_app.jsx`: `apiDeckToProto` dùng `mine: !!d.mine`; `DeckView` `isOwner = deck.mine || author==="me"`; nút Trình chiếu trong `DeckView` route deck thật → `livePresent` (đồng bộ với nút TopBar).
- **Đã verify trong trình duyệt** (2 tab): chủ mở Trình chiếu → `LivePresenterView` thật (mã join, 0/0/— **không bot**); người thật join+nộp ở tab kia → presenter cập nhật realtime (1 đã vào → 1 đã nộp → điểm 1/10).
- **Đã gỡ bot ảo**: `ExamPresenterView` (bỏ mô phỏng phòng chờ `JOINING_NAMES` + kết quả ảo `genParticipants`) và `DeckPresenterView` (bỏ mô phỏng người tham gia + phản hồi). Verify: phòng chờ mock exam hiện "0 người", không còn tên ảo. `PathPresenterView` vẫn còn counter ảo (Path chưa có live thật) — gỡ khi mở rộng live cho Path.

- **⚠️ DB local/test đang thiếu migration**: DB local (`localhost:5432`) và test DB chỉ mới có 0001–0005. Đã chạy `npm run db:migrate` cho cả hai (áp 0006 + 0007). Khi deploy Railway nhớ chạy quy trình 2 bước ở §3 nếu prod cũng thiếu.

## 8. Live exam có phòng chờ + công bố kết quả trễ (vừa xong — chưa deploy)

Nâng cấp phiên live: **phòng chờ → thi → công bố**. **Cần migration 0008** (`live_at`, `ends_at` trên `presentation_sessions`).

- **Vòng đời**: `phaseOf()` = `endedAt` hoặc `ends_at` đã qua → `ended`; `live_at` set → `live`; còn lại → `waiting`. `finalizeIfExpired()` tự chốt khi hết giờ (guard `ended_at is null`).
- **Backend** (`live.service.ts` viết lại + `live.routes.ts`, `ws.routes.ts`, `hub.ts`):
  - `POST /live-sessions/:id/start` (host, optional `durationMinutes`) → vào `live`, đặt `ends_at`.
  - `submitLiveAnswers` chấm & lưu server-side nhưng **KHÔNG trả điểm** (`{submitted:true}`), chặn nộp khi `waiting`/`ended`.
  - `GET /live-sessions/:id/participants/:pid/result` → điểm **chỉ lộ khi `ended`** (kèm `correctByQuestion` để đối chiếu).
  - `getSessionByCode` trả thêm `phase`/`endsAt`. `endLiveSession` trả snapshot `ended` (không còn `{ended:true}`).
  - Kênh WS công khai cho participant: `subscribe_live_state` → chỉ `{phase, endsAt}` (không lộ kết quả). Presenter vẫn dùng `subscribe_live`.
- **Frontend** (`api.js`, `rankev_app.jsx`):
  - `api.live.start/participantResult`, `subscribeLiveState`.
  - `LivePresenterView`: 3 giai đoạn (phòng chờ chọn thời lượng + danh sách vào + "Bắt đầu" → đang thi có đồng hồ + "Kết thúc & công bố" → kết quả). Ghi vào Lịch sử trình chiếu qua `onSessionEnd`→`saveDeckSession`.
  - `LiveJoinView`: code → tên → **chờ** → làm bài (đồng hồ, tự nộp khi hết giờ) → **xem lại bài của mình (chưa điểm)** → **điểm + ✓/✗ khi công bố**.
  - Sửa hiển thị điểm mỗi câu exam (ô nhập 40→56px, hết cắt "3.3" thành "3.").
- **Verify trong trình duyệt (2 tab)**: phòng chờ ✓, chờ→thi realtime ✓, nộp không lộ điểm ✓, kết thúc→công bố điểm + xem lại ✓, tự hết giờ ✓ (API), lưu lịch sử ✓. `tsc` sạch, test 31/32 (1 fail có sẵn).
- **⚠️ Deploy**: có migration 0008 → **phải chạy quy trình 2 bước Railway ở §3**.

### Tinh chỉnh (đợt 2 — không thêm migration)
- **Phòng chờ**: dùng `DurationPicker` (giống tạo exam), **mặc định = thời lượng chủ bài đã set**.
- **Đang thi/kết quả (presenter)**: giao diện kiểu kết quả exam — biểu đồ phân loại điểm (A–F) realtime, số "đạt ≥ điểm đạt", bảng có **hạng · thời gian làm bài mỗi người (⏱ = submittedAt − liveAt) · xếp loại · điểm**. `computeLiveResults` trả thêm `liveAt`, participant có `joinedAt`/`submittedAt`.
- **Công bố (participant)**: giống kết quả 1 exam — điểm lớn + huy hiệu xếp loại + Đạt/Chưa đạt + xem lại từng câu ✓/✗.
- **Lưu phiên**: presenter có **ô đặt tên** + "Lưu phiên trình chiếu" (thay vì auto-lưu tên deck). Lịch sử hiện đúng tên + số người + ĐTB.
- **`allowGuestPresent`**: giờ **lưu thật** (thêm vào `createDeckSchema` + create/update service + `DeckView`). `createLiveSession` cho phép **người khác** mở live nếu chủ bài bật cờ này (không chỉ tác giả). Frontend `apiDeckToProto` map `mine`+`allowGuestPresent` → nút Trình chiếu mở khóa đúng.
- Sửa hiển thị điểm mỗi câu exam bị cắt "3.3"→"3." (ô 40→56px).
- **Deck mẫu cứng** (id kiểu `exam1`) vẫn KHÔNG live được (không phải deck thật) — đây là dữ liệu demo offline.

## 6. Ghi chú vận hành

- Tài khoản test live: `live_8r0nb@example.com` / `LiveTest123!`.
- Sau khi push backend → **nhớ Redeploy Railway thủ công**.
- Có thêm migration → **chạy quy trình 2 bước ở §3**.
- Test nhiều người tham gia: mở nhiều tab/thiết bị với link `?join=MÃ`, mỗi tab một tên.
