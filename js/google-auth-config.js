/*
 * วิธีเปิดใช้งาน Google Sign-In จริง (Google Identity Services):
 * 1. สร้าง OAuth 2.0 Client ID (Web application) ที่ https://console.cloud.google.com/apis/credentials
 * 2. เพิ่ม Authorized JavaScript origins เช่น http://localhost:5500 หรือ https://yourdomain.com
 * 3. นำ Client ID (ลงท้ายด้วย .apps.googleusercontent.com) มาวางใน clientId ด้านล่าง
 * หมายเหตุ: Google OAuth ไม่อนุญาตโปรโตคอล file:// จึงมีโหมดจำลอง (Demo Mode) ให้ทดสอบได้ทันทีบนเครื่อง
 */
window.SOULIN_GOOGLE_AUTH_CONFIG = {
    clientId: '99554895464-l2r9vdvagdmtonnick78q4hcq8t0o1q1.apps.googleusercontent.com',
    enableDemoFallback: true
};
