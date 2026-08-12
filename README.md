# Rankev Backend

Backend cho **Rankev** — mạng xã hội polling/ranking. Đây là **Sprint 1**: Auth, Post/Rankie CRUD, và Vote.

Stack: **Node.js 20+ · Fastify 4 · TypeScript · Drizzle ORM · PostgreSQL 15 · JWT + bcryptjs · Zod**.

---

## 1. Yêu cầu môi trường

Máy hiện tại **chưa cài** Node.js và PostgreSQL. Cài trước khi chạy:

- **Node.js 20 LTS** — https://nodejs.org (bản LTS). Kiểm tra: `node -v`
- **PostgreSQL 15** — https://www.postgresql.org/download/windows/
  hoặc chạy nhanh bằng Docker:
  ```bash
  docker run --name rankev-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=rankev -p 5432:5432 -d postgres:15
  ```

## 2. Cài đặt

```bash
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

Sửa `.env`:
- `DATABASE_URL` trỏ tới Postgres của bạn
- `JWT_SECRET` đặt một chuỗi ngẫu nhiên dài (≥ 16 ký tự)

## 3. Tạo schema (migration)

```bash
npm run db:migrate
```

Lệnh này áp dụng mọi file trong `migrations/*.sql` đúng một lần (theo dõi trong bảng `schema_migrations`). Có 4 migration: 0001 (auth+rankie), 0002 (moderation), 0003 (comment ranks), 0004 (path+deck+participations).

Tạo dữ liệu mẫu (khuyến nghị để bảng tin có nội dung):

```bash
npm run db:seed
```

## Test (Vitest)

Test dùng `app.inject()` của Fastify (không cần mạng) trên **database test riêng** `rankev_test`.

Tạo DB test 1 lần (rồi migrate):
```bash
# tạo rankev_test (owner rankev_app) bằng psql superuser, rồi:
DATABASE_URL=postgres://rankev_app:PASS@localhost:5432/rankev_test npm run db:migrate
```
Cấu hình test đọc `.env.test` (đã gitignore). Chạy:
```bash
npm test          # chạy 1 lần
npm run test:watch
```
Hiện có 14 test (auth + posts/rankie): đăng ký/đăng nhập/refresh/guard, tạo–vote–results–PATCH(chủ bài/403)–xoá–feed.

## 4. Chạy

```bash
npm run dev      # tsx watch, hot-reload
# hoặc production:
npm run build && npm start
```

Server mặc định ở `http://localhost:3000`. Kiểm tra: `GET /health`.

---

## 5. API (Sprint 1)

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/auth/register` | — | Đăng ký (email, password, handle, name) |
| POST | `/auth/login` | — | Đăng nhập → access token + refresh cookie |
| POST | `/auth/refresh` | cookie | Xoay refresh token, cấp access token mới |
| DELETE | `/auth/logout` | cookie | Thu hồi refresh token |
| GET | `/users/me` | Bearer | Thông tin user hiện tại |
| GET | `/users/:id` | — | Hồ sơ công khai |
| GET | `/posts?type=rankie&category=&cursor=&limit=` | tùy chọn | Feed Rankie, phân trang cursor |
| GET | `/posts/:id` | tùy chọn | Chi tiết 1 Rankie (kèm `myVote` nếu đăng nhập) |
| POST | `/posts` | Bearer | Tạo bài (rankie/path/deck theo `type`) |
| PATCH | `/posts/:id` | Bearer | Sửa bài (chủ bài) — metadata + nhãn option |
| DELETE | `/posts/:id` | Bearer | Xóa (chỉ chủ bài) |
| POST | `/rankies/:id/vote` | Bearer | Bình chọn / đổi phiếu (upsert) |
| GET | `/rankies/:id/votes/me` · `/rankies/:id/results` | Bearer/— | Phiếu của mình · phân bố kết quả |
| GET | `/paths/:id/companions` | — | Người cùng chơi (bản tổng) |
| GET | `/posts/:id/comments?ending=` | Bearer | Comment theo ending (khoá theo unlock) |
| GET | `/feed?type=&cursor=` · `/users/me/feed` | tùy chọn/Bearer | **Bảng tin hợp nhất** (rankie/path/deck) |
| POST | `/paths/:id/complete` | Bearer | Path: kết thúc + mở khoá ending |
| GET | `/paths/:id/unlocks/me` | Bearer | Danh sách ending đã mở |
| GET | `/paths/:id/companions/:ending` | — | Người cùng ending |
| POST | `/decks/:id/submit` | Bearer | Survey/Exam nộp bài (server chấm lại) |
| GET | `/decks/:id/my-result` · `/stats` | Bearer/— | Kết quả của mình · thống kê |
| GET/POST/PATCH/DELETE | `/posts/:id/comments`, `/comments/:id/rank`, `/comments/:id` | — / Bearer | Bình luận + rank up/down + xoá |
| POST/DELETE/GET | `/posts/:id/bookmark`, `/users/me/bookmarks` | Bearer | Lưu bài |
| POST | `/posts/:id/report`, `/users/:id/report` | Bearer | Báo cáo nội dung/người dùng |
| POST/DELETE | `/users/:id/block` | Bearer | Chặn / bỏ chặn |
| DELETE | `/users/me` | Bearer | Xoá tài khoản (Apple 5.1.1) |
| GET | `/legal/privacy` · `/legal/terms` | — | Trang pháp lý (HTML) |
| WS | `/ws?token=` | tùy chọn | Realtime: subscribe_rankie / vote → vote_update, new_comment |
| POST | `/users/:id/rankup` | Bearer | RankUp (tier 0-3, 0 = bỏ) — thay follow |
| PATCH | `/users/me` | Bearer | Cập nhật hồ sơ (name/handle/bio/avatar) |
| GET | `/users/me/posts` · `/users/:id/posts` | Bearer/— | Bài của user |
| GET | `/users/me/history` | Bearer | Lịch sử tham gia (Path/Deck) |
| GET/POST/PATCH/DELETE | `/series...` | Bearer | Series/Chapter: tạo, thêm/xoá/sắp xếp post |
| POST/GET | `/posts/:id/sessions`, `/users/me/sessions` | Bearer | Presentation sessions |
| POST | `/uploads/image` · `/uploads/scene` | Bearer | Upload ảnh (multipart) → { url }; phục vụ tại `/uploads/*` |

**Tạo Path/Deck**: `POST /posts` với `type: 'path'` hoặc `type: 'deck'` (kèm `deckMode`). Xem `smoke`/`src/db/seed.ts` để biết cấu trúc body.

**Dữ liệu mẫu**: `npm run db:seed` tạo user `demo@rankev.app` / `demo1234` + 1 bài mỗi loại (rankie/path/survey/exam) để bảng tin có nội dung ngay.

### Auth model
- **Access token**: JWT ký bằng `JWT_SECRET`, sống 15 phút (`ACCESS_TOKEN_TTL`). Gửi qua header `Authorization: Bearer <token>`.
- **Refresh token**: chuỗi ngẫu nhiên **opaque**, chỉ lưu **SHA-256 hash** trong `refresh_tokens`. Trả về client dưới dạng cookie `httpOnly` (`rankev_rt`, path `/auth`), sống 7 ngày. `/auth/refresh` xoay vòng (revoke cũ + cấp mới).

### Voting rules (`voting_type`)
- `single` / `rating` / `unlimited`: chọn **đúng 1** option.
- `multiple`: chọn **≥ 1** option.
- `unlimited`: mỗi lần gọi `+1` vào `tap_count` và `votes` của option (fanclub vote).
- Vote lại được: hệ thống tự trừ phiếu cũ, cộng phiếu mới trong 1 transaction. `rankie_options.votes/voters` được cập nhật đồng bộ.

> Realtime WebSocket (`vote_update`) thuộc **Sprint 2** — Sprint 1 dùng REST thường.

---

## 6. Cấu trúc thư mục

```
src/
  server.ts              # bootstrap + graceful shutdown
  app.ts                 # build Fastify: plugins, routes, error handler
  env.ts                 # nạp + validate .env bằng Zod
  db/
    schema.ts            # Drizzle schema (typing cho query)
    index.ts             # pg Pool + drizzle client
    migrate.ts           # runner áp dụng migrations/*.sql
  lib/                    # errors, password, tokens, cursor, validate
  plugins/auth.ts        # preHandler: authenticate / optionalAuth
  modules/
    auth/                # register / login / refresh / logout
    users/               # /users/me, /users/:id, serializer (ẩn email + hash)
    posts/               # CRUD Rankie + feed cursor
    rankies/             # vote + votes/me
migrations/0001_init.sql # DDL Sprint 1
```

## 7. Ghi chú kỹ thuật
- Dùng **bcryptjs** (thuần JS) thay vì `bcrypt` native → không cần build tool (node-gyp) trên Windows.
- Migration là **SQL viết tay** (`migrations/`), không phụ thuộc `drizzle-kit`. `schema.ts` là nguồn typing — giữ đồng bộ khi đổi schema. (`npm run db:generate` có sẵn nếu muốn chuyển sang drizzle-kit sau này.)
- `posts` tạo đủ cột cho cả Path/Deck (nullable) để tránh migration lại ở các sprint sau.
