const AUDIT_LOG_MAX_LOCAL = 300;
window.auditLogs = safeJsonParse(localStorage.getItem('soulin_audit_logs'), []);

let currentAuditCategoryFilter = 'all';
let currentAuditSeverityFilter = 'all';

const AUDIT_CATEGORY_META = {
    order: { label: 'ออเดอร์และการเงิน', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    stock: { label: 'คลังสินค้า', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
    cms: { label: 'CMS & ตั้งค่า', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    auth: { label: 'ผู้ใช้งาน', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    system: { label: 'ระบบ', cls: 'bg-slate-100 text-slate-700 border-slate-200' }
};

const AUDIT_SEVERITY_META = {
    success: { label: 'สำเร็จ', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    warning: { label: 'แจ้งเตือน', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    error: { label: 'ผิดพลาด', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
    info: { label: 'บันทึกเหตุการณ์', cls: 'bg-sky-100 text-sky-800 border-sky-200' }
};

function getAuditCategoryBadge(categoryKey) {
    return AUDIT_CATEGORY_META[categoryKey] || AUDIT_CATEGORY_META.system;
}

function getAuditSeverityBadge(severityKey) {
    return AUDIT_SEVERITY_META[severityKey] || AUDIT_SEVERITY_META.info;
}

function resolveAuditActor() {
    if (window.currentUser && window.currentUser.username) {
        return {
            actor: String(window.currentUser.username),
            actorRole: String(window.currentUser.role || 'customer')
        };
    }
    return { actor: 'guest', actorRole: 'guest' };
}

function buildAuditLogRecord(entrySpec) {
    const spec = entrySpec || {};
    const actorIdentity = resolveAuditActor();
    const nowMs = Date.now();
    const suffix = Math.random().toString(36).slice(2, 8);
    return {
        logId: `LOG-${nowMs}-${suffix}`,
        timestamp: nowMs,
        actor: String(spec.actor || actorIdentity.actor),
        actorRole: String(spec.actorRole || actorIdentity.actorRole),
        category: String(spec.category || 'system'),
        action: String(spec.action || 'SYSTEM_EVENT'),
        targetId: String(spec.targetId || ''),
        summary: String(spec.summary || ''),
        severity: String(spec.severity || 'info'),
        metadata: spec.metadata && typeof spec.metadata === 'object' ? spec.metadata : {}
    };
}

function updateAuditTabBadge() {
    const badgeEl = document.getElementById('adm-badge-logs');
    if (!badgeEl) return;
    const logList = Array.isArray(window.auditLogs) ? window.auditLogs : [];
    const alertCount = logList.filter(entry => entry.severity === 'warning' || entry.severity === 'error').length;
    const badgeCount = alertCount > 0 ? alertCount : logList.length;
    badgeEl.textContent = String(badgeCount);
    badgeEl.classList.toggle('hidden', badgeCount === 0);
}

function recordAuditLog(entrySpec) {
    const logEntry = buildAuditLogRecord(entrySpec);
    if (!Array.isArray(window.auditLogs)) window.auditLogs = [];
    window.auditLogs.unshift(logEntry);
    if (window.auditLogs.length > AUDIT_LOG_MAX_LOCAL) {
        window.auditLogs = window.auditLogs.slice(0, AUDIT_LOG_MAX_LOCAL);
    }
    safeStorageSet('soulin_audit_logs', JSON.stringify(window.auditLogs));
    if (typeof window.syncAuditLogToCloud === 'function') {
        window.syncAuditLogToCloud(logEntry);
    }
    updateAuditTabBadge();
    renderAdminAuditLogs();
    return logEntry;
}

function formatAuditTimestamp(tsMs) {
    const parsedMs = Number(tsMs);
    if (!Number.isFinite(parsedMs) || parsedMs <= 0) return '-';
    return new Date(parsedMs).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function matchesAuditLogFilter(logEntry, queryText) {
    if (!logEntry) return false;
    if (currentAuditCategoryFilter !== 'all' && logEntry.category !== currentAuditCategoryFilter) {
        return false;
    }
    if (currentAuditSeverityFilter !== 'all' && logEntry.severity !== currentAuditSeverityFilter) {
        return false;
    }
    if (!queryText) return true;
    const combined = [logEntry.action, logEntry.actor, logEntry.targetId, logEntry.summary]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return combined.includes(queryText);
}

function buildAuditCategoryPillHtml(catKey, catLabel) {
    const isActive = currentAuditCategoryFilter === catKey;
    const activeCls = 'px-3 py-1.5 rounded-full text-xs font-semibold bg-soulin-primary text-white shadow-sm transition-all';
    const idleCls = 'px-3 py-1.5 rounded-full text-xs font-medium bg-white text-slate-600 border border-slate-200 hover:bg-soulin-mint transition-all';
    return `<button type="button" id="adm-log-cat-${catKey}" onclick="filterAdminAuditCategory('${catKey}')" class="${isActive ? activeCls : idleCls}">${catLabel}</button>`;
}

function buildAuditSeverityOptionsHtml() {
    const sevOptions = [
        ['all', 'ทุกระดับความสำคัญ'],
        ['info', 'บันทึกเหตุการณ์ (Info)'],
        ['success', 'สำเร็จ (Success)'],
        ['warning', 'แจ้งเตือน (Warning)'],
        ['error', 'ผิดพลาด (Error)']
    ];
    return sevOptions.map(([optKey, optLabel]) => {
        const selectedAttr = currentAuditSeverityFilter === optKey ? 'selected' : '';
        return `<option value="${optKey}" ${selectedAttr}>${optLabel}</option>`;
    }).join('');
}

function buildAuditMetadataPreview(metaObj) {
    if (!metaObj || typeof metaObj !== 'object' || Object.keys(metaObj).length === 0) {
        return '';
    }
    const serialized = JSON.stringify(metaObj);
    const trimmed = serialized.length > 90 ? `${serialized.slice(0, 87)}...` : serialized;
    return `<span class="block text-[10px] font-mono text-slate-400 mt-1 break-all">${escapeHtml(trimmed)}</span>`;
}

function buildAuditLogRowHtml(logEntry) {
    const catMeta = getAuditCategoryBadge(logEntry.category);
    const sevMeta = getAuditSeverityBadge(logEntry.severity);
    const targetBadge = logEntry.targetId
        ? `<span class="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">${escapeHtml(logEntry.targetId)}</span>`
        : '';
    return `
        <tr class="hover:bg-slate-50/70 transition-colors align-top">
            <td class="p-3.5 text-[11px] text-slate-500 whitespace-nowrap">${escapeHtml(formatAuditTimestamp(logEntry.timestamp))}</td>
            <td class="p-3.5 whitespace-nowrap">
                <span class="${sevMeta.cls} text-[10px] font-semibold px-2.5 py-0.5 rounded-full border inline-block">${escapeHtml(sevMeta.label)}</span>
                <span class="${catMeta.cls} text-[10px] font-medium px-2.5 py-0.5 rounded-full border inline-block ml-1">${escapeHtml(catMeta.label)}</span>
            </td>
            <td class="p-3.5 text-xs whitespace-nowrap">
                <span class="font-semibold text-soulin-dark">${escapeHtml(logEntry.actor)}</span>
                <span class="text-[10px] text-slate-400 block">${escapeHtml(logEntry.actorRole)}</span>
            </td>
            <td class="p-3.5 text-xs">
                <div class="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <span class="font-bold text-slate-800">${escapeHtml(logEntry.action)}</span>
                    ${targetBadge}
                </div>
                <p class="text-slate-600 leading-relaxed">${escapeHtml(logEntry.summary)}</p>
                ${buildAuditMetadataPreview(logEntry.metadata)}
            </td>
        </tr>
    `;
}

function buildAuditLogKpisHtml(allLogs) {
    const totalCount = allLogs.length;
    const alertCount = allLogs.filter(entry => entry.severity === 'warning' || entry.severity === 'error').length;
    const orderCount = allLogs.filter(entry => entry.category === 'order').length;
    return `
        <div id="adm-log-kpi-bar" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="bg-white p-4 rounded-2xl border border-emerald-100 smooth-shadow flex items-center justify-between">
                <div><span class="text-[11px] text-slate-500 font-semibold block">บันทึกเหตุการณ์ทั้งหมด</span><span id="adm-log-stat-total" class="text-2xl font-bold text-soulin-dark">${totalCount}</span></div>
                <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><i class="fa-solid fa-scroll"></i></div>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-emerald-100 smooth-shadow flex items-center justify-between">
                <div><span class="text-[11px] text-slate-500 font-semibold block">รายการแจ้งเตือน / แก้ไขสำคัญ</span><span id="adm-log-stat-alerts" class="text-2xl font-bold text-amber-600">${alertCount}</span></div>
                <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><i class="fa-solid fa-triangle-exclamation"></i></div>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-emerald-100 smooth-shadow flex items-center justify-between">
                <div><span class="text-[11px] text-slate-500 font-semibold block">ความเคลื่อนไหวออเดอร์ &amp; เงิน</span><span id="adm-log-stat-orders" class="text-2xl font-bold text-soulin-primary">${orderCount}</span></div>
                <div class="w-10 h-10 rounded-xl bg-soulin-mint text-soulin-primary flex items-center justify-center"><i class="fa-solid fa-receipt"></i></div>
            </div>
        </div>
    `;
}

const AUDIT_CATEGORY_PILLS = [
    ['all', 'ทั้งหมด'],
    ['order', 'ออเดอร์/เงิน'],
    ['stock', 'สต็อกสินค้า'],
    ['cms', 'CMS/ตั้งค่า'],
    ['auth', 'ผู้ใช้งาน/แอดมิน'],
    ['system', 'ระบบ']
];

function buildAuditShellHtml(allLogs) {
    const categoryTabs = AUDIT_CATEGORY_PILLS
        .map(([catKey, catLabel]) => buildAuditCategoryPillHtml(catKey, catLabel))
        .join('');
    return `
        ${buildAuditLogKpisHtml(allLogs)}
        <div class="bg-white p-4 rounded-2xl border border-emerald-100 smooth-shadow space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div id="adm-log-cat-pills" class="flex flex-wrap items-center gap-1.5">${categoryTabs}</div>
                <div class="flex flex-wrap items-center gap-2">
                    <span class="bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold px-3 py-2 rounded-xl inline-flex items-center gap-1.5"><i class="fa-solid fa-lock text-soulin-primary"></i> Append-Only</span>
                    <button type="button" onclick="refreshAuditLogsFromCloud()" class="bg-white hover:bg-emerald-50 text-soulin-primary border border-emerald-200 text-xs font-semibold px-3 py-2 rounded-xl transition-all inline-flex items-center gap-1.5"><i class="fa-solid fa-rotate"></i> รีเฟรช</button>
                    <button type="button" onclick="exportAuditLogsCsv()" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5"><i class="fa-solid fa-file-csv"></i> ส่งออก .CSV</button>
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-slate-100">
                <div class="sm:col-span-4"><select id="adm-log-severity-select" onchange="filterAdminAuditSeverity(this.value)" class="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white">${buildAuditSeverityOptionsHtml()}</select></div>
                <div class="sm:col-span-8 relative">
                    <i class="fa-solid fa-magnifying-glass text-slate-400 text-xs absolute left-3 top-1/2 -translate-y-1/2"></i>
                    <input type="text" id="adm-log-search" oninput="handleAdminAuditSearch()" placeholder="ค้นหา Action, ผู้ทำรายการ, เลขออเดอร์ หรือรายละเอียด..." class="w-full text-xs pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-soulin-primary/35">
                </div>
            </div>
        </div>
        <div class="bg-white rounded-3xl border border-emerald-100 overflow-x-auto smooth-shadow">
            <table class="w-full min-w-[760px] text-left">
                <thead class="bg-soulin-mint/80 text-soulin-dark text-xs font-semibold border-b border-emerald-100">
                    <tr><th class="p-3.5">วัน-เวลา</th><th class="p-3.5">ระดับ / หมวดหมู่</th><th class="p-3.5">ผู้ทำรายการ</th><th class="p-3.5">เหตุการณ์และรายละเอียด</th></tr>
                </thead>
                <tbody id="admin-audit-logs-tbody" class="divide-y divide-slate-100"></tbody>
            </table>
        </div>
    `;
}

function getFilteredAuditLogs() {
    const searchEl = document.getElementById('adm-log-search');
    const queryText = searchEl ? String(searchEl.value || '').trim().toLowerCase() : '';
    const allLogs = Array.isArray(window.auditLogs) ? window.auditLogs : [];
    return allLogs.filter(entry => matchesAuditLogFilter(entry, queryText));
}

function updateAuditKpiNumbers(allLogs) {
    const totalEl = document.getElementById('adm-log-stat-total');
    const alertsEl = document.getElementById('adm-log-stat-alerts');
    const ordersEl = document.getElementById('adm-log-stat-orders');
    if (totalEl) totalEl.textContent = String(allLogs.length);
    if (alertsEl) alertsEl.textContent = String(allLogs.filter(entry => entry.severity === 'warning' || entry.severity === 'error').length);
    if (ordersEl) ordersEl.textContent = String(allLogs.filter(entry => entry.category === 'order').length);
}

function renderAuditRowsOnly() {
    const tbody = document.getElementById('admin-audit-logs-tbody');
    if (!tbody) return;
    const filteredLogs = getFilteredAuditLogs();
    updateAuditKpiNumbers(Array.isArray(window.auditLogs) ? window.auditLogs : []);
    if (filteredLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-xs text-slate-400">ไม่พบบันทึกเหตุการณ์ที่ตรงกับเงื่อนไขนี้</td></tr>';
        return;
    }
    tbody.innerHTML = filteredLogs.map(buildAuditLogRowHtml).join('');
}

function renderAdminAuditLogs() {
    updateAuditTabBadge();
    const mountEl = document.getElementById('adm-content-logs');
    if (!mountEl) return;
    const allLogs = Array.isArray(window.auditLogs) ? window.auditLogs : [];
    if (!mountEl.innerHTML.includes('admin-audit-logs-tbody')) {
        mountEl.innerHTML = buildAuditShellHtml(allLogs);
    }
    renderAuditRowsOnly();
}

function filterAdminAuditCategory(catKey) {
    currentAuditCategoryFilter = catKey || 'all';
    const pillsEl = document.getElementById('adm-log-cat-pills');
    if (pillsEl) {
        pillsEl.innerHTML = AUDIT_CATEGORY_PILLS
            .map(([keyName, keyLabel]) => buildAuditCategoryPillHtml(keyName, keyLabel))
            .join('');
    }
    renderAuditRowsOnly();
}

function filterAdminAuditSeverity(sevKey) {
    currentAuditSeverityFilter = sevKey || 'all';
    renderAuditRowsOnly();
}

function handleAdminAuditSearch() {
    renderAuditRowsOnly();
}

function escapeCsvCell(rawCell) {
    const textCell = String(rawCell === null || rawCell === undefined ? '' : rawCell);
    return `"${textCell.replace(/"/g, '""')}"`;
}

function buildAuditLogsCsvContent(logList) {
    const headers = ['log_id', 'timestamp_ms', 'date_th', 'severity', 'category', 'actor', 'actor_role', 'action', 'target_id', 'summary', 'metadata'];
    const lines = [headers.join(',')];
    (logList || []).forEach(entry => {
        const cols = [
            entry.logId,
            entry.timestamp,
            formatAuditTimestamp(entry.timestamp),
            entry.severity,
            entry.category,
            entry.actor,
            entry.actorRole,
            entry.action,
            entry.targetId,
            entry.summary,
            JSON.stringify(entry.metadata || {})
        ].map(escapeCsvCell);
        lines.push(cols.join(','));
    });
    return `\uFEFF${lines.join('\n')}`;
}

function exportAuditLogsCsv() {
    const filteredLogs = getFilteredAuditLogs();
    if (filteredLogs.length === 0) {
        showToast('ไม่มีข้อมูล Log สำหรับส่งออก', 'info');
        return;
    }
    const csvText = buildAuditLogsCsvContent(filteredLogs);
    const csvBlob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const linkEl = document.createElement('a');
    linkEl.href = URL.createObjectURL(csvBlob);
    linkEl.download = `soulin-audit-logs-${Date.now()}.csv`;
    document.body.appendChild(linkEl);
    linkEl.click();
    document.body.removeChild(linkEl);
    showToast(`ส่งออก Log ${filteredLogs.length} รายการเป็น .CSV แล้ว`, 'success');
}

async function refreshAuditLogsFromCloud() {
    if (typeof window.refreshSupabaseAuditLogs !== 'function') {
        renderAdminAuditLogs();
        showToast('รีเฟรช Log จากเครื่องเรียบร้อยแล้ว (Local Mode)', 'info');
        return false;
    }
    const synced = await window.refreshSupabaseAuditLogs();
    showToast(synced ? 'ซิงค์ประวัติ Log ล่าสุดจาก Supabase แล้ว' : 'ไม่สามารถดึง Log จาก Supabase ได้', synced ? 'success' : 'error');
    return synced;
}
