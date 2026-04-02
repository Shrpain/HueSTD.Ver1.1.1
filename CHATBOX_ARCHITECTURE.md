# CHATBOX_ARCHITECTURE

## Muc tieu

Chat box trong HueSTD duoc thiet ke de:

- biet user nao dang chat
- biet user dang o trang nao va module nao
- giu cung mot session khi user doi trang
- reconnect va queue tin nhan khi mat mang tam thoi
- tra loi bang markdown dep, co quick replies va tim kiem hoi thoai
- de mo rong sang RAG, handover, knowledge base va multi-device sync

## Kien truc hien tai trong repo

- Realtime chinh: `SignalR` tren backend .NET
- Realtime bo tro san co: `Supabase Realtime` cho notifications/chat/doc updates
- AI response: tai su dung `IAiService`
- Session isolation: khoa session la `userId:sessionId`
- Client persistence: localStorage theo user de giu session, locale, persona, quick replies va queue offline

## Nhung gi da hoan thien trong code

- Giu cung `sessionId` khi user di chuyen giua cac trang
- Re-join session khi route thay doi de cap nhat `pagePath`, `pageTitle`, `module`, `metadata`
- `SignalR` tu reconnect voi backoff
- Offline queue o frontend, gui lai khi co mang va ket noi hoi phuc
- Rich messages qua markdown, links, code blocks, tables, math va images
- Quick replies / suggested replies
- Search trong hoi thoai hien tai
- i18n co ban cho `vi-VN` va `en-US`
- Accessibility co ban: `aria-label`, `aria-live`, `role="log"`, keyboard send
- User profile trong header chatbox, ho tro chon persona
- Context-aware replies: gui metadata ve route, title, userId, userRole
- Truncation / short-term summary o backend de context gui sang LLM khong phinh vo han
- Handover co ban: gui yeu cau thong bao cho admin
- Notification tren browser khi assistant tra loi luc tab dang an

## Nhung gi chua the goi la production-complete

Nhung muc duoi day can them ha tang, DB schema hoac service rieng. Repo hien tai moi dung o muc scaffold hoac feature flag:

- RAG voi vector DB va tai lieu noi bo
- Knowledge base / FAQ ingestion va ranking
- Multi-device sync that su
- Push/email notifications tu backend
- Handover den nhan vien that kem transfer history va SLA
- OCR/indexing file attachment vao vector store
- Streaming token that su tu LLM
- Redis backplane neu scale nhieu instance backend

## Flow hien tai

1. Frontend mo `AssistantChatBox`
2. SignalR ket noi den `/hubs/assistant` kem access token
3. Frontend gui `JoinSession` voi `sessionId`, route, locale, persona va metadata
4. Backend lay user tu token, ghep context hien tai va tra ve snapshot session
5. User gui cau hoi
6. Backend gioi han lich su, tom tat doan cu, roi goi `IAiService.ChatAsync`
7. Assistant tra loi realtime qua SignalR
8. Neu mat mang, client queue tin nhan va flush lai sau khi reconnect

## Khi nhieu user cung dung

- Moi session duoc tach bang khoa `userId:sessionId`
- Context khong bi tron giua user A va B
- Moi connection chi nhan event trong group session cua no
- Neu can scale ngang, buoc tiep theo la dua session state vao DB/Redis thay vi RAM

## Huong mo rong tiep theo

- Luu session/messages vao Supabase de co multi-device sync that su
- Them bang `assistant_sessions`, `assistant_messages`, `assistant_handover_requests`
- Them pipeline ingest cho documents/FAQ sang vector store
- Them streaming response tu AI provider
- Them rate limit, telemetry, audit log va moderation
