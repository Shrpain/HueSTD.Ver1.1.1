# HueSTD

Nền tảng cộng đồng sinh viên Huế với:
- Frontend React + Vite
- Backend .NET 9 Web API
- Supabase cho Auth, Database, Storage, Realtime

README này tập trung vào mục tiêu: cài một lần, sau đó chạy local ổn định với ít thao tác nhất.

## 1. Yêu cầu trước khi chạy

Cần cài sẵn:
- `Node.js` 20 trở lên
- `npm`
- `.NET SDK 9.0`
- PowerShell trên Windows

Khuyến nghị kiểm tra nhanh:

```powershell
node -v
npm -v
dotnet --version
```

## 2. Cấu trúc repo

```text
c:\khoaLuan
├── HueSTD_Frontend
├── HueSTD_Backend
└── setup-local.ps1
```

- `HueSTD_Frontend`: giao diện người dùng
- `HueSTD_Backend`: API .NET
- `setup-local.ps1`: script tạo file cấu hình local backend

## 3. Thiết lập lần đầu

### Bước 1: clone repo

```powershell
git clone <url-repo>
cd <thu-muc-repo>
```

### Bước 2: tạo file cấu hình local backend

Chạy:

```powershell
.\setup-local.ps1
```

Script sẽ:
- lấy [appsettings.json](/c:/khoaLuan/HueSTD_Backend/HueSTD.API/appsettings.json) làm template
- tạo [appsettings.Development.json](/c:/khoaLuan/HueSTD_Backend/HueSTD.API/appsettings.Development.json) nếu chưa có
- không ghi đè file local đang tồn tại

Nếu muốn tạo lại từ đầu:

```powershell
.\setup-local.ps1 -Force
```

### Bước 3: điền config local thật

Mở file:

- [appsettings.Development.json](/c:/khoaLuan/HueSTD_Backend/HueSTD.API/appsettings.Development.json)

Điền các giá trị thật:
- `Supabase:Url`
- `Supabase:Key`
- `Supabase:AnonKey`
- `Supabase:ServiceRoleKey`
- `AI:DefaultApiKey` nếu bạn dùng AI backend riêng

Lưu ý:
- `appsettings.json` được giữ ở dạng mẫu
- `appsettings.Development.json` đã được ignore trong Git, chỉ dùng local

### Bước 4: cài package frontend

```powershell
cd .\HueSTD_Frontend
npm install
cd ..
```

### Bước 5: restore backend

```powershell
cd .\HueSTD_Backend
dotnet restore
cd ..
```

Sau bước này, máy local coi như đã cài xong.

## 4. Chạy hằng ngày

Mỗi lần làm việc, mở 2 terminal.

### Terminal 1: chạy backend

```powershell
cd .\HueSTD_Backend\HueSTD.API
dotnet run
```

Backend mặc định chạy ở:
- `http://localhost:5136`
- `https://localhost:7058`

### Terminal 2: chạy frontend

```powershell
cd .\HueSTD_Frontend
npm run dev
```

Frontend thường chạy ở:
- `http://localhost:3000` hoặc
- `http://localhost:5173`

## 5. Cách kiểm tra app đã lên đúng

### Backend

Mở:

- `http://localhost:5136/swagger`

Nếu thấy Swagger là backend đã chạy.

### Frontend

Mở:

- `http://localhost:3000`
- hoặc `http://localhost:5173`

Nếu giao diện lên và gọi được dữ liệu dashboard/chat thì hệ thống đang kết nối đúng.

## 6. Nếu clone về mà muốn chạy nhanh nhất

Quy trình ngắn nhất:

```powershell
.\setup-local.ps1
cd .\HueSTD_Frontend
npm install
cd ..\HueSTD_Backend
dotnet restore
```

Từ những lần sau chỉ cần:

```powershell
cd .\HueSTD_Backend\HueSTD.API
dotnet run
```

và ở terminal khác:

```powershell
cd .\HueSTD_Frontend
npm run dev
```

## 7. Các lỗi thường gặp

### Lỗi backend không lên vì thiếu Supabase config

Dấu hiệu:
- backend báo thiếu `Supabase:Url`
- hoặc thiếu key hợp lệ

Cách xử lý:
- kiểm tra [appsettings.Development.json](/c:/khoaLuan/HueSTD_Backend/HueSTD.API/appsettings.Development.json)
- đảm bảo không còn placeholder như `YOUR_SUPABASE_SERVICE_ROLE_KEY`

### Lỗi frontend lên nhưng không gọi được API

Kiểm tra:
- backend có đang chạy ở `http://localhost:5136`
- CORS có cho phép `localhost:3000` / `localhost:5173`

### Lỗi chat không realtime

Kiểm tra:
- user đã đăng nhập thành công
- backend và frontend cùng đang chạy
- Supabase token/session đang hợp lệ

### Lỗi login Google có session nhưng UI chưa nhận

Hiện tại repo đã có fix logic trong `AuthContext`, nhưng nếu gặp lại:
- xóa local storage cũ
- đăng nhập lại

## 8. Quy ước config

- Không commit secret thật vào GitHub
- Chỉ commit file mẫu:
  - [appsettings.json](/c:/khoaLuan/HueSTD_Backend/HueSTD.API/appsettings.json)
- Chỉ giữ file local:
  - [appsettings.Development.json](/c:/khoaLuan/HueSTD_Backend/HueSTD.API/appsettings.Development.json)

## 9. Lệnh hữu ích

### Tạo lại file config local từ template

```powershell
.\setup-local.ps1 -Force
```

### Kiểm tra backend build

```powershell
cd .\HueSTD_Backend\HueSTD.API
dotnet build
```

### Build frontend

```powershell
cd .\HueSTD_Frontend
npm run build
```

## 10. Ghi chú vận hành

- Nếu đang chạy backend rồi mà sửa controller/service lớn, đôi khi nên restart `dotnet run`
- Nếu frontend giữ state cũ sau khi đổi auth/chat, nên hard refresh trình duyệt
- `appsettings.Development.json` là file local riêng, không phải file để push

## 11. Tóm tắt ngắn

Cài lần đầu:

```powershell
.\setup-local.ps1
cd .\HueSTD_Frontend
npm install
cd ..\HueSTD_Backend
dotnet restore
```

Chạy hằng ngày:

```powershell
cd .\HueSTD_Backend\HueSTD.API
dotnet run
```

```powershell
cd .\HueSTD_Frontend
npm run dev
```
