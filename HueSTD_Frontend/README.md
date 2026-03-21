# HueSTD - Hue Student Community Hub

A comprehensive platform for Hue University students featuring:

- **Document Sharing** - Upload, search, and download study materials
- **AI Chat Assistant** - OCR-powered PDF analysis and intelligent Q&A
- **Community Marketplace** - Buy and sell used items
- **Real-time Messaging** - Direct messaging between students
- **Admin Dashboard** - Content moderation and user management

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: .NET 9 Web API (Clean Architecture)
- **Database**: Supabase (PostgreSQL + Storage + Realtime)
- **Deployment**: Vercel (frontend), dedicated server (backend)

## Getting Started

### Prerequisites

- Node.js 18+
- .NET 9 SDK
- Supabase account

### Frontend

```bash
cd HueSTD_Frontend
npm install
npm run dev
```

### Backend

```bash
cd HueSTD_Backend/HueSTD.API
dotnet run
```

## Environment Variables

### Frontend (.env.local)

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=/api
```

### Backend (appsettings.json)

```
Supabase:Url=your_supabase_url
Supabase:Key=your_service_role_key
Supabase:AnonKey=your_anon_key
```
