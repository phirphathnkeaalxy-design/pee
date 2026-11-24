const SENDER_PROFILE_STORAGE_KEY = 'soulin_sender_profile';

const DEFAULT_SENDER_PROFILE = {
    shopName: 'SOULIN (โซลอิน) Official',
    phone: '',
    address: 'ร้าน SOULIN ยาดมสมุนไพรธรรมชาติแท้ 100%',
    footerNote: 'ขอบคุณที่ไว้วางใจ SOULIN • กรุณาถ่ายวิดีโอขณะแกะพัสดุเพื่อใช้เป็นหลักฐานหากสินค้ามีปัญหา'
};

const THAI_NUM_WORDS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const THAI_POS_WORDS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

const CODE39_PATTERNS = {
    '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
    '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
    A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn',
    F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
    K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn',
    P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
    U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn',
    Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn'
};

function getSenderProfile() {
    const saved = typeof localStorage !== 'undefined'
        ? safeJsonParse(localStorage.getItem(SENDER_PROFILE_STORAGE_KEY), null)
        : null;
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_SENDER_PROFILE };
    return {
        shopName: String(saved.shopName || DEFAULT_SENDER_PROFILE.shopName).trim(),
        phone: String(saved.phone || '').trim(),
        address: String(saved.address || DEFAULT_SENDER_PROFILE.address).trim(),
        footerNote: String(saved.footerNote || DEFAULT_SENDER_PROFILE.footerNote).trim()
    };
}

function ensureSenderProfileModal() {
    let modalEl = document.getElementById('admin-sender-profile-modal');
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.id = 'admin-sender-profile-modal';
    modalEl.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4';
    document.body.appendChild(modalEl);
    return modalEl;
}

function closeSenderProfileModal() {
    const modalEl = document.getElementById('admin-sender-profile-modal');
    if (modalEl) modalEl.classList.add('hidden');
}

function buildSenderModalHtml(profile) {
    return `
        <div class="bg-white rounded-3xl max-w-md w-full p-6 smooth-shadow border border-emerald-100 space-y-4">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-base font-bold text-soulin-dark">ตั้งค่าข้อมูลผู้ส่งบนใบปะหน้า &amp; ใบเสร็จ</h3>
                    <p class="text-[11px] text-slate-500">แสดงเป็นข้อมูลร้านผู้ส่งบนเอกสารที่แอดมินสั่งพิมพ์ทั้งหมด</p>
                </div>
                <button type="button" onclick="closeSenderProfileModal()" class="text-slate-400 hover:text-slate-600 p-1">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>
            <form id="sender-profile-form" onsubmit="saveSenderProfile(event)" class="space-y-3">
                <div>
                    <label for="sender-shop-name" class="block text-xs font-semibold text-slate-700 mb-1">ชื่อร้าน / ผู้ส่ง *</label>
                    <input type="text" id="sender-shop-name" required value="${escapeHtml(profile.shopName)}" class="w-full text-xs sm:text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-soulin-primary">
                </div>
                <div>
                    <label for="sender-shop-phone" class="block text-xs font-semibold text-slate-700 mb-1">เบอร์โทรติดต่อร้าน</label>
                    <input type="tel" id="sender-shop-phone" value="${escapeHtml(profile.phone)}" placeholder="เช่น 08X-XXX-XXXX" class="w-full text-xs sm:text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-soulin-primary">
                </div>
                <div>
                    <label for="sender-shop-address" class="block text-xs font-semibold text-slate-700 mb-1">ที่อยู่ผู้ส่ง *</label>
                    <textarea id="sender-shop-address" rows="2" required class="w-full text-xs sm:text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-soulin-primary">${escapeHtml(profile.address)}</textarea>
                </div>
                <div>
                    <label for="sender-footer-note" class="block text-xs font-semibold text-slate-700 mb-1">หมายเหตุท้ายใบสั่งซื้อ</label>
                    <input type="text" id="sender-footer-note" value="${escapeHtml(profile.footerNote)}" class="w-full text-xs sm:text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-soulin-primary">
                </div>
                <div class="flex gap-2 pt-2">
                    <button type="button" onclick="closeSenderProfileModal()" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl text-xs">ยกเลิก</button>
                    <button type="submit" class="flex-1 bg-soulin-primary hover:bg-soulin-dark text-white font-semibold py-2.5 rounded-xl text-xs sm:text-sm shadow-sm">บันทึกข้อมูลผู้ส่ง</button>
                </div>
            </form>
        </div>
    `;
}

function openSenderProfileModal() {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return;
    }
    const modalEl = ensureSenderProfileModal();
    modalEl.innerHTML = buildSenderModalHtml(getSenderProfile());
    modalEl.classList.remove('hidden');
}

function readSenderInput(elementId, fallbackText) {
    const fieldEl = document.getElementById(elementId);
    if (!fieldEl || fieldEl.value === undefined || fieldEl.value === null) return fallbackText;
    return String(fieldEl.value).trim();
}

function saveSenderProfile(submitEvent) {
    if (submitEvent) submitEvent.preventDefault();
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return false;
    }
    const nextProfile = {
        shopName: readSenderInput('sender-shop-name', ''),
        phone: readSenderInput('sender-shop-phone', ''),
        address: readSenderInput('sender-shop-address', ''),
        footerNote: readSenderInput('sender-footer-note', DEFAULT_SENDER_PROFILE.footerNote)
    };
    if (!nextProfile.shopName || !nextProfile.address) {
        showToast('กรุณากรอกชื่อร้านและที่อยู่ผู้ส่งให้ครบถ้วน', 'error');
        return false;
    }
    if (!safeStorageSet(SENDER_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile))) return false;
    emitAdminAudit('cms', 'SENDER_PROFILE_UPDATED', 'senderProfile', `อัปเดตข้อมูลผู้ส่งเอกสาร "${nextProfile.shopName}"`, 'info');
    closeSenderProfileModal();
    showToast('บันทึกข้อมูลผู้ส่งเรียบร้อยแล้ว', 'success');
    return true;
}

function resolveThaiDigitWord(digit, pos, hasHigherDigit) {
    if (digit === 0) return '';
    if (pos === 1 && digit === 1) return 'สิบ';
    if (pos === 1 && digit === 2) return `ยี่${THAI_POS_WORDS[1]}`;
    if (pos === 0 && digit === 1 && hasHigherDigit) return 'เอ็ด';
    return `${THAI_NUM_WORDS[digit]}${THAI_POS_WORDS[pos]}`;
}

function convertThaiSegment(segmentInt) {
    const digitsText = String(segmentInt);
    const totalDigits = digitsText.length;
    let outText = '';
    for (let idx = 0; idx < totalDigits; idx++) {
        const digit = Number(digitsText[idx]);
        const pos = totalDigits - 1 - idx;
        const hasHigher = segmentInt >= 10 && pos === 0;
        outText += resolveThaiDigitWord(digit, pos, hasHigher);
    }
    return outText;
}

function convertThaiWholeNumber(wholeInt) {
    if (wholeInt <= 0) return 'ศูนย์';
    const chunks = [];
    let cursor = wholeInt;
    while (cursor > 0) {
        chunks.unshift(cursor % 1000000);
        cursor = Math.floor(cursor / 1000000);
    }
    return chunks.map((chunkVal, idx) => {
        if (chunkVal === 0 && idx > 0) return '';
        const textPart = convertThaiSegment(chunkVal);
        return idx < chunks.length - 1 ? `${textPart}ล้าน` : textPart;
    }).join('');
}

function formatThaiBahtText(rawAmount) {
    const cleanNum = Math.max(0, Number(rawAmount) || 0);
    if (cleanNum === 0) return 'ศูนย์บาทถ้วน';
    const wholePart = Math.floor(cleanNum);
    const satangPart = Math.round((cleanNum - wholePart) * 100);
    const bahtLabel = `${convertThaiWholeNumber(wholePart)}บาท`;
    if (satangPart === 0) return `${bahtLabel}ถ้วน`;
    return `${bahtLabel}${convertThaiWholeNumber(satangPart)}สตางค์`;
}

function appendCode39CharRects(rectParts, patternStr, startX, barHeight, unitWidth) {
    let cursorX = startX;
    for (let idx = 0; idx < patternStr.length; idx++) {
        const moduleWidth = patternStr[idx] === 'w' ? unitWidth * 2.4 : unitWidth;
        if (idx % 2 === 0) {
            rectParts.push(`<rect x="${cursorX.toFixed(1)}" y="0" width="${moduleWidth.toFixed(1)}" height="${barHeight}" fill="#0F172A"/>`);
        }
        cursorX += moduleWidth;
    }
    return cursorX + unitWidth;
}

function buildCode39Svg(rawText, barHeight = 36) {
    const sanitized = String(rawText || 'SOULIN').toUpperCase().replace(/[^0-9A-Z\-. ]/g, '-');
    const framedText = `*${sanitized}*`;
    const unitWidth = 2;
    const rectParts = [];
    let cursorX = 2;
    for (let idx = 0; idx < framedText.length; idx++) {
        const pattern = CODE39_PATTERNS[framedText[idx]] || CODE39_PATTERNS['-'];
        cursorX = appendCode39CharRects(rectParts, pattern, cursorX, barHeight, unitWidth);
    }
    const svgWidth = Math.ceil(cursorX + 2);
    return `<svg viewBox="0 0 ${svgWidth} ${barHeight}" width="100%" height="${barHeight}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(sanitized)}">${rectParts.join('')}</svg>`;
}

function extractOrderPostalCode(orderRecord) {
    const shipDetails = orderRecord.shippingDetails && typeof orderRecord.shippingDetails === 'object' ? orderRecord.shippingDetails : null;
    if (shipDetails && shipDetails.postalCode) return String(shipDetails.postalCode).trim();
    const match = /\b(\d{5})\b/.exec(String(orderRecord.address || ''));
    return match ? match[1] : '-----';
}

function resolveOrderPaymentStatusTag(orderRecord) {
    if (orderRecord.paymentMethod === 'cod') {
        return { stamp: 'เก็บเงินปลายทาง (COD)', cls: 'stamp-cod' };
    }
    if (orderRecord.paymentStatus === 'paid' || orderRecord.status === 'จัดส่งสำเร็จ') {
        return { stamp: 'ชำระเงินแล้ว (PAID)', cls: 'stamp-paid' };
    }
    return { stamp: 'รอตรวจสอบชำระเงิน', cls: 'stamp-pending' };
}

function buildOrderContactDetails(orderRecord) {
    const details = orderRecord.shippingDetails && typeof orderRecord.shippingDetails === 'object' ? orderRecord.shippingDetails : {};
    return {
        recipient: escapeHtml(details.recipient || orderRecord.customerName || '-'),
        phone: details.phone ? escapeHtml(details.phone) : '-',
        address: escapeHtml(orderRecord.address || '-'),
        note: details.note ? escapeHtml(details.note) : ''
    };
}

function buildInvoiceItemRowsHtml(orderRecord) {
    return (orderRecord.items || []).map((line, idx) => {
        const lineQty = Number(line.qty) || 0;
        const unitPrice = Number(line.price) || 0;
        const lineTotal = unitPrice > 0 ? unitPrice * lineQty : (Number(line.lineTotal) || 0);
        return `<tr><td class="c"><span class="chk"></span> ${idx + 1}</td><td>${escapeHtml(line.name)}</td><td class="num">${lineQty}</td><td class="num">${unitPrice.toLocaleString()}</td><td class="num">${lineTotal.toLocaleString()}</td></tr>`;
    }).join('');
}

function buildInvoiceTotalsHtml(orderRecord, totalBahtText) {
    const shippingFee = Number(orderRecord.shipping) || 0;
    const discountAmt = Number(orderRecord.discount) || 0;
    const codFee = Number(orderRecord.codFee) || 0;
    const totalAmt = Number(orderRecord.total) || 0;
    const subtotalAmt = Number(orderRecord.subtotal) || Math.max(0, totalAmt - shippingFee - codFee + discountAmt);
    const discountRow = discountAmt > 0 ? `<tr><td>ส่วนลดโปรโมชั่น</td><td class="num">-${discountAmt.toLocaleString()} ฿</td></tr>` : '';
    const codRow = codFee > 0 ? `<tr><td>ค่าธรรมเนียมเก็บเงินปลายทาง</td><td class="num">${codFee.toLocaleString()} ฿</td></tr>` : '';
    return `
        <div class="sum-wrap">
            <div class="baht-text"><span class="lbl">ยอดรวมตัวอักษร:</span><strong>(${escapeHtml(totalBahtText)})</strong></div>
            <table class="sum-tbl">
                <tr><td>รวมมูลค่าสินค้า</td><td class="num">${subtotalAmt.toLocaleString()} ฿</td></tr>
                <tr><td>ค่าจัดส่งพัสดุ</td><td class="num">${shippingFee.toLocaleString()} ฿</td></tr>
                ${discountRow}${codRow}
                <tr class="grand"><td>ยอดรวมสุทธิ</td><td class="num">${totalAmt.toLocaleString()} ฿</td></tr>
            </table>
        </div>
    `;
}

function buildInvoicePartiesHtml(orderRecord, safeId) {
    const contact = buildOrderContactDetails(orderRecord);
    const statusTag = resolveOrderPaymentStatusTag(orderRecord);
    const methodLabel = typeof getPaymentMethodLabel === 'function' ? getPaymentMethodLabel(orderRecord.paymentMethod) : (orderRecord.paymentMethod || 'promptpay');
    const noteMarkup = contact.note ? `<div class="muted">หมายเหตุลูกค้า: ${contact.note}</div>` : '';
    return `
        <section class="two-col">
            <div class="panel">
                <div class="panel-lbl">ข้อมูลลูกค้า / ที่อยู่จัดส่ง</div>
                <div class="strong-lg">${contact.recipient}</div>
                <div>โทร: <strong>${contact.phone}</strong></div>
                <div class="addr-line">${contact.address}</div>
                ${noteMarkup}
            </div>
            <div class="panel">
                <div class="panel-lbl">รายละเอียดคำสั่งซื้อ &amp; การชำระเงิน</div>
                <div>เลขที่ออเดอร์: <strong>${safeId}</strong></div>
                <div>วันที่สั่งซื้อ: ${escapeHtml(orderRecord.date || '-')}</div>
                <div>ช่องทางชำระ: <strong>${escapeHtml(methodLabel)}</strong></div>
                <div class="stamp ${statusTag.cls}">${escapeHtml(statusTag.stamp)}</div>
            </div>
        </section>
    `;
}

function buildA4InvoicePageHtml(orderRecord, senderProfile) {
    const safeId = escapeHtml(orderRecord.orderId);
    const bahtText = formatThaiBahtText(Number(orderRecord.total) || 0);
    const senderPhone = senderProfile.phone ? ` • โทร. ${escapeHtml(senderProfile.phone)}` : '';
    return `
        <article class="doc-page a4-doc">
            <header class="inv-head">
                <div>
                    <div class="brand-title">${escapeHtml(senderProfile.shopName)}</div>
                    <div class="muted">${escapeHtml(senderProfile.address)}${senderPhone}</div>
                </div>
                <div class="inv-right">
                    <div class="doc-badge">ใบสั่งซื้อ &amp; ใบจัดสินค้า</div>
                    <div class="barcode-box">${buildCode39Svg(orderRecord.orderId, 34)}<div class="barcode-txt">${safeId}</div></div>
                </div>
            </header>
            ${buildInvoicePartiesHtml(orderRecord, safeId)}
            <table class="items-tbl">
                <thead><tr><th class="c" style="width:70px">จัด/ที่</th><th>รายการสินค้า</th><th class="num" style="width:70px">จำนวน</th><th class="num" style="width:90px">ราคา/หน่วย</th><th class="num" style="width:95px">รวม (฿)</th></tr></thead>
                <tbody>${buildInvoiceItemRowsHtml(orderRecord)}</tbody>
            </table>
            ${buildInvoiceTotalsHtml(orderRecord, bahtText)}
            <footer class="inv-foot">
                <div class="sign-row">
                    <div class="sign-box"><div class="line"></div><span>ผู้จัดเตรียมสินค้า / วันที่</span></div>
                    <div class="sign-box"><div class="line"></div><span>ผู้ตรวจสอบก่อนจัดส่ง / วันที่</span></div>
                </div>
                <div class="foot-note">${escapeHtml(senderProfile.footerNote)}</div>
            </footer>
        </article>
    `;
}

function buildLabelItemsCompactHtml(orderRecord) {
    return (orderRecord.items || []).map((line, idx) => (
        `<div class="lbl-item"><span>${idx + 1}. ${escapeHtml(line.name)}</span><strong>× ${Number(line.qty) || 0}</strong></div>`
    )).join('');
}

function buildLabelPaymentBannerHtml(orderRecord) {
    if (orderRecord.paymentMethod === 'cod') {
        return `<div class="cod-banner"><span>COD เก็บเงินปลายทาง</span><strong>${(Number(orderRecord.total) || 0).toLocaleString()} บาท</strong></div>`;
    }
    return `<div class="paid-banner">ชำระเงินเรียบร้อยแล้ว • ไม่ต้องเก็บเงินปลายทาง</div>`;
}

function buildThermalLabelPageHtml(orderRecord, senderProfile) {
    const safeId = escapeHtml(orderRecord.orderId);
    const contact = buildOrderContactDetails(orderRecord);
    const postalCode = escapeHtml(extractOrderPostalCode(orderRecord));
    const totalQty = (orderRecord.items || []).reduce((sum, line) => sum + (Number(line.qty) || 0), 0);
    const senderPhone = senderProfile.phone ? ` (${escapeHtml(senderProfile.phone)})` : '';
    const noteLine = contact.note ? `<div class="lbl-note">หมายเหตุ: ${contact.note}</div>` : '';
    return `
        <article class="doc-page thermal-doc">
            <div class="lbl-head">
                <div class="lbl-brand">SOULIN</div>
                <div class="lbl-meta"><strong>${safeId}</strong><span>${escapeHtml(orderRecord.date || '-')}</span></div>
            </div>
            <div class="lbl-barcode">${buildCode39Svg(orderRecord.orderId, 42)}<div class="barcode-txt">${safeId}</div></div>
            <div class="lbl-from"><span class="tag">FROM ผู้ส่ง</span><div><strong>${escapeHtml(senderProfile.shopName)}</strong>${senderPhone}</div><div class="sm">${escapeHtml(senderProfile.address)}</div></div>
            <div class="lbl-to">
                <div class="to-top"><span class="tag-blk">TO ผู้รับ</span><span class="zip-box">${postalCode}</span></div>
                <div class="to-name">${contact.recipient}</div>
                <div class="to-phone">โทร: ${contact.phone}</div>
                <div class="to-addr">${contact.address}</div>
                ${noteLine}
            </div>
            ${buildLabelPaymentBannerHtml(orderRecord)}
            <div class="lbl-pack">
                <div class="pack-head"><span>รายการสินค้าจัดลงกล่อง (${totalQty} ชิ้น)</span><span>☐ ตรวจครบ</span></div>
                ${buildLabelItemsCompactHtml(orderRecord)}
            </div>
        </article>
    `;
}

function buildOrdersSummaryRowHtml(orderRecord) {
    const itemsText = (orderRecord.items || []).map(line => `${escapeHtml(line.name)} × ${Number(line.qty) || 0}`).join(', ');
    return `<tr><td><strong>${escapeHtml(orderRecord.orderId)}</strong><div class="muted">${escapeHtml(orderRecord.date || '-')}</div></td><td><strong>${escapeHtml(orderRecord.customerName)}</strong><div class="muted">${escapeHtml(orderRecord.address || '-')}</div></td><td>${itemsText}</td><td>${escapeHtml(orderRecord.status || '-')}</td><td class="num"><strong>${(Number(orderRecord.total) || 0).toLocaleString()} ฿</strong></td></tr>`;
}

function buildOrdersSummaryTableHtml(orderList, senderProfile) {
    const activeRevenue = orderList.filter(entry => entry.status !== 'ยกเลิกคำสั่งซื้อ').reduce((sum, entry) => sum + (Number(entry.total) || 0), 0);
    return `
        <article class="doc-page a4-doc">
            <header class="inv-head">
                <div><div class="brand-title">${escapeHtml(senderProfile.shopName)} • รายงานสรุปคำสั่งซื้อ</div><div class="muted">พิมพ์เมื่อ: ${escapeHtml(new Date().toLocaleString('th-TH'))}</div></div>
                <div class="inv-right"><div>จำนวนทั้งหมด: <strong>${orderList.length} รายการ</strong></div><div>ยอดขายรวม (ไม่รวมยกเลิก): <strong>${activeRevenue.toLocaleString()} ฿</strong></div></div>
            </header>
            <table class="items-tbl">
                <thead><tr><th>เลขออเดอร์ / วันที่</th><th>ลูกค้า / ที่อยู่จัดส่ง</th><th>รายการสินค้า</th><th>สถานะ</th><th class="num">ยอดสุทธิ</th></tr></thead>
                <tbody>${orderList.map(buildOrdersSummaryRowHtml).join('')}</tbody>
            </table>
        </article>
    `;
}

function buildPrintPageCss(pageMode) {
    const isLabel = pageMode === 'label' || pageMode === 'batch-label';
    const pageRule = isLabel ? '@page{size:100mm 150mm;margin:4mm}' : '@page{size:A4;margin:12mm}';
    const docWidth = isLabel ? '100mm' : '210mm';
    return `*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        ${pageRule}
        body{margin:0;padding:18px;font-family:'Noto Sans Thai','Sarabun','Segoe UI',sans-serif;color:#0F172A;background:#E2E8F0}
        .no-print{max-width:${docWidth};margin:0 auto 12px;display:flex;justify-content:flex-end;gap:8px}
        .btn{border:1px solid #CBD5E1;background:#fff;color:#1E293B;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer}
        .btn-primary{background:#162E22;border-color:#162E22;color:#fff}
        .doc-page{width:100%;max-width:${docWidth};margin:0 auto 16px;background:#fff;padding:18px;box-shadow:0 8px 24px rgba(15,23,42,.08);page-break-after:always;break-after:page}
        .doc-page:last-of-type{page-break-after:auto;break-after:auto}
        .a4-doc{border-radius:10px;padding:24px;font-size:13px}
        .inv-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #162E22;padding-bottom:12px;margin-bottom:14px}
        .brand-title{font-size:20px;font-weight:700;color:#162E22}.inv-right{text-align:right;font-size:12px}
        .doc-badge{display:inline-block;background:#162E22;color:#fff;font-weight:700;padding:4px 10px;border-radius:6px;margin-bottom:6px}
        .barcode-box{width:190px;margin-left:auto}.barcode-txt{font-size:11px;font-weight:700;letter-spacing:1.2px;text-align:center;margin-top:2px}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
        .panel{border:1px solid #CBD5E1;border-radius:10px;padding:11px 13px;line-height:1.55;font-size:12px}
        .panel-lbl{font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;margin-bottom:4px}.strong-lg{font-size:15px;font-weight:700}
        .muted{font-size:11px;color:#475569}.addr-line{margin-top:3px}.stamp{display:inline-block;margin-top:6px;padding:3px 10px;border-radius:6px;font-weight:700;font-size:11px;border:1.5px solid}
        .stamp-paid{color:#166534;border-color:#166534;background:#F0FDF4}.stamp-cod{color:#991B1B;border-color:#991B1B;background:#FEF2F2}.stamp-pending{color:#92400E;border-color:#92400E;background:#FFFBEB}
        .items-tbl{width:100%;border-collapse:collapse;font-size:12px}.items-tbl th,.items-tbl td{border-bottom:1px solid #E2E8F0;padding:8px 7px;text-align:left}
        .items-tbl th{background:#F1F5F9;font-weight:700}.items-tbl .num{text-align:right}.items-tbl .c{text-align:center}.chk{display:inline-block;width:12px;height:12px;border:1.5px solid #475569;vertical-align:middle;margin-right:3px}
        .sum-wrap{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-top:14px}.baht-text{background:#F8FAFC;border:1px dashed #94A3B8;padding:10px 12px;border-radius:8px;font-size:12px;flex:1}
        .baht-text .lbl{display:block;font-size:10px;color:#64748B}.sum-tbl{width:260px;border-collapse:collapse;font-size:12px}.sum-tbl td{padding:4px 6px}.sum-tbl .num{text-align:right}
        .sum-tbl .grand td{border-top:2px solid #162E22;padding-top:7px;font-size:15px;font-weight:700;color:#162E22}
        .inv-foot{margin-top:26px}.sign-row{display:grid;grid-template-columns:1fr 1fr;gap:32px;text-align:center;font-size:11px;color:#475569}
        .sign-box .line{border-bottom:1px solid #94A3B8;height:28px;margin-bottom:5px}.foot-note{margin-top:14px;padding-top:10px;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;text-align:center}
        .thermal-doc{border:2px solid #0F172A;padding:10px;font-size:11px}.lbl-head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0F172A;padding-bottom:6px}
        .lbl-brand{font-size:18px;font-weight:800;letter-spacing:1.5px}.lbl-meta{text-align:right;font-size:10px}.lbl-meta strong{display:block;font-size:11px}
        .lbl-barcode{padding:6px 4px;border-bottom:1.5px dashed #0F172A}.lbl-from{padding:6px 4px;border-bottom:1.5px solid #0F172A;line-height:1.35}
        .tag{display:inline-block;border:1px solid #0F172A;font-size:9px;font-weight:700;padding:1px 5px;margin-bottom:2px}.sm{font-size:10px}
        .lbl-to{padding:8px 6px;border-bottom:2px solid #0F172A}.to-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
        .tag-blk{background:#0F172A;color:#fff;font-size:10px;font-weight:700;padding:2px 7px}.zip-box{border:2px solid #0F172A;font-size:18px;font-weight:800;letter-spacing:2px;padding:1px 8px}
        .to-name{font-size:15px;font-weight:800;margin-top:2px}.to-phone{font-size:13px;font-weight:700}.to-addr{font-size:12px;line-height:1.4;margin-top:3px}.lbl-note{margin-top:3px;font-size:10px;border-top:1px dotted #64748B;padding-top:2px}
        .cod-banner{background:#0F172A;color:#fff;padding:7px 8px;display:flex;justify-content:space-between;align-items:center;font-size:13px;margin:6px 0}
        .paid-banner{border:1.5px solid #0F172A;text-align:center;font-weight:700;padding:5px;margin:6px 0;font-size:11px}
        .lbl-pack{font-size:10px;padding:4px 2px}.pack-head{display:flex;justify-content:space-between;font-weight:700;border-bottom:1px solid #0F172A;padding-bottom:2px;margin-bottom:3px}
        .lbl-item{display:flex;justify-content:space-between;padding:1.5px 0;border-bottom:1px dotted #CBD5E1}
        @media print{body{background:#fff;padding:0}.no-print{display:none}.doc-page{box-shadow:none;margin:0;border-radius:0;max-width:100%}}`;
}

function buildProfessionalPrintShell(docTitle, pageMode, bodyMarkup) {
    return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>${escapeHtml(docTitle)}</title><style>${buildPrintPageCss(pageMode)}</style></head><body>
        <div class="no-print"><button type="button" class="btn" onclick="window.close()">ปิดหน้าต่าง</button><button type="button" class="btn btn-primary" onclick="window.print()">สั่งพิมพ์ / Save PDF</button></div>
        ${bodyMarkup}
    </body></html>`;
}

function openPrintableWindow(docTitle, pageMode, bodyMarkup) {
    if (typeof window.open !== 'function') return false;
    const printWin = window.open('', '_blank', 'width=900,height=920');
    if (!printWin || !printWin.document) {
        showToast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up แล้วลองใหม่', 'error');
        return false;
    }
    printWin.document.open();
    printWin.document.write(buildProfessionalPrintShell(docTitle, pageMode, bodyMarkup));
    printWin.document.close();
    if (typeof printWin.focus === 'function') printWin.focus();
    if (typeof printWin.print === 'function') printWin.print();
    return true;
}

function printAdminOrder(orderId, printMode = 'invoice') {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return false;
    }
    const targetOrder = (window.orders || []).find(entry => entry.orderId === orderId);
    if (!targetOrder) return false;
    const sender = getSenderProfile();
    const isLabel = printMode === 'label';
    const pageHtml = isLabel ? buildThermalLabelPageHtml(targetOrder, sender) : buildA4InvoicePageHtml(targetOrder, sender);
    const opened = openPrintableWindow(`SOULIN ${isLabel ? 'Label' : 'Invoice'} ${targetOrder.orderId}`, isLabel ? 'label' : 'invoice', pageHtml);
    if (opened) {
        emitAdminAudit('order', 'ORDER_PRINTED', targetOrder.orderId, `พิมพ์${isLabel ? 'ใบปะหน้า 100×150' : 'ใบสั่งซื้อ A4'} ${targetOrder.orderId}`, 'info', { mode: printMode });
    }
    return opened;
}

function buildBatchPrintMarkup(orderList, printMode, senderProfile) {
    if (printMode === 'batch-label') {
        return orderList.map(entry => buildThermalLabelPageHtml(entry, senderProfile)).join('');
    }
    if (printMode === 'batch-invoice') {
        return orderList.map(entry => buildA4InvoicePageHtml(entry, senderProfile)).join('');
    }
    return buildOrdersSummaryTableHtml(orderList, senderProfile);
}

function printFilteredAdminOrders(printMode = 'summary') {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return false;
    }
    const filteredOrders = typeof getFilteredAdminOrdersList === 'function' ? getFilteredAdminOrdersList() : (window.orders || []);
    if (filteredOrders.length === 0) {
        showToast('ไม่มีรายการคำสั่งซื้อที่ตรงกับตัวกรองสำหรับพิมพ์', 'info');
        return false;
    }
    const markup = buildBatchPrintMarkup(filteredOrders, printMode, getSenderProfile());
    const opened = openPrintableWindow(`SOULIN ${printMode}`, printMode, markup);
    if (opened) {
        emitAdminAudit('order', 'ORDERS_SUMMARY_PRINTED', 'FILTERED_ORDERS', `พิมพ์ชุดคำสั่งซื้อ (${printMode}) จำนวน ${filteredOrders.length} รายการ`, 'info', { count: filteredOrders.length, mode: printMode });
    }
    return opened;
}
