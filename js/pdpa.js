const PDPA_CONSENT_STORAGE_KEY = 'soulin_pdpa_consent';
const PDPA_POLICY_VERSION = '2026-11-v1';
window.soulinPdpaScrolledToBottom = false;

function loadPdpaConsent() {
    const rawStored = localStorage.getItem(PDPA_CONSENT_STORAGE_KEY);
    const parsedConsent = safeJsonParse(rawStored, null);
    if (!parsedConsent || typeof parsedConsent !== 'object') return null;
    return parsedConsent;
}

function hasCurrentPdpaConsent() {
    const existing = loadPdpaConsent();
    return Boolean(existing && existing.version === PDPA_POLICY_VERSION && existing.acceptedAt);
}

function isPdpaGateBlocked() {
    return Boolean(!hasCurrentPdpaConsent() && !window.soulinPdpaScrolledToBottom);
}

function hidePdpaConsentBanner() {
    const bannerEl = document.getElementById('pdpa-consent-banner');
    if (bannerEl) bannerEl.classList.add('hidden');
}

function closePdpaPreferencesModal() {
    const modalEl = document.getElementById('pdpa-modal');
    if (modalEl) modalEl.classList.add('hidden');
}

function savePdpaConsent(consentInput) {
    const spec = consentInput || {};
    const consentRecord = {
        version: PDPA_POLICY_VERSION,
        acceptedAt: new Date().toISOString(),
        essential: true,
        analytics: Boolean(spec.analytics),
        marketing: Boolean(spec.marketing),
        termsAccepted: Boolean(spec.termsAccepted)
    };
    if (!safeStorageSet(PDPA_CONSENT_STORAGE_KEY, JSON.stringify(consentRecord))) {
        return null;
    }
    hidePdpaConsentBanner();
    closePdpaPreferencesModal();
    if (typeof recordAuditLog === 'function') {
        recordAuditLog({
            category: 'system',
            action: 'PDPA_CONSENT_SAVED',
            targetId: PDPA_POLICY_VERSION,
            summary: `บันทึกความยินยอม PDPA (วิเคราะห์: ${consentRecord.analytics ? 'อนุญาต' : 'ปิด'}, การตลาด: ${consentRecord.marketing ? 'อนุญาต' : 'ปิด'})`,
            severity: 'info',
            metadata: { analytics: consentRecord.analytics, marketing: consentRecord.marketing }
        });
    }
    return consentRecord;
}

function acceptAllPdpaConsent() {
    if (isPdpaGateBlocked()) {
        showToast('กรุณาเลื่อนอ่านข้อกำหนดและ PDPA จนถึงด้านล่างสุดก่อนกดยอมรับ', 'info');
        return false;
    }
    savePdpaConsent({ analytics: true, marketing: true, termsAccepted: true });
    showToast('บันทึกความยินยอมความเป็นส่วนตัวทั้งหมดแล้ว', 'success');
    return true;
}

function acceptEssentialPdpaOnly() {
    if (isPdpaGateBlocked()) {
        showToast('กรุณาเลื่อนอ่านข้อกำหนดและ PDPA จนถึงด้านล่างสุดก่อนกดยอมรับ', 'info');
        return false;
    }
    savePdpaConsent({ analytics: false, marketing: false, termsAccepted: true });
    showToast('เลือกใช้เฉพาะข้อมูลที่จำเป็นต่อการทำงานแล้ว', 'info');
    return true;
}

function buildPdpaScrollContentHtml() {
    return `
        <div class="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div class="p-3 rounded-xl bg-soulin-mint/50 border border-emerald-200 text-soulin-dark">
                <strong class="block mb-1">ส่วนที่ 1: นโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA — พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562)</strong>
                <p>บริษัท โซลอิน แบรนด์ จำกัด (SOULIN Brand Co., Ltd.) เคารพสิทธิความเป็นส่วนตัวและจัดเก็บข้อมูลเท่าที่จำเป็นต่อการให้บริการร้านค้าออนไลน์อย่างโปร่งใส</p>
            </div>
            <p><strong>1. ข้อมูลที่จัดเก็บ:</strong> ชื่อ-นามสกุล, ชื่อผู้ใช้, เบอร์โทร, อีเมล/โปรไฟล์ Google, ที่อยู่จัดส่ง 4 ขั้นตอน, รายการสั่งซื้อ, ภาพสลิปโอนเงิน และบันทึกเหตุการณ์ความปลอดภัย (Audit Log)</p>
            <p><strong>2. วัตถุประสงค์และฐานกฎหมาย:</strong> ประมวลผลตามฐานสัญญา (จัดส่งสินค้าและออกหลักฐานคำสั่งซื้อ), ฐานกฎหมายทางบัญชี/ภาษี, ฐานประโยชน์โดยชอบธรรม (ป้องกันการทุจริต), และฐานความยินยอม (วิเคราะห์/โปรโมชั่น)</p>
            <p><strong>3. การเปิดเผยข้อมูล:</strong> ไม่จำหน่ายข้อมูลส่วนบุคคลให้บุคคลภายนอก ส่งต่อเฉพาะเท่าที่จำเป็นแก่ Supabase Cloud (ฐานข้อมูล/สลิป), Google OAuth 2.0 และผู้ให้บริการขนส่ง</p>
            <p><strong>4. การจัดเก็บและลบข้อมูลอัตโนมัติ:</strong> รูปภาพสลิปหรือไฟล์รูปที่ถูกยกเลิก/แทนที่จะถูกลบออกจาก Supabase Storage โดยอัตโนมัติไม่ให้ค้างในระบบ</p>
            <p><strong>5. มาตรการความปลอดภัย:</strong> รหัสผ่านเข้ารหัสด้วย SHA-256 + Salt, ป้องกันฐานข้อมูลด้วย Row Level Security (RLS) และบันทึก Audit Log แบบ Append-Only ห้ามลบแก้ไขย้อนหลัง</p>
            <p><strong>6. สิทธิของเจ้าของข้อมูล (7 ประการ):</strong> ขอเข้าถึง/รับสำเนา, ขอแก้ไข, ขอลบ/ทำลาย, ขอระงับการใช้, ขอโอนย้ายข้อมูล, คัดค้าน และถอนความยินยอมได้ที่ <strong>privacy@soulin-herbal.example</strong></p>
            <div class="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-slate-800">
                <strong class="block mb-1">ส่วนที่ 2: ข้อกำหนดและเงื่อนไขการใช้งานเว็บไซต์ (Terms of Use)</strong>
                <p>การใช้งานเว็บไซต์และการสั่งซื้อถือว่าท่านยอมรับเงื่อนไขด้านบัญชีผู้ใช้ ราคา ค่าจัดส่ง (เหมาจ่าย 40 ฿ / ลด 50 ฿ เมื่อซื้อครบ 500 ฿) และการตรวจสอบหลักฐานชำระเงินจริง</p>
            </div>
            <p><strong>7. การชำระเงิน:</strong> รองรับ PromptPay QR มาตรฐาน EMVCo พร้อมแนบสลิป และเก็บเงินปลายทาง (COD) ร้านขอสงวนสิทธิ์ตรวจสอบยอดเงินจริงก่อนจัดส่ง และปฏิเสธหากสลิปไม่ถูกต้อง</p>
            <p><strong>8. การยกเลิกและคืนสต็อก:</strong> คำสั่งซื้อที่ถูกปฏิเสธหรือยกเลิกก่อนจัดส่งจะคืนจำนวนสินค้าเข้าคลังโดยอัตโนมัติ</p>
            <p><strong>9. ทรัพย์สินทางปัญญาและกฎหมายไทย:</strong> ห้ามคัดลอก ดัดแปลง หรือใช้งานเว็บไซต์ในทางมิชอบ อยู่ภายใต้บังคับแห่งกฎหมายราชอาณาจักรไทย</p>
            <p class="text-[11px] font-semibold text-soulin-primary pt-1 text-center">— สิ้นสุดข้อความข้อกำหนดและนโยบาย PDPA (เวอร์ชัน ${PDPA_POLICY_VERSION}) —</p>
        </div>
    `;
}

function buildPdpaGateModalHtml() {
    return `
        <div class="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 relative smooth-shadow border border-emerald-100 space-y-4">
            <div class="space-y-1">
                <span class="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-soulin-mint text-soulin-primary px-2.5 py-1 rounded-full border border-emerald-200"><i class="fa-solid fa-shield-halved"></i> PDPA &amp; Terms of Use</span>
                <h3 class="text-lg font-bold text-soulin-dark">ข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว (PDPA)</h3>
                <p class="text-xs text-slate-500">กรุณาเลื่อนอ่านรายละเอียดด้านล่างให้ครบถ้วนเพื่อปลดล็อกปุ่มยอมรับ</p>
            </div>
            <div id="pdpa-scroll-box" onscroll="handlePdpaTermsScroll(this)" class="max-h-56 sm:max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/50 p-4 custom-scrollbar">
                ${buildPdpaScrollContentHtml()}
            </div>
            <div id="pdpa-scroll-hint" class="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl flex items-center gap-2">
                <i class="fa-solid fa-arrow-down-long animate-bounce"></i>
                <span>กรุณาเลื่อนข้อความด้านบนลงมาจนสุดก่อนกดยอมรับ</span>
            </div>
            <div class="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button type="button" id="pdpa-btn-essential" disabled onclick="acceptEssentialPdpaOnly()" class="opacity-50 cursor-not-allowed text-xs font-semibold text-soulin-dark bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3.5 py-2.5 rounded-xl transition-all">เฉพาะที่จำเป็น</button>
                <button type="button" id="pdpa-btn-accept-all" disabled onclick="acceptAllPdpaConsent()" class="opacity-50 cursor-not-allowed text-xs font-semibold text-white bg-soulin-primary hover:bg-soulin-dark px-4 py-2.5 rounded-xl shadow transition-all">ยอมรับและเข้าใช้งาน</button>
            </div>
        </div>
    `;
}

function unlockPdpaAcceptButtons() {
    ['pdpa-btn-essential', 'pdpa-btn-accept-all'].forEach(btnId => {
        const btnEl = document.getElementById(btnId);
        if (!btnEl) return;
        btnEl.disabled = false;
        btnEl.classList.remove('opacity-50', 'cursor-not-allowed');
    });
    const hintEl = document.getElementById('pdpa-scroll-hint');
    if (!hintEl) return;
    hintEl.className = 'text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl flex items-center gap-2';
    hintEl.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-600"></i><span>อ่านข้อกำหนดครบถ้วนแล้ว สามารถกดยอมรับเพื่อเข้าใช้งานได้</span>';
}

function handlePdpaTermsScroll(scrollBoxEl) {
    if (!scrollBoxEl || window.soulinPdpaScrolledToBottom) return false;
    const scrolledBottom = Number(scrollBoxEl.scrollTop || 0) + Number(scrollBoxEl.clientHeight || 0);
    const totalHeight = Number(scrollBoxEl.scrollHeight || 0);
    if (totalHeight > 0 && scrolledBottom < totalHeight - 16) {
        return false;
    }
    window.soulinPdpaScrolledToBottom = true;
    unlockPdpaAcceptButtons();
    return true;
}

function openPdpaGateModal() {
    const modalEl = document.getElementById('pdpa-modal');
    if (!modalEl) return;
    hidePdpaConsentBanner();
    window.soulinPdpaScrolledToBottom = false;
    modalEl.innerHTML = buildPdpaGateModalHtml();
    const essBtn = document.getElementById('pdpa-btn-essential');
    const allBtn = document.getElementById('pdpa-btn-accept-all');
    if (essBtn) essBtn.disabled = true;
    if (allBtn) allBtn.disabled = true;
    modalEl.classList.remove('hidden');
}

function buildPdpaBannerHtml() {
    return `
        <div class="max-w-5xl mx-auto bg-soulin-dark/95 backdrop-blur-md text-white rounded-3xl p-4 sm:p-5 border border-emerald-400/25 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div class="space-y-1 text-xs leading-relaxed">
                <div class="flex items-center gap-2 font-bold text-soulin-light"><i class="fa-solid fa-shield-halved text-emerald-300"></i><span>ความเป็นส่วนตัว (PDPA) และข้อกำหนดการใช้งาน SOULIN</span></div>
                <p class="text-emerald-100/85">โปรดอ่านรายละเอียดและตั้งค่าความยินยอมในการจัดเก็บข้อมูลของท่าน</p>
            </div>
            <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                <button type="button" onclick="openPdpaPreferencesModal()" class="text-xs font-semibold text-emerald-100 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-2 rounded-xl transition-all">ตั้งค่าความยินยอม</button>
                <button type="button" onclick="openPdpaGateModal()" class="text-xs font-semibold text-soulin-dark bg-amber-300 hover:bg-amber-200 px-4 py-2 rounded-xl shadow transition-all">อ่านและยอมรับ</button>
            </div>
        </div>
    `;
}

function renderPdpaConsentBanner() {
    const bannerEl = document.getElementById('pdpa-consent-banner');
    if (!bannerEl) return;
    if (hasCurrentPdpaConsent()) {
        bannerEl.classList.add('hidden');
        return;
    }
    bannerEl.innerHTML = buildPdpaBannerHtml();
    bannerEl.classList.remove('hidden');
}

function buildPdpaToggleRowHtml(toggleId, titleText, descText, isChecked) {
    const checkedAttr = isChecked ? 'checked' : '';
    return `
        <div class="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70">
            <div class="text-xs space-y-0.5"><span class="font-bold text-soulin-dark block">${escapeHtml(titleText)}</span><p class="text-[11px] text-slate-500 leading-relaxed">${escapeHtml(descText)}</p></div>
            <input type="checkbox" id="${escapeHtml(toggleId)}" ${checkedAttr} class="w-4 h-4 mt-1 accent-soulin-primary flex-shrink-0 cursor-pointer">
        </div>
    `;
}

function buildPdpaModalHtml(consentState) {
    const currentAnalytics = Boolean(consentState && consentState.analytics);
    const currentMarketing = Boolean(consentState && consentState.marketing);
    return `
        <div class="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 relative smooth-shadow border border-emerald-100 space-y-4">
            <button type="button" onclick="closePdpaPreferencesModal()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark text-lg"></i></button>
            <div class="space-y-1 pr-6">
                <h3 class="text-lg font-bold text-soulin-dark flex items-center gap-2"><i class="fa-solid fa-user-lock text-soulin-primary"></i> ตั้งค่าความยินยอมข้อมูลส่วนบุคคล (PDPA)</h3>
                <p class="text-[11px] text-slate-500">เลือกประเภทข้อมูลที่คุณอนุญาตให้ SOULIN ประมวลผล (เวอร์ชันนโยบาย ${PDPA_POLICY_VERSION})</p>
            </div>
            <div class="space-y-2.5">
                <div class="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-emerald-200 bg-soulin-mint/40">
                    <div class="text-xs space-y-0.5"><span class="font-bold text-soulin-dark block">ข้อมูลที่จำเป็นต่อการทำงานของระบบ</span><p class="text-[11px] text-slate-600">ใช้เพื่อเข้าสู่ระบบ ตะกร้าสินค้า ที่อยู่จัดส่ง สลิปโอนเงิน และความปลอดภัย (เปิดใช้งานเสมอ)</p></div>
                    <span class="text-[10px] font-bold bg-soulin-primary text-white px-2.5 py-1 rounded-full whitespace-nowrap">จำเป็น</span>
                </div>
                ${buildPdpaToggleRowHtml('pdpa-toggle-analytics', 'การวิเคราะห์และปรับปรุงบริการ', 'ช่วยให้ร้านเข้าใจสินค้ายอดนิยมและประสิทธิภาพหน้าเว็บเพื่อปรับปรุงประสบการณ์ช้อปปิ้ง', currentAnalytics)}
                ${buildPdpaToggleRowHtml('pdpa-toggle-marketing', 'โปรโมชั่นและข่าวสารพิเศษ', 'รับแจ้งโปรโมชั่น ส่วนลด หรือกลิ่นยาดมสมุนไพรสูตรใหม่จาก SOULIN', currentMarketing)}
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-soulin-primary font-semibold pt-1">
                <a href="./privacy.html#privacy" class="hover:underline"><i class="fa-solid fa-file-shield mr-1"></i>อ่านนโยบาย PDPA ฉบับเต็ม</a>
                <a href="./privacy.html#terms" class="hover:underline"><i class="fa-solid fa-file-contract mr-1"></i>อ่านข้อกำหนดการใช้งาน</a>
            </div>
            <div class="flex gap-2 pt-1">
                <button type="button" onclick="savePdpaPreferencesFromModal()" class="flex-1 bg-soulin-primary hover:bg-soulin-dark text-white font-semibold py-2.5 rounded-xl text-xs transition-all">บันทึกการตั้งค่าที่เลือก</button>
                <button type="button" onclick="window.soulinPdpaScrolledToBottom = true; acceptAllPdpaConsent()" class="bg-emerald-50 hover:bg-emerald-100 text-soulin-primary border border-emerald-200 font-semibold px-4 py-2.5 rounded-xl text-xs transition-all">ยอมรับทั้งหมด</button>
            </div>
        </div>
    `;
}

function openPdpaPreferencesModal() {
    const modalEl = document.getElementById('pdpa-modal');
    if (!modalEl) return;
    modalEl.innerHTML = buildPdpaModalHtml(loadPdpaConsent());
    modalEl.classList.remove('hidden');
}

function savePdpaPreferencesFromModal() {
    const analyticsEl = document.getElementById('pdpa-toggle-analytics');
    const marketingEl = document.getElementById('pdpa-toggle-marketing');
    const allowAnalytics = Boolean(analyticsEl && analyticsEl.checked);
    const allowMarketing = Boolean(marketingEl && marketingEl.checked);
    savePdpaConsent({ analytics: allowAnalytics, marketing: allowMarketing, termsAccepted: true });
    showToast('บันทึกการตั้งค่าความเป็นส่วนตัว (PDPA) เรียบร้อยแล้ว', 'success');
}

function isPrivacyDocPage() {
    const pathText = typeof window !== 'undefined' && window.location && window.location.pathname
        ? String(window.location.pathname)
        : '';
    return pathText.toLowerCase().includes('privacy.html');
}

function initPdpaConsentUi() {
    if (hasCurrentPdpaConsent()) {
        hidePdpaConsentBanner();
        return;
    }
    if (isPrivacyDocPage()) {
        renderPdpaConsentBanner();
        return;
    }
    openPdpaGateModal();
}

window.addEventListener('DOMContentLoaded', initPdpaConsentUi);
