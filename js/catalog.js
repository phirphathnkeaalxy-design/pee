function renderPromotions() {
    if (typeof renderPromoCarousel === 'function') {
        renderPromoCarousel();
    }
    const container = document.getElementById('promotions-grid');
    if (!container) return;
    container.innerHTML = PROMOTIONS.map(promo => `
        <div class="bg-white p-6 rounded-2xl border border-soulin-mint smooth-shadow space-y-3 flex flex-col justify-between hover:border-soulin-light transition-all">
            <div>
                <span class="inline-block text-[11px] font-bold px-2.5 py-1 rounded-md ${escapeHtml(promo.badgeBg)} mb-3">${escapeHtml(promo.tag)}</span>
                <h3 class="font-bold text-slate-800 text-base">${escapeHtml(promo.title)}</h3>
                <p class="text-xs text-slate-500 mt-2 leading-relaxed">${escapeHtml(promo.desc)}</p>
            </div>
            <button onclick="switchTab('products')" class="text-xs font-semibold text-soulin-primary hover:text-soulin-dark flex items-center gap-1 pt-2">
                ดูสินค้าร่วมรายการ <i class="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
        </div>
    `).join('');
}

function filterProducts(type) {
    window.currentProductFilter = type;
    const filterKeys = ['all', 'jar', 'stick'];
    filterKeys.forEach(filterKey => {
        const btn = document.getElementById(`btn-filter-${filterKey}`);
        if (!btn) return;
        const activeCls = 'filter-btn px-5 py-2 rounded-xl text-sm font-medium transition-all bg-soulin-primary text-white shadow';
        const idleCls = 'filter-btn px-5 py-2 rounded-xl text-sm font-medium transition-all bg-white text-slate-600 hover:bg-soulin-mint';
        btn.className = filterKey === type ? activeCls : idleCls;
    });
    renderProducts(type);
}

function buildStockBadgeHtml(stockCount) {
    if (stockCount <= 0) {
        return '<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">สินค้าหมด</span>';
    }
    if (stockCount < 10) {
        return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">เหลือ ${stockCount} ชิ้น</span>`;
    }
    return `<span class="text-[11px] font-medium text-emerald-700">คงเหลือ ${stockCount} ชิ้น</span>`;
}

function buildProductActionButton(safeId, isOutOfStock) {
    if (isOutOfStock) {
        return '<button type="button" disabled class="bg-slate-200 text-slate-400 cursor-not-allowed text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2"><i class="fa-solid fa-ban"></i> สินค้าหมด</button>';
    }
    return `<button onclick="addToCart('${safeId}')" class="bg-soulin-primary hover:bg-soulin-dark text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"><i class="fa-solid fa-cart-plus"></i> เพิ่มในตะกร้า</button>`;
}

function renderProductCard(productRecord) {
    const safeImg = sanitizeImageUrl(productRecord.img);
    const safeName = escapeHtml(productRecord.name);
    const safeScent = escapeHtml(productRecord.scent);
    const safeDesc = escapeHtml(productRecord.desc);
    const safeId = escapeHtml(productRecord.id);
    const fallbackIcon = productRecord.type === 'jar' ? 'fa-jar' : 'fa-capsules';
    const iconClass = escapeHtml(productRecord.iconClass || fallbackIcon);
    const fallbackBadge = productRecord.type === 'jar' ? 'กระปุกสมุนไพร 20g' : 'แท่งลูกกลิ้ง 10 ml';
    const badgeText = escapeHtml(productRecord.badgeText || fallbackBadge);
    const stockCount = Number(productRecord.stock) || 0;
    const isOutOfStock = stockCount <= 0;

    return `
        <div class="bg-white rounded-3xl border border-soulin-mint overflow-hidden smooth-shadow flex flex-col justify-between group hover:shadow-xl transition-all">
            <div class="p-5 space-y-4">
                <div class="relative w-full h-48 bg-soulin-bg rounded-2xl overflow-hidden flex items-center justify-center p-4">
                    <img src="${safeImg}" alt="${safeName}" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 ${isOutOfStock ? 'opacity-60 grayscale' : ''}">
                    <span class="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-soulin-primary text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-soulin-mint flex items-center gap-1.5 shadow-sm">
                        <i class="fa-solid ${iconClass}"></i>
                        ${badgeText}
                    </span>
                </div>
                <div>
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-[11px] text-soulin-medium font-semibold uppercase tracking-wider">${safeScent}</span>
                        ${buildStockBadgeHtml(stockCount)}
                    </div>
                    <h3 class="font-bold text-slate-800 text-base leading-snug mt-1">${safeName}</h3>
                    <p class="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">${safeDesc}</p>
                </div>
            </div>
            <div class="px-5 pb-5 pt-2 flex items-center justify-between border-t border-slate-100">
                <div>
                    <span class="text-xs text-slate-400 block">ราคา</span>
                    <span class="text-lg font-bold text-soulin-dark">${Number(productRecord.price) || 0} ฿</span>
                </div>
                ${buildProductActionButton(safeId, isOutOfStock)}
            </div>
        </div>
    `;
}

function renderProducts(filter = window.currentProductFilter || 'all') {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    const filtered = filter === 'all'
        ? window.products
        : window.products.filter(productRecord => productRecord.type === filter);
    grid.innerHTML = filtered.map(renderProductCard).join('');
}
