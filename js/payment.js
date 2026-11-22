window.soulinPaymentState = {
    method: 'promptpay',
    slipUrl: '',
    referenceNote: ''
};

const PAYMENT_METHOD_LABELS = {
    promptpay: 'พร้อมเพย์ QR / โอนเงิน',
    cod: 'เก็บเงินปลายทาง (COD)',
    stripe: 'บัตรเครดิต/พร้อมเพย์ (Stripe)',
    omise: 'Payment Gateway (Omise)'
};

const PAYMENT_STATUS_META_MAP = {
    paid: { label: 'ชำระแล้ว', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    awaiting_verification: { label: 'รอตรวจสลิป', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
    cod_pending: { label: 'เก็บเงินปลายทาง', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    rejected: { label: 'สลิปไม่ผ่าน/ยกเลิก', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    pending: { label: 'รอชำระเงิน', cls: 'bg-slate-100 text-slate-700 border-slate-200' }
};

function getActivePaymentConfig() {
    const baseCfg = typeof DEFAULT_PAYMENT_CONFIG !== 'undefined' ? DEFAULT_PAYMENT_CONFIG : {};
    const cmsPayCfg = window.cmsConfig && window.cmsConfig.paymentConfig ? window.cmsConfig.paymentConfig : {};
    const mergedCfg = { ...baseCfg, ...cmsPayCfg };
    mergedCfg.enablePromptpay = mergedCfg.enablePromptpay !== false;
    mergedCfg.enableCod = mergedCfg.enableCod !== false;
    mergedCfg.codFee = Math.max(0, Number(mergedCfg.codFee) || 0);
    return mergedCfg;
}

function getPaymentMethodLabel(methodKey) {
    return PAYMENT_METHOD_LABELS[methodKey] || 'พร้อมเพย์ QR / โอนเงิน';
}

function getPaymentStatusBadgeMeta(statusKey) {
    return PAYMENT_STATUS_META_MAP[statusKey] || PAYMENT_STATUS_META_MAP.pending;
}

function computeEmvCrc16(rawText) {
    let crcWord = 0xFFFF;
    for (let charIdx = 0; charIdx < rawText.length; charIdx++) {
        crcWord ^= rawText.charCodeAt(charIdx) << 8;
        for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
            const highBit = (crcWord & 0x8000) !== 0;
            crcWord = highBit ? ((crcWord << 1) ^ 0x1021) : (crcWord << 1);
            crcWord &= 0xFFFF;
        }
    }
    return crcWord.toString(16).toUpperCase().padStart(4, '0');
}

function encodeEmvTlv(tagCode, fieldText) {
    const lenStr = String(fieldText.length).padStart(2, '0');
    return `${tagCode}${lenStr}${fieldText}`;
}

function formatPromptPayTarget(rawId) {
    const digitsOnly = String(rawId || '').replace(/\D/g, '');
    if (digitsOnly.length === 10 && digitsOnly.startsWith('0')) {
        return { tag: '01', targetValue: `0066${digitsOnly.slice(1)}` };
    }
    if (digitsOnly.length === 13) {
        return { tag: '02', targetValue: digitsOnly };
    }
    if (digitsOnly.length === 15) {
        return { tag: '03', targetValue: digitsOnly };
    }
    return null;
}

function buildPromptPayPayload(rawId, amountThb) {
    const targetSpec = formatPromptPayTarget(rawId);
    if (!targetSpec) return '';
    const aidPart = encodeEmvTlv('00', 'A000000677010111');
    const targetPart = encodeEmvTlv(targetSpec.tag, targetSpec.targetValue);
    const merchantField = encodeEmvTlv('29', `${aidPart}${targetPart}`);
    const numericAmount = Number(amountThb);
    const hasAmount = Number.isFinite(numericAmount) && numericAmount > 0;
    const methodFlag = hasAmount ? '12' : '11';
    const amountSection = hasAmount ? encodeEmvTlv('54', numericAmount.toFixed(2)) : '';
    const qrBodyText = [
        encodeEmvTlv('00', '01'),
        encodeEmvTlv('01', methodFlag),
        merchantField,
        encodeEmvTlv('58', 'TH'),
        encodeEmvTlv('53', '764'),
        amountSection,
        '6304'
    ].join('');
    return `${qrBodyText}${computeEmvCrc16(qrBodyText)}`;
}

function renderPromptPayQrInto(containerId, qrText) {
    const boxEl = document.getElementById(containerId);
    if (!boxEl) return;
    if (!qrText) {
        boxEl.innerHTML = '<div class="text-xs text-rose-600 p-4 bg-rose-50 rounded-xl border border-rose-200">เบอร์พร้อมเพย์ร้านค้าไม่ถูกต้อง กรุณาติดต่อแอดมิน</div>';
        return;
    }
    boxEl.innerHTML = '';
    if (typeof window.QRCode === 'function') {
        new window.QRCode(boxEl, {
            text: qrText,
            width: 180,
            height: 180,
            colorDark: '#1E3E2B',
            colorLight: '#FFFFFF'
        });
        return;
    }
    boxEl.innerHTML = `<div class="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-center space-y-1"><span class="text-[11px] font-semibold text-soulin-dark block">PromptPay EMVCo Code</span><code class="block text-[10px] break-all text-slate-600">${escapeHtml(qrText)}</code></div>`;
}

function getCheckoutPayableTotal(methodKey) {
    const pricing = calculateCartPricing(window.cart, window.products);
    const payCfg = getActivePaymentConfig();
    const extraFee = methodKey === 'cod' ? payCfg.codFee : 0;
    return {
        pricing,
        payCfg,
        extraFee,
        payableTotal: pricing.total + extraFee
    };
}

function buildPaymentMethodTabsHtml(payCfg, activeMethod) {
    const buttons = [];
    if (payCfg.enablePromptpay) {
        const isActive = activeMethod === 'promptpay';
        const cls = isActive ? 'bg-soulin-primary text-white border-soulin-primary shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-soulin-mint/50';
        buttons.push(`<button type="button" id="pay-tab-promptpay" onclick="selectPaymentMethod('promptpay')" class="flex-1 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${cls}"><i class="fa-solid fa-qrcode"></i> พร้อมเพย์ QR / โอนเงิน</button>`);
    }
    if (payCfg.enableCod) {
        const isActive = activeMethod === 'cod';
        const cls = isActive ? 'bg-soulin-primary text-white border-soulin-primary shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-soulin-mint/50';
        const feeTag = payCfg.codFee > 0 ? ` (+${payCfg.codFee}฿)` : '';
        buttons.push(`<button type="button" id="pay-tab-cod" onclick="selectPaymentMethod('cod')" class="flex-1 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${cls}"><i class="fa-solid fa-truck-fast"></i> เก็บเงินปลายทาง${feeTag}</button>`);
    }
    return `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${buttons.join('')}</div>`;
}

function buildSlipPreviewSectionHtml(slipUrl) {
    if (!slipUrl) {
        return '<div id="payment-slip-preview-box" class="hidden"></div>';
    }
    const safeSlip = sanitizeImageUrl(slipUrl);
    return `
        <div id="payment-slip-preview-box" class="mt-2 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
                <img id="payment-slip-preview-img" src="${safeSlip}" alt="Slip Preview" class="w-12 h-14 object-cover rounded-lg border border-emerald-200 bg-white">
                <span class="text-xs font-semibold text-emerald-800">แนบสลิปเรียบร้อยแล้ว</span>
            </div>
            <button type="button" onclick="removeStagedPaymentSlip()" class="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2.5 py-1 rounded-lg bg-white border border-rose-200"><i class="fa-solid fa-trash-can mr-1"></i>ลบสลิป</button>
        </div>
    `;
}

function buildPromptPayPanelHtml(payCfg, payableTotal) {
    const safePromptpayId = escapeHtml(payCfg.promptpayId);
    const safePromptpayName = escapeHtml(payCfg.promptpayName);
    const safeBankName = escapeHtml(payCfg.bankName);
    const safeBankAcc = escapeHtml(payCfg.bankAccountNo);
    const safeRef = escapeHtml(window.soulinPaymentState.referenceNote);
    const copyVal = escapeHtml(payCfg.promptpayId || payCfg.bankAccountNo);
    return `
        <div class="space-y-4">
            <div class="bg-soulin-bg/80 border border-emerald-100 rounded-2xl p-4 flex flex-col items-center text-center space-y-2.5">
                <span class="text-[11px] font-semibold text-soulin-primary bg-soulin-mint px-3 py-0.5 rounded-full">สแกน QR ชำระเงินอัตโนมัติ (PromptPay)</span>
                <div id="soulin-promptpay-qr" class="bg-white p-3 rounded-2xl border border-emerald-100 shadow-sm min-h-[180px] flex items-center justify-center"></div>
                <div class="text-xs text-slate-600 space-y-0.5">
                    <p class="font-bold text-soulin-dark text-sm">ยอดโอน: <span class="text-soulin-primary">${payableTotal.toLocaleString()} บาท</span></p>
                    <p>${safePromptpayName}</p>
                    <p class="text-[11px] text-slate-500">พร้อมเพย์: <span class="font-semibold text-slate-700">${safePromptpayId || '-'}</span> • ${safeBankName} ${safeBankAcc}</p>
                </div>
                <button type="button" onclick="copyPaymentAccountNo('${copyVal}')" class="text-[11px] font-semibold text-soulin-primary bg-white hover:bg-soulin-mint border border-emerald-200 px-3 py-1 rounded-lg transition-all"><i class="fa-regular fa-copy mr-1"></i>คัดลอกเลขพร้อมเพย์</button>
            </div>
            <div class="space-y-2">
                <label class="block text-xs font-semibold text-slate-700">แนบสลิปการโอนเงิน *</label>
                <input type="file" id="payment-slip-file" accept="image/*" onchange="handlePaymentSlipFileChange(event)" class="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-soulin-mint file:text-soulin-primary hover:file:bg-emerald-200 cursor-pointer border border-slate-200 rounded-xl p-1.5">
                ${buildSlipPreviewSectionHtml(window.soulinPaymentState.slipUrl)}
            </div>
            <div>
                <label for="payment-ref-input" class="block text-xs font-semibold text-slate-700 mb-1">เวลาโอน / หมายเหตุอ้างอิง <span class="text-slate-400 font-normal">(ไม่บังคับ)</span></label>
                <input type="text" id="payment-ref-input" value="${safeRef}" oninput="syncPaymentReferenceInput(this.value)" placeholder="เช่น โอนจาก KPlus 18:35 น." class="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-soulin-primary">
            </div>
        </div>
    `;
}

function buildCodPanelHtml(payCfg, payableTotal) {
    const feeLine = payCfg.codFee > 0
        ? `<p class="text-xs text-amber-700 font-medium">รวมค่าธรรมเนียมบริการเก็บเงินปลายทาง +${payCfg.codFee} ฿ แล้ว</p>`
        : '<p class="text-xs text-emerald-700 font-medium">ฟรี! ไม่มีค่าธรรมเนียมเก็บเงินปลายทางเพิ่มเติม</p>';
    return `
        <div class="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 text-center space-y-2.5">
            <div class="w-12 h-12 mx-auto rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-sm"><i class="fa-solid fa-box-open"></i></div>
            <h4 class="font-bold text-soulin-dark text-sm">ชำระเงินสดหรือสแกนกับพนักงานขนส่ง</h4>
            <p class="text-lg font-bold text-indigo-700">ยอดชำระปลายทาง: ${payableTotal.toLocaleString()} บาท</p>
            ${feeLine}
            <p class="text-[11px] text-slate-500">กรุณาเตรียมรับสายจากขนส่งในวันจัดส่งสินค้า</p>
        </div>
    `;
}

function buildPaymentModalCardHtml() {
    const activeMethod = window.soulinPaymentState.method;
    const { payCfg, payableTotal } = getCheckoutPayableTotal(activeMethod);
    const bodyHtml = activeMethod === 'cod'
        ? buildCodPanelHtml(payCfg, payableTotal)
        : buildPromptPayPanelHtml(payCfg, payableTotal);
    const confirmLabel = activeMethod === 'cod' ? 'ยืนยันสั่งซื้อ (เก็บเงินปลายทาง)' : 'ส่งสลิปและยืนยันคำสั่งซื้อ';
    return `
        <div class="bg-white rounded-3xl max-w-md w-full max-h-[92vh] overflow-y-auto p-6 relative smooth-shadow border border-emerald-100 space-y-4">
            <button type="button" onclick="closePaymentModal(false)" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark text-lg"></i></button>
            <div>
                <h3 class="text-lg font-bold text-soulin-dark flex items-center gap-2"><i class="fa-solid fa-shield-halved text-soulin-primary"></i> ชำระเงินค่าสินค้า</h3>
                <p class="text-[11px] text-slate-500">เลือกวิธีชำระเงินที่สะดวกเพื่อยืนยันคำสั่งซื้อ</p>
            </div>
            ${buildPaymentMethodTabsHtml(payCfg, activeMethod)}
            ${bodyHtml}
            <div class="flex gap-2 pt-1">
                <button type="button" onclick="closePaymentModal(false)" class="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-4 py-2.5 rounded-xl text-xs">ยกเลิก</button>
                <button type="button" id="payment-confirm-btn" onclick="confirmPaymentAndPlaceOrder()" class="flex-1 bg-soulin-primary hover:bg-soulin-dark text-white font-semibold py-2.5 rounded-xl shadow text-xs sm:text-sm transition-all">${confirmLabel}</button>
            </div>
        </div>
    `;
}

function renderPaymentModalContent() {
    const modal = document.getElementById('payment-modal');
    if (!modal) return;
    modal.innerHTML = buildPaymentModalCardHtml();
    if (window.soulinPaymentState.method === 'promptpay') {
        const { payCfg, payableTotal } = getCheckoutPayableTotal('promptpay');
        const qrText = buildPromptPayPayload(payCfg.promptpayId, payableTotal);
        renderPromptPayQrInto('soulin-promptpay-qr', qrText);
    }
}

function openPaymentCheckout() {
    if (typeof validateCheckoutPrerequisites === 'function') {
        const checkOutcome = validateCheckoutPrerequisites();
        if (!checkOutcome.ok) return;
    }
    const payCfg = getActivePaymentConfig();
    if (!payCfg.enablePromptpay && !payCfg.enableCod) {
        showToast('ขออภัย ร้านค้าปิดช่องทางชำระเงินชั่วคราว', 'error');
        return;
    }
    window.soulinPaymentState.method = payCfg.enablePromptpay ? 'promptpay' : 'cod';
    window.soulinPaymentState.slipUrl = '';
    window.soulinPaymentState.referenceNote = '';
    openPaymentModal();
}

function openPaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (!modal) return;
    renderPaymentModalContent();
    modal.classList.remove('hidden');
}

function closePaymentModal(keepStagedSlip = false) {
    if (!keepStagedSlip && typeof discardStagedUpload === 'function') {
        discardStagedUpload('slip');
    }
    window.soulinPaymentState.slipUrl = '';
    const modal = document.getElementById('payment-modal');
    if (modal) modal.classList.add('hidden');
}

function selectPaymentMethod(methodKey) {
    window.soulinPaymentState.method = methodKey === 'cod' ? 'cod' : 'promptpay';
    renderPaymentModalContent();
}

function syncPaymentReferenceInput(textValue) {
    window.soulinPaymentState.referenceNote = String(textValue || '').trim();
}

async function handlePaymentSlipFileChange(changeEvent) {
    const fileInput = changeEvent && changeEvent.target ? changeEvent.target : null;
    const selectedFile = fileInput && fileInput.files ? fileInput.files[0] : null;
    if (!selectedFile) return;
    fileInput.disabled = true;
    try {
        const compressedUrl = await compressImageFile(selectedFile, 1000, 0.85);
        const resolvedUrl = await resolveUploadedImageUrl(compressedUrl, 'slips', 'slip');
        if (typeof replaceStagedUpload === 'function') {
            replaceStagedUpload('slip', resolvedUrl);
        }
        window.soulinPaymentState.slipUrl = resolvedUrl;
        renderPaymentModalContent();
    } catch (uploadErr) {
        console.error('Slip upload error:', uploadErr);
        showToast(uploadErr.message || 'อัปโหลดสลิปไม่สำเร็จ', 'error');
    } finally {
        const activeInput = document.getElementById('payment-slip-file');
        if (activeInput) activeInput.disabled = false;
    }
}

function removeStagedPaymentSlip() {
    if (typeof discardStagedUpload === 'function') {
        discardStagedUpload('slip');
    }
    window.soulinPaymentState.slipUrl = '';
    renderPaymentModalContent();
    showToast('ลบรูปสลิปที่เลือกแล้ว', 'info');
}

function copyPaymentAccountNo(accountValue) {
    const cleanText = String(accountValue || '').trim();
    if (!cleanText) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cleanText)
            .then(() => showToast(`คัดลอก ${cleanText} แล้ว`, 'success'))
            .catch(() => showToast(`กรุณาคัดลอกเลขบัญชี: ${cleanText}`, 'info'));
        return;
    }
    showToast(`เลขบัญชีพร้อมเพย์: ${cleanText}`, 'info');
}

function confirmPaymentAndPlaceOrder() {
    const activeMethod = window.soulinPaymentState.method;
    const payCfg = getActivePaymentConfig();
    if (activeMethod === 'cod') {
        const codPlaced = processCheckout({
            paymentMethod: 'cod',
            paymentStatus: 'cod_pending',
            paymentGateway: 'cod',
            paymentSlipUrl: '',
            paymentReference: 'เก็บเงินปลายทาง',
            status: 'เก็บเงินปลายทาง (รอจัดส่ง)',
            extraFee: payCfg.codFee
        });
        if (codPlaced) closePaymentModal(false);
        return;
    }
    const slipUrl = sanitizeImageUrl(window.soulinPaymentState.slipUrl);
    if (!slipUrl) {
        showToast('กรุณาแนบรูปสลิปการโอนเงินก่อนยืนยันคำสั่งซื้อ', 'error');
        return;
    }
    const refInput = document.getElementById('payment-ref-input');
    const refText = (refInput ? refInput.value.trim() : window.soulinPaymentState.referenceNote) || 'โอนพร้อมเพย์แล้ว';
    const orderPlaced = processCheckout({
        paymentMethod: 'promptpay',
        paymentStatus: 'awaiting_verification',
        paymentGateway: 'manual',
        paymentSlipUrl: slipUrl,
        paymentReference: refText,
        status: 'รอตรวจสอบการชำระเงิน'
    });
    if (!orderPlaced) return;
    if (typeof commitStagedUpload === 'function') {
        commitStagedUpload('slip', '', slipUrl);
    }
    closePaymentModal(true);
}

function renderAdminPaymentSettings() {
    const mountEl = document.getElementById('admin-payment-settings-mount');
    if (!mountEl) return;
    const payCfg = getActivePaymentConfig();
    const ppChecked = payCfg.enablePromptpay ? 'checked' : '';
    const codChecked = payCfg.enableCod ? 'checked' : '';
    mountEl.innerHTML = `
        <div class="bg-white p-6 rounded-3xl border border-emerald-100 smooth-shadow space-y-4">
            <div class="border-b border-slate-100 pb-3 flex flex-wrap justify-between items-center gap-2">
                <div>
                    <h3 class="text-base font-bold text-soulin-dark flex items-center gap-2"><i class="fa-solid fa-qrcode text-soulin-primary"></i> ตั้งค่าบัญชีรับเงินร้านค้า (PromptPay &amp; COD)</h3>
                    <p class="text-[11px] text-slate-500">ใช้สร้าง QR Code รับเงินอัตโนมัติตามยอดสั่งซื้อจริงและบันทึกลง Supabase</p>
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                <div><label class="block font-semibold text-slate-700 mb-1">เบอร์พร้อมเพย์ / เลขนิติบุคคล (10 หรือ 13 หลัก)</label><input type="text" id="adm-pay-promptpay-id" value="${escapeHtml(payCfg.promptpayId)}" class="w-full p-2.5 border border-slate-200 rounded-xl"></div>
                <div><label class="block font-semibold text-slate-700 mb-1">ชื่อบัญชีรับเงินพร้อมเพย์</label><input type="text" id="adm-pay-promptpay-name" value="${escapeHtml(payCfg.promptpayName)}" class="w-full p-2.5 border border-slate-200 rounded-xl"></div>
                <div><label class="block font-semibold text-slate-700 mb-1">ธนาคารและเลขบัญชีสำรอง</label><input type="text" id="adm-pay-bank-name" value="${escapeHtml(payCfg.bankName)}" class="w-full p-2.5 border border-slate-200 rounded-xl mb-1.5" placeholder="ชื่อธนาคาร"><input type="text" id="adm-pay-bank-no" value="${escapeHtml(payCfg.bankAccountNo)}" class="w-full p-2.5 border border-slate-200 rounded-xl" placeholder="เลขที่บัญชี"></div>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs">
                <div class="flex flex-wrap items-center gap-4">
                    <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700"><input type="checkbox" id="adm-pay-enable-pp" ${ppChecked} class="w-4 h-4 accent-soulin-primary"> เปิดรับชำระด้วย PromptPay QR</label>
                    <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700"><input type="checkbox" id="adm-pay-enable-cod" ${codChecked} class="w-full sm:w-4 h-4 accent-soulin-primary"> เปิดเก็บเงินปลายทาง (COD)</label>
                    <label class="flex items-center gap-2 font-medium text-slate-700">ค่าธรรมเนียม COD (บาท): <input type="number" id="adm-pay-cod-fee" min="0" value="${Number(payCfg.codFee) || 0}" class="w-20 p-1.5 border border-slate-200 rounded-lg text-center"></label>
                </div>
                <button type="button" id="adm-pay-save-btn" onclick="saveAdminPaymentSettings()" class="bg-soulin-primary hover:bg-soulin-dark text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5"><i class="fa-solid fa-floppy-disk"></i> บันทึกการตั้งค่าชำระเงิน</button>
            </div>
        </div>
    `;
}

function collectAdminPaymentDraft(existingCfg) {
    const readVal = (elId, fallbackVal) => {
        const el = document.getElementById(elId);
        return el ? String(el.value || '').trim() : fallbackVal;
    };
    const ppBox = document.getElementById('adm-pay-enable-pp');
    const codBox = document.getElementById('adm-pay-enable-cod');
    return {
        promptpayId: readVal('adm-pay-promptpay-id', existingCfg.promptpayId),
        promptpayName: readVal('adm-pay-promptpay-name', existingCfg.promptpayName),
        bankName: readVal('adm-pay-bank-name', existingCfg.bankName),
        bankAccountNo: readVal('adm-pay-bank-no', existingCfg.bankAccountNo),
        bankAccountName: readVal('adm-pay-promptpay-name', existingCfg.bankAccountName),
        enablePromptpay: ppBox ? Boolean(ppBox.checked) : existingCfg.enablePromptpay,
        enableCod: codBox ? Boolean(codBox.checked) : existingCfg.enableCod,
        codFee: Math.max(0, Number(readVal('adm-pay-cod-fee', existingCfg.codFee)) || 0)
    };
}

function emitPaymentAudit(actionName, targetId, summaryText, severityLevel, metaSpec) {
    if (typeof recordAuditLog === 'function') {
        recordAuditLog({
            category: 'order',
            action: actionName,
            targetId: targetId,
            summary: summaryText,
            severity: severityLevel,
            metadata: metaSpec || {}
        });
    }
}

function saveAdminPaymentSettings() {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return false;
    }
    const previousCfg = getActivePaymentConfig();
    const draftCfg = collectAdminPaymentDraft(previousCfg);
    if (draftCfg.enablePromptpay && !formatPromptPayTarget(draftCfg.promptpayId)) {
        showToast('กรุณากรอกเบอร์พร้อมเพย์ 10 หลัก หรือเลขนิติบุคคล 13 หลักให้ถูกต้อง', 'error');
        return false;
    }
    window.cmsConfig.paymentConfig = draftCfg;
    if (!safeStorageSet('soulin_cms', JSON.stringify(window.cmsConfig))) return false;
    if (typeof window.syncCMSToCloud === 'function') {
        window.syncCMSToCloud(window.cmsConfig);
    }
    if (typeof recordAuditLog === 'function') {
        recordAuditLog({
            category: 'cms',
            action: 'PAYMENT_CONFIG_UPDATED',
            targetId: 'paymentConfig',
            summary: `อัปเดตบัญชีรับเงิน (${previousCfg.promptpayId || '-'} -> ${draftCfg.promptpayId || '-'}) และ COD`,
            severity: 'warning',
            metadata: {
                before: { promptpayId: previousCfg.promptpayId, enablePromptpay: previousCfg.enablePromptpay, enableCod: previousCfg.enableCod, codFee: previousCfg.codFee },
                after: { promptpayId: draftCfg.promptpayId, enablePromptpay: draftCfg.enablePromptpay, enableCod: draftCfg.enableCod, codFee: draftCfg.codFee }
            }
        });
    }
    showToast('บันทึกการตั้งค่ารับชำระเงินเรียบร้อยแล้ว!', 'success');
    return true;
}

function closeSlipPreviewModal() {
    const modal = document.getElementById('slip-preview-modal');
    if (modal) modal.classList.add('hidden');
}

function openSlipPreviewModal(orderId) {
    const targetOrder = (window.orders || []).find(entry => entry.orderId === orderId);
    const modal = document.getElementById('slip-preview-modal');
    if (!targetOrder || !modal) return;
    const safeSlip = sanitizeImageUrl(targetOrder.paymentSlipUrl);
    const isAdmin = Boolean(window.currentUser && window.currentUser.role === 'admin');
    const canReview = isAdmin && targetOrder.status === 'รอตรวจสอบการชำระเงิน';
    const actionBar = canReview
        ? `<div class="flex gap-2 pt-2"><button type="button" onclick="approveOrderPayment('${escapeHtml(orderId)}')" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs">อนุมัติสลิปนี้</button><button type="button" onclick="rejectOrderPayment('${escapeHtml(orderId)}')" class="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl text-xs">ปฏิเสธ (คืนสต็อก)</button></div>`
        : '';
    modal.innerHTML = `
        <div class="bg-white rounded-3xl max-w-md w-full p-6 relative smooth-shadow border border-emerald-100 space-y-3">
            <button type="button" onclick="closeSlipPreviewModal()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark text-lg"></i></button>
            <div><h3 class="text-base font-bold text-soulin-dark">หลักฐานการชำระเงิน (${escapeHtml(orderId)})</h3><p class="text-xs text-slate-500">ยอดสุทธิ ${Number(targetOrder.total || 0).toLocaleString()} ฿ • อ้างอิง: ${escapeHtml(targetOrder.paymentReference || '-')}</p></div>
            <div class="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex justify-center"><img src="${safeSlip}" alt="Payment Slip" class="max-h-80 object-contain rounded-xl"></div>
            ${actionBar}
        </div>
    `;
    modal.classList.remove('hidden');
}

function refreshOrdersAndStockViews() {
    if (typeof window.renderProducts === 'function') {
        window.renderProducts(window.currentProductFilter);
    }
    const uiHooks = [
        'renderOrders',
        'renderAdminProductsTable',
        'renderAdminOrdersList',
        'updateAdminStats',
        'updateAdminTabBadges',
        'renderAdminRecentOrdersWidget',
        'renderAdminLowStockWidget',
        'initAnalyticsChart'
    ];
    uiHooks.forEach(hookName => {
        if (typeof window[hookName] === 'function') window[hookName]();
    });
}

function approveOrderPayment(orderId) {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return false;
    }
    const targetOrder = (window.orders || []).find(entry => entry.orderId === orderId);
    if (!targetOrder) return false;
    targetOrder.paymentStatus = 'paid';
    targetOrder.paidAt = new Date().toISOString();
    targetOrder.status = 'ชำระเงินเรียบร้อย (รอจัดส่ง)';
    safeStorageSet('soulin_orders', JSON.stringify(window.orders));
    if (typeof window.syncOrderToCloud === 'function') {
        window.syncOrderToCloud(targetOrder);
    }
    closeSlipPreviewModal();
    refreshOrdersAndStockViews();
    emitPaymentAudit('PAYMENT_APPROVED', orderId, `อนุมัติสลิปคำสั่งซื้อ ${orderId} ยอด ${targetOrder.total} ฿`, 'success', { total: targetOrder.total });
    showToast(`อนุมัติการชำระเงิน ${orderId} เรียบร้อยแล้ว`, 'success');
    return true;
}

function restoreOrderProductStock(orderRecord) {
    for (const lineEntry of (orderRecord.items || [])) {
        const matched = (window.products || []).find(entry => entry.id === lineEntry.id);
        if (!matched) continue;
        matched.stock = (Number(matched.stock) || 0) + (Number(lineEntry.qty) || 0);
    }
    safeStorageSet('soulin_products', JSON.stringify(window.products));
    if (typeof window.syncProductsToCloud === 'function') {
        window.syncProductsToCloud(window.products);
    }
}

function rejectOrderPayment(orderId) {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return false;
    }
    const targetOrder = (window.orders || []).find(entry => entry.orderId === orderId);
    if (!targetOrder) return false;
    if (targetOrder.status !== 'ยกเลิกคำสั่งซื้อ') {
        restoreOrderProductStock(targetOrder);
    }
    targetOrder.paymentStatus = 'rejected';
    targetOrder.status = 'ยกเลิกคำสั่งซื้อ';
    safeStorageSet('soulin_orders', JSON.stringify(window.orders));
    if (typeof window.syncOrderToCloud === 'function') {
        window.syncOrderToCloud(targetOrder);
    }
    closeSlipPreviewModal();
    refreshOrdersAndStockViews();
    emitPaymentAudit('PAYMENT_REJECTED', orderId, `ปฏิเสธสลิปและคืนสต็อกคำสั่งซื้อ ${orderId}`, 'warning', { total: targetOrder.total });
    showToast(`ปฏิเสธสลิปและคืนสต็อกคำสั่งซื้อ ${orderId} แล้ว`, 'info');
    return true;
}
