# คู่มืออัปโหลดเว็บไซต์ SOULIN ขึ้น Cloudflare Pages

ไฟล์ทุกอย่างในโฟลเดอร์ `d:\soulin` เป็น Static Website (HTML + CSS + JS) เชื่อมฐานข้อมูล **Supabase** และ **Google OAuth** แล้ว พร้อมอัปโหลดขึ้น Cloudflare Pages ได้ทันทีโดยไม่ต้องมีขั้นตอน Build ค่ะ

---

## วิธีที่ 1: Direct Upload (เร็วที่สุด — ลากโฟลเดอร์วาง จบใน 1 นาที)

1. ล็อกอินที่ [dash.cloudflare.com](https://dash.cloudflare.com)
2. เมนูด้านซ้ายเลือก **Workers & Pages** → กด **Create** → เลือกแท็บ **Pages** → **Use direct upload**
3. ตั้งชื่อโปรเจกต์ (เช่น `soulin-store` จะได้ลิงก์ `https://soulin-store.pages.dev`)
4. ลากโฟลเดอร์ **`d:\soulin`** ทั้งโฟลเดอร์มาวาง แล้วกด **Deploy site**

---

## วิธีที่ 2: เชื่อม GitHub Auto-Deploy (แนะนำเมื่อต้องอัปเดตโค้ดบ่อย)

1. สร้าง Repository บน GitHub แล้ว Push โฟลเดอร์ `d:\soulin` ขึ้นไป (ไฟล์ `.gitignore` จะกันไฟล์ชั่วคราวให้อัตโนมัติ)
2. ใน Cloudflare **Workers & Pages → Create → Pages → Connect to Git** เลือก Repository ของคุณ
3. ตั้งค่า Build ตามนี้:
   - **Framework preset:** `None`
   - **Build command:** *(เว้นว่าง)*
   - **Build output directory:** `/`
4. กด **Save and Deploy**

---

## Checklist สำคัญหลังขึ้นโฮสต์จริง (ต้องทำครบทุกข้อ!)

1. **ตั้งค่า Google Sign-In บนโดเมนจริง (`*.pages.dev` หรือโดเมนร้านของคุณ)**
   - ไปที่ [Google Cloud Console → Clients](https://console.cloud.google.com/auth/clients) → เลือก Web Client เดิม → เพิ่ม `https://soulin-store.pages.dev` (หรือโดเมนจริงของคุณ) ใน **Authorized JavaScript origins** แล้วกด **Save**
   - ไปที่ [Google Cloud Console → Audience](https://console.cloud.google.com/auth/audience) → หากเปิดใช้งานให้ลูกค้าทั่วไปใช้จริง ให้กด **Publish App** (หากยังอยู่ในโหมด Testing จะเข้าสู่ระบบด้วย Google ได้เฉพาะอีเมลที่เพิ่มใน Test users)
2. **ตั้งค่าบัญชีรับเงินพร้อมเพย์และธนาคารจริงของร้าน**
   - เข้า `https://<โดเมนของคุณ>/admin` → ล็อกอินแอดมิน → แท็บ **ปรับแต่ง CMS** → แก้เบอร์พร้อมเพย์, ชื่อบัญชี, และเลขบัญชีธนาคารจริง แล้วกด **บันทึกการตั้งค่าชำระเงิน**
3. **เปลี่ยนอีเมล DPO (PDPA) ใน `privacy.html`**
   - แก้คำว่า `privacy@soulin-herbal.example` ในไฟล์ `privacy.html` (และข้อความแจ้งเตือนใน `js/pdpa.js`) เป็นอีเมลติดต่อจริงของร้าน
4. **ตรวจความเรียบร้อยหลัง Deploy**
   - ทดสอบเข้า `https://<โดเมนของคุณ>/supabase/schema.sql` ต้องขึ้น `404` (ไฟล์ `_redirects` ปิดกั้นไม่ให้บุคคลภายนอกอ่าน Schema)
   - ทดสอบเปิดโหมด Incognito เพื่อเช็ก **PDPA Scroll-to-Bottom Pop-up**, สั่งซื้อสินค้า, สแกน PromptPay QR, แนบสลิป, และตรวจรายการในแท็บ **ประวัติ Log (Append-Only)**
