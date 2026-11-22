function calculateCartPricing(cartMap, productCatalog) {
    let subtotal = 0;
    let totalItemCount = 0;
    const catalog = Array.isArray(productCatalog) ? productCatalog : [];
    for (const productId of Object.keys(cartMap || {})) {
        const qty = Number(cartMap[productId]) || 0;
        const matched = catalog.find(entry => entry.id === productId);
        if (!matched || qty <= 0) continue;
        subtotal += matched.price * qty;
        totalItemCount += qty;
    }
    const shipping = subtotal > 0 ? 40 : 0;
    const discount = subtotal >= 500 ? 50 : 0;
    const total = Math.max(0, subtotal + shipping - discount);
    return { subtotal, shipping, discount, total, totalItemCount };
}

function addToCart(productId) {
    const productRecord = window.products.find(entry => entry.id === productId);
    if (!productRecord) return;

    if (productRecord.stock <= (window.cart[productId] || 0)) {
        showToast('ขออภัย สินค้าในสต็อกไม่เพียงพอ', 'error');
        return;
    }

    window.cart[productId] = (window.cart[productId] || 0) + 1;
    saveCart();
    updateCartBadge();
    showToast(`เพิ่ม "${productRecord.name}" ลงในตะกร้าแล้ว`, 'success');
}

function updateCartQty(productId, delta) {
    if (!window.cart[productId]) return;
    const nextQty = window.cart[productId] + delta;

    if (nextQty <= 0) {
        delete window.cart[productId];
    } else {
        const productRecord = window.products.find(entry => entry.id === productId);
        if (!productRecord) {
            delete window.cart[productId];
            saveCart();
            renderCart();
            updateCartBadge();
            showToast('ไม่พบข้อมูลสินค้านี้ในระบบ', 'error');
            return;
        }
        if (nextQty > productRecord.stock) {
            showToast('สินค้าเกินจำนวนในสต็อก', 'error');
            return;
        }
        window.cart[productId] = nextQty;
    }
    saveCart();
    renderCart();
    updateCartBadge();
}

function removeFromCart(productId) {
    delete window.cart[productId];
    saveCart();
    renderCart();
    updateCartBadge();
    showToast('ลบรายการสินค้าออกแล้ว', 'info');
}

function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    const totalCount = Object.values(window.cart).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
    badge.innerText = totalCount;
}

function renderEmptyCartHtml() {
    return `
        <div class="bg-white rounded-3xl p-12 text-center border border-soulin-mint space-y-4">
            <div class="w-16 h-16 mx-auto bg-soulin-mint text-soulin-primary rounded-full flex items-center justify-center text-2xl">
                <i class="fa-solid fa-basket-shopping"></i>
            </div>
            <h3 class="text-lg font-bold text-slate-700">ตะกร้าสินค้าของคุณยังว่างอยู่</h3>
            <p class="text-xs text-slate-400 max-w-sm mx-auto">เลือกยาดมสมุนไพร SOULIN กลิ่นโปรดของคุณแล้วเพิ่มลงในตะกร้าได้เลย</p>
            <button onclick="switchTab('products')" class="bg-soulin-primary text-white text-xs font-semibold px-6 py-3 rounded-xl hover:bg-soulin-dark transition-all">
                ไปที่หน้าเลือกสินค้า
            </button>
        </div>
    `;
}

function renderCartItemRow(productRecord, qty) {
    const safeId = escapeHtml(productRecord.id);
    const safeImg = sanitizeImageUrl(productRecord.img);
    const safeName = escapeHtml(productRecord.name);
    const safeScent = escapeHtml(productRecord.scent);
    const unitPrice = Number(productRecord.price) || 0;
    const lineTotal = unitPrice * qty;

    return `
        <div class="bg-white p-4 sm:p-5 rounded-2xl border border-soulin-mint smooth-shadow flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="flex items-center space-x-4 w-full sm:w-auto">
                <img src="${safeImg}" alt="${safeName}" class="w-16 h-16 object-contain rounded-xl bg-soulin-bg p-2 flex-shrink-0">
                <div>
                    <span class="text-[10px] text-soulin-medium font-semibold uppercase">${safeScent}</span>
                    <h4 class="font-bold text-slate-800 text-sm">${safeName}</h4>
                    <span class="text-xs text-slate-500">${unitPrice} ฿ / ชิ้น</span>
                </div>
            </div>
            <div class="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6">
                <div class="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    <button onclick="updateCartQty('${safeId}', -1)" class="px-3 py-1 text-slate-600 hover:bg-slate-200">-</button>
                    <span class="px-3 py-1 text-xs font-bold text-slate-800">${qty}</span>
                    <button onclick="updateCartQty('${safeId}', 1)" class="px-3 py-1 text-slate-600 hover:bg-slate-200">+</button>
                </div>
                <span class="font-bold text-soulin-dark text-base min-w-[70px] text-right">${lineTotal} ฿</span>
                <button onclick="removeFromCart('${safeId}')" class="text-slate-400 hover:text-red-500 p-2">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>
    `;
}

function renderCheckoutAddressCard() {
    const cardEl = document.getElementById('checkout-address-card');
    const hiddenInput = document.getElementById('checkout-address');
    const selectedAddr = typeof getSelectedCheckoutAddress === 'function' ? getSelectedCheckoutAddress() : null;

    if (hiddenInput) {
        if (selectedAddr) {
            hiddenInput.value = formatFullShippingText(selectedAddr);
        } else if (!hiddenInput.value.trim() && window.currentUser && window.currentUser.defaultAddress) {
            hiddenInput.value = window.currentUser.defaultAddress;
        }
    }

    if (!cardEl) return;
    if (selectedAddr) {
        cardEl.innerHTML = buildAddressSummaryHtml(selectedAddr);
        return;
    }
    const fallbackText = hiddenInput ? hiddenInput.value.trim() : '';
    if (fallbackText) {
        cardEl.innerHTML = `<p class="text-xs text-slate-700 leading-relaxed">${escapeHtml(fallbackText)}</p>`;
        return;
    }
    cardEl.innerHTML = `
        <button type="button" onclick="openAddressModal()" class="w-full text-left flex items-center justify-between gap-2 text-slate-500 hover:text-soulin-primary transition-colors py-1">
            <span><i class="fa-solid fa-location-dot mr-1.5 text-soulin-primary"></i>ยังไม่ได้เลือกที่อยู่จัดส่ง — คลิกเพื่อเพิ่มที่อยู่</span>
            <i class="fa-solid fa-chevron-right text-[10px]"></i>
        </button>
    `;
}

function setCheckoutAddressLabel(labelText) {
    const isWork = labelText === 'ที่ทำงาน';
    const labelInput = document.getElementById('addr-label');
    const homeBtn = document.getElementById('addr-label-home');
    const workBtn = document.getElementById('addr-label-work');
    if (labelInput) labelInput.value = isWork ? 'ที่ทำงาน' : 'บ้าน';
    const activeCls = 'px-3 py-1 rounded-lg text-xs font-semibold border border-soulin-primary bg-soulin-mint text-soulin-primary';
    const idleCls = 'px-3 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-600';
    if (homeBtn) homeBtn.className = isWork ? idleCls : activeCls;
    if (workBtn) workBtn.className = isWork ? activeCls : idleCls;
}

function showCheckoutAddressPicker() {
    const picker = document.getElementById('checkout-address-picker');
    const formWrap = document.getElementById('checkout-address-form-wrap');
    if (picker) picker.classList.remove('hidden');
    if (formWrap) formWrap.classList.add('hidden');
    renderCheckoutAddressPicker();
}

function buildPickerAddressRow(addr, activeId) {
    const safeId = escapeHtml(addr.id);
    const isSelected = addr.id === activeId;
    const borderCls = isSelected ? 'border-soulin-primary bg-soulin-mint/40' : 'border-slate-200 bg-white';
    return `
        <div class="p-3.5 rounded-2xl border ${borderCls} space-y-2.5">
            <div onclick="selectCheckoutAddress('${safeId}')" class="cursor-pointer">
                ${buildAddressSummaryHtml(addr)}
            </div>
            <div class="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                <button type="button" onclick="openCheckoutAddressForm('${safeId}')" class="text-[11px] font-semibold text-amber-700 hover:underline px-2">แก้ไข</button>
                <button type="button" onclick="handleCheckoutAddressDelete('${safeId}')" class="text-[11px] font-semibold text-red-600 hover:underline px-2">ลบ</button>
                <button type="button" onclick="selectCheckoutAddress('${safeId}')" class="text-[11px] font-semibold bg-soulin-primary text-white px-3 py-1 rounded-lg">
                    ${isSelected ? 'กำลังใช้งาน' : 'เลือกใช้ที่อยู่นี้'}
                </button>
            </div>
        </div>
    `;
}

function renderCheckoutAddressPicker() {
    const listEl = document.getElementById('checkout-address-list');
    if (!listEl) return;
    const addresses = loadUserAddresses();
    if (addresses.length === 0) {
        listEl.innerHTML = '<div class="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">ยังไม่มีที่อยู่ในสมุดที่อยู่ กดเพิ่มที่อยู่ใหม่ด้านล่างได้เลย</div>';
        return;
    }
    const activeAddr = getSelectedCheckoutAddress();
    const activeId = activeAddr ? activeAddr.id : '';
    listEl.innerHTML = addresses.map(addr => buildPickerAddressRow(addr, activeId)).join('');
}

function openAddressModal() {
    const modal = document.getElementById('address-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (loadUserAddresses().length === 0) {
        openCheckoutAddressForm();
        return;
    }
    showCheckoutAddressPicker();
}

function closeAddressModal() {
    const modal = document.getElementById('address-modal');
    if (modal) modal.classList.add('hidden');
}

function selectCheckoutAddress(addressId) {
    window.selectedCheckoutAddressId = addressId;
    renderCheckoutAddressCard();
    closeAddressModal();
    showToast('เปลี่ยนที่อยู่จัดส่งเรียบร้อยแล้ว', 'success');
}

function fillCheckoutAddressFields(sourceAddr) {
    const setField = (elId, textVal) => {
        const el = document.getElementById(elId);
        if (el) el.value = textVal || '';
    };
    setField('addr-edit-id', sourceAddr.id || '');
    setField('addr-recipient', sourceAddr.recipientName || (window.currentUser ? window.currentUser.name : ''));
    setField('addr-phone', sourceAddr.phone || (window.currentUser ? window.currentUser.phone : ''));
    setField('addr-street', sourceAddr.streetDetail || '');
    setField('addr-note', sourceAddr.deliveryNote || '');
    initAddressCascadeForm('addr', sourceAddr);
    setCheckoutAddressLabel(sourceAddr.label || 'บ้าน');
    const defBox = document.getElementById('addr-default');
    if (defBox) defBox.checked = Boolean(sourceAddr.isDefault || loadUserAddresses().length === 0);
}

function openCheckoutAddressForm(addressId = '') {
    const existing = addressId ? loadUserAddresses().find(entry => entry.id === addressId) : null;
    fillCheckoutAddressFields(existing || {});
    const titleEl = document.getElementById('addr-form-title');
    if (titleEl) titleEl.textContent = existing ? 'แก้ไขที่อยู่จัดส่ง' : 'เพิ่มที่อยู่จัดส่งใหม่';
    const errEl = document.getElementById('addr-form-error');
    if (errEl) {
        errEl.textContent = '';
        errEl.classList.add('hidden');
    }
    const picker = document.getElementById('checkout-address-picker');
    const formWrap = document.getElementById('checkout-address-form-wrap');
    if (picker) picker.classList.add('hidden');
    if (formWrap) formWrap.classList.remove('hidden');
}

function handleCheckoutAddressSubmit(submitEvent) {
    if (submitEvent) submitEvent.preventDefault();
    const draft = {
        id: document.getElementById('addr-edit-id').value,
        recipientName: document.getElementById('addr-recipient').value,
        phone: document.getElementById('addr-phone').value,
        province: document.getElementById('addr-province').value,
        postalCode: document.getElementById('addr-postal').value,
        district: document.getElementById('addr-district').value,
        subdistrict: document.getElementById('addr-subdistrict').value,
        streetDetail: document.getElementById('addr-street').value,
        deliveryNote: document.getElementById('addr-note').value,
        label: document.getElementById('addr-label').value,
        isDefault: document.getElementById('addr-default').checked
    };
    const outcome = upsertUserAddress(getAddressOwnerKey(), draft);
    const errEl = document.getElementById('addr-form-error');
    if (!outcome.ok) {
        if (errEl) {
            errEl.textContent = outcome.message;
            errEl.classList.remove('hidden');
        }
        showToast(outcome.message, 'error');
        return;
    }
    window.selectedCheckoutAddressId = outcome.address.id;
    renderCheckoutAddressCard();
    closeAddressModal();
    showToast('บันทึกที่อยู่จัดส่งเรียบร้อยแล้ว', 'success');
}

function handleCheckoutAddressDelete(addressId) {
    deleteUserAddress(getAddressOwnerKey(), addressId);
    if (window.selectedCheckoutAddressId === addressId) {
        window.selectedCheckoutAddressId = '';
    }
    renderCheckoutAddressPicker();
    renderCheckoutAddressCard();
    showToast('ลบที่อยู่จัดส่งแล้ว', 'info');
}

function renderCart() {
    const container = document.getElementById('cart-items-container');
    const cartKeys = Object.keys(window.cart);

    if (container) {
        container.innerHTML = cartKeys.length === 0
            ? renderEmptyCartHtml()
            : cartKeys.map(productId => {
                const matched = window.products.find(entry => entry.id === productId);
                return matched ? renderCartItemRow(matched, window.cart[productId]) : '';
            }).join('');
    }

    const pricing = calculateCartPricing(window.cart, window.products);
    const summaryMap = {
        'summary-subtotal': `${pricing.subtotal} ฿`,
        'summary-shipping': `${pricing.shipping} ฿`,
        'summary-discount': `-${pricing.discount} ฿`,
        'summary-total': `${pricing.total} ฿`,
        'cart-item-count-text': `${pricing.totalItemCount} รายการ`
    };
    for (const elementId of Object.keys(summaryMap)) {
        const summaryEl = document.getElementById(elementId);
        if (summaryEl) summaryEl.innerText = summaryMap[elementId];
    }
    renderCheckoutAddressCard();
}
