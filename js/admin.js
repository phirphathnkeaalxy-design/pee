let salesChartInstance = null;
let currentAdminProductFilter = 'all';
let currentAdminOrderFilter = 'all';

const ADMIN_ORDER_STATUS_FILTERS = {
    all: '',
    pending: 'รอตรวจสอบการชำระเงิน',
    paid: 'ชำระเงินเรียบร้อย (รอจัดส่ง)',
    shipping: 'กำลังจัดส่ง',
    done: 'จัดส่งสำเร็จ',
    cancelled: 'ยกเลิกคำสั่งซื้อ'
};

const ADMIN_TAB_META = {
    analytics: { title: 'ภาพรวม & ยอดขาย', subtitle: 'ติดตามรายได้ สต็อกสินค้า และคำสั่งซื้อแบบเรียลไทม์' },
    products: { title: 'จัดการสต็อกสินค้า (8 รายการ)', subtitle: 'ปรับราคา จำนวนคงเหลือ และรูปภาพสินค้าได้ทันที' },
    cms: { title: 'ปรับแต่งหน้าเว็บ & แบนเนอร์', subtitle: 'แก้ไขข้อความและพรีวิวแบนเนอร์หน้าร้านแบบเรียลไทม์' },
    orders: { title: 'ตรวจเช็คคำสั่งซื้อของลูกค้า', subtitle: 'กรอง ค้นหา และอัปเดตสถานะการจัดส่งให้ลูกค้า' },
    logs: { title: 'ตรวจสอบประวัติการใช้งาน (Audit Log)', subtitle: 'ติดตามทุกเหตุการณ์สำคัญ ออเดอร์ การเงิน สต็อก และการตั้งค่าระบบแบบเรียลไทม์' }
};

function emitAdminAudit(categoryKey, actionName, targetId, summaryText, severityLevel, metaSpec) {
    if (typeof recordAuditLog === 'function') {
        recordAuditLog({
            category: categoryKey,
            action: actionName,
            targetId: targetId,
            summary: summaryText,
            severity: severityLevel || 'info',
            metadata: metaSpec || {}
        });
    }
}

function updateAdminWorkspaceHeader(subTab) {
    const meta = ADMIN_TAB_META[subTab] || ADMIN_TAB_META.analytics;
    const titleEl = document.getElementById('adm-workspace-title');
    const subEl = document.getElementById('adm-workspace-subtitle');
    const titleText = subTab === 'products'
        ? `จัดการสต็อกสินค้า (${(window.products || []).length} รายการ)`
        : meta.title;
    if (titleEl) titleEl.textContent = titleText;
    if (subEl) subEl.textContent = meta.subtitle;
}

function redirectUnauthorizedAdminRoute() {
    const requestedAdmin = typeof getInitialTabFromQuery === 'function' && getInitialTabFromQuery() === 'admin';
    if (requestedAdmin && typeof window !== 'undefined' && window.location) {
        window.location.href = './admin-login.html';
    }
}

async function verifyLiveAdminAuthSession() {
    if (!window.soulinSupabaseClient || typeof window.hasValidSupabaseAdminSession !== 'function') {
        return true;
    }
    const validAdmin = await window.hasValidSupabaseAdminSession();
    if (validAdmin) return true;
    window.currentUser = null;
    localStorage.removeItem('soulin_user');
    if (typeof renderAuthUI === 'function') renderAuthUI();
    showToast('เซสชันผู้ดูแลระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'error');
    switchTab('home');
    redirectUnauthorizedAdminRoute();
    return false;
}

function renderAdminDashboard() {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        switchTab('home');
        redirectUnauthorizedAdminRoute();
        return;
    }
    verifyLiveAdminAuthSession();
    renderAdminProductsTable();
    renderAdminOrdersList();
    updateAdminStats();
    updateAdminTabBadges();
    renderAdminLowStockWidget();
    renderAdminRecentOrdersWidget();
    initAnalyticsChart();
    if (typeof renderAdminPaymentSettings === 'function') {
        renderAdminPaymentSettings();
    }
    if (typeof renderAdminAuditLogs === 'function') {
        renderAdminAuditLogs();
    }
}

function switchAdminTab(subTab) {
    const activeTabCls = 'adm-btn w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-500/25 text-white border border-emerald-400/35 shadow-sm transition-all';
    const idleTabCls = 'adm-btn w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-emerald-100/75 hover:bg-white/10 hover:text-white border border-transparent transition-all';
    ['analytics', 'products', 'cms', 'orders', 'logs'].forEach(tabKey => {
        const panel = document.getElementById(`adm-content-${tabKey}`);
        const tabBtn = document.getElementById(`adm-tab-${tabKey}`);
        const isCurrent = tabKey === subTab;
        if (panel) panel.classList.toggle('hidden', !isCurrent);
        if (tabBtn) tabBtn.className = isCurrent ? activeTabCls : idleTabCls;
    });
    if (subTab === 'logs' && typeof renderAdminAuditLogs === 'function') {
        renderAdminAuditLogs();
    }
    updateAdminWorkspaceHeader(subTab);
}

function accumulateOrderMetrics(orderRecord, monthlyTotals, productCounts, fallbackMonth) {
    const orderTotal = Number(orderRecord.total) || 0;
    const parsedDate = orderRecord.timestamp ? new Date(orderRecord.timestamp) : new Date();
    const monthIdx = Number.isNaN(parsedDate.getMonth()) ? fallbackMonth : parsedDate.getMonth();
    monthlyTotals[monthIdx] += orderTotal;
    for (const line of (orderRecord.items || [])) {
        const prodName = line.name || 'สินค้า SOULIN';
        productCounts[prodName] = (productCounts[prodName] || 0) + (Number(line.qty) || 0);
    }
    return orderTotal;
}

function findTopProductName(productCounts) {
    let bestSellerName = 'ยังไม่มีข้อมูลยอดขาย';
    let topQty = 0;
    for (const prodName of Object.keys(productCounts)) {
        if (productCounts[prodName] > topQty) {
            topQty = productCounts[prodName];
            bestSellerName = prodName;
        }
    }
    return bestSellerName;
}

function computeSalesAnalytics(orderList) {
    const monthlyTotals = new Array(12).fill(0);
    const productCounts = {};
    let activeOrdersCount = 0;
    let totalRevenue = 0;
    const fallbackMonth = new Date().getMonth();

    for (const orderRecord of (orderList || [])) {
        if (!orderRecord || orderRecord.status === 'ยกเลิกคำสั่งซื้อ') continue;
        activeOrdersCount += 1;
        totalRevenue += accumulateOrderMetrics(orderRecord, monthlyTotals, productCounts, fallbackMonth);
    }

    return {
        activeOrdersCount,
        totalRevenue,
        monthlyTotals,
        bestSellerName: findTopProductName(productCounts)
    };
}

function updateAdminInventoryKpi() {
    const catalogList = window.products || [];
    const lowStockCount = catalogList.filter(entry => (Number(entry.stock) || 0) < 10).length;
    const totalUnits = catalogList.reduce((sum, entry) => sum + (Number(entry.stock) || 0), 0);
    const lowEl = document.getElementById('adm-stat-lowstock');
    const subEl = document.getElementById('adm-stat-stock-sub');
    if (lowEl) {
        lowEl.textContent = lowStockCount > 0 ? `ใกล้หมด ${lowStockCount} รายการ` : 'สต็อกพร้อมขาย';
    }
    if (subEl) {
        subEl.textContent = `คงเหลือรวม ${totalUnits.toLocaleString()} ชิ้น`;
    }
}

function setBadgeCounter(elementId, countValue) {
    const badgeEl = document.getElementById(elementId);
    if (!badgeEl) return;
    badgeEl.textContent = String(countValue);
    badgeEl.classList.toggle('hidden', countValue <= 0);
}

function updateAdminTabBadges() {
    const lowCount = (window.products || []).filter(entry => (Number(entry.stock) || 0) < 10).length;
    const pendingOrdersCount = (window.orders || []).filter(
        entry => entry && entry.status !== 'จัดส่งสำเร็จ' && entry.status !== 'ยกเลิกคำสั่งซื้อ'
    ).length;
    setBadgeCounter('adm-badge-lowstock', lowCount);
    setBadgeCounter('adm-badge-orders', pendingOrdersCount);
}

function updateAdminStats() {
    const analytics = computeSalesAnalytics(window.orders);
    const salesEl = document.getElementById('adm-stat-sales');
    const ordersEl = document.getElementById('adm-stat-orders');
    const bestEl = document.getElementById('adm-stat-bestseller');
    if (salesEl) salesEl.innerText = `${analytics.totalRevenue.toLocaleString()} ฿`;
    if (ordersEl) ordersEl.innerText = `${analytics.activeOrdersCount} ออเดอร์`;
    if (bestEl) bestEl.innerText = analytics.bestSellerName;
    updateAdminInventoryKpi();
    updateAdminTabBadges();
}

function buildLowStockAlertCard(entry) {
    const safeId = escapeHtml(entry.id);
    return `
        <div class="flex items-center justify-between gap-2 bg-rose-50/70 border border-rose-100 rounded-xl px-3 py-2">
            <div class="min-w-0">
                <span class="font-semibold text-slate-800 block truncate">${escapeHtml(entry.name)}</span>
                <span class="text-[11px] text-rose-600 font-bold">เหลือเพียง ${Number(entry.stock) || 0} ชิ้น</span>
            </div>
            <button type="button" onclick="quickAdjustStock('${safeId}', 10)" class="bg-white hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 font-semibold text-[11px] px-2.5 py-1 rounded-lg transition-all flex-shrink-0">+10 ชิ้น</button>
        </div>
    `;
}

function renderAdminLowStockWidget() {
    const container = document.getElementById('adm-lowstock-alerts');
    if (!container) return;
    const lowProducts = (window.products || []).filter(entry => (Number(entry.stock) || 0) < 10);
    if (lowProducts.length === 0) {
        container.innerHTML = '<div class="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl p-3.5 text-center font-medium"><i class="fa-solid fa-circle-check mr-1.5"></i>สต็อกสินค้าทั้ง 8 รายการอยู่ในระดับปกติ</div>';
        return;
    }
    container.innerHTML = lowProducts.map(buildLowStockAlertCard).join('');
}

function buildRecentOrderSummaryCard(orderRecord) {
    const badgeClass = getOrderStatusBadgeClass(orderRecord.status);
    return `
        <div class="flex items-center justify-between gap-2 bg-slate-50/80 border border-slate-100 rounded-xl px-3 py-2.5">
            <div class="min-w-0">
                <span class="font-bold text-soulin-dark block truncate">${escapeHtml(orderRecord.orderId)} • ${escapeHtml(orderRecord.customerName)}</span>
                <span class="${badgeClass} inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-1">${escapeHtml(orderRecord.status)}</span>
            </div>
            <span class="font-bold text-soulin-primary flex-shrink-0">${Number(orderRecord.total) || 0} ฿</span>
        </div>
    `;
}

function renderAdminRecentOrdersWidget() {
    const container = document.getElementById('adm-recent-orders');
    if (!container) return;
    const recentOrders = (window.orders || []).slice(0, 3);
    if (recentOrders.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 py-4 bg-slate-50 rounded-2xl">ยังไม่มีรายการสั่งซื้อเข้ามา</div>';
        return;
    }
    container.innerHTML = recentOrders.map(buildRecentOrderSummaryCard).join('');
}

function updateFilterPillGroup(prefixId, filterKeys, activeKey, lowWarnKey) {
    const activeCls = 'px-3 py-1.5 rounded-full text-xs font-semibold bg-soulin-primary text-white shadow-sm transition-all';
    const warnActiveCls = 'px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-600 text-white shadow-sm transition-all';
    const idleCls = 'px-3 py-1.5 rounded-full text-xs font-medium bg-white text-slate-600 border border-slate-200 hover:bg-soulin-mint transition-all';
    filterKeys.forEach(keyName => {
        const pillBtn = document.getElementById(`${prefixId}-${keyName}`);
        if (!pillBtn) return;
        if (keyName !== activeKey) {
            pillBtn.className = idleCls;
            return;
        }
        pillBtn.className = keyName === lowWarnKey ? warnActiveCls : activeCls;
    });
}

function matchesAdminProductFilter(productRecord, queryText) {
    const stockCount = Number(productRecord.stock) || 0;
    if (currentAdminProductFilter === 'jar' && productRecord.type !== 'jar') return false;
    if (currentAdminProductFilter === 'stick' && productRecord.type !== 'stick') return false;
    if (currentAdminProductFilter === 'low' && stockCount >= 10) return false;
    if (!queryText) return true;
    const haystack = `${productRecord.name || ''} ${productRecord.scent || ''}`.toLowerCase();
    return haystack.includes(queryText);
}

function filterAdminProducts(filterKey) {
    currentAdminProductFilter = filterKey;
    updateFilterPillGroup('adm-prod-filter', ['all', 'jar', 'stick', 'low'], filterKey, 'low');
    renderAdminProductsTable();
}

function handleAdminProductSearch() {
    renderAdminProductsTable();
}

function refreshAfterProductChange() {
    renderAdminProductsTable();
    renderProducts(window.currentProductFilter);
    renderCart();
    updateAdminStats();
    renderAdminLowStockWidget();
}

function quickAdjustStock(prodId, stockDelta) {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return false;
    }
    const productRecord = window.products.find(entry => entry.id === prodId);
    if (!productRecord) return false;

    const prevStock = Number(productRecord.stock) || 0;
    const nextStock = Math.max(0, prevStock + Number(stockDelta));
    productRecord.stock = nextStock;
    if (!safeStorageSet('soulin_products', JSON.stringify(window.products))) return false;
    if (typeof window.syncProductsToCloud === 'function') {
        window.syncProductsToCloud(window.products);
    }
    refreshAfterProductChange();
    emitAdminAudit(
        'stock',
        'STOCK_ADJUSTED',
        prodId,
        `ปรับสต็อก "${productRecord.name}" (${prevStock} -> ${nextStock} ชิ้น)`,
        'info',
        { beforeStock: prevStock, afterStock: nextStock, delta: stockDelta }
    );
    showToast(`อัปเดตสต็อก "${productRecord.name}" เหลือ ${nextStock} ชิ้นแล้ว`, 'success');
    return true;
}

function getStockHealthVisual(stockCount) {
    const widthPct = Math.min(100, Math.round((stockCount / 60) * 100));
    if (stockCount < 10) {
        return { barColor: 'bg-rose-500', widthPct, badgeCls: 'bg-rose-50 text-rose-700 border-rose-200', statusText: 'ใกล้หมด' };
    }
    if (stockCount < 25) {
        return { barColor: 'bg-amber-500', widthPct, badgeCls: 'bg-amber-50 text-amber-800 border-amber-200', statusText: 'ปานกลาง' };
    }
    return { barColor: 'bg-emerald-600', widthPct, badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', statusText: 'พร้อมขาย' };
}

function renderAdminProductRow(productRecord) {
    const safeId = escapeHtml(productRecord.id);
    const safeImg = sanitizeImageUrl(productRecord.img);
    const safeName = escapeHtml(productRecord.name);
    const safeScent = escapeHtml(productRecord.scent);
    const stockCount = Number(productRecord.stock) || 0;
    const health = getStockHealthVisual(stockCount);
    const typeClass = productRecord.type === 'jar' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800';
    const typeLabel = productRecord.type === 'jar' ? 'กระปุก' : 'แท่งลูกกลิ้ง';
    return `
        <tr class="hover:bg-soulin-mint/20 transition-colors">
            <td class="p-4"><div class="w-12 h-12 rounded-xl bg-soulin-bg border border-emerald-100 p-1 flex items-center justify-center"><img src="${safeImg}" alt="${safeName}" class="w-full h-full object-contain"></div></td>
            <td class="p-4 font-semibold text-slate-800">${safeName}<span class="block text-[11px] font-normal text-slate-400 mt-0.5">${safeScent}</span></td>
            <td class="p-4"><span class="text-xs px-2.5 py-1 rounded-full font-medium ${typeClass}">${typeLabel}</span></td>
            <td class="p-4 font-bold text-soulin-dark">${Number(productRecord.price) || 0} ฿</td>
            <td class="p-4 min-w-[140px]">
                <div class="flex items-center justify-between gap-2 text-xs mb-1"><span class="font-bold text-slate-700">${stockCount} ชิ้น</span><span class="${health.badgeCls} text-[10px] font-semibold px-2 py-0.5 rounded-full border">${health.statusText}</span></div>
                <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-1.5 ${health.barColor} rounded-full" style="width:${health.widthPct}%"></div></div>
            </td>
            <td class="p-4">
                <div class="flex items-center justify-center gap-1.5">
                    <button type="button" onclick="quickAdjustStock('${safeId}', -1)" title="ลด 1 ชิ้น" class="bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 px-2 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 transition-all">-1</button>
                    <button type="button" onclick="quickAdjustStock('${safeId}', 5)" title="เพิ่ม 5 ชิ้น" class="bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white px-2 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 transition-all">+5</button>
                    <button type="button" onclick="openEditModal('${safeId}')" class="bg-amber-50 text-amber-800 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-200 transition-all"><i class="fa-solid fa-pen mr-1"></i>แก้ไข</button>
                    <button type="button" onclick="openDeleteProductConfirm('${safeId}')" title="ลบสินค้า" class="bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-rose-200 transition-all"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </td>
        </tr>
    `;
}

function renderAdminProductsTable() {
    const allFilterEl = document.getElementById('adm-prod-filter-all');
    if (allFilterEl) allFilterEl.textContent = `ทั้งหมด (${(window.products || []).length})`;
    const tbody = document.getElementById('admin-product-table-body');
    if (!tbody) return;
    const searchEl = document.getElementById('adm-product-search');
    const queryText = searchEl ? searchEl.value.trim().toLowerCase() : '';
    const filteredList = window.products.filter(entry => matchesAdminProductFilter(entry, queryText));
    if (filteredList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-xs text-slate-400">ไม่พบสินค้าที่ตรงกับตัวกรองหรือคำค้นหา</td></tr>';
        return;
    }
    tbody.innerHTML = filteredList.map(renderAdminProductRow).join('');
}

function setFieldVal(elementId, nextValue) {
    const fieldEl = document.getElementById(elementId);
    if (fieldEl) fieldEl.value = nextValue;
}

function getFieldVal(elementId, fallbackText) {
    const fieldEl = document.getElementById(elementId);
    if (!fieldEl || fieldEl.value === undefined || fieldEl.value === null) return fallbackText;
    return String(fieldEl.value).trim();
}

function setProductModalMode(isCreateMode) {
    const titleEl = document.getElementById('edit-modal-title');
    const subEl = document.getElementById('edit-modal-subtitle');
    const submitEl = document.getElementById('edit-modal-submit-btn');
    if (titleEl) titleEl.textContent = isCreateMode ? 'เพิ่มสินค้าใหม่' : 'แก้ไขข้อมูลและสต็อกสินค้า';
    if (subEl) subEl.textContent = isCreateMode ? 'กรอกรายละเอียด ราคา สต็อก และอัปโหลดรูปภาพสินค้าใหม่' : 'ปรับราคา จำนวนสต็อก หรืออัปโหลดรูปภาพสินค้าใหม่';
    if (submitEl) submitEl.textContent = isCreateMode ? 'เพิ่มสินค้าเข้าระบบ' : 'บันทึกการเปลี่ยนแปลง';
}

function openAddProductModal() {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return;
    }
    if (typeof discardStagedUpload === 'function') discardStagedUpload('product');
    const fallbackImg = typeof getDefaultProductImage === 'function' ? getDefaultProductImage('') : '';
    setFieldVal('edit-prod-id', '');
    setFieldVal('edit-prod-name', '');
    setFieldVal('edit-prod-type', 'jar');
    setFieldVal('edit-prod-scent', '');
    setFieldVal('edit-prod-desc', '');
    setFieldVal('edit-prod-badge', 'สินค้าใหม่');
    setFieldVal('edit-prod-price', '89');
    setFieldVal('edit-prod-stock', '20');
    setFieldVal('edit-prod-img-data', fallbackImg);
    setFieldVal('edit-prod-img-file', '');
    const previewEl = document.getElementById('edit-prod-img-preview');
    if (previewEl) previewEl.src = fallbackImg;
    setProductModalMode(true);
    document.getElementById('admin-edit-modal').classList.remove('hidden');
}

function openEditModal(prodId) {
    if (typeof discardStagedUpload === 'function') discardStagedUpload('product');
    const productRecord = window.products.find(entry => entry.id === prodId);
    if (!productRecord) return;
    const safeImg = sanitizeImageUrl(productRecord.img);

    setFieldVal('edit-prod-id', productRecord.id);
    setFieldVal('edit-prod-name', productRecord.name);
    setFieldVal('edit-prod-type', productRecord.type === 'stick' ? 'stick' : 'jar');
    setFieldVal('edit-prod-scent', productRecord.scent || '');
    setFieldVal('edit-prod-desc', productRecord.desc || '');
    setFieldVal('edit-prod-badge', productRecord.badgeText || '');
    setFieldVal('edit-prod-price', productRecord.price);
    setFieldVal('edit-prod-stock', productRecord.stock);
    setFieldVal('edit-prod-img-data', safeImg);
    setFieldVal('edit-prod-img-file', '');
    const previewEl = document.getElementById('edit-prod-img-preview');
    if (previewEl) previewEl.src = safeImg;

    setProductModalMode(false);
    document.getElementById('admin-edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    if (typeof discardStagedUpload === 'function') discardStagedUpload('product');
    document.getElementById('admin-edit-modal').classList.add('hidden');
}

function validateProductInput(updatedName, parsedPrice, parsedStock) {
    if (!updatedName) return false;
    if (!Number.isFinite(parsedPrice) || parsedPrice < 1) return false;
    return Number.isInteger(parsedStock) && parsedStock >= 0;
}

function readProductFormFields() {
    const rawType = getFieldVal('edit-prod-type', 'jar');
    return {
        prodId: getFieldVal('edit-prod-id', ''),
        prodName: getFieldVal('edit-prod-name', ''),
        prodType: rawType === 'stick' ? 'stick' : 'jar',
        scentText: getFieldVal('edit-prod-scent', ''),
        descText: getFieldVal('edit-prod-desc', ''),
        badgeText: getFieldVal('edit-prod-badge', ''),
        parsedPrice: Number(getFieldVal('edit-prod-price', '0')),
        parsedStock: Number(getFieldVal('edit-prod-stock', '-1')),
        imgUrl: sanitizeImageUrl(getFieldVal('edit-prod-img-data', ''))
    };
}

function persistAndRefreshProductCatalog(prevImgUrl, nextImgUrl) {
    if (!safeStorageSet('soulin_products', JSON.stringify(window.products))) return false;
    if (typeof window.syncProductsToCloud === 'function') {
        window.syncProductsToCloud(window.products);
    }
    if (typeof commitStagedUpload === 'function') {
        commitStagedUpload('product', prevImgUrl, nextImgUrl);
    }
    refreshAfterProductChange();
    return true;
}

function createNewProductRecord(formFields) {
    const randSuffix = Math.random().toString(36).slice(2, 5);
    const createdId = `${formFields.prodType}-${Date.now().toString(36)}-${randSuffix}`;
    const fallbackImg = typeof getDefaultProductImage === 'function' ? getDefaultProductImage('') : '';
    const nextRecord = {
        id: createdId,
        name: formFields.prodName,
        scent: formFields.scentText || 'สมุนไพรธรรมชาติ',
        desc: formFields.descText || 'สูตรสมุนไพรธรรมชาติจาก SOULIN',
        type: formFields.prodType,
        price: formFields.parsedPrice,
        stock: formFields.parsedStock,
        iconClass: formFields.prodType === 'stick' ? 'fa-wand-magic-sparkles' : 'fa-jar',
        badgeText: formFields.badgeText,
        img: formFields.imgUrl || fallbackImg
    };
    window.products.push(nextRecord);
    if (!persistAndRefreshProductCatalog('', nextRecord.img)) return;
    updateAdminWorkspaceHeader('products');
    emitAdminAudit(
        'stock',
        'PRODUCT_CREATED',
        createdId,
        `เพิ่มสินค้าใหม่ "${nextRecord.name}" (${nextRecord.price} ฿ / สต็อก ${nextRecord.stock} ชิ้น)`,
        'info',
        { product: nextRecord }
    );
    closeEditModal();
    showToast(`เพิ่มสินค้า "${nextRecord.name}" เข้าระบบเรียบร้อยแล้ว`, 'success');
}

function updateExistingProductRecord(productRecord, formFields) {
    const beforeSnapshot = {
        name: productRecord.name,
        price: productRecord.price,
        stock: productRecord.stock
    };
    const previousProductImg = productRecord.img;
    productRecord.name = formFields.prodName;
    productRecord.type = formFields.prodType;
    productRecord.iconClass = formFields.prodType === 'stick' ? 'fa-wand-magic-sparkles' : 'fa-jar';
    productRecord.scent = formFields.scentText;
    productRecord.desc = formFields.descText;
    productRecord.badgeText = formFields.badgeText;
    productRecord.price = formFields.parsedPrice;
    productRecord.stock = formFields.parsedStock;
    if (formFields.imgUrl) productRecord.img = formFields.imgUrl;

    if (!persistAndRefreshProductCatalog(previousProductImg, productRecord.img)) return;
    emitAdminAudit(
        'stock',
        'PRODUCT_UPDATED',
        productRecord.id,
        `อัปเดตสินค้า "${productRecord.name}" (${beforeSnapshot.price} -> ${formFields.parsedPrice} ฿ / สต็อก ${beforeSnapshot.stock} -> ${formFields.parsedStock} ชิ้น)`,
        'info',
        { before: beforeSnapshot, after: { name: productRecord.name, price: formFields.parsedPrice, stock: formFields.parsedStock } }
    );
    closeEditModal();
    showToast('อัปเดตและบันทึกรูปภาพสินค้าลงระบบเรียบร้อยแล้ว', 'success');
}

function saveProductEdit(submitEvent) {
    if (submitEvent) submitEvent.preventDefault();
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return;
    }
    const formFields = readProductFormFields();
    if (!validateProductInput(formFields.prodName, formFields.parsedPrice, formFields.parsedStock)) {
        showToast('กรุณากรอกชื่อ ราคา (ตั้งแต่ 1 บาท) และสต็อก (จำนวนเต็มตั้งแต่ 0) ให้ถูกต้อง', 'error');
        return;
    }
    if (!formFields.prodId) {
        createNewProductRecord(formFields);
        return;
    }
    const productRecord = window.products.find(entry => entry.id === formFields.prodId);
    if (!productRecord) return;
    updateExistingProductRecord(productRecord, formFields);
}

function ensureDeleteProductModal() {
    let modalEl = document.getElementById('admin-delete-product-modal');
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.id = 'admin-delete-product-modal';
    modalEl.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4';
    document.body.appendChild(modalEl);
    return modalEl;
}

function closeDeleteProductConfirm() {
    const modalEl = document.getElementById('admin-delete-product-modal');
    if (modalEl) modalEl.classList.add('hidden');
}

function buildDeleteProductModalHtml(productRecord) {
    const safeId = escapeHtml(productRecord.id);
    const safeName = escapeHtml(productRecord.name);
    return `
        <div class="bg-white rounded-3xl max-w-sm w-full p-6 smooth-shadow border border-rose-100 space-y-5">
            <div class="flex items-start gap-3.5">
                <div class="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-lg flex-shrink-0">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div class="min-w-0">
                    <h3 class="text-base font-bold text-soulin-dark">ยืนยันการลบสินค้า</h3>
                    <p class="text-xs text-slate-500 mt-1 leading-relaxed">
                        ต้องการลบ <strong class="text-slate-800">"${safeName}"</strong> ออกจากรายการสินค้าและคลาวด์ใช่หรือไม่? การลบไม่สามารถกู้คืนได้
                    </p>
                </div>
            </div>
            <div class="flex gap-2.5 pt-1">
                <button type="button" onclick="closeDeleteProductConfirm()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition-all">
                    ยกเลิก
                </button>
                <button type="button" onclick="confirmDeleteProduct('${safeId}')" class="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl shadow-sm text-xs transition-all inline-flex items-center justify-center gap-1.5">
                    <i class="fa-solid fa-trash-can"></i> ยืนยันการลบ
                </button>
            </div>
        </div>
    `;
}

function openDeleteProductConfirm(prodId) {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return;
    }
    const productRecord = (window.products || []).find(entry => entry.id === prodId);
    if (!productRecord) return;
    const modalEl = ensureDeleteProductModal();
    modalEl.innerHTML = buildDeleteProductModalHtml(productRecord);
    modalEl.classList.remove('hidden');
}

function cleanupDeletedProductFromCart(prodId) {
    if (!window.cart || !Object.prototype.hasOwnProperty.call(window.cart, prodId)) {
        return;
    }
    delete window.cart[prodId];
    safeStorageSet('soulin_cart', JSON.stringify(window.cart));
    if (typeof updateCartBadge === 'function') updateCartBadge();
}

function syncDeletedProductToCloud(prodId, imageUrl) {
    if (typeof window.deleteProductFromCloud === 'function') {
        window.deleteProductFromCloud(prodId);
    }
    if (typeof window.deleteImageFromCloud === 'function' && imageUrl) {
        window.deleteImageFromCloud(imageUrl);
    }
}

function confirmDeleteProduct(prodId) {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return false;
    }
    const catalog = window.products || [];
    const targetIdx = catalog.findIndex(entry => entry.id === prodId);
    if (targetIdx === -1) return false;
    const [removedRecord] = catalog.splice(targetIdx, 1);
    if (!safeStorageSet('soulin_products', JSON.stringify(catalog))) return false;
    cleanupDeletedProductFromCart(prodId);
    syncDeletedProductToCloud(prodId, removedRecord.img);
    refreshAfterProductChange();
    updateAdminWorkspaceHeader('products');
    emitAdminAudit('stock', 'PRODUCT_DELETED', prodId, `ลบสินค้า "${removedRecord.name}" ออกจากระบบแล้ว`, 'warning');
    closeDeleteProductConfirm();
    showToast(`ลบสินค้า "${removedRecord.name}" เรียบร้อยแล้ว`, 'info');
    return true;
}

function resetDefaultStock() {
    if (typeof window.confirm === 'function' && !window.confirm('ต้องการคืนค่าสต็อกและข้อมูลสินค้าเริ่มต้นทั้งหมดใช่หรือไม่?')) {
        return;
    }
    const previousImageUrls = (window.products || []).map(entry => entry.img).filter(Boolean);
    window.products = cloneDefaultProducts();
    safeStorageSet('soulin_products', JSON.stringify(window.products));
    if (typeof window.syncProductsToCloud === 'function') {
        window.syncProductsToCloud(window.products);
    }
    if (typeof window.deleteImagesFromCloud === 'function') {
        window.deleteImagesFromCloud(previousImageUrls);
    }
    refreshAfterProductChange();
    emitAdminAudit('stock', 'STOCK_RESET', 'ALL_PRODUCTS', 'คืนค่าสต็อกและข้อมูลสินค้าทั้งหมดเป็นค่าเริ่มต้น', 'warning');
    showToast('คืนค่าสต็อกสินค้าเริ่มต้นเรียบร้อยแล้ว', 'info');
}

async function runAdminOrphanImageCleanup() {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return;
    }
    if (typeof window.cleanupOrphanedStorageImages !== 'function' || !window.soulinSupabaseClient) {
        showToast('กรุณาเชื่อมต่อ Supabase ก่อนล้างรูปค้าง', 'info');
        return;
    }
    showToast('กำลังตรวจสอบและล้างรูปค้างใน Supabase Storage...', 'info');
    const cleanupOutcome = await window.cleanupOrphanedStorageImages();
    if (!cleanupOutcome.ok) {
        showToast('ไม่สามารถล้างรูปค้างได้ กรุณาลองใหม่อีกครั้ง', 'error');
        return;
    }
    emitAdminAudit('system', 'STORAGE_ORPHAN_CLEANUP', 'soulin-images', `สแกนและล้างรูปค้างใน Storage ออก ${cleanupOutcome.deletedCount} ไฟล์`, 'info', { deletedCount: cleanupOutcome.deletedCount });
    const toastMsg = cleanupOutcome.deletedCount > 0
        ? `ล้างรูปค้างออก ${cleanupOutcome.deletedCount} ไฟล์เรียบร้อยแล้ว`
        : 'ไม่พบรูปค้างในระบบ ข้อมูลสะอาดเรียบร้อย';
    showToast(toastMsg, 'success');
}

function findProductForOrderLine(lineEntry) {
    if (!lineEntry || !Array.isArray(window.products)) return null;
    if (lineEntry.id) {
        const byId = window.products.find(entry => entry.id === lineEntry.id);
        if (byId) return byId;
    }
    return window.products.find(entry => entry.name === lineEntry.name) || null;
}

function canRedeductOrderStock(orderRecord) {
    for (const lineEntry of (orderRecord.items || [])) {
        const neededQty = Number(lineEntry.qty) || 0;
        if (neededQty <= 0) continue;
        const matchedProd = findProductForOrderLine(lineEntry);
        const availStock = matchedProd ? (Number(matchedProd.stock) || 0) : 0;
        if (!matchedProd || availStock < neededQty) {
            return {
                ok: false,
                message: `ไม่สามารถเปิดออเดอร์กลับได้ "${lineEntry.name}" เหลือ ${availStock} ชิ้น (ต้องการ ${neededQty} ชิ้น)`
            };
        }
    }
    return { ok: true, message: '' };
}

function applyOrderStockDelta(orderRecord, directionSign) {
    let changedCount = 0;
    for (const lineEntry of (orderRecord.items || [])) {
        const lineQty = Number(lineEntry.qty) || 0;
        const matchedProd = findProductForOrderLine(lineEntry);
        if (!matchedProd || lineQty <= 0) continue;
        matchedProd.stock = Math.max(0, (Number(matchedProd.stock) || 0) + (directionSign * lineQty));
        changedCount += 1;
    }
    if (changedCount === 0) return false;
    safeStorageSet('soulin_products', JSON.stringify(window.products));
    if (typeof window.syncProductsToCloud === 'function') {
        window.syncProductsToCloud(window.products);
    }
    refreshAfterProductChange();
    return true;
}

function syncOrderStockOnTransition(targetOrder, previousStatus, nextStatus) {
    if (previousStatus === 'ยกเลิกคำสั่งซื้อ') {
        const stockCheck = canRedeductOrderStock(targetOrder);
        if (!stockCheck.ok) return stockCheck;
        applyOrderStockDelta(targetOrder, -1);
        return { ok: true, restored: false };
    }
    if (nextStatus === 'ยกเลิกคำสั่งซื้อ') {
        applyOrderStockDelta(targetOrder, 1);
        return { ok: true, restored: true };
    }
    return { ok: true, restored: false };
}

function resolveAdminOrderTarget(orderId, nextStatus) {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return null;
    }
    if (!ORDER_STATUS_OPTIONS.includes(nextStatus)) {
        showToast('สถานะคำสั่งซื้อไม่ถูกต้อง', 'error');
        return null;
    }
    return window.orders.find(entry => entry.orderId === orderId) || null;
}

function updateOrderStatus(orderId, nextStatus) {
    const targetOrder = resolveAdminOrderTarget(orderId, nextStatus);
    if (!targetOrder) return false;
    if (targetOrder.status === nextStatus) return true;

    const transitionOutcome = syncOrderStockOnTransition(targetOrder, targetOrder.status, nextStatus);
    if (!transitionOutcome.ok) {
        showToast(transitionOutcome.message, 'error');
        renderAdminOrdersList();
        return false;
    }
    const prevStatusText = targetOrder.status;
    targetOrder.status = nextStatus;
    safeStorageSet('soulin_orders', JSON.stringify(window.orders));
    if (typeof window.syncOrderToCloud === 'function') {
        window.syncOrderToCloud(targetOrder);
    }
    emitAdminAudit(
        'order',
        'ORDER_STATUS_CHANGED',
        orderId,
        `เปลี่ยนสถานะออเดอร์ ${orderId} จาก "${prevStatusText}" เป็น "${nextStatus}"`,
        nextStatus === 'ยกเลิกคำสั่งซื้อ' ? 'warning' : 'info',
        { from: prevStatusText, to: nextStatus, stockRestored: transitionOutcome.restored }
    );
    renderAdminOrdersList();
    renderOrders();
    updateAdminStats();
    updateAdminTabBadges();
    renderAdminRecentOrdersWidget();
    initAnalyticsChart();
    showToast(transitionOutcome.restored ? `ยกเลิก ${orderId} และคืนสต็อกสินค้าแล้ว` : `อัปเดตสถานะ ${orderId} เป็น "${nextStatus}" แล้ว`, 'success');
    return true;
}

function filterAdminOrders(filterKey) {
    currentAdminOrderFilter = filterKey;
    updateFilterPillGroup('adm-ord-filter', ['all', 'pending', 'paid', 'shipping', 'done', 'cancelled'], filterKey, 'cancelled');
    renderAdminOrdersList();
}

function handleAdminOrderSearch() {
    renderAdminOrdersList();
}

function buildOrderSearchText(orderRecord) {
    const itemsText = (orderRecord.items || []).map(line => line.name).join(' ');
    return [orderRecord.orderId, orderRecord.customerName, orderRecord.address, itemsText]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function matchesAdminOrderFilter(orderRecord, queryText) {
    const expectedStatus = ADMIN_ORDER_STATUS_FILTERS[currentAdminOrderFilter] || '';
    if (expectedStatus && orderRecord.status !== expectedStatus) return false;
    if (!queryText) return true;
    return buildOrderSearchText(orderRecord).includes(queryText);
}

function buildOrderItemPill(line) {
    return `<span class="inline-block bg-soulin-mint/60 text-soulin-dark text-[11px] font-medium px-2.5 py-0.5 rounded-full">${escapeHtml(line.name)} × ${Number(line.qty) || 0}</span>`;
}

function buildOrderStatusOptions(currentStatus) {
    return ORDER_STATUS_OPTIONS.map(statusOpt => {
        const selectedAttr = currentStatus === statusOpt ? 'selected' : '';
        return `<option value="${escapeHtml(statusOpt)}" ${selectedAttr}>${escapeHtml(statusOpt)}</option>`;
    }).join('');
}

function buildAdminOrderPaymentActionsHtml(orderRecord, safeOrderId) {
    const methodLabel = typeof getPaymentMethodLabel === 'function'
        ? getPaymentMethodLabel(orderRecord.paymentMethod)
        : (orderRecord.paymentMethod || 'promptpay');
    const payMeta = typeof getPaymentStatusBadgeMeta === 'function'
        ? getPaymentStatusBadgeMeta(orderRecord.paymentStatus)
        : { label: orderRecord.paymentStatus || '-', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
    const slipBtn = orderRecord.paymentSlipUrl
        ? `<button type="button" onclick="openSlipPreviewModal('${safeOrderId}')" class="text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-soulin-primary border border-emerald-200 px-2.5 py-1 rounded-lg"><i class="fa-solid fa-receipt mr-1"></i>ดูสลิป</button>`
        : '';
    const verifyBtns = orderRecord.status === 'รอตรวจสอบการชำระเงิน'
        ? `<button type="button" onclick="approveOrderPayment('${safeOrderId}')" class="text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg">อนุมัติสลิป</button><button type="button" onclick="rejectOrderPayment('${safeOrderId}')" class="text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg">ปฏิเสธ</button>`
        : '';
    return `<div class="flex flex-wrap items-center gap-1.5 pt-1"><span class="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">${escapeHtml(methodLabel)}</span><span class="${payMeta.cls} text-[11px] font-semibold px-2 py-0.5 rounded-full border">${escapeHtml(payMeta.label)}</span>${slipBtn}${verifyBtns}</div>`;
}

function renderAdminOrderRow(orderRecord) {
    const safeOrderId = escapeHtml(orderRecord.orderId);
    const badgeClass = getOrderStatusBadgeClass(orderRecord.status);
    const itemsPills = (orderRecord.items || []).map(buildOrderItemPill).join('');
    const optionsHtml = buildOrderStatusOptions(orderRecord.status);
    const orderTotalText = (Number(orderRecord.total) || 0).toLocaleString();
    const paymentBarHtml = buildAdminOrderPaymentActionsHtml(orderRecord, safeOrderId);

    return `
        <div class="p-5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="font-bold text-sm text-soulin-dark">${safeOrderId}</span>
                    <span class="text-xs bg-slate-100 px-2.5 py-0.5 rounded-full text-slate-700 font-medium"><i class="fa-solid fa-user text-[10px] mr-1 text-slate-400"></i>${escapeHtml(orderRecord.customerName)}</span>
                    <span class="${badgeClass} text-[11px] font-semibold px-2.5 py-0.5 rounded-full border">${escapeHtml(orderRecord.status)}</span>
                </div>
                <p class="text-xs text-slate-500"><i class="fa-solid fa-location-dot text-soulin-primary mr-1"></i>${escapeHtml(orderRecord.address)} <span class="text-slate-400 ml-1">• ${escapeHtml(orderRecord.date)}</span></p>
                <div class="flex flex-wrap gap-1.5">${itemsPills}</div>
                ${paymentBarHtml}
            </div>
            <div class="text-left md:text-right flex-shrink-0 space-y-2 w-full md:w-auto">
                <span class="text-lg font-bold text-soulin-primary block">${orderTotalText} ฿</span>
                <div class="flex flex-wrap md:justify-end items-center gap-1.5">
                    <button type="button" onclick="printAdminOrder('${safeOrderId}', 'invoice')" title="พิมพ์ใบสั่งซื้อ / ใบเสร็จ A4" class="text-xs bg-white hover:bg-soulin-dark hover:text-white text-soulin-dark border border-emerald-200 font-semibold px-2.5 py-2 rounded-xl transition-all inline-flex items-center gap-1"><i class="fa-solid fa-file-invoice"></i> ใบเสร็จ A4</button>
                    <button type="button" onclick="printAdminOrder('${safeOrderId}', 'label')" title="พิมพ์ใบปะหน้าพัสดุ 100×150 มม." class="text-xs bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 border border-slate-200 font-semibold px-2.5 py-2 rounded-xl transition-all inline-flex items-center gap-1"><i class="fa-solid fa-tag"></i> ใบปะหน้า</button>
                    <select onchange="updateOrderStatus('${safeOrderId}', this.value)" aria-label="เปลี่ยนสถานะคำสั่งซื้อ ${safeOrderId}" class="text-xs border border-emerald-200 rounded-xl px-3 py-2 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-soulin-primary flex-1 md:flex-initial">
                        ${optionsHtml}
                    </select>
                </div>
            </div>
        </div>
    `;
}

function getFilteredAdminOrdersList() {
    const searchEl = document.getElementById('adm-order-search');
    const queryText = searchEl ? searchEl.value.trim().toLowerCase() : '';
    return (window.orders || []).filter(entry => matchesAdminOrderFilter(entry, queryText));
}

function renderAdminOrdersList() {
    const container = document.getElementById('admin-orders-list');
    if (!container) return;
    const filteredOrders = getFilteredAdminOrdersList();
    if (filteredOrders.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">ยังไม่มีรายการสั่งซื้อที่ตรงกับเงื่อนไขนี้</div>';
        return;
    }
    container.innerHTML = filteredOrders.map(renderAdminOrderRow).join('');
}

function initAnalyticsChart() {
    const ctx = document.getElementById('salesChart');
    if (!ctx || typeof Chart === 'undefined') return;
    if (salesChartInstance) salesChartInstance.destroy();

    const analytics = computeSalesAnalytics(window.orders);
    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
            datasets: [{
                label: 'ยอดขายรายเดือน (บาท)',
                data: analytics.monthlyTotals,
                backgroundColor: 'rgba(45, 90, 66, 0.88)',
                borderRadius: 10,
                hoverBackgroundColor: '#1E3E2B'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#EBF3ED' } },
                x: { grid: { display: false } }
            }
        }
    });
}
