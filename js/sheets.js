function sanitizeCsvCell(rawCell) {
    const text = rawCell === null || rawCell === undefined ? '' : String(rawCell);
    const formulaPrefix = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${formulaPrefix.replace(/"/g, '""')}"`;
}

function openGoogleSheetModal() {
    document.getElementById('gsheet-webhook-url').value = getSavedWebhookUrl();
    document.getElementById('gsheet-modal').classList.remove('hidden');
}

function closeGoogleSheetModal() {
    document.getElementById('gsheet-modal').classList.add('hidden');
}

function saveGoogleSheetWebhook() {
    if (!window.currentUser || window.currentUser.role !== 'admin') {
        showToast('เข้าถึงเฉพาะแอดมินเท่านั้น', 'error');
        return;
    }
    const webhookUrl = document.getElementById('gsheet-webhook-url').value.trim();
    if (webhookUrl && !webhookUrl.startsWith('https://')) {
        showToast('กรุณากรอก URL ที่ขึ้นต้นด้วย https:// เท่านั้น', 'error');
        return;
    }
    const previousWebhook = getSavedWebhookUrl();
    safeStorageSet('soulin_gsheet_webhook', webhookUrl);
    window.cmsConfig.gsheetWebhook = webhookUrl;
    safeStorageSet('soulin_cms', JSON.stringify(window.cmsConfig));
    if (typeof window.syncAdminWebhookToCloud === 'function') {
        window.syncAdminWebhookToCloud(webhookUrl);
    }
    if (typeof recordAuditLog === 'function') {
        recordAuditLog({
            category: 'cms',
            action: 'GOOGLE_SHEET_WEBHOOK_UPDATED',
            targetId: 'gsheetWebhook',
            summary: webhookUrl ? 'อัปเดตลิงก์เชื่อมต่อ Google Sheet Webhook' : 'ยกเลิกการเชื่อมต่อ Google Sheet Webhook',
            severity: 'warning',
            metadata: { hadWebhookBefore: Boolean(previousWebhook), hasWebhookAfter: Boolean(webhookUrl) }
        });
    }
    closeGoogleSheetModal();
    showToast(webhookUrl ? 'บันทึกลิงก์เชื่อมต่อ Google Sheet เรียบร้อยแล้ว!' : 'ยกเลิกการเชื่อมต่อ Webhook แล้ว', 'success');
}

async function sendOrderToGoogleSheetWebhook(orderRecord) {
    const webhookUrl = getSavedWebhookUrl();
    if (!webhookUrl) return false;
    try {
        const webhookBody = {
            orderId: orderRecord.orderId,
            date: orderRecord.date,
            customerName: orderRecord.customerName,
            username: orderRecord.user,
            items: (orderRecord.items || []).map(line => `${line.name} x${line.qty}`).join(', '),
            total: orderRecord.total,
            address: orderRecord.address,
            status: orderRecord.status
        };
        await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(webhookBody)
        });
        return true;
    } catch (webhookErr) {
        console.error('Google Sheet Webhook error:', webhookErr);
        return false;
    }
}

function exportOrdersToGoogleSheet() {
    if (!window.orders || window.orders.length === 0) {
        showToast('ยังไม่มีข้อมูลคำสั่งซื้อสำหรับส่งออก', 'error');
        return;
    }

    const headers = ['หมายเลขคำสั่งซื้อ', 'วันที่สั่งซื้อ', 'ชื่อลูกค้า', 'บัญชีผู้ใช้', 'รายการสินค้า', 'ยอดรวมสุทธิ (บาท)', 'ที่อยู่จัดส่ง', 'สถานะ'];
    const rows = window.orders.map(orderRecord => {
        const itemsText = (orderRecord.items || []).map(line => `${line.name} (${line.qty})`).join(' | ');
        return [
            sanitizeCsvCell(orderRecord.orderId),
            sanitizeCsvCell(orderRecord.date),
            sanitizeCsvCell(orderRecord.customerName),
            sanitizeCsvCell(orderRecord.user),
            sanitizeCsvCell(itemsText),
            Number(orderRecord.total) || 0,
            sanitizeCsvCell(orderRecord.address),
            sanitizeCsvCell(orderRecord.status)
        ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);

    link.setAttribute('href', downloadUrl);
    link.setAttribute('download', `SOULIN_Orders_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    showToast('ส่งออกไฟล์ข้อมูลเรียบร้อย! สามารถนำเข้า (Import) ใน Google Sheet ได้ทันที', 'success');
}
