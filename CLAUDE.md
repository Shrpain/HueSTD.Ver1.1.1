# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (HueSTD_Frontend/)
```bash
npm ci          # Fast reinstall of dependencies
npm run dev     # Start dev server (http://localhost:3000)
npm run build   # Build production assets
npm run preview # Preview built assets
npm run test    # Run all tests
npm run test -- --filter "<pattern>"   # Run a specific test
npm run lint    # Lint code
npm run lint:fix # Auto-fix lint issues
```

### Backend (HueSTD_Backend/HueSTD.API/)
```powershell
dotnet build                     # Build project
dotnet run                       # Start API (http://localhost:5136)
dotnet test                        # Run all tests
dotnet test --filter "Name=DocumentUploadTests"  # Run a specific test
dotnet clean                       # Clean bin/obj folders
```

## Architecture (high‑level)

- **Backend**: Clean Architecture layers
  - *Presentation*: API controllers & middleware (`HueSTD.API/Controllers/`)
  - *Application*: Business logic & DTOs (`HueSTD.Application/DTOs/`, `HueSTD.Application/Services/`)
  - *Domain*: Core entities & interfaces (`HueSTD.Domain/Entities/`, `Interfaces/`)
  - *Infrastructure*: Data access, external services, config (`HueSTD.Infrastructure/...`)

- **Frontend**: Feature‑based modules in `HueSTD_Frontend/components/`.  
  - Authentication via Supabase OAuth (JWT).  
  - API calls proxied through Vite to backend.  
  - Global state via React Context (`AuthContext`).

- **Database / Auth / Realtime**: Supabase (PostgreSQL + Storage + Realtime).  
  - Backend uses the **Service Role key** for uploads and bypassing RLS when needed.  
  - Document approval flow: `draft` → `pending` → `approved` → `published`. Only `approved` docs become publicly accessible.

## Environment Variables

### Frontend (`.env.local`)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=/api
```

### Backend (`appsettings.Development.json` / env)
```json
{
  "Supabase": {
    "Url": "...",
    "Key": "...",
    "AnonKey": "...",
    "ServiceRoleKey": "...",
    "AllowedOrigins": "http://localhost:3000,https://prod.example.com"
  }
}
```

## Important Patterns

- **File Upload**: Backend streams file to Supabase Storage using the Service Role key; front‑end obtains a pre‑signed URL for final upload.
- **Document Approval**: Documents transition `draft` → `pending` → `approved` → `published`. Only `approved` docs are publicly visible.
- **Realtime Updates**: Supabase Realtime channels (`profile`, `documents`) push updates to connected clients.
- **CORS**: Configurable via `CorsConfigurationExtensions`; matches allowed origins from config.

## Supabase MCP Server

- **Location**: `C:\Users\Administrator\.cursor\projects\c-khoaLuan\mcps\user-Supabase`
- **Use**: Only for schema migrations, extension management, or when backend lacks support.  
  Available tools: `execute_sql`, `apply_migration`, `list_migrations`, `list_tables`, `search_docs`, `get_logs`, `deploy_edge_function`, `generate_typescript_types`.

## Update Log (recommended)

Add a short markdown section at the bottom of this file whenever you make structural or configuration changes, e.g.:

```markdown
## Update log

- 2026-03-24: Refactored CORS setup into separate file, added Supabase warm‑up extension.
- 2026-03-25: Added Document approval workflow, introduced AI chat module.
```

Do **not** add generic development advice or list every file. Keep the file concise and focused on commands, architecture, and key patterns that aid a new Claude instance in getting productive quickly.