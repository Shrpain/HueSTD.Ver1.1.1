# PROJECT_CONTEXT.md

Muc dich cua file nay la lam "bo nho du an" cho cac phien chat va coding agent.
Khi vao repo, nen doc file nay truoc de biet du an dang lam gi va dang o giai doan nao.

## 1. Tong quan du an

- Ten du an: `HueSTD`
- Muc tieu: nen tang cong dong sinh vien Hue, gom chia se tai lieu, chat, AI ho tro hoc tap, thong bao va quan tri noi dung.
- Kieu repo: monorepo fullstack

## 2. Cong nghe dang dung

- Frontend: React 19 + TypeScript + Vite
- Backend: .NET 9 Web API
- Kien truc backend: Clean Architecture
- Database / Auth / Storage / Realtime: Supabase
- Frontend deploy: Vercel

## 3. Cac module chinh da co trong codebase

- Xac thuc nguoi dung voi Supabase
- Ho so ca nhan va cap nhat profile
- Dashboard thong ke tong quan
- Quan ly tai lieu: upload, danh sach, chi tiet, binh luan
- AI module / AI chat
- Chat thoi gian thuc giua nguoi dung
- Notification module
- Admin module: dashboard, users, documents, settings, notifications

## 4. Trang thai hien tai cua du an

Tinh den: `2026-03-24`

Nhung gi da thay ro trong repo:

- Frontend va backend da duoc tach rieng, co cau truc ro rang va co the chay local.
- Backend da co nhieu controller va service cho auth, profile, documents, dashboard, chat, AI, admin, notification.
- Frontend da co UI/module tuong ung cho cac tinh nang lon o tren.
- Repo da co tai lieu huong dan chay local trong `README.md`.

Tien do tong quat co the xem nhu:

- Nen tang co ban: da xong phan lon
- Tinh nang chinh: da co khung va implementation cho nhieu module
- Giai doan hien tai: hoan thien, tinh chinh, ket noi va on dinh hoa van hanh

## 5. Dau hieu cong viec dang lam gan day

Working tree hien tai dang co thay doi chua commit o backend startup/config:

- Refactor CORS trong `HueSTD_Backend/HueSTD.API/Program.cs`
- Tach CORS sang `HueSTD_Backend/HueSTD.API/Configuration/CorsConfigurationExtensions.cs`
- Tach khoi tao Supabase sang `HueSTD_Backend/HueSTD.API/Configuration/SupabaseWarmupExtensions.cs`

Suy ra hop ly:

- Nhom dang don dep `Program.cs`
- Dang chuan hoa startup configuration
- Dang lam backend on dinh hon cho local/dev va production

## 6. Cach chay du an

Backend:

```powershell
cd .\HueSTD_Backend\HueSTD.API
dotnet run
```

Frontend:

```powershell
cd .\HueSTD_Frontend
npm run dev
```

## 7. Neu can cap nhat file nay

Nen sua cac muc sau sau moi dot lam viec lon:

- `Trang thai hien tai cua du an`
- `Dau hieu cong viec dang lam gan day`
- Them `Quyet dinh ky thuat moi` neu co
- Them `Van de ton dong` neu phat sinh

## 8. Mau cap nhat nhanh sau moi phien

Co the them vao cuoi file theo format:

```md
## Update log

- 2026-03-24: Refactor startup backend, tach CORS va Supabase warmup khoi `Program.cs`.
- 2026-03-24: Xac nhan repo da co day du module auth, profile, documents, AI, chat, admin.
```

## 9. Luu y cho agent / AI

- Neu can hieu nhanh du an, doc file nay truoc roi doc `README.md`.
- Neu can biet chinh xac tinh nang, xem them:
  - `HueSTD_Frontend/components/`
  - `HueSTD_Backend/HueSTD.API/Controllers/`
  - `HueSTD_Backend/HueSTD.Infrastructure/Services/`
- Khong duoc xem file nay la nguon chan ly tuyet doi; phai doi chieu voi code khi sua logic quan trong.

## Update log

- 2026-03-24: Tao file bo nho du an de luu tong quan, tien do va dau viec gan day.
- 2026-03-24: Ghi nhan repo hien co cac module auth, profile, dashboard, documents, AI, chat, notifications, admin.
- 2026-03-24: Ghi nhan thay doi chua commit dang tap trung vao refactor startup/config backend.
