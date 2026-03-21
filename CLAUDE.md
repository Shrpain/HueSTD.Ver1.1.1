# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HueSTD is a full-stack application with:
- **Frontend**: React 19 + TypeScript + Vite (HueSTD_Frontend/)
- **Backend**: .NET 9 Web API (HueSTD_Backend/)
- **Database/Storage**: Supabase (PostgreSQL + Storage + Realtime)
- **Deployment**: Vercel (frontend), dedicated server (backend)

## Commands

### Frontend (HueSTD_Frontend/)
```bash
npm install          # Install dependencies
npm run dev          # Start development server (port 3000)
npm run build        # Build production assets
npm run preview      # Preview built assets
npm run test         # Run all tests
npm run test -- --filter "Document upload"  # Run specific test
npm run lint         # Check code quality
npm run lint:fix     # Auto-fix lint issues
```

### Backend (HueSTD_Backend/HueSTD.API/)
```bash
dotnet run                    # Start API (port 5136)
dotnet build                  # Build project
dotnet test                   # Run all tests
dotnet test --filter "Name=DocumentUploadTests"  # Run specific test
```

## Architecture

### Backend
- **Clean Architecture** with layers:
  - *Presentation*: API controllers and middleware (HueSTD.API/)
  - *Application*: Business logic and DTOs (HueSTD.Application/)
  - *Domain*: Core entities and interfaces (HueSTD.Domain/)
  - *Infrastructure*: Data access and external services (HueSTD.Infrastructure/)

### Frontend
- Modular structure with feature-based components (DocumentModule, AdminModule, etc.)
- Authentication via Supabase OAuth with JWT token management
- API requests proxied through Vite dev server to backend
- State managed via React Context (AuthContext)

## Environment Variables

### Frontend
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=/api
```

### Backend
```
Supabase:Url=...
Supabase:Key=...
Supabase:AnonKey=...
Supabase:ServiceRoleKey=...
AllowedOrigins=http://localhost:3000,...
```

## Important Patterns

- **File Upload**: Backend uses Supabase Service Role key to bypass RLS
- **Document Approval**: Admins must approve documents before public visibility
- **Realtime Updates**: Supabase Realtime channels for profile changes
- **CORS Configuration**: Backend allows origins from appsettings

## Supabase MCP Server

**MCP Server**: `user-Supabase` (enabled at `C:\Users\Administrator\.cursor\projects\c-khoaLuan\mcps\user-Supabase`)

**Khi cần thao tác với Database**: Luôn dùng MCP Supabase, KHÔNG cần tạo file SQL hay script migration thủ công.

Tuy nhiên, **KHÔNG dùng MCP cho các tác vụ thông thường** (đọc data, insert, update — những thứ backend đã làm qua Supabase client). MCP chỉ dùng khi backend chưa hỗ trợ và cần tạo bảng/column mới.

### Các tool MCP có sẵn
- `execute_sql` — Chạy SQL thuần trong Postgres (DDL, DML)
- `apply_migration` — Áp dụng migration mới
- `list_migrations` — Xem danh sách migration
- `list_tables` — Liệt kê các bảng
- `list_extensions` — Liệt kê extensions
- `search_docs` — Tìm tài liệu Supabase
- `get_logs` — Xem logs của edge functions
- `deploy_edge_function` — Deploy Supabase Edge Functions
- `get_publishable_keys` / `get_project_url` — Lấy config
- `generate_typescript_types` — Generate types từ schema
- Git operations: `create_branch`, `list_branches`, `merge_branch`, etc.