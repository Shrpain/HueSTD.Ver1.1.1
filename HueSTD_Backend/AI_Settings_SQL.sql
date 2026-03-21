-- SQL để tạo AI settings trong Supabase
-- Chạy trong Supabase Dashboard > SQL Editor

-- Tạo bản ghi API Key cho AI (thay YOUR_API_KEY bằng API key thực)
INSERT INTO api_settings (id, key_name, key_value, description, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'ai_api_key',
    'sk-3ec6ef1e80454a81be1a1e9849f85662', -- Thay bằng API key của bạn
    'Gemini API Key cho AI Chat',
    NOW(),
    NOW()
) ON CONFLICT (key_name) DO UPDATE SET key_value = EXCLUDED.key_value;

-- Tạo bản ghi Model cho AI
INSERT INTO api_settings (id, key_name, key_value, description, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'ai_model',
    'gemini-3-flash',
    'Model ID cho Gemini API',
    NOW(),
    NOW()
) ON CONFLICT (key_name) DO UPDATE SET key_value = EXCLUDED.key_value;
