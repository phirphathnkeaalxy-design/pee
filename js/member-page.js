let currentMemberOrderFilter = 'all';

const ORDER_FILTER_MATCHERS = {
    all: () => true,
    pending: statusText => statusText === 'รอตรวจสอบการชำระเงิน' || statusText === 'ชำระเงินเรียบร้อย (รอจัดส่ง)',
    shipping: statusText => statusText === 'กำลังจัดส่ง',
    completed: statusText => statusText === 'จัดส่งสำเร็จ',
    cancelled: statusText => statusText === 'ยกเลิกคำสั่งซื้อ'
};

function getMemberOrders() {
    if (!window.currentUser) return [];
    if (window.currentUser.role === 'admin') return window.orders;
    return window.orders.filter(orderRecord => orderRecord.user === window.currentUser.username);
}

function getMemberTier(totalSpent) {
    if (totalSpent >= 1500) {
        return { label: 'SOULIN VIP', badgeClass: 'bg-amber-400/20 text-amber-200 border-amber-300/40' };
    }
    if (totalSpent >= 500) {
        return { label: 'Herbal Lover', badgeClass: 'bg-emerald-400/20 text-emerald-100 border-emerald-300/40' };
    }
    return { label: 'Botanical Member', badgeClass: 'bg-white/15 text-soulin-light border-white/25' };
}

function getMemberInitials(displayName) {
    const cleanText = String(displayName || '').trim();
    if (!cleanText) return 'S';
    const parts = cleanText.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function computeMemberSummary(memberOrders) {
    let activeOrdersCount = 0;
    let totalSpent = 0;
    for (const orderRecord of (memberOrders || [])) {
        if (!orderRecord || orderRecord.status === 'ยกเลิกคำสั่งซื้อ') continue;
        activeOrdersCount += 1;
        totalSpent += Number(orderRecord.total) || 0;
    }
    const cartCount = Object.values(window.cart || {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
    return { activeOrdersCount, totalSpent, cartCount };
}

function setMemberText(elementId, textValue) {
    const targetEl = document.getElementById(elementId);
    if (targetEl) targetEl.textContent = String(textValue ?? '');
}

function renderMemberGoogleAvatarAndBadge(displayName) {
    const isGoogleAccount = window.currentUser.authProvider === 'google';
    const googleBadge = document.getElementById('member-google-badge');
    if (googleBadge) {
        googleBadge.classList.toggle('hidden', !isGoogleAccount);
    }
    const avatarBox = document.getElementById('member-avatar-initials');
    const safeAvatar = sanitizeImageUrl(window.currentUser.avatarUrl || '');
    if (avatarBox && safeAvatar) {
        avatarBox.innerHTML = `<img src="${escapeHtml(safeAvatar)}" alt="${escapeHtml(displayName)}" class="w-full h-full object-cover rounded-2xl">`;
        return;
    }
    setMemberText('member-avatar-initials', getMemberInitials(displayName));
}

function renderMemberHeaderAndStats() {
    if (!window.currentUser) return;
    const summary = computeMemberSummary(getMemberOrders());
    const tier = getMemberTier(summary.totalSpent);
    const displayName = window.currentUser.name || window.currentUser.username;

    renderMemberGoogleAvatarAndBadge(displayName);
    setMemberText('member-display-name', displayName);
    setMemberText('member-username-handle', `@${window.currentUser.username}`);
    setMemberText('member-stat-orders', `${summary.activeOrdersCount} ออเดอร์`);
    setMemberText('member-stat-spent', `${summary.totalSpent.toLocaleString()} ฿`);
    setMemberText('member-stat-cart', `${summary.cartCount} ชิ้น`);

    const tierEl = document.getElementById('member-tier-badge');
    if (tierEl) {
        tierEl.textContent = tier.label;
        tierEl.className = `inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border ${tier.badgeClass}`;
    }

    const adminLink = document.getElementById('member-admin-link');
    if (adminLink) {
        adminLink.classList.toggle('hidden', window.currentUser.role !== 'admin');
    }

    const navBadge = document.getElementById('member-nav-cart-badge');
    if (navBadge) {
        navBadge.textContent = String(summary.cartCount);
        navBadge.classList.toggle('hidden', summary.cartCount <= 0);
    }
}

function switchMemberTab(tabKey) {
    const activeCls = 'px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 border-soulin-primary text-soulin-primary whitespace-nowrap transition-all';
    const idleCls = 'px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-soulin-dark whitespace-nowrap transition-all';

    ['orders', 'profile', 'security'].forEach(key => {
        const panelEl = document.getElementById(`member-panel-${key}`);
        const tabBtn = document.getElementById(`member-tab-${key}`);
        const isCurrent = key === tabKey;
        if (panelEl) panelEl.classList.toggle('hidden', !isCurrent);
        if (tabBtn) tabBtn.className = isCurrent ? activeCls : idleCls;
    });
}

function matchesOrderFilter(orderRecord, filterKey) {
    const matcher = ORDER_FILTER_MATCHERS[filterKey] || ORDER_FILTER_MATCHERS.all;
    return matcher(orderRecord && orderRecord.status);
}

function filterMemberOrders(filterKey) {
    currentMemberOrderFilter = filterKey;
    const activePill = 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-soulin-primary text-white shadow-sm transition-all';
    const idlePill = 'px-3.5 py-1.5 rounded-full text-xs font-medium bg-white text-slate-600 border border-slate-200 hover:bg-soulin-mint transition-all';

    ['all', 'pending', 'shipping', 'completed', 'cancelled'].forEach(key => {
        const pillBtn = document.getElementById(`member-filter-${key}`);
        if (pillBtn) pillBtn.className = key === filterKey ? activePill : idlePill;
    });
    renderMemberOrders();
}

function getDeliveryStepIndex(statusText) {
    if (statusText === 'ยกเลิกคำสั่งซื้อ') return -1;
    if (statusText === 'จัดส่งสำเร็จ') return 3;
    if (statusText === 'กำลังจัดส่ง') return 2;
    return 1;
}

function buildDeliveryStepHtml(stepIndex, activeStep, stepLabel) {
    const isReached = activeStep >= stepIndex;
    const dotCls = isReached
        ? 'bg-soulin-primary text-white border-soulin-primary'
        : 'bg-white text-slate-400 border-slate-200';
    const textCls = isReached ? 'text-soulin-dark font-semibold' : 'text-slate-400';
    const iconCls = isReached ? 'fa-check' : 'fa-circle';
    return `
        <div class="flex items-center gap-1.5">
            <span class="w-5 h-5 rounded-full border ${dotCls} flex items-center justify-center text-[10px] flex-shrink-0">
                <i class="fa-solid ${iconCls}"></i>
            </span>
            <span class="text-[11px] ${textCls} whitespace-nowrap">${stepLabel}</span>
        </div>
    `;
}

function buildDeliveryTimelineHtml(statusText) {
    const activeStep = getDeliveryStepIndex(statusText);
    if (activeStep === -1) {
        return '<div class="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2"><i class="fa-solid fa-circle-xmark"></i><span>คำสั่งซื้อนี้ถูกยกเลิกแล้ว</span></div>';
    }
    const bar1Cls = activeStep >= 2 ? 'bg-soulin-primary' : 'bg-slate-200';
    const bar2Cls = activeStep >= 3 ? 'bg-soulin-primary' : 'bg-slate-200';
    return `
        <div class="bg-soulin-bg/70 border border-emerald-100 rounded-xl p-3 flex items-center justify-between gap-2 overflow-x-auto">
            ${buildDeliveryStepHtml(1, activeStep, 'ชำระเงินแล้ว')}
            <div class="h-0.5 flex-1 min-w-[16px] ${bar1Cls} rounded"></div>
            ${buildDeliveryStepHtml(2, activeStep, 'กำลังจัดส่ง')}
            <div class="h-0.5 flex-1 min-w-[16px] ${bar2Cls} rounded"></div>
            ${buildDeliveryStepHtml(3, activeStep, 'จัดส่งสำเร็จ')}
        </div>
    `;
}

function renderMemberOrderCard(orderRecord) {
    const safeOrderId = escapeHtml(orderRecord.orderId);
    const safeDate = escapeHtml(orderRecord.date);
    const safeStatus = escapeHtml(orderRecord.status);
    const safeAddress = escapeHtml(orderRecord.address);
    const badgeClass = getOrderStatusBadgeClass(orderRecord.status);
    const discountLine = Number(orderRecord.discount) > 0
        ? `<div class="flex justify-between text-xs text-emerald-700 font-medium"><span>ส่วนลดพิเศษ</span><span>-${Number(orderRecord.discount)} ฿</span></div>`
        : '';

    const itemsHtml = (orderRecord.items || []).map(line => `
        <div class="flex justify-between text-xs text-slate-600">
            <span>• ${escapeHtml(line.name)} x ${Number(line.qty) || 0}</span>
            <span class="font-medium">${(Number(line.price) || 0) * (Number(line.qty) || 0)} ฿</span>
        </div>
    `).join('');

    return `
        <article class="bg-white p-6 rounded-2xl border border-soulin-mint smooth-shadow space-y-4">
            <div class="flex flex-wrap justify-between items-center border-b border-slate-100 pb-3 gap-2">
                <div>
                    <span class="font-bold text-soulin-dark text-sm">หมายเลขคำสั่งซื้อ: ${safeOrderId}</span>
                    <span class="text-xs text-slate-400 block">${safeDate}</span>
                </div>
                <span class="${badgeClass} text-xs font-semibold px-3 py-1 rounded-full border">${safeStatus}</span>
            </div>
            ${buildDeliveryTimelineHtml(orderRecord.status)}
            <div class="space-y-2">${itemsHtml}${discountLine}</div>
            <div class="border-t border-slate-100 pt-3 flex flex-wrap justify-between items-center gap-3 text-xs text-slate-500">
                <span>จัดส่งไปที่: ${safeAddress}</span>
                <div class="flex items-center gap-3">
                    <span class="text-sm font-bold text-soulin-primary">ยอดสุทธิ: ${Number(orderRecord.total) || 0} ฿</span>
                    <button type="button" onclick="reorderFromHistory('${safeOrderId}')" class="bg-soulin-mint hover:bg-emerald-100 text-soulin-primary font-semibold px-3.5 py-2 rounded-xl transition-all inline-flex items-center gap-1.5">
                        <i class="fa-solid fa-rotate-right"></i> สั่งซื้อซ้ำ
                    </button>
                </div>
            </div>
        </article>
    `;
}

function renderMemberOrders() {
    const container = document.getElementById('member-orders-list');
    if (!container) return;

    const filteredOrders = getMemberOrders().filter(orderRecord => matchesOrderFilter(orderRecord, currentMemberOrderFilter));
    if (filteredOrders.length === 0) {
        container.innerHTML = `
            <div class="bg-white p-10 rounded-2xl text-center border border-emerald-100 space-y-3">
                <div class="w-12 h-12 mx-auto rounded-full bg-soulin-mint text-soulin-primary flex items-center justify-center text-lg">
                    <i class="fa-solid fa-box-open"></i>
                </div>
                <p class="text-sm font-semibold text-slate-700">ยังไม่มีรายการคำสั่งซื้อในหมวดนี้</p>
                <a href="./soulin.html?tab=products" class="inline-flex items-center gap-2 bg-soulin-primary hover:bg-soulin-dark text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all">
                    ไปเลือกซื้อยาดมสมุนไพร SOULIN
                </a>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredOrders.map(renderMemberOrderCard).join('');
}

function addOrderLineToCart(lineEntry) {
    const productRecord = window.products.find(entry => entry.id === lineEntry.id);
    if (!productRecord || productRecord.stock <= 0) return 0;

    const currentInCart = Number(window.cart[productRecord.id]) || 0;
    const availableSlots = Math.max(0, productRecord.stock - currentInCart);
    const qtyToAdd = Math.min(Number(lineEntry.qty) || 1, availableSlots);
    if (qtyToAdd <= 0) return 0;

    window.cart[productRecord.id] = currentInCart + qtyToAdd;
    return qtyToAdd;
}

function reorderFromHistory(orderId) {
    const sourceOrder = window.orders.find(entry => entry.orderId === orderId);
    if (!sourceOrder) return;

    let addedUnits = 0;
    for (const lineEntry of (sourceOrder.items || [])) {
        addedUnits += addOrderLineToCart(lineEntry);
    }

    if (addedUnits <= 0) {
        showToast('ขออภัย สินค้าในออเดอร์นี้หมดสต็อกชั่วคราว', 'error');
        return;
    }

    saveCart();
    renderMemberHeaderAndStats();
    showToast(`เพิ่มสินค้า ${addedUnits} ชิ้นลงตะกร้าแล้ว`, 'success');
    window.location.href = './soulin.html?tab=cart';
}

function setMemberInlineMessage(elementId, messageText, isError) {
    const msgEl = document.getElementById(elementId);
    if (!msgEl) return;
    if (!messageText) {
        msgEl.textContent = '';
        msgEl.classList.add('hidden');
        return;
    }
    const baseCls = 'text-xs px-3.5 py-2.5 rounded-xl border';
    const toneCls = isError
        ? 'text-red-700 bg-red-50 border-red-200'
        : 'text-emerald-800 bg-emerald-50 border-emerald-200';
    msgEl.className = `${baseCls} ${toneCls}`;
    msgEl.classList.remove('hidden');
    msgEl.textContent = messageText;
}

function populateMemberProfileForm() {
    if (!window.currentUser) return;
    const setInput = (elId, inputValue) => {
        const el = document.getElementById(elId);
        if (el) el.value = inputValue || '';
    };
    setInput('member-username-readonly', window.currentUser.username);
    setInput('member-fullname', window.currentUser.name);
    setInput('member-phone', window.currentUser.phone);
}

function handleMemberProfileSubmit(submitEvent) {
    if (submitEvent) submitEvent.preventDefault();
    if (!window.currentUser) return;
    setMemberInlineMessage('member-profile-feedback', '', false);

    const outcome = updateCustomerProfile(window.currentUser.username, {
        fullname: document.getElementById('member-fullname').value,
        phone: document.getElementById('member-phone').value,
        defaultAddress: window.currentUser.defaultAddress || ''
    });

    if (!outcome.ok) {
        setMemberInlineMessage('member-profile-feedback', outcome.message, true);
        showToast(outcome.message, 'error');
        return;
    }

    renderMemberHeaderAndStats();
    populateMemberProfileForm();
    setMemberInlineMessage('member-profile-feedback', 'บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว', false);
    showToast('บันทึกข้อมูลส่วนตัวสำเร็จ!', 'success');
}

function setMemberAddressLabel(labelText) {
    const isWork = labelText === 'ที่ทำงาน';
    const labelInput = document.getElementById('m-addr-label');
    const homeBtn = document.getElementById('m-addr-label-home');
    const workBtn = document.getElementById('m-addr-label-work');
    if (labelInput) labelInput.value = isWork ? 'ที่ทำงาน' : 'บ้าน';
    const activeCls = 'px-3 py-1 rounded-lg text-xs font-semibold border border-soulin-primary bg-soulin-mint text-soulin-primary';
    const idleCls = 'px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-600';
    if (homeBtn) homeBtn.className = isWork ? idleCls : activeCls;
    if (workBtn) workBtn.className = isWork ? activeCls : idleCls;
}

function buildMemberAddressCardHtml(addr) {
    const safeId = escapeHtml(addr.id);
    const defaultBtn = addr.isDefault
        ? ''
        : `<button type="button" onclick="handleMemberSetDefaultAddress('${safeId}')" class="text-[11px] font-semibold text-soulin-primary hover:underline px-2">ตั้งเป็นค่าเริ่มต้น</button>`;
    return `
        <div class="p-4 rounded-2xl border ${addr.isDefault ? 'border-soulin-primary bg-soulin-mint/30' : 'border-slate-200 bg-white'} space-y-3">
            ${buildAddressSummaryHtml(addr)}
            <div class="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-2.5">
                ${defaultBtn}
                <button type="button" onclick="openMemberAddressForm('${safeId}')" class="text-[11px] font-semibold text-amber-700 hover:bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">แก้ไข</button>
                <button type="button" onclick="handleMemberDeleteAddress('${safeId}')" class="text-[11px] font-semibold text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">ลบ</button>
            </div>
        </div>
    `;
}

function renderMemberAddressBook() {
    const listEl = document.getElementById('member-address-book-list');
    if (!listEl) return;
    const addresses = loadUserAddresses();
    if (addresses.length === 0) {
        listEl.innerHTML = '<div class="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">ยังไม่มีที่อยู่ในสมุดที่อยู่ กด "+ เพิ่มที่อยู่ใหม่" เพื่อตั้งค่าที่อยู่จัดส่ง</div>';
        return;
    }
    listEl.innerHTML = addresses.map(buildMemberAddressCardHtml).join('');
}

function fillMemberAddressFields(sourceAddr) {
    const setField = (elId, textVal) => {
        const el = document.getElementById(elId);
        if (el) el.value = textVal || '';
    };
    setField('m-addr-id', sourceAddr.id || '');
    setField('m-addr-recipient', sourceAddr.recipientName || (window.currentUser ? window.currentUser.name : ''));
    setField('m-addr-phone', sourceAddr.phone || (window.currentUser ? window.currentUser.phone : ''));
    setField('m-addr-street', sourceAddr.streetDetail || '');
    setField('m-addr-note', sourceAddr.deliveryNote || '');
    initAddressCascadeForm('m-addr', sourceAddr);
    setMemberAddressLabel(sourceAddr.label || 'บ้าน');
    const defBox = document.getElementById('m-addr-default');
    if (defBox) defBox.checked = Boolean(sourceAddr.isDefault || loadUserAddresses().length === 0);
}

function openMemberAddressForm(addressId = '') {
    const existing = addressId ? loadUserAddresses().find(entry => entry.id === addressId) : null;
    fillMemberAddressFields(existing || {});
    const titleEl = document.getElementById('m-addr-form-title');
    if (titleEl) titleEl.textContent = existing ? 'แก้ไขที่อยู่จัดส่ง' : 'เพิ่มที่อยู่จัดส่งใหม่';
    setMemberInlineMessage('m-addr-error', '', false);
    const formCard = document.getElementById('member-address-form-card');
    if (formCard) formCard.classList.remove('hidden');
}

function closeMemberAddressForm() {
    const formCard = document.getElementById('member-address-form-card');
    const formEl = document.getElementById('member-address-form');
    if (formEl) formEl.reset();
    if (formCard) formCard.classList.add('hidden');
    setMemberInlineMessage('m-addr-error', '', false);
}

function handleMemberAddressSubmit(submitEvent) {
    if (submitEvent) submitEvent.preventDefault();
    const draft = {
        id: document.getElementById('m-addr-id').value,
        recipientName: document.getElementById('m-addr-recipient').value,
        phone: document.getElementById('m-addr-phone').value,
        province: document.getElementById('m-addr-province').value,
        postalCode: document.getElementById('m-addr-postal').value,
        district: document.getElementById('m-addr-district').value,
        subdistrict: document.getElementById('m-addr-subdistrict').value,
        streetDetail: document.getElementById('m-addr-street').value,
        deliveryNote: document.getElementById('m-addr-note').value,
        label: document.getElementById('m-addr-label').value,
        isDefault: document.getElementById('m-addr-default').checked
    };
    const outcome = upsertUserAddress(getAddressOwnerKey(), draft);
    if (!outcome.ok) {
        setMemberInlineMessage('m-addr-error', outcome.message, true);
        showToast(outcome.message, 'error');
        return;
    }
    closeMemberAddressForm();
    renderMemberAddressBook();
    showToast('บันทึกที่อยู่จัดส่งเรียบร้อยแล้ว!', 'success');
}

function handleMemberSetDefaultAddress(addressId) {
    setDefaultUserAddress(getAddressOwnerKey(), addressId);
    renderMemberAddressBook();
    showToast('ตั้งเป็นที่อยู่จัดส่งเริ่มต้นแล้ว', 'success');
}

function handleMemberDeleteAddress(addressId) {
    if (typeof window.confirm === 'function' && !window.confirm('ต้องการลบที่อยู่นี้ออกจากสมุดที่อยู่ใช่หรือไม่?')) {
        return;
    }
    deleteUserAddress(getAddressOwnerKey(), addressId);
    renderMemberAddressBook();
    showToast('ลบที่อยู่เรียบร้อยแล้ว', 'info');
}

function renderSecurityPanelAccess() {
    if (!window.currentUser) return;
    const isBuiltInAdmin = window.currentUser.username === ADMIN_USERNAME;
    const isGoogleAccount = window.currentUser.authProvider === 'google';
    const adminNote = document.getElementById('member-admin-password-note');
    const googleNote = document.getElementById('member-google-password-note');
    const passwordForm = document.getElementById('member-password-form');
    if (adminNote) adminNote.classList.toggle('hidden', !isBuiltInAdmin);
    if (googleNote) googleNote.classList.toggle('hidden', !isGoogleAccount);
    if (passwordForm) passwordForm.classList.toggle('hidden', isBuiltInAdmin || isGoogleAccount);
}

function updateMemberPasswordStrength() {
    const newPassEl = document.getElementById('member-new-password');
    const barEl = document.getElementById('member-pw-strength-bar');
    const labelEl = document.getElementById('member-pw-strength-label');
    if (!newPassEl || !barEl || !labelEl) return;

    const strength = evaluatePasswordStrength(newPassEl.value);
    barEl.className = `h-1.5 rounded-full transition-all duration-300 ${strength.barClass} ${strength.widthClass}`;
    labelEl.textContent = strength.label;
}

function handleMemberPasswordSubmit(submitEvent) {
    if (submitEvent) submitEvent.preventDefault();
    if (!window.currentUser) return;
    setMemberInlineMessage('member-password-feedback', '', false);

    const currentPass = document.getElementById('member-current-password').value;
    const nextPass = document.getElementById('member-new-password').value;
    const confirmPass = document.getElementById('member-confirm-password').value;

    if (nextPass !== confirmPass) {
        const mismatchMsg = 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน';
        setMemberInlineMessage('member-password-feedback', mismatchMsg, true);
        showToast(mismatchMsg, 'error');
        return;
    }

    const changeOutcome = changeCustomerPassword(window.currentUser.username, currentPass, nextPass);
    if (!changeOutcome.ok) {
        setMemberInlineMessage('member-password-feedback', changeOutcome.message, true);
        showToast(changeOutcome.message, 'error');
        return;
    }

    document.getElementById('member-password-form').reset();
    updateMemberPasswordStrength();
    setMemberInlineMessage('member-password-feedback', 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว', false);
    showToast('อัปเดตรหัสผ่านใหม่แล้ว!', 'success');
}

function handleMemberLogout() {
    window.currentUser = null;
    localStorage.removeItem('soulin_user');
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
    window.location.href = './login.html';
}

function handleMemberStorageSync(storageEvent) {
    if (storageEvent.key === 'soulin_orders') {
        window.orders = safeJsonParse(storageEvent.newValue, []);
        renderMemberHeaderAndStats();
        renderMemberOrders();
    }
    if (storageEvent.key === 'soulin_cart') {
        window.cart = safeJsonParse(storageEvent.newValue, {});
        renderMemberHeaderAndStats();
    }
    if (storageEvent.key === 'soulin_addresses') {
        renderMemberAddressBook();
    }
}

function bootstrapMemberPage() {
    const guestGuard = document.getElementById('member-guest-guard');
    const portalContent = document.getElementById('member-portal-content');
    const isSignedIn = Boolean(window.currentUser);

    if (guestGuard) guestGuard.classList.toggle('hidden', isSignedIn);
    if (portalContent) portalContent.classList.toggle('hidden', !isSignedIn);

    if (!isSignedIn) {
        navigateToLoginPage('member');
        return;
    }

    renderMemberHeaderAndStats();
    populateMemberProfileForm();
    renderMemberAddressBook();
    renderSecurityPanelAccess();
    renderMemberOrders();
    switchMemberTab('orders');

    const newPassInput = document.getElementById('member-new-password');
    if (newPassInput) {
        newPassInput.addEventListener('input', updateMemberPasswordStrength);
    }
    if (typeof initCloudSync === 'function') {
        initCloudSync();
    }
    window.addEventListener('storage', handleMemberStorageSync);
}

window.addEventListener('DOMContentLoaded', bootstrapMemberPage);
