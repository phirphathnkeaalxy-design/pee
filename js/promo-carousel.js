const PROMO_AUTO_SLIDE_MS = 4000;

let promoSlideIndex = 0;
let promoAutoSlideTimer = null;

function normalizePromoBannersList(rawList) {
    if (!Array.isArray(rawList)) return [];
    const cleanedList = [];
    for (const entry of rawList) {
        if (!entry || typeof entry !== 'object') continue;
        const safeImg = sanitizeImageUrl(entry.img || '');
        if (!safeImg) continue;
        cleanedList.push({
            id: String(entry.id || `promo-${cleanedList.length + 1}`),
            img: safeImg,
            caption: String(entry.caption || '').trim()
        });
    }
    return cleanedList;
}

function getPromoBanners() {
    const raw = window.cmsConfig ? window.cmsConfig.promoBanners : [];
    return normalizePromoBannersList(raw);
}

function persistPromoBanners(nextList) {
    window.cmsConfig = window.cmsConfig || {};
    window.cmsConfig.promoBanners = normalizePromoBannersList(nextList);
    if (!safeStorageSet('soulin_cms', JSON.stringify(window.cmsConfig))) return false;
    if (typeof window.syncCMSToCloud === 'function') {
        window.syncCMSToCloud(window.cmsConfig);
    }
    renderPromoCarousel();
    renderAdminPromoManager();
    return true;
}

function stopPromoAutoSlide() {
    if (promoAutoSlideTimer !== null && typeof clearInterval === 'function') {
        clearInterval(promoAutoSlideTimer);
    }
    promoAutoSlideTimer = null;
}

function startPromoAutoSlide() {
    stopPromoAutoSlide();
    const banners = getPromoBanners();
    if (banners.length <= 1 || typeof setInterval !== 'function') return;
    promoAutoSlideTimer = setInterval(() => {
        nextPromoSlide(false);
    }, PROMO_AUTO_SLIDE_MS);
}

function updatePromoCarouselIndicators(activeIdx, totalCount) {
    const counterEl = document.getElementById('promo-slide-counter');
    if (counterEl) {
        counterEl.textContent = `${activeIdx + 1} / ${totalCount}`;
    }
    for (let idx = 0; idx < totalCount; idx++) {
        const dotEl = document.getElementById(`promo-dot-${idx}`);
        if (!dotEl) continue;
        dotEl.className = idx === activeIdx
            ? 'h-2.5 w-7 rounded-full bg-white shadow transition-all'
            : 'h-2.5 w-2.5 rounded-full bg-white/55 hover:bg-white/85 transition-all';
    }
}

function applyPromoSlideTransform() {
    const banners = getPromoBanners();
    if (banners.length === 0) return;
    const boundedIdx = ((promoSlideIndex % banners.length) + banners.length) % banners.length;
    promoSlideIndex = boundedIdx;
    const trackEl = document.getElementById('promo-carousel-track');
    if (trackEl && trackEl.style) {
        trackEl.style.transform = `translateX(-${boundedIdx * 100}%)`;
    }
    updatePromoCarouselIndicators(boundedIdx, banners.length);
}

function goToPromoSlide(targetIdx, resetTimer = true) {
    const banners = getPromoBanners();
    if (banners.length <= 1) return;
    promoSlideIndex = ((Number(targetIdx) || 0) % banners.length + banners.length) % banners.length;
    applyPromoSlideTransform();
    if (resetTimer) startPromoAutoSlide();
}

function nextPromoSlide(resetTimer = true) {
    goToPromoSlide(promoSlideIndex + 1, resetTimer);
}

function prevPromoSlide() {
    goToPromoSlide(promoSlideIndex - 1, true);
}

function buildSinglePromoBannerHtml(bannerEntry) {
    const captionOverlay = bannerEntry.caption
        ? `<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-5 py-4 text-white text-xs sm:text-sm font-semibold">${escapeHtml(bannerEntry.caption)}</div>`
        : '';
    return `
        <div class="relative rounded-3xl overflow-hidden border border-emerald-200/70 bg-white smooth-shadow">
            <img src="${escapeHtml(bannerEntry.img)}" alt="${escapeHtml(bannerEntry.caption || 'SOULIN Promotion')}" class="w-full h-56 sm:h-72 lg:h-80 object-cover block">
            ${captionOverlay}
        </div>
    `;
}

function buildPromoSlideItemHtml(bannerEntry) {
    const captionOverlay = bannerEntry.caption
        ? `<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-6 py-4 text-white text-xs sm:text-sm font-semibold">${escapeHtml(bannerEntry.caption)}</div>`
        : '';
    return `
        <div class="w-full flex-shrink-0 relative">
            <img src="${escapeHtml(bannerEntry.img)}" alt="${escapeHtml(bannerEntry.caption || 'SOULIN Promotion')}" class="w-full h-56 sm:h-72 lg:h-80 object-cover block">
            ${captionOverlay}
        </div>
    `;
}

function buildMultiPromoCarouselHtml(bannersList) {
    const slidesHtml = bannersList.map(buildPromoSlideItemHtml).join('');
    const dotsHtml = bannersList.map((_, idx) => (
        `<button type="button" id="promo-dot-${idx}" onclick="goToPromoSlide(${idx})" aria-label="สไลด์โปรโมชั่นที่ ${idx + 1}" class="${idx === 0 ? 'h-2.5 w-7 rounded-full bg-white shadow transition-all' : 'h-2.5 w-2.5 rounded-full bg-white/55 hover:bg-white/85 transition-all'}"></button>`
    )).join('');
    return `
        <div class="relative rounded-3xl overflow-hidden border border-emerald-200/70 bg-slate-900 smooth-shadow group" onmouseenter="stopPromoAutoSlide()" onmouseleave="startPromoAutoSlide()">
            <div id="promo-carousel-track" class="flex transition-transform duration-500 ease-out" style="transform: translateX(0%);">
                ${slidesHtml}
            </div>
            <button type="button" onclick="prevPromoSlide()" aria-label="รูปก่อนหน้า" class="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-all">
                <i class="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <button type="button" onclick="nextPromoSlide()" aria-label="รูปถัดไป" class="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-all">
                <i class="fa-solid fa-chevron-right text-xs"></i>
            </button>
            <span id="promo-slide-counter" class="absolute top-3 right-3 bg-black/55 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">1 / ${bannersList.length}</span>
            <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">${dotsHtml}</div>
        </div>
    `;
}

function renderPromoCarousel() {
    const mountEl = document.getElementById('promo-carousel-mount');
    if (!mountEl) return;
    const banners = getPromoBanners();
    if (banners.length === 0) {
        stopPromoAutoSlide();
        mountEl.innerHTML = '';
        mountEl.classList.add('hidden');
        return;
    }
    mountEl.classList.remove('hidden');
    if (banners.length === 1) {
        stopPromoAutoSlide();
        mountEl.innerHTML = buildSinglePromoBannerHtml(banners[0]);
        return;
    }
    promoSlideIndex = 0;
    mountEl.innerHTML = buildMultiPromoCarouselHtml(banners);
    startPromoAutoSlide();
}

function buildAdminPromoCardHtml(bannerEntry, index, totalCount) {
    const safeId = escapeHtml(bannerEntry.id);
    const captionText = bannerEntry.caption ? escapeHtml(bannerEntry.caption) : 'ไม่มีคำบรรยาย';
    const leftDisabled = index === 0 ? 'disabled opacity-40 cursor-not-allowed' : '';
    const rightDisabled = index === totalCount - 1 ? 'disabled opacity-40 cursor-not-allowed' : '';
    return `
        <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
            <div class="relative rounded-xl overflow-hidden bg-white border border-slate-200 h-28">
                <img src="${escapeHtml(bannerEntry.img)}" alt="Promo ${index + 1}" class="w-full h-full object-cover">
                <span class="absolute top-2 left-2 bg-soulin-dark/85 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">สไลด์ #${index + 1}</span>
            </div>
            <p class="text-[11px] text-slate-600 truncate">${captionText}</p>
            <div class="flex items-center justify-between gap-1.5">
                <div class="flex items-center gap-1">
                    <button type="button" ${leftDisabled} onclick="movePromoBanner('${safeId}', -1)" title="เลื่อนซ้าย" class="px-2 py-1 text-[11px] rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700"><i class="fa-solid fa-arrow-left"></i></button>
                    <button type="button" ${rightDisabled} onclick="movePromoBanner('${safeId}', 1)" title="เลื่อนขวา" class="px-2 py-1 text-[11px] rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700"><i class="fa-solid fa-arrow-right"></i></button>
                </div>
                <button type="button" onclick="removePromoBanner('${safeId}')" class="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 transition-all"><i class="fa-solid fa-trash-can mr-1"></i>ลบ</button>
            </div>
        </div>
    `;
}

function renderAdminPromoManager() {
    const mountEl = document.getElementById('admin-promo-banners-mount');
    if (!mountEl) return;
    const banners = getPromoBanners();
    const cardsHtml = banners.length > 0
        ? banners.map((entry, idx) => buildAdminPromoCardHtml(entry, idx, banners.length)).join('')
        : '<div class="sm:col-span-2 lg:col-span-3 text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">ยังไม่มีรูปโปรโมชั่น (เพิ่มได้หลายรูป เมื่อมีมากกว่า 1 รูป หน้าร้านจะเลื่อนอัตโนมัติ)</div>';
    mountEl.innerHTML = `
        <div class="bg-white p-6 rounded-3xl border border-emerald-100 smooth-shadow space-y-5">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                    <h3 class="text-base font-bold text-soulin-dark">รูปแบนเนอร์โปรโมชั่น (${banners.length} รูป)</h3>
                    <p class="text-[11px] text-slate-500">อัปโหลดได้หลายรูปพร้อมกัน หากมีมากกว่า 1 รูป สไลด์โปรโมชั่นหน้าร้านจะเลื่อนให้อัตโนมัติ</p>
                </div>
                <span class="text-[11px] font-semibold bg-soulin-mint text-soulin-primary px-3 py-1 rounded-full">${banners.length > 1 ? 'โหมดสไลด์อัตโนมัติทำงาน' : 'เพิ่มอีกเพื่อเปิดสไลด์'}</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-soulin-bg/70 p-4 rounded-2xl border border-emerald-100">
                <div class="md:col-span-5">
                    <label for="cms-promo-img-file" class="block text-xs font-semibold text-slate-700 mb-1">เลือกไฟล์รูปโปรโมชั่น (เลือกได้หลายรูป)</label>
                    <input type="file" id="cms-promo-img-file" multiple accept="image/*" class="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-soulin-mint file:text-soulin-primary bg-white border border-slate-200 rounded-xl p-1.5 cursor-pointer">
                </div>
                <div class="md:col-span-4">
                    <label for="cms-promo-caption" class="block text-xs font-semibold text-slate-700 mb-1">ข้อความบนรูป <span class="text-slate-400 font-normal">(ไม่บังคับ)</span></label>
                    <input type="text" id="cms-promo-caption" placeholder="เช่น โปรเปิดร้าน ลดพิเศษ 50 บาท" class="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-soulin-primary/35">
                </div>
                <div class="md:col-span-3">
                    <button type="button" id="cms-promo-upload-btn" onclick="handleAdminPromoBannerUpload()" class="w-full bg-soulin-primary hover:bg-soulin-dark text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all inline-flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-cloud-arrow-up"></i> เพิ่มรูปโปรโมชั่น
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${cardsHtml}</div>
        </div>
    `;
}

async function uploadSelectedPromoFile(imageFile, captionText, idx) {
    const compressed = await compressImageFile(imageFile, 1280, 0.85);
    const resolvedUrl = await resolveUploadedImageUrl(compressed, 'banners', 'promo');
    return {
        id: `promo-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        img: resolvedUrl,
        caption: captionText
    };
}

async function handleAdminPromoBannerUpload() {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return false;
    }
    const fileInput = document.getElementById('cms-promo-img-file');
    const selectedFiles = fileInput && fileInput.files ? Array.from(fileInput.files) : [];
    if (selectedFiles.length === 0) {
        showToast('กรุณาเลือกไฟล์รูปโปรโมชั่นอย่างน้อย 1 รูป', 'error');
        return false;
    }
    const captionEl = document.getElementById('cms-promo-caption');
    const captionText = captionEl && captionEl.value ? captionEl.value.trim() : '';
    const nextList = getPromoBanners();
    for (let idx = 0; idx < selectedFiles.length; idx++) {
        const uploadedEntry = await uploadSelectedPromoFile(selectedFiles[idx], captionText, idx);
        nextList.push(uploadedEntry);
    }
    if (!persistPromoBanners(nextList)) return false;
    if (fileInput) fileInput.value = '';
    if (captionEl) captionEl.value = '';
    if (typeof recordAuditLog === 'function') {
        recordAuditLog({ category: 'cms', action: 'PROMO_BANNER_ADDED', targetId: 'promoBanners', summary: `เพิ่มรูปแบนเนอร์โปรโมชั่น ${selectedFiles.length} รูป`, severity: 'info', metadata: { addedCount: selectedFiles.length, totalCount: nextList.length } });
    }
    showToast(`เพิ่มรูปโปรโมชั่น ${selectedFiles.length} รูปเรียบร้อยแล้ว`, 'success');
    return true;
}

function movePromoBanner(bannerId, delta) {
    if (!window.currentUser || window.currentUser.role !== 'admin') return false;
    const list = getPromoBanners();
    const currentIdx = list.findIndex(entry => entry.id === bannerId);
    const targetIdx = currentIdx + Number(delta);
    if (currentIdx === -1 || targetIdx < 0 || targetIdx >= list.length) return false;
    const [moved] = list.splice(currentIdx, 1);
    list.splice(targetIdx, 0, moved);
    return persistPromoBanners(list);
}

function removePromoBanner(bannerId) {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return false;
    }
    const list = getPromoBanners();
    const targetIdx = list.findIndex(entry => entry.id === bannerId);
    if (targetIdx === -1) return false;
    const [removedEntry] = list.splice(targetIdx, 1);
    if (typeof window.deleteImageFromCloud === 'function' && removedEntry.img) {
        window.deleteImageFromCloud(removedEntry.img);
    }
    if (!persistPromoBanners(list)) return false;
    if (typeof recordAuditLog === 'function') {
        recordAuditLog({ category: 'cms', action: 'PROMO_BANNER_REMOVED', targetId: bannerId, summary: 'ลบรูปแบนเนอร์โปรโมชั่น 1 รายการ', severity: 'warning', metadata: { remainingCount: list.length } });
    }
    showToast('ลบรูปโปรโมชั่นเรียบร้อยแล้ว', 'info');
    return true;
}
