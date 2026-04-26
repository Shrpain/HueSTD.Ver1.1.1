import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Configure PDF.js worker
// Using version matching the installed pdfjs-dist
// Configure PDF.js worker
// Using unpkg for better version matching with npm package.
// Note: pdfjs-dist v5+ uses .mjs for worker in some builds, but .min.js in 'build' folder is usually safe UMD/SystemJS or similar.
// Let's try the standard module-compatible worker if valid, or the classic one.
// For v5.x, 'pdf.worker.min.mjs' is common for modules.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export interface ExtractedSourcePayload {
    extractedText: string;
    extractor: string;
    ocrUsed: boolean;
    pageCount: number;
    metadataJson?: string;
}

/**
 * Extracts text from a PDF url.
 * Uses pdfjs-dist for standard text and Tesseract.js for OCR if needed.
 */
export const extractTextFromPdf = async (url: string, onProgress?: (status: string) => void): Promise<string> => {
    try {
        if (onProgress) onProgress(`Đang tải tài liệu (v${pdfjsLib.version})...`);
        console.log(`[PDF] Loading document from: ${url}`);

        // Load the PDF file with robust config
        const loadingTask = pdfjsLib.getDocument({
            url,
            cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
            cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        console.log(`[PDF] Loaded. Pages: ${pdf.numPages}`);

        let fullText = '';
        const totalPages = pdf.numPages;

        for (let i = 1; i <= totalPages; i++) {
            const progressMsg = `Đang xử lý trang ${i}/${totalPages}...`;
            if (onProgress) onProgress(progressMsg);

            try {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');

                console.log(`[PDF] Page ${i} text length: ${pageText.trim().length}`);

                // Heuristic: if page has very little text (< 20 chars), try OCR
                if (pageText.trim().length < 20) {
                    const ocrMsg = `Đang OCR trang ${i}/${totalPages} (Ảnh scan)...`;
                    if (onProgress) onProgress(ocrMsg);
                    console.log(`[PDF] Page ${i} triggering OCR...`);

                    // Render page to canvas for OCR
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    if (context) {
                        await page.render({ canvasContext: context, viewport: viewport } as any).promise;

                        // OCR with Tesseract
                        // 'vie' for Vietnamese, 'eng' for English
                        const { data: { text } } = await Tesseract.recognize(
                            canvas.toDataURL('image/png'),
                            'vie+eng',
                            // { logger: m => console.log(m) } // Optional logger
                        );

                        console.log(`[PDF] Page ${i} OCR Result length: ${text.length}`);
                        fullText += `--- Trang ${i} (OCR) ---\n${text}\n\n`;
                    }
                } else {
                    fullText += `--- Trang ${i} ---\n${pageText}\n\n`;
                }
            } catch (pageError) {
                console.error(`[PDF] Error processing page ${i}:`, pageError);
                fullText += `--- Trang ${i} (Lỗi đọc) ---\n\n`;
            }
        }

        if (fullText.trim().length === 0) {
            console.warn('[PDF] Extraction finished but result is empty.');
            return ''; // Or throw?
        }

        if (onProgress) onProgress('Hoàn tất trích xuất!');
        return fullText;

    } catch (error) {
        console.error('[PDF] Text extraction failed:', error);
        // Return empty string to trigger "Limited AI" warning in UI instead of crashing
        return '';
    }
};

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json'];

export const extractTextFromSource = async (
    url: string,
    onProgress?: (status: string) => void
): Promise<ExtractedSourcePayload> => {
    const normalizedUrl = url.split('?')[0].split('#')[0];
    const safeUrl = normalizedUrl.toLowerCase();

    if (safeUrl.endsWith('.pdf')) {
        const extractedText = await extractTextFromPdf(url, onProgress);
        return {
            extractedText,
            extractor: 'frontend-pdfjs+tesseract',
            ocrUsed: extractedText.includes('(OCR)'),
            pageCount: (extractedText.match(/--- Trang/g) || []).length,
            metadataJson: JSON.stringify({ type: 'pdf' })
        };
    }

    if (IMAGE_EXTENSIONS.some((extension) => safeUrl.endsWith(extension))) {
        if (onProgress) onProgress('Đang OCR hình ảnh...');
        const { data: { text } } = await Tesseract.recognize(url, 'vie+eng');
        return {
            extractedText: text,
            extractor: 'frontend-tesseract-image',
            ocrUsed: true,
            pageCount: 1,
            metadataJson: JSON.stringify({ type: 'image' })
        };
    }

    if (TEXT_EXTENSIONS.some((extension) => safeUrl.endsWith(extension))) {
        if (onProgress) onProgress('Đang đọc file văn bản...');
        const response = await fetch(url);
        const extractedText = await response.text();
        return {
            extractedText,
            extractor: 'frontend-fetch-text',
            ocrUsed: false,
            pageCount: 1,
            metadataJson: JSON.stringify({ type: 'text' })
        };
    }

    throw new Error('Định dạng nguồn này chưa hỗ trợ OCR/scan tự động. Hiện chỉ hỗ trợ PDF, ảnh và file văn bản.');
};

/**
 * Generate system prompt for reading document
 */
export const getSystemPrompt = (context: string): string => {
    return `Đây là nội dung của tài liệu. Hãy đọc kỹ và ghi nhớ để trả lời câu hỏi của người dùng.\n\nNội dung tài liệu:\n${context}`;
};

/**
 * Chat with AI about document content
 * Calls backend API which uses stored Gemini API key
 */
export const chatWithDocument = async (
    message: string,
    context: string,
    isSystemPrompt: boolean = false
): Promise<string> => {
    console.log('[AI] Starting chatWithDocument...', { isSystemPrompt, messageLength: message?.length, contextLength: context?.length });

    try {
        const { default: api } = await import('./api');
        console.log('[AI] Importing api module...');
        const apiInstance = api;
        console.log('[AI] API module imported successfully');

        const token = localStorage.getItem('accessToken');

        console.log('[AI] Sending POST to /Ai/chat...');
        const response = await apiInstance.post('/Ai/chat', {
            message,
            context,
            isSystemPrompt
        }, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        console.log('[AI] Response received:', response.status, response.data);

        if (response.data.success) {
            return response.data.content;
        } else {
            console.error('[AI] Error from backend:', response.data.error);
            const err = new Error(response.data.error || 'Lỗi không xác định từ AI') as any;
            err.errorCode = response.data.errorCode;
            throw err;
        }
    } catch (error: any) {
        console.error('[AI] Chat request failed:', error);
        console.error('[AI] Error details:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });

        if (error.response?.status === 403) {
            const serverError = error.response?.data?.error;
            const err = new Error(serverError || 'Bạn đã hết lượt hỏi AI.') as any;
            err.errorCode = 'limit_exceeded';
            throw err;
        }
        if (error.response?.status === 401) {
            throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        }
        if (error.response?.status === 500) {
            const serverError = error.response?.data?.error;
            throw new Error(serverError || 'Lỗi server. Vui lòng thử lại sau.');
        }

        throw new Error(error.message || 'Không thể kết nối đến AI. Vui lòng thử lại.');
    }
};

/** AI usage returned by GET /AI/my-usage */
export interface MyAiUsage {
    messagesUsed: number;
    messageLimit: number;
    remaining: number;
    isUnlocked: boolean;
    hasDedicatedApi: boolean;
}

/**
 * Get current user's AI usage status
 */
export const getMyAiUsage = async (): Promise<MyAiUsage> => {
    const { default: api } = await import('./api');
    const token = localStorage.getItem('accessToken');
    if (!token) {
        throw Object.assign(new Error('not_authenticated'), { status: 401 });
    }
    const response = await api.get('/Ai/my-usage', {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

/**
 * Generate exam questions from text content using AI
 */
export const generateExamFromAI = async (content: string, questionCount: number): Promise<any> => {
    try {
        const { default: api } = await import('./api');
        const token = localStorage.getItem('accessToken');
        const response = await api.post('/Ai/generate-exam', {
            content,
            questionCount
        }, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        return response.data;
    } catch (error: any) {
        console.error('[AI] Generate exam failed:', error);
        throw new Error(error.response?.data?.error || error.message || 'Không thể tạo đề thi bằng AI. Vui lòng thử lại.');
    }
};
