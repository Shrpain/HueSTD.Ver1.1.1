-- ============================================
-- AI Chat Per-User Usage & Unlock System
-- ============================================

-- User AI Usage table: tracks per-user message limits, API keys, and unlock status
CREATE TABLE IF NOT EXISTS user_ai_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    api_key TEXT,
    message_limit INTEGER NOT NULL DEFAULT 10,
    messages_used INTEGER NOT NULL DEFAULT 0,
    is_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- AI Unlock Requests table: users request unlock from admin
CREATE TABLE IF NOT EXISTS ai_unlock_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_id UUID REFERENCES profiles(id),
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_user_ai_usages_user_id ON user_ai_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_unlock_requests_user_id ON ai_unlock_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_unlock_requests_status ON ai_unlock_requests(status);

-- Enable Row Level Security (RLS)
ALTER TABLE user_ai_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_unlock_requests ENABLE ROW LEVEL SECURITY;

-- Policies for user_ai_usages
-- Admins/moderators can read all
CREATE POLICY "Admins can read all user AI usages"
    ON user_ai_usages FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    ));

-- Service role bypass (backend uses service role key)
-- Users can only read/update their own usage
CREATE POLICY "Users can read own AI usage"
    ON user_ai_usages FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own AI usage"
    ON user_ai_usages FOR UPDATE
    USING (user_id = auth.uid());

-- Backend inserts usage records via service role key
CREATE POLICY "Service role can insert AI usage"
    ON user_ai_usages FOR INSERT
    WITH CHECK (true);

-- Policies for ai_unlock_requests
-- Admins can read all
CREATE POLICY "Admins can read all unlock requests"
    ON ai_unlock_requests FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    ));

-- Any authenticated user can create unlock requests
CREATE POLICY "Users can create unlock requests"
    ON ai_unlock_requests FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Admins can update (approve/reject)
CREATE POLICY "Admins can update unlock requests"
    ON ai_unlock_requests FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    ));

-- ============================================
-- Notification types for AI unlock
-- ============================================
-- Note: The notification type 'ai_unlock_approved' and 'ai_unlock_rejected'
-- will be handled by the NotificationService automatically
