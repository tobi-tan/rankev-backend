# Deploy Rankev Backend (HTTPS)

App di động thật **không gọi được `localhost`** và Apple bắt buộc **HTTPS**. Deploy backend + Postgres lên một nhà cung cấp có HTTPS.

Đã kiểm chứng: `npm run build` → `node dist/db/migrate.js && node dist/server.js` (đúng lệnh trong `Dockerfile`) chạy tốt.

---

## Phương án A — Render.com (khuyến nghị, có sẵn Blueprint)

Repo đã có `render.yaml` (tạo web service Docker + Postgres, tự sinh `JWT_SECRET`, tự migrate khi deploy).

1. Đẩy code lên GitHub (backend là 1 repo riêng).
2. Vào https://dashboard.render.com → **New → Blueprint** → chọn repo → Render đọc `render.yaml`.
3. Bấm **Apply**. Render tạo:
   - Postgres `rankev-db` (free)
   - Web service `rankev-api` (Docker) — build từ `Dockerfile`, healthcheck `/health`
4. Xong, bạn có URL dạng `https://rankev-api.onrender.com`. Kiểm tra `GET /health`.

> Migration tự chạy mỗi lần deploy (CMD trong Dockerfile). `JWT_SECRET` do Render sinh ngẫu nhiên. `DATABASE_URL` tự nối từ DB.

## Phương án B — Railway

1. https://railway.app → New Project → **Deploy from GitHub** (backend repo).
2. Add **PostgreSQL** plugin → Railway set biến `DATABASE_URL`.
3. Railway tự nhận `Dockerfile`. Thêm biến môi trường (mục Variables):
   - `JWT_SECRET` = chuỗi ngẫu nhiên dài
   - `NODE_ENV=production`
4. Deploy → lấy domain HTTPS (Settings → Networking → Generate Domain).

## Phương án C — Fly.io

```bash
fly launch --no-deploy          # tạo app, KHÔNG tạo Dockerfile mới (đã có)
fly postgres create             # tạo Postgres, rồi:
fly postgres attach <db-name>   # set DATABASE_URL
fly secrets set JWT_SECRET=<chuỗi-ngẫu-nhiên> NODE_ENV=production
fly deploy
```

---

## Biến môi trường cần có
| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `DATABASE_URL` | ✅ | do nhà cung cấp Postgres set |
| `JWT_SECRET` | ✅ | chuỗi ngẫu nhiên ≥ 16 ký tự |
| `NODE_ENV` | nên | `production` |
| `PORT` | tuỳ | mặc định 3000; nhiều host tự set |
| `CORS_ORIGIN` | tuỳ | để trống = cho mọi origin (app native không cần) |
| `ACCESS_TOKEN_TTL` | tuỳ | mặc định `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | tuỳ | mặc định `7` |

## Sau khi deploy
1. Lấy URL HTTPS của backend.
2. Trong `rankev-app/eas.json`, đặt `EXPO_PUBLIC_API_URL` (profile `production`) = URL đó.
3. (Tuỳ chọn) chạy `npm run db:seed` một lần trên host để có dữ liệu mẫu — hoặc tạo nội dung ngay trong app.
4. Build app: `eas build --platform ios --profile production` (xem `rankev-app/DEPLOY_APPSTORE.md`).

## Lưu ý
- **Uploads (`/uploads`)** hiện lưu vào ổ đĩa local của instance. Trên Render/Railway/Fly, ổ đĩa **ephemeral** — file mất khi redeploy/scale. Với production thật, gắn **persistent disk** (Render Disks / Fly Volumes) trỏ vào thư mục `uploads/`, hoặc đổi module `src/modules/uploads` sang **S3-compatible** (spec §1). Nhiều instance thì bắt buộc dùng S3.
- **WebSocket** (`/ws`) chạy cùng cổng HTTP — Render/Railway/Fly đều hỗ trợ WSS tự động qua HTTPS. App tự đổi `http→ws`, `https→wss`.
- Realtime hiện lưu trong bộ nhớ (1 instance). Nếu scale nhiều instance, cần Redis pub/sub (xem `src/realtime/hub.ts`).
- Postgres free tier của Render/Railway có giới hạn — đủ để thử nghiệm, nâng cấp khi lên production thật.
