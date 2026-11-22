const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

function escapeHtml(rawText) {
    if (rawText === null || rawText === undefined) return '';
    return String(rawText).replace(/[&<>"']/g, ch => HTML_ESCAPE_MAP[ch]);
}

function sanitizeImageUrl(rawUrl) {
    if (typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.trim();
    const isAllowed = /^(https?:\/\/|data:image\/|\/|\.\/)/i.test(trimmed);
    return isAllowed ? trimmed : '';
}

function safeJsonParse(rawJson, fallbackValue) {
    if (!rawJson) return fallbackValue;
    try {
        const parsed = JSON.parse(rawJson);
        return parsed === null ? fallbackValue : parsed;
    } catch (parseErr) {
        console.error('JSON parse error:', parseErr);
        return fallbackValue;
    }
}

function safeStorageSet(storageKey, serializedText) {
    try {
        localStorage.setItem(storageKey, serializedText);
        return true;
    } catch (storageErr) {
        console.error(`Storage write failed (${storageKey}):`, storageErr);
        if (typeof showToast === 'function') {
            showToast('พื้นที่จัดเก็บข้อมูลในเบราว์เซอร์เต็ม กรุณาลดขนาดรูปภาพหรือล้างข้อมูลเก่า', 'error');
        }
        return false;
    }
}

window.products = safeJsonParse(localStorage.getItem('soulin_products'), null) || cloneDefaultProducts();
window.cart = safeJsonParse(localStorage.getItem('soulin_cart'), {});
window.orders = safeJsonParse(localStorage.getItem('soulin_orders'), []);
window.currentUser = safeJsonParse(localStorage.getItem('soulin_user'), null);
window.cmsConfig = safeJsonParse(localStorage.getItem('soulin_cms'), { ...DEFAULT_CMS_CONFIG });
window.currentProductFilter = 'all';

function saveCart() {
    safeStorageSet('soulin_cart', JSON.stringify(window.cart));
}

function getSavedWebhookUrl() {
    return localStorage.getItem('soulin_gsheet_webhook')
        || (window.cmsConfig && window.cmsConfig.gsheetWebhook)
        || '';
}
