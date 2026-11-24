function readImageAsDataUrl(imageFile) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = loadEvt => resolve(loadEvt.target.result);
        reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
        reader.readAsDataURL(imageFile);
    });
}

function loadImageElement(sourceUrl) {
    return new Promise((resolve, reject) => {
        const imageEl = new Image();
        imageEl.onload = () => resolve(imageEl);
        imageEl.onerror = () => reject(new Error('ไฟล์รูปภาพไม่ถูกต้อง'));
        imageEl.src = sourceUrl;
    });
}

function drawResizedJpeg(imageEl, maxWidth, quality) {
    const scale = imageEl.width > maxWidth ? maxWidth / imageEl.width : 1;
    const targetW = Math.max(1, Math.round(imageEl.width * scale));
    const targetH = Math.max(1, Math.round(imageEl.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการย่อขนาดรูปภาพ');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(imageEl, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', quality);
}

async function compressImageFile(imageFile, maxWidth = 800, quality = 0.8) {
    if (!imageFile || !imageFile.type || !imageFile.type.startsWith('image/')) {
        throw new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
    }
    if (imageFile.size > 10 * 1024 * 1024) {
        throw new Error('ขนาดไฟล์รูปภาพต้องไม่เกิน 10 MB');
    }
    const sourceUrl = await readImageAsDataUrl(imageFile);
    const imageEl = await loadImageElement(sourceUrl);
    let compressed = drawResizedJpeg(imageEl, maxWidth, quality);
    if (compressed.length > 550000) {
        compressed = drawResizedJpeg(imageEl, Math.min(maxWidth, 640), 0.6);
    }
    if (compressed.length > 550000) {
        throw new Error('รูปภาพยังมีขนาดใหญ่เกินไป กรุณาเลือกรูปที่มีความละเอียดน้อยลง');
    }
    return compressed;
}

function attachImageCompressionListener(inputId, maxWidth, quality, onCompressed) {
    const fileInput = document.getElementById(inputId);
    if (!fileInput) return;
    fileInput.addEventListener('change', async (changeEvent) => {
        const selectedFile = changeEvent.target.files[0];
        if (!selectedFile) return;
        fileInput.disabled = true;
        try {
            const compressedUrl = await compressImageFile(selectedFile, maxWidth, quality);
            await onCompressed(compressedUrl);
        } catch (compressErr) {
            console.error('Image upload error:', compressErr);
            showToast(compressErr.message || 'อัปโหลดรูปภาพไม่สำเร็จ', 'error');
            changeEvent.target.value = '';
        } finally {
            fileInput.disabled = false;
        }
    });
}

window.soulinStagedUploads = { product: '', cms: '', slip: '' };

function isCloudStorageImageUrl(imageUrl) {
    if (typeof window.extractStoragePathFromPublicUrl !== 'function') return false;
    return Boolean(window.extractStoragePathFromPublicUrl(imageUrl));
}

function discardStagedUpload(scopeKey) {
    const stagedUrl = window.soulinStagedUploads[scopeKey] || '';
    window.soulinStagedUploads[scopeKey] = '';
    if (stagedUrl && typeof window.deleteImageFromCloud === 'function') {
        window.deleteImageFromCloud(stagedUrl);
    }
}

function replaceStagedUpload(scopeKey, nextUrl) {
    const previousStaged = window.soulinStagedUploads[scopeKey] || '';
    if (previousStaged && previousStaged !== nextUrl && typeof window.deleteImageFromCloud === 'function') {
        window.deleteImageFromCloud(previousStaged);
    }
    window.soulinStagedUploads[scopeKey] = isCloudStorageImageUrl(nextUrl) ? nextUrl : '';
}

function commitStagedUpload(scopeKey, previousSavedUrl, nextSavedUrl) {
    const stagedUrl = window.soulinStagedUploads[scopeKey] || '';
    window.soulinStagedUploads[scopeKey] = '';
    const urlsToDelete = [];
    if (stagedUrl && stagedUrl !== nextSavedUrl) {
        urlsToDelete.push(stagedUrl);
    }
    if (previousSavedUrl && previousSavedUrl !== nextSavedUrl) {
        urlsToDelete.push(previousSavedUrl);
    }
    if (urlsToDelete.length > 0 && typeof window.deleteImagesFromCloud === 'function') {
        window.deleteImagesFromCloud(urlsToDelete);
    }
}

async function resolveUploadedImageUrl(compressedUrl, folderName, filePrefix) {
    if (typeof window.uploadImageToCloud !== 'function' || !window.soulinSupabaseClient) {
        return compressedUrl;
    }
    showToast('กำลังอัปโหลดรูปภาพขึ้น Supabase Storage...', 'info');
    const cloudImageUrl = await window.uploadImageToCloud(compressedUrl, folderName, filePrefix);
    if (cloudImageUrl) {
        showToast('อัปโหลดรูปขึ้น Supabase Storage สำเร็จ!', 'success');
        return cloudImageUrl;
    }
    showToast('อัปโหลดขึ้นคลาวด์ไม่สำเร็จ ใช้รูปสำรองแทนชั่วคราว', 'info');
    return compressedUrl;
}

function getCmsFieldValue(inputId, fallbackText) {
    const fieldEl = document.getElementById(inputId);
    const trimmedText = fieldEl && fieldEl.value ? fieldEl.value.trim() : '';
    return trimmedText || fallbackText;
}

function syncCmsLivePreview() {
    const titleEl = document.getElementById('cms-live-preview-title');
    const tagEl = document.getElementById('cms-live-preview-tag');
    const subtitleEl = document.getElementById('cms-live-preview-subtitle');
    const imgEl = document.getElementById('cms-live-preview-img');

    if (titleEl) titleEl.textContent = getCmsFieldValue('cms-input-title', DEFAULT_CMS_CONFIG.title);
    if (tagEl) tagEl.textContent = getCmsFieldValue('cms-input-tag', DEFAULT_CMS_CONFIG.tag);
    if (subtitleEl) subtitleEl.textContent = getCmsFieldValue('cms-input-subtitle', DEFAULT_CMS_CONFIG.subtitle);
    if (imgEl) imgEl.src = sanitizeImageUrl(getCmsFieldValue('cms-input-img-data', '')) || DEFAULT_CMS_CONFIG.img;
}

function setupFileInputListeners() {
    attachImageCompressionListener('edit-prod-img-file', 1000, 0.85, async (compressedUrl) => {
        const prodPrefix = getCmsFieldValue('edit-prod-id', 'product');
        const resolvedUrl = await resolveUploadedImageUrl(compressedUrl, 'products', prodPrefix);
        replaceStagedUpload('product', resolvedUrl);
        document.getElementById('edit-prod-img-data').value = resolvedUrl;
        document.getElementById('edit-prod-img-preview').src = resolvedUrl;
    });

    attachImageCompressionListener('cms-input-img-file', 1200, 0.85, async (compressedUrl) => {
        const resolvedUrl = await resolveUploadedImageUrl(compressedUrl, 'banners', 'hero');
        replaceStagedUpload('cms', resolvedUrl);
        document.getElementById('cms-input-img-data').value = resolvedUrl;
        document.getElementById('cms-img-preview').src = resolvedUrl;
        document.getElementById('cms-img-preview-container').classList.remove('hidden');
        syncCmsLivePreview();
    });

    ['cms-input-title', 'cms-input-tag', 'cms-input-subtitle'].forEach(fieldId => {
        const inputEl = document.getElementById(fieldId);
        if (inputEl) inputEl.addEventListener('input', syncCmsLivePreview);
    });
}

function getDefaultProductImage(prodId) {
    if (typeof DEFAULT_PRODUCTS === 'undefined' || !Array.isArray(DEFAULT_PRODUCTS)) return '';
    const matchEntry = DEFAULT_PRODUCTS.find(entry => entry.id === prodId) || DEFAULT_PRODUCTS[0];
    return matchEntry && matchEntry.img ? matchEntry.img : '';
}

function removeEditProductImage() {
    const prodId = getCmsFieldValue('edit-prod-id', '');
    const fallbackImg = getDefaultProductImage(prodId);
    discardStagedUpload('product');
    document.getElementById('edit-prod-img-data').value = fallbackImg;
    document.getElementById('edit-prod-img-preview').src = fallbackImg;
    document.getElementById('edit-prod-img-file').value = '';
    showToast('คืนค่ารูปสินค้าเริ่มต้นแล้ว (กดบันทึกเพื่อยืนยันและลบรูปเก่า)', 'info');
}

function removeCmsBannerImage() {
    const fallbackImg = DEFAULT_CMS_CONFIG.img;
    discardStagedUpload('cms');
    document.getElementById('cms-input-img-data').value = fallbackImg;
    document.getElementById('cms-img-preview').src = fallbackImg;
    document.getElementById('cms-input-img-file').value = '';
    syncCmsLivePreview();
    showToast('คืนค่ารูปแบนเนอร์เริ่มต้นแล้ว (กดบันทึกเพื่อยืนยันและลบรูปเก่า)', 'info');
}

function refreshCmsSubPanels() {
    syncCmsLivePreview();
    if (typeof renderPromoCarousel === 'function') renderPromoCarousel();
    if (typeof renderAdminPromoManager === 'function') renderAdminPromoManager();
    if (typeof renderAdminPaymentSettings === 'function') renderAdminPaymentSettings();
}

function renderCMS() {
    const safeImg = sanitizeImageUrl(window.cmsConfig.img) || DEFAULT_CMS_CONFIG.img;
    const setText = (elId, textVal) => {
        const el = document.getElementById(elId);
        if (el) el.innerText = textVal;
    };
    const setInputVal = (elId, inputVal) => {
        const el = document.getElementById(elId);
        if (el) el.value = inputVal;
    };

    setText('hero-title', window.cmsConfig.title || DEFAULT_CMS_CONFIG.title);
    setText('hero-tag', window.cmsConfig.tag || DEFAULT_CMS_CONFIG.tag);
    setText('hero-subtitle', window.cmsConfig.subtitle || DEFAULT_CMS_CONFIG.subtitle);
    const heroImg = document.getElementById('hero-img-display');
    if (heroImg) heroImg.src = safeImg;

    setInputVal('cms-input-title', window.cmsConfig.title || DEFAULT_CMS_CONFIG.title);
    setInputVal('cms-input-tag', window.cmsConfig.tag || DEFAULT_CMS_CONFIG.tag);
    setInputVal('cms-input-subtitle', window.cmsConfig.subtitle || DEFAULT_CMS_CONFIG.subtitle);
    setInputVal('cms-input-img-data', safeImg);
    const previewImg = document.getElementById('cms-img-preview');
    if (previewImg) previewImg.src = safeImg;
    const previewBox = document.getElementById('cms-img-preview-container');
    if (previewBox) previewBox.classList.remove('hidden');
    refreshCmsSubPanels();
}

function saveCMSChanges() {
    const previousBannerImg = window.cmsConfig.img;
    const previousTitle = window.cmsConfig.title;
    window.cmsConfig.title = document.getElementById('cms-input-title').value;
    window.cmsConfig.tag = document.getElementById('cms-input-tag').value;
    window.cmsConfig.subtitle = document.getElementById('cms-input-subtitle').value;

    const uploadedBannerImg = sanitizeImageUrl(document.getElementById('cms-input-img-data').value);
    if (uploadedBannerImg) {
        window.cmsConfig.img = uploadedBannerImg;
    }
    if (!safeStorageSet('soulin_cms', JSON.stringify(window.cmsConfig))) return;
    if (typeof window.syncCMSToCloud === 'function') {
        window.syncCMSToCloud(window.cmsConfig);
    }
    commitStagedUpload('cms', previousBannerImg, window.cmsConfig.img);
    if (typeof recordAuditLog === 'function') {
        recordAuditLog({
            category: 'cms',
            action: 'CMS_UPDATED',
            targetId: 'main',
            summary: 'บันทึกการแก้ไขหัวข้อและแบนเนอร์หน้าร้าน (CMS)',
            severity: 'info',
            metadata: { beforeTitle: previousTitle, afterTitle: window.cmsConfig.title, imageChanged: previousBannerImg !== window.cmsConfig.img }
        });
    }
    renderCMS();
    showToast('ปรับแต่งหน้าเว็บเพจและบันทึกรูปภาพเรียบร้อยแล้ว!', 'success');
}
