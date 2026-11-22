/*
 * การตั้งค่าเชื่อมต่อ Supabase:
 * 1. รันไฟล์ supabase/schema.sql ใน Supabase SQL Editor ของโปรเจกต์ใหม่ของคุณ
 * 2. คัดลอก Project URL และ Publishable key (sb_publishable_...) จาก Settings -> API Keys
 *    คำเตือนความปลอดภัย: ห้ามใส่ Secret key หรือ service_role key ในไฟล์ฝั่งหน้าเว็บเด็ดขาด
 * 3. นำมาวางใน url และ publishableKey ด้านล่าง ระบบจะสลับจาก Local Mode เป็น Supabase Real-time Sync อัตโนมัติ
 */
window.SOULIN_SUPABASE_CONFIG = {
    url: 'https://lyllujgfvutdeasqpzry.supabase.co',
    publishableKey: 'sb_publishable_PEtLr7WJRFRBTfczGBBU2A_cEAuv-Uu',
    storageBucket: 'soulin-images',
    enableRealtime: true
};
