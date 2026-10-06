# Deploy guide (Dokploy)

Deploy `mobile-release-dashboard` lên VPS Dokploy của bạn trong ~15 phút.

## 1. Tạo app trên Dokploy

1. Dokploy → project → **Create Service → Compose**
2. Repository: `dantech0xff/mobile-release-dashboard`, branch `main`, compose file `docker-compose.yml`
3. Tab **Environment** — thêm:

   | Var | Giá trị |
   |---|---|
   | `DASHBOARD_PASSWORD` | mật khẩu login dashboard |
   | `DASHBOARD_MASTER_KEY` | chuỗi random dài — **sinh 1 lần, giữ nguyên mãi mãi** (`openssl rand -hex 32`). Đổi/mất key = mất toàn bộ secrets đã lưu |
   | `TZ` | `Asia/Ho_Chi_Minh` (timezone cho cron của worker) |

4. Tab **Domains** → Add domain → `releases.<domain-của-bạn>.com`, container port `3000`, bật HTTPS — Traefik tự cấp Let's Encrypt. **Chỉ expose service `web`** (worker không có port).
5. **Deploy**. Lần đầu `worker` build ~5–15 phút (kéo Android SDK + Flutter + fastlane ~4GB image). Xem log build trong Dokploy nếu lâu.

Volume `data` (named volume) persist DB + keystores + workspaces + Gradle cache — rebuild/deploy lại không mất dữ liệu.

## 2. Setup secrets lần đầu (trong dashboard)

Mở `https://releases.<domain>.com` → login → tab **Secrets**:

1. **GitHub PAT** — tạo ở https://github.com/settings/tokens (classic, scope `repo`; thêm `workflow` nếu repo app có GitHub Actions bị ảnh hưởng bởi commit bump). Paste và Save.
2. **Signing profile** — upload keystore release của app (`.jks`/`.keystore`) + key alias + store/key password.
3. **Service account (Play)** — Play Console → Setup → API access → service account JSON có quyền Release. Paste JSON. *App phải đã tồn tại trên Play Console — lần upload đầu tiên của app mới không tự động được.*

## 3. Đăng ký project đầu tiên

**Projects → + New project**:

- Repo URL `https://github.com/owner/repo`, branch `main`
- Type: `Android Native (Kotlin)` hoặc `Flutter`
- Version scheme: `patch` (1.2.3 → 1.2.4, versionCode +1)
- Android: để trống Gradle file/task nếu chuẩn (`app/build.gradle.kts`, `bundleRelease`)
- Signing profile + Play service account + package name (applicationId)
- Schedule: **để tắt Enabled lúc đầu** — test tay trước

## 4. Test bằng "Run now"

Bấm **Run now** → vào run detail xem log qua từng stage: `prepare → bump → commit_push → build → upload`.

- Build fail → xem log lỗi Gradle trong trang run; lần đầu Gradle tải dependencies khá lâu (cache persist trong volume, lần sau nhanh).
- Upload fail `The current user has insufficient permissions` → service account chưa được grant quyền release trên Play Console.
- Upload fail `package not found` → app chưa tồn tại trên Play Console / sai package name.

## 5. Bật schedule

Vào project → Schedule: cron `0 9 * * 1` (09:00 sáng thứ 2, theo `TZ`) → tick **Enabled** → Save. Cột "Next run" trên dashboard hiển thị lần chạy kế tiếp.

## Troubleshooting

| Triệu chứng | Xử lý |
|---|---|
| Trang trắng/502 sau deploy | Worker đang build image — xem Dokploy build logs; kiểm tra domain trỏ đúng port 3000 của `web` |
| Run kẹt `running` mãi | Worker restart giữa chừng → run được mark `failed` ở lần khởi động tiếp theo; bấm Run now lại |
| Hết disk | `docker system prune` + dọn `data/workspaces` (clone lại được); AAB artifacts nằm trong workspaces |
| Quên DASHBOARD_MASTER_KEY | Không khôi phục được — xóa hết secrets trong UI, đổi key, nhập lại |
