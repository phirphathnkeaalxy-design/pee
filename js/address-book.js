const THAI_PROVINCES = window.THAI_GEO_TREE ? Object.keys(window.THAI_GEO_TREE) : [];
window.THAI_PROVINCES = THAI_PROVINCES;

function getAddressOwnerKey() {
    return window.currentUser && window.currentUser.username ? window.currentUser.username : 'guest';
}

function getDistrictsForProvince(provinceName) {
    if (!window.THAI_GEO_TREE || !provinceName) return [];
    const districtMap = window.THAI_GEO_TREE[provinceName];
    return districtMap ? Object.keys(districtMap) : [];
}

function getSubdistrictEntries(provinceName, districtName) {
    if (!window.THAI_GEO_TREE || !provinceName || !districtName) return [];
    const districtMap = window.THAI_GEO_TREE[provinceName];
    return districtMap && Array.isArray(districtMap[districtName]) ? districtMap[districtName] : [];
}

function getUniqueSubdistrictNames(provinceName, districtName) {
    const entries = getSubdistrictEntries(provinceName, districtName);
    const seen = new Set();
    const names = [];
    for (const entry of entries) {
        if (seen.has(entry[0])) continue;
        seen.add(entry[0]);
        names.push(entry[0]);
    }
    return names;
}

function getPostalCodesForSubdistrict(provinceName, districtName, subdistrictName) {
    const entries = getSubdistrictEntries(provinceName, districtName);
    const seen = new Set();
    const codes = [];
    for (const entry of entries) {
        if (entry[0] !== subdistrictName || !entry[1] || seen.has(entry[1])) continue;
        seen.add(entry[1]);
        codes.push(entry[1]);
    }
    return codes;
}

function populateSelectOptions(selectId, placeholderText, optionValues, shouldDisable) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    const optionsMarkup = (optionValues || []).map(optText => (
        `<option value="${escapeHtml(optText)}">${escapeHtml(optText)}</option>`
    )).join('');
    selectEl.innerHTML = `<option value="">${escapeHtml(placeholderText)}</option>${optionsMarkup}`;
    selectEl.disabled = Boolean(shouldDisable);
    selectEl.value = '';
}

function updateAreaLabels(prefix, provinceName) {
    const isBangkok = provinceName === 'กรุงเทพมหานคร';
    const distLabel = document.getElementById(`${prefix}-district-label`);
    const subLabel = document.getElementById(`${prefix}-subdistrict-label`);
    if (distLabel) distLabel.textContent = isBangkok ? 'เขต *' : 'อำเภอ *';
    if (subLabel) subLabel.textContent = isBangkok ? 'แขวง *' : 'ตำบล *';
}

function handleProvinceCascade(prefix) {
    const provEl = document.getElementById(`${prefix}-province`);
    const provinceName = provEl ? provEl.value : '';
    updateAreaLabels(prefix, provinceName);
    if (!provinceName) {
        populateSelectOptions(`${prefix}-district`, '-- เลือกจังหวัดก่อน --', [], true);
        populateSelectOptions(`${prefix}-subdistrict`, '-- เลือกอำเภอ/เขตก่อน --', [], true);
        populateSelectOptions(`${prefix}-postal`, '-- เลือกตำบล/แขวงก่อน --', [], true);
        return;
    }
    const distPlaceholder = provinceName === 'กรุงเทพมหานคร' ? '-- เลือกเขต --' : '-- เลือกอำเภอ --';
    populateSelectOptions(`${prefix}-district`, distPlaceholder, getDistrictsForProvince(provinceName), false);
    populateSelectOptions(`${prefix}-subdistrict`, '-- เลือกอำเภอ/เขตก่อน --', [], true);
    populateSelectOptions(`${prefix}-postal`, '-- เลือกตำบล/แขวงก่อน --', [], true);
}

function handleDistrictCascade(prefix) {
    const provEl = document.getElementById(`${prefix}-province`);
    const distEl = document.getElementById(`${prefix}-district`);
    const provinceName = provEl ? provEl.value : '';
    const districtName = distEl ? distEl.value : '';
    if (!provinceName || !districtName) {
        populateSelectOptions(`${prefix}-subdistrict`, '-- เลือกอำเภอ/เขตก่อน --', [], true);
        populateSelectOptions(`${prefix}-postal`, '-- เลือกตำบล/แขวงก่อน --', [], true);
        return;
    }
    const subPlaceholder = provinceName === 'กรุงเทพมหานคร' ? '-- เลือกแขวง --' : '-- เลือกตำบล --';
    populateSelectOptions(`${prefix}-subdistrict`, subPlaceholder, getUniqueSubdistrictNames(provinceName, districtName), false);
    populateSelectOptions(`${prefix}-postal`, '-- เลือกตำบล/แขวงก่อน --', [], true);
}

function handleSubdistrictCascade(prefix) {
    const provEl = document.getElementById(`${prefix}-province`);
    const distEl = document.getElementById(`${prefix}-district`);
    const subEl = document.getElementById(`${prefix}-subdistrict`);
    const provinceName = provEl ? provEl.value : '';
    const districtName = distEl ? distEl.value : '';
    const subdistrictName = subEl ? subEl.value : '';
    if (!provinceName || !districtName || !subdistrictName) {
        populateSelectOptions(`${prefix}-postal`, '-- เลือกตำบล/แขวงก่อน --', [], true);
        return;
    }
    const zipCodes = getPostalCodesForSubdistrict(provinceName, districtName, subdistrictName);
    populateSelectOptions(`${prefix}-postal`, '-- เลือกรหัสไปรษณีย์ --', zipCodes, false);
    const postalEl = document.getElementById(`${prefix}-postal`);
    if (postalEl && zipCodes.length === 1) {
        postalEl.value = zipCodes[0];
    }
}

function applyCascadePreset(selectId, presetValue, cascadeStep) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl || !presetValue) return false;
    selectEl.value = presetValue;
    if (selectEl.value !== presetValue) return false;
    if (typeof cascadeStep === 'function') cascadeStep();
    return true;
}

function initAddressCascadeForm(prefix, initialAddress = {}) {
    populateSelectOptions(`${prefix}-province`, '-- เลือกจังหวัด --', THAI_PROVINCES, false);
    handleProvinceCascade(prefix);
    const addr = initialAddress || {};
    if (!applyCascadePreset(`${prefix}-province`, addr.province, () => handleProvinceCascade(prefix))) return;
    if (!applyCascadePreset(`${prefix}-district`, addr.district, () => handleDistrictCascade(prefix))) return;
    if (!applyCascadePreset(`${prefix}-subdistrict`, addr.subdistrict, () => handleSubdistrictCascade(prefix))) return;
    applyCascadePreset(`${prefix}-postal`, addr.postalCode);
}

function populateProvinceSelect(selectId) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    if (selectEl.innerHTML && selectEl.innerHTML.includes('กรุงเทพมหานคร')) return;
    populateSelectOptions(selectId, '-- เลือกจังหวัด --', THAI_PROVINCES, false);
}

function formatThaiPhone(rawPhone) {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    if (digits.length === 10) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 9) {
        return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }
    return String(rawPhone || '').trim();
}

function formatThaiAddressLine(addr) {
    if (!addr) return '';
    const isBangkok = addr.province === 'กรุงเทพมหานคร';
    const areaText = isBangkok
        ? `แขวง${addr.subdistrict} เขต${addr.district} กรุงเทพมหานคร ${addr.postalCode}`
        : `ต.${addr.subdistrict} อ.${addr.district} จ.${addr.province} ${addr.postalCode}`;
    return `${addr.streetDetail} ${areaText}`.trim();
}

function formatFullShippingText(addr) {
    if (!addr) return '';
    const phoneText = formatThaiPhone(addr.phone);
    const labelText = addr.label || 'บ้าน';
    const baseText = `${addr.recipientName} (${phoneText}) [${labelText}] ${formatThaiAddressLine(addr)}`;
    return addr.deliveryNote ? `${baseText} (หมายเหตุ: ${addr.deliveryNote})` : baseText;
}

function cleanAddressDraft(draft) {
    const source = draft || {};
    const labelCandidate = String(source.label || '').trim();
    return {
        id: String(source.id || '').trim(),
        recipientName: String(source.recipientName || '').trim(),
        phone: String(source.phone || '').replace(/[\s-]/g, ''),
        province: String(source.province || '').trim(),
        district: String(source.district || '').trim(),
        subdistrict: String(source.subdistrict || '').trim(),
        postalCode: String(source.postalCode || '').trim(),
        streetDetail: String(source.streetDetail || '').trim(),
        deliveryNote: String(source.deliveryNote || '').trim(),
        label: labelCandidate === 'ที่ทำงาน' ? 'ที่ทำงาน' : 'บ้าน',
        isDefault: Boolean(source.isDefault)
    };
}

function validateContactFields(cleaned) {
    if (!cleaned.recipientName) return 'กรุณากรอกชื่อ-นามสกุลผู้รับ';
    if (!/^[0-9]{9,10}$/.test(cleaned.phone)) return 'กรุณากรอกเบอร์โทรศัพท์ 9-10 หลักให้ถูกต้อง';
    return '';
}

function validateGeoHierarchy(cleaned) {
    if (!window.THAI_GEO_TREE) return '';
    const districts = getDistrictsForProvince(cleaned.province);
    if (!districts.includes(cleaned.district)) return 'กรุณาเลือกเขต / อำเภอให้ตรงกับจังหวัด';
    const subdistricts = getUniqueSubdistrictNames(cleaned.province, cleaned.district);
    if (!subdistricts.includes(cleaned.subdistrict)) return 'กรุณาเลือกแขวง / ตำบลให้ตรงกับอำเภอ';
    return '';
}

function validateLocationFields(cleaned) {
    if (!THAI_PROVINCES.includes(cleaned.province)) return 'กรุณาเลือกจังหวัดที่ถูกต้อง';
    if (!cleaned.district) return 'กรุณาเลือกเขต / อำเภอ';
    if (!cleaned.subdistrict) return 'กรุณาเลือกแขวง / ตำบล';
    if (!/^[0-9]{5}$/.test(cleaned.postalCode)) return 'กรุณาเลือกรหัสไปรษณีย์ 5 หลัก';
    if (cleaned.streetDetail.length < 3) return 'กรุณากรอกรายละเอียดที่อยู่ (บ้านเลขที่/ซอย/ถนน)';
    return validateGeoHierarchy(cleaned);
}

function validateThaiAddressInput(draft) {
    const cleaned = cleanAddressDraft(draft);
    const contactErr = validateContactFields(cleaned);
    if (contactErr) return { ok: false, message: contactErr };
    const locationErr = validateLocationFields(cleaned);
    if (locationErr) return { ok: false, message: locationErr };
    return { ok: true, cleaned };
}

function loadAllAddressBooks() {
    const book = safeJsonParse(localStorage.getItem('soulin_addresses'), {});
    return book && typeof book === 'object' && !Array.isArray(book) ? book : {};
}

function loadUserAddresses(ownerKey = getAddressOwnerKey()) {
    const book = loadAllAddressBooks();
    const entries = book[ownerKey];
    return Array.isArray(entries) ? entries : [];
}

function syncDefaultAddressToProfile(ownerKey, addressList) {
    if (!window.currentUser || window.currentUser.username !== ownerKey) return;
    const defaultEntry = addressList.find(entry => entry.isDefault) || addressList[0] || null;
    const formattedDefault = defaultEntry ? formatFullShippingText(defaultEntry) : '';
    window.currentUser.defaultAddress = formattedDefault;
    safeStorageSet('soulin_user', JSON.stringify(window.currentUser));

    const savedUsers = safeJsonParse(localStorage.getItem('soulin_registered_users'), []);
    const userIdx = savedUsers.findIndex(userRecord => userRecord.username === ownerKey);
    if (userIdx !== -1) {
        savedUsers[userIdx].defaultAddress = formattedDefault;
        safeStorageSet('soulin_registered_users', JSON.stringify(savedUsers));
    }
}

function saveUserAddresses(ownerKey, addressList) {
    const book = loadAllAddressBooks();
    book[ownerKey] = addressList;
    if (!safeStorageSet('soulin_addresses', JSON.stringify(book))) {
        return false;
    }
    syncDefaultAddressToProfile(ownerKey, addressList);
    return true;
}

function applyAddressUpsert(existingList, record, makeDefault) {
    const nextList = existingList.map(entry => ({
        ...entry,
        isDefault: makeDefault ? false : Boolean(entry.isDefault)
    }));
    const existingIdx = nextList.findIndex(entry => entry.id === record.id);
    if (existingIdx !== -1) {
        nextList[existingIdx] = record;
    } else {
        nextList.unshift(record);
    }
    if (!nextList.some(entry => entry.isDefault) && nextList.length > 0) {
        nextList[0].isDefault = true;
    }
    return nextList;
}

function upsertUserAddress(ownerKey, draft) {
    const validation = validateThaiAddressInput(draft);
    if (!validation.ok) return validation;

    const currentList = loadUserAddresses(ownerKey);
    const cleaned = validation.cleaned;
    const isFirstAddress = currentList.length === 0;
    const makeDefault = isFirstAddress || cleaned.isDefault;
    const recordId = cleaned.id || `addr-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`;
    const record = { ...cleaned, id: recordId, isDefault: makeDefault };
    const updatedList = applyAddressUpsert(currentList, record, makeDefault);

    if (!saveUserAddresses(ownerKey, updatedList)) {
        return { ok: false, message: 'ไม่สามารถบันทึกที่อยู่ได้' };
    }
    return { ok: true, address: record, addresses: updatedList };
}

function deleteUserAddress(ownerKey, addressId) {
    const filtered = loadUserAddresses(ownerKey).filter(entry => entry.id !== addressId);
    if (filtered.length > 0 && !filtered.some(entry => entry.isDefault)) {
        filtered[0].isDefault = true;
    }
    saveUserAddresses(ownerKey, filtered);
    return filtered;
}

function setDefaultUserAddress(ownerKey, addressId) {
    const updated = loadUserAddresses(ownerKey).map(entry => ({
        ...entry,
        isDefault: entry.id === addressId
    }));
    saveUserAddresses(ownerKey, updated);
    return updated;
}

function getDefaultOrFirstAddress(ownerKey = getAddressOwnerKey()) {
    const list = loadUserAddresses(ownerKey);
    return list.find(entry => entry.isDefault) || list[0] || null;
}

function getSelectedCheckoutAddress() {
    const list = loadUserAddresses(getAddressOwnerKey());
    if (window.selectedCheckoutAddressId) {
        const selected = list.find(entry => entry.id === window.selectedCheckoutAddressId);
        if (selected) return selected;
    }
    return getDefaultOrFirstAddress(getAddressOwnerKey());
}

function buildAddressLabelBadge(labelText) {
    const isWork = labelText === 'ที่ทำงาน';
    const cls = isWork
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    const icon = isWork ? 'fa-briefcase' : 'fa-house';
    return `<span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${cls}"><i class="fa-solid ${icon}"></i> ${escapeHtml(labelText || 'บ้าน')}</span>`;
}

function buildAddressSummaryHtml(addr) {
    const safeName = escapeHtml(addr.recipientName);
    const safePhone = escapeHtml(formatThaiPhone(addr.phone));
    const safeLine = escapeHtml(formatThaiAddressLine(addr));
    const defaultTag = addr.isDefault
        ? '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">ค่าเริ่มต้น</span>'
        : '';
    const noteLine = addr.deliveryNote
        ? `<p class="text-[11px] text-slate-400 mt-1"><i class="fa-regular fa-note-sticky mr-1"></i>หมายเหตุ: ${escapeHtml(addr.deliveryNote)}</p>`
        : '';
    return `
        <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-1.5">
                <span class="font-bold text-slate-800 text-xs sm:text-sm">${safeName}</span>
                <span class="text-xs text-slate-500">| ${safePhone}</span>
                ${buildAddressLabelBadge(addr.label)}
                ${defaultTag}
            </div>
            <p class="text-xs text-slate-600 leading-relaxed">${safeLine}</p>
            ${noteLine}
        </div>
    `;
}
