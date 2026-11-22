function validateCartStock(cartMap, productCatalog) {
    for (const productId of Object.keys(cartMap)) {
        const requestedQty = Number(cartMap[productId]) || 0;
        const matched = productCatalog.find(entry => entry.id === productId);
        if (!matched) {
            return { valid: false, message: 'ไม่พบสินค้าบางรายการในระบบ กรุณาตรวจสอบตะกร้าอีกครั้ง' };
        }
        if (requestedQty <= 0 || matched.stock < requestedQty) {
            return {
                valid: false,
                message: `ขออภัย "${matched.name}" เหลือเพียง ${matched.stock} ชิ้น`
            };
        }
    }
    return { valid: true, message: '' };
}

function buildOrderLineItems(cartMap, productCatalog) {
    const orderItems = [];
    for (const productId of Object.keys(cartMap)) {
        const qty = Number(cartMap[productId]) || 0;
        const matched = productCatalog.find(entry => entry.id === productId);
        if (!matched || qty <= 0) continue;
        matched.stock = Math.max(0, matched.stock - qty);
        orderItems.push({
            id: matched.id,
            name: matched.name,
            price: matched.price,
            qty: qty
        });
    }
    return orderItems;
}

function createOrderRecord(address, orderItems, pricing, paymentChoice) {
    const nowMs = Date.now();
    const paySpec = paymentChoice || {};
    const extraFee = Math.max(0, Number(paySpec.extraFee) || 0);
    return {
        orderId: `SL-${nowMs.toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`,
        timestamp: nowMs,
        user: window.currentUser.username,
        customerName: window.currentUser.name,
        items: orderItems,
        subtotal: pricing.subtotal,
        shipping: pricing.shipping,
        discount: pricing.discount,
        codFee: extraFee,
        total: pricing.total + extraFee,
        address: address,
        shippingDetails: typeof getSelectedCheckoutAddress === 'function' ? getSelectedCheckoutAddress() : null,
        date: new Date(nowMs).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }),
        status: paySpec.status || 'ชำระเงินเรียบร้อย (รอจัดส่ง)',
        paymentMethod: paySpec.paymentMethod || 'promptpay',
        paymentStatus: paySpec.paymentStatus || 'pending',
        paymentSlipUrl: paySpec.paymentSlipUrl || '',
        paymentReference: paySpec.paymentReference || '',
        paymentGateway: paySpec.paymentGateway || 'manual',
        paidAt: paySpec.paidAt || null
    };
}

function commitOrderAfterValidation(address, addressInput, paymentChoice) {
    const pricing = calculateCartPricing(window.cart, window.products);
    const orderItems = buildOrderLineItems(window.cart, window.products);
    safeStorageSet('soulin_products', JSON.stringify(window.products));
    if (typeof window.syncProductsToCloud === 'function') {
        window.syncProductsToCloud(window.products);
    }

    const orderRecord = createOrderRecord(address, orderItems, pricing, paymentChoice);
    window.orders.unshift(orderRecord);
    safeStorageSet('soulin_orders', JSON.stringify(window.orders));
    if (typeof window.syncOrderToCloud === 'function') {
        window.syncOrderToCloud(orderRecord);
    }
    if (typeof recordAuditLog === 'function') {
        recordAuditLog({
            category: 'order',
            action: 'ORDER_CREATED',
            targetId: orderRecord.orderId,
            summary: `สร้างคำสั่งซื้อ ${orderRecord.orderId} ยอด ${orderRecord.total} ฿ (${orderRecord.paymentMethod})`,
            severity: 'info',
            metadata: { total: orderRecord.total, method: orderRecord.paymentMethod }
        });
    }
    sendOrderToGoogleSheetWebhook(orderRecord);

    window.cart = {};
    saveCart();
    if (addressInput) addressInput.value = '';
    updateCartBadge();
    renderCart();
    renderProducts(window.currentProductFilter);
    updateAdminStats();
    initAnalyticsChart();

    showToast('สั่งซื้อสินค้าสำเร็จแล้ว! ขอบคุณที่ไว้วางใจ SOULIN', 'success');
    switchTab('orders');
    return true;
}

function validateCheckoutPrerequisites() {
    if (Object.keys(window.cart).length === 0) {
        showToast('ไม่มีสินค้าในตะกร้า', 'error');
        return { ok: false };
    }
    if (!window.currentUser) {
        showToast('กรุณาเข้าสู่ระบบก่อนทำการสั่งซื้อ', 'info');
        navigateToLoginPage('cart');
        return { ok: false };
    }
    const addressInput = document.getElementById('checkout-address');
    const address = addressInput ? addressInput.value.trim() : '';
    if (!address) {
        showToast('กรุณาเพิ่มและเลือกที่อยู่สำหรับการจัดส่งก่อนสั่งซื้อ', 'error');
        if (typeof openAddressModal === 'function') openAddressModal();
        return { ok: false };
    }
    const stockCheck = validateCartStock(window.cart, window.products);
    if (!stockCheck.valid) {
        showToast(stockCheck.message, 'error');
        return { ok: false };
    }
    return { ok: true, address, addressInput };
}

function processCheckout(paymentChoice) {
    const checkOutcome = validateCheckoutPrerequisites();
    if (!checkOutcome.ok) return false;
    return commitOrderAfterValidation(checkOutcome.address, checkOutcome.addressInput, paymentChoice);
}

function getOrderStatusBadgeClass(statusText) {
    const statusClassMap = {
        'จัดส่งสำเร็จ': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'กำลังจัดส่ง': 'bg-blue-50 text-blue-700 border-blue-200',
        'เก็บเงินปลายทาง (รอจัดส่ง)': 'bg-indigo-50 text-indigo-700 border-indigo-200',
        'รอตรวจสอบการชำระเงิน': 'bg-amber-50 text-amber-800 border-amber-200',
        'ยกเลิกคำสั่งซื้อ': 'bg-red-50 text-red-700 border-red-200'
    };
    return statusClassMap[statusText] || 'bg-teal-50 text-teal-700 border-teal-200';
}

function buildOrderPaymentFooterHtml(orderRecord) {
    const methodLabel = typeof getPaymentMethodLabel === 'function'
        ? getPaymentMethodLabel(orderRecord.paymentMethod)
        : (orderRecord.paymentMethod === 'cod' ? 'เก็บเงินปลายทาง (COD)' : 'พร้อมเพย์ QR / โอนเงิน');
    const slipBtn = orderRecord.paymentSlipUrl
        ? `<button type="button" onclick="openSlipPreviewModal('${escapeHtml(orderRecord.orderId)}')" class="text-[11px] font-semibold text-soulin-primary hover:underline inline-flex items-center gap-1"><i class="fa-solid fa-receipt"></i> ดูสลิป</button>`
        : '';
    return `<div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-1"><span class="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md">${escapeHtml(methodLabel)}</span>${slipBtn}</div>`;
}

function renderOrderCard(orderRecord) {
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
        <div class="bg-white p-6 rounded-2xl border border-soulin-mint smooth-shadow space-y-4">
            <div class="flex flex-wrap justify-between items-center border-b border-slate-100 pb-3 gap-2">
                <div>
                    <span class="font-bold text-soulin-dark text-sm">หมายเลขคำสั่งซื้อ: ${safeOrderId}</span>
                    <span class="text-xs text-slate-400 block">${safeDate}</span>
                </div>
                <span class="${badgeClass} text-xs font-semibold px-3 py-1 rounded-full border">${safeStatus}</span>
            </div>
            <div class="space-y-2">
                ${itemsHtml}
                ${discountLine}
            </div>
            <div class="border-t border-slate-100 pt-3 flex flex-wrap justify-between items-center text-xs text-slate-500 gap-2">
                <div><span>จัดส่งไปที่: ${safeAddress}</span>${buildOrderPaymentFooterHtml(orderRecord)}</div>
                <span class="text-sm font-bold text-soulin-primary">ยอดสุทธิ: ${Number(orderRecord.total) || 0} ฿</span>
            </div>
        </div>
    `;
}

function renderOrders() {
    const container = document.getElementById('orders-list-container');
    if (!container) return;
    if (!window.currentUser) {
        container.innerHTML = `
            <div class="bg-white p-8 rounded-2xl text-center border border-slate-200 space-y-4">
                <p class="text-sm text-slate-500">กรุณาเข้าสู่ระบบเพื่อดูประวัติการสั่งซื้อของคุณ</p>
                <div class="flex flex-wrap justify-center gap-3">
                    <a href="./login.html?redirect=orders" class="bg-soulin-primary text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-soulin-dark transition-all inline-flex items-center gap-2">
                        <i class="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบ
                    </a>
                    <a href="./login.html?redirect=orders&mode=signup" class="bg-soulin-mint text-soulin-primary text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-100 transition-all inline-flex items-center gap-2">
                        <i class="fa-solid fa-user-plus"></i> สมัครสมาชิกใหม่
                    </a>
                </div>
            </div>
        `;
        return;
    }

    const userOrders = window.currentUser.role === 'admin'
        ? window.orders
        : window.orders.filter(orderRecord => orderRecord.user === window.currentUser.username);

    if (userOrders.length === 0) {
        container.innerHTML = `
            <div class="bg-white p-8 rounded-2xl text-center border border-slate-200 text-slate-400 text-xs">
                ยังไม่มีประวัติการสั่งซื้อในระบบ
            </div>
        `;
        return;
    }

    container.innerHTML = userOrders.map(renderOrderCard).join('');
}
