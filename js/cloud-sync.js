const CLOUD_APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'soulin-herbal-app';

function textOr(primaryText, backupText) {
    return primaryText ? String(primaryText) : (backupText || '');
}

function numberOr(primaryNumber, backupNumber) {
    if (primaryNumber !== undefined && primaryNumber !== null) {
        return Number(primaryNumber);
    }
    return Number(backupNumber || 0);
}

function persistCloudCache(storageKey, serializedValue) {
    try {
        localStorage.setItem(storageKey, serializedValue);
    } catch (storageErr) {
        console.error(`Cloud cache save error (${storageKey}):`, storageErr);
    }
}

function setCloudSyncBadge(labelHtml) {
    const statusBadge = document.getElementById('cloud-sync-status');
    if (statusBadge) {
        statusBadge.innerHTML = labelHtml;
    }
}

function invokeGlobalUiHooks(hookNames) {
    hookNames.forEach(hookName => {
        if (typeof window[hookName] === 'function') {
            window[hookName]();
        }
    });
}

function refreshSyncedOrdersUi() {
    invokeGlobalUiHooks([
        'renderOrders',
        'renderAdminOrdersList',
        'updateAdminStats',
        'renderAdminRecentOrdersWidget',
        'initAnalyticsChart',
        'renderMemberHeaderAndStats',
        'renderMemberOrders'
    ]);
}

function refreshSyncedProductsUi() {
    if (typeof window.renderProducts === 'function') {
        window.renderProducts(window.currentProductFilter);
    }
    invokeGlobalUiHooks([
        'renderAdminProductsTable',
        'renderCart',
        'updateAdminStats',
        'renderAdminLowStockWidget'
    ]);
}

function refreshSyncedCmsUi() {
    invokeGlobalUiHooks(['renderCMS']);
}

function getSupabaseSettings() {
    const baseCfg = window.SOULIN_SUPABASE_CONFIG || {};
    const storedUrl = localStorage.getItem('soulin_supabase_url') || '';
    const storedKey = localStorage.getItem('soulin_supabase_key') || '';
    return {
        url: String(storedUrl || baseCfg.url || '').trim(),
        publishableKey: String(storedKey || baseCfg.publishableKey || '').trim(),
        enableRealtime: baseCfg.enableRealtime !== false
    };
}

function loadSupabaseSdkScript() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        return Promise.resolve(true);
    }
    if (window.soulinSupabaseSdkPromise) {
        return window.soulinSupabaseSdkPromise;
    }
    window.soulinSupabaseSdkPromise = new Promise((resolve, reject) => {
        const scriptEl = document.createElement('script');
        scriptEl.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        scriptEl.async = true;
        scriptEl.defer = true;
        scriptEl.onload = () => resolve(true);
        scriptEl.onerror = () => {
            window.soulinSupabaseSdkPromise = null;
            reject(new Error('ไม่สามารถโหลด Supabase JS SDK ได้'));
        };
        document.head.appendChild(scriptEl);
    });
    return window.soulinSupabaseSdkPromise;
}

function findBaseProduct(prodId) {
    if (typeof DEFAULT_PRODUCTS === 'undefined') return {};
    return DEFAULT_PRODUCTS.find(entry => entry.id === prodId) || {};
}

function mapProductToSupabaseRow(productEntry, sortIndex) {
    const productType = productEntry.type === 'stick' ? 'stick' : 'jar';
    return {
        id: productEntry.id,
        name: productEntry.name,
        scent: textOr(productEntry.scent),
        description: textOr(productEntry.desc),
        type: productType,
        price: Math.max(1, numberOr(productEntry.price, 1)),
        stock: Math.max(0, numberOr(productEntry.stock, 0)),
        icon_class: textOr(productEntry.iconClass, 'fa-jar'),
        badge_text: textOr(productEntry.badgeText),
        img: textOr(productEntry.img),
        sort_order: sortIndex,
        updated_at: new Date().toISOString()
    };
}

function mapSupabaseRowToProduct(rowRecord) {
    const base = findBaseProduct(rowRecord.id);
    const productType = rowRecord.type === 'stick' ? 'stick' : 'jar';
    return {
        ...base,
        id: rowRecord.id,
        type: productType,
        name: textOr(rowRecord.name, base.name),
        scent: textOr(rowRecord.scent, base.scent),
        desc: textOr(rowRecord.description, base.desc),
        price: numberOr(rowRecord.price, numberOr(base.price, 89)),
        stock: numberOr(rowRecord.stock, numberOr(base.stock, 0)),
        iconClass: textOr(rowRecord.icon_class, textOr(base.iconClass, 'fa-jar')),
        badgeText: textOr(rowRecord.badge_text, base.badgeText),
        img: textOr(rowRecord.img, base.img)
    };
}

function mapOrderToSupabaseRow(orderRecord) {
    const nowMs = numberOr(orderRecord.timestamp, Date.now());
    return {
        order_id: orderRecord.orderId,
        timestamp_ms: nowMs,
        username: textOr(orderRecord.user),
        customer_name: textOr(orderRecord.customerName),
        items: Array.isArray(orderRecord.items) ? orderRecord.items : [],
        subtotal: numberOr(orderRecord.subtotal, 0),
        shipping: numberOr(orderRecord.shipping, 0),
        discount: numberOr(orderRecord.discount, 0),
        total: numberOr(orderRecord.total, 0),
        address: textOr(orderRecord.address),
        shipping_details: orderRecord.shippingDetails || null,
        order_date_text: textOr(orderRecord.date),
        status: textOr(orderRecord.status),
        payment_method: textOr(orderRecord.paymentMethod, 'promptpay'),
        payment_status: textOr(orderRecord.paymentStatus, 'pending'),
        payment_slip_url: textOr(orderRecord.paymentSlipUrl),
        payment_reference: textOr(orderRecord.paymentReference),
        payment_gateway: textOr(orderRecord.paymentGateway, 'manual'),
        paid_at: orderRecord.paidAt || null,
        updated_at: new Date().toISOString()
    };
}

function mapSupabaseRowToOrder(rowRecord) {
    return {
        orderId: rowRecord.order_id,
        timestamp: numberOr(rowRecord.timestamp_ms, 0),
        user: textOr(rowRecord.username),
        customerName: textOr(rowRecord.customer_name),
        items: Array.isArray(rowRecord.items) ? rowRecord.items : [],
        subtotal: numberOr(rowRecord.subtotal, 0),
        shipping: numberOr(rowRecord.shipping, 0),
        discount: numberOr(rowRecord.discount, 0),
        total: numberOr(rowRecord.total, 0),
        address: textOr(rowRecord.address),
        shippingDetails: rowRecord.shipping_details || null,
        date: textOr(rowRecord.order_date_text),
        status: textOr(rowRecord.status),
        paymentMethod: textOr(rowRecord.payment_method, 'promptpay'),
        paymentStatus: textOr(rowRecord.payment_status, 'pending'),
        paymentSlipUrl: textOr(rowRecord.payment_slip_url),
        paymentReference: textOr(rowRecord.payment_reference),
        paymentGateway: textOr(rowRecord.payment_gateway, 'manual'),
        paidAt: rowRecord.paid_at || null
    };
}

function mergePaymentConfigRecord(rawConfig) {
    const baseCfg = typeof DEFAULT_PAYMENT_CONFIG !== 'undefined' ? DEFAULT_PAYMENT_CONFIG : {};
    if (!rawConfig || typeof rawConfig !== 'object') {
        return { ...baseCfg };
    }
    return { ...baseCfg, ...rawConfig };
}

function mapCmsToSupabaseRow(cmsSettings) {
    const fallbackCms = typeof DEFAULT_CMS_CONFIG !== 'undefined' ? DEFAULT_CMS_CONFIG : {};
    return {
        id: 'main',
        title: textOr(cmsSettings.title, fallbackCms.title),
        tag: textOr(cmsSettings.tag, fallbackCms.tag),
        subtitle: textOr(cmsSettings.subtitle, fallbackCms.subtitle),
        img: textOr(cmsSettings.img, fallbackCms.img),
        gsheet_webhook: textOr(cmsSettings.gsheetWebhook),
        payment_config: mergePaymentConfigRecord(cmsSettings.paymentConfig),
        updated_at: new Date().toISOString()
    };
}

function mapSupabaseRowToCms(rowRecord) {
    const fallbackCms = typeof DEFAULT_CMS_CONFIG !== 'undefined' ? DEFAULT_CMS_CONFIG : {};
    return {
        title: textOr(rowRecord.title, fallbackCms.title),
        tag: textOr(rowRecord.tag, fallbackCms.tag),
        subtitle: textOr(rowRecord.subtitle, fallbackCms.subtitle),
        img: textOr(rowRecord.img, fallbackCms.img),
        gsheetWebhook: textOr(rowRecord.gsheet_webhook),
        paymentConfig: mergePaymentConfigRecord(rowRecord.payment_config)
    };
}

function mapAuditLogToSupabaseRow(logEntry) {
    return {
        log_id: textOr(logEntry.logId),
        timestamp_ms: numberOr(logEntry.timestamp, Date.now()),
        actor: textOr(logEntry.actor, 'guest'),
        actor_role: textOr(logEntry.actorRole, 'guest'),
        category: textOr(logEntry.category, 'system'),
        action: textOr(logEntry.action, 'SYSTEM_EVENT'),
        target_id: textOr(logEntry.targetId),
        summary: textOr(logEntry.summary),
        severity: textOr(logEntry.severity, 'info'),
        metadata: logEntry.metadata && typeof logEntry.metadata === 'object' ? logEntry.metadata : {}
    };
}

function mapSupabaseRowToAuditLog(rowRecord) {
    return {
        logId: textOr(rowRecord.log_id),
        timestamp: numberOr(rowRecord.timestamp_ms, 0),
        actor: textOr(rowRecord.actor, 'guest'),
        actorRole: textOr(rowRecord.actor_role, 'guest'),
        category: textOr(rowRecord.category, 'system'),
        action: textOr(rowRecord.action, 'SYSTEM_EVENT'),
        targetId: textOr(rowRecord.target_id),
        summary: textOr(rowRecord.summary),
        severity: textOr(rowRecord.severity, 'info'),
        metadata: rowRecord.metadata && typeof rowRecord.metadata === 'object' ? rowRecord.metadata : {}
    };
}

async function hydrateSupabaseProducts(sbClient) {
    const { data: fetchedRows, error: queryErr } = await sbClient
        .from('soulin_products')
        .select('*')
        .order('sort_order', { ascending: true });
    if (queryErr) {
        console.error('Supabase products fetch failed:', queryErr);
        return false;
    }
    if (!Array.isArray(fetchedRows) || fetchedRows.length === 0) return false;
    window.products = fetchedRows.map(mapSupabaseRowToProduct);
    persistCloudCache('soulin_products', JSON.stringify(window.products));
    refreshSyncedProductsUi();
    return true;
}

function resolveSupabaseClient(explicitClient) {
    if (explicitClient) return explicitClient;
    return typeof window !== 'undefined' ? window.soulinSupabaseClient || null : null;
}

function isSupabaseAuthReady(activeClient) {
    return Boolean(
        activeClient
        && activeClient.auth
        && typeof activeClient.auth.signInWithPassword === 'function'
    );
}

async function fetchCurrentSupabaseSessionUser(activeClient) {
    if (!activeClient || !activeClient.auth || typeof activeClient.auth.getSession !== 'function') {
        return null;
    }
    try {
        const { data: sessionBox, error: sessionErr } = await activeClient.auth.getSession();
        if (sessionErr || !sessionBox || !sessionBox.session) return null;
        return sessionBox.session.user || null;
    } catch (sessReadErr) {
        console.error('Supabase session read failed:', sessReadErr);
        return null;
    }
}

async function checkSupabaseAdminSession(explicitClient) {
    const activeClient = resolveSupabaseClient(explicitClient);
    const authUser = await fetchCurrentSupabaseSessionUser(activeClient);
    if (!authUser || typeof activeClient.rpc !== 'function') return false;
    try {
        const { data: adminFlag, error: rpcErr } = await activeClient.rpc('is_soulin_admin');
        return Boolean(!rpcErr && adminFlag === true);
    } catch (adminRpcErr) {
        console.error('Supabase admin check failed:', adminRpcErr);
        return false;
    }
}

async function performSupabaseSignOut(explicitClient) {
    const activeClient = resolveSupabaseClient(explicitClient);
    if (!activeClient || !activeClient.auth || typeof activeClient.auth.signOut !== 'function') {
        return;
    }
    try {
        await activeClient.auth.signOut();
    } catch (signOutErr) {
        console.error('Supabase sign-out failed:', signOutErr);
    }
}

async function signInAdminWithSupabase(adminEmail, adminPassword) {
    const cleanEmail = String(adminEmail || '').trim().toLowerCase();
    const cleanPass = String(adminPassword || '').trim();
    if (!cleanEmail || !cleanPass) {
        return { ok: false, message: 'กรุณากรอกอีเมลแอดมินและรหัสผ่าน' };
    }
    const activeClient = resolveSupabaseClient();
    if (!isSupabaseAuthReady(activeClient)) {
        return { ok: false, message: 'ระบบยืนยันตัวตน Supabase ยังไม่พร้อมใช้งาน' };
    }
    const { data: signInBox, error: signInErr } = await activeClient.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPass
    });
    if (signInErr || !signInBox || !signInBox.user) {
        if (signInErr) console.error('Supabase admin sign-in error:', signInErr);
        return { ok: false, message: 'อีเมลแอดมินหรือรหัสผ่านไม่ถูกต้อง' };
    }
    const adminAllowed = await checkSupabaseAdminSession(activeClient);
    if (!adminAllowed) {
        await performSupabaseSignOut(activeClient);
        return { ok: false, message: 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ SOULIN' };
    }
    const verifiedEmail = signInBox.user.email || cleanEmail;
    return {
        ok: true,
        user: {
            username: verifiedEmail,
            email: verifiedEmail,
            role: 'admin',
            name: 'ผู้ดูแลระบบ (Admin)',
            authProvider: 'supabase'
        }
    };
}

function enforceValidAdminUiSession(isAdminSession) {
    if (isAdminSession || !window.currentUser || window.currentUser.role !== 'admin') {
        return;
    }
    window.currentUser = null;
    localStorage.removeItem('soulin_user');
    invokeGlobalUiHooks(['renderAuthUI']);
    const onAdminTab = typeof getInitialTabFromQuery === 'function' && getInitialTabFromQuery() === 'admin';
    if (onAdminTab && typeof window !== 'undefined' && window.location) {
        window.location.href = './admin-login.html';
    }
}

function mapOrderToRpcParams(orderRecord) {
    const rawItems = Array.isArray(orderRecord.items) ? orderRecord.items : [];
    const rpcItems = rawItems.map(entry => ({ id: entry.id, qty: Number(entry.qty) || 1 }));
    return {
        p_order_id: orderRecord.orderId,
        p_timestamp_ms: Number(orderRecord.timestamp) || Date.now(),
        p_username: textOr(orderRecord.user, 'guest'),
        p_customer_name: textOr(orderRecord.customerName, 'ลูกค้า'),
        p_items: rpcItems,
        p_address: textOr(orderRecord.address, '-'),
        p_shipping_details: orderRecord.shippingDetails || null,
        p_order_date_text: textOr(orderRecord.date),
        p_payment_method: textOr(orderRecord.paymentMethod, 'promptpay'),
        p_payment_slip_url: textOr(orderRecord.paymentSlipUrl),
        p_payment_reference: textOr(orderRecord.paymentReference),
        p_payment_gateway: textOr(orderRecord.paymentGateway, 'manual')
    };
}

async function hydrateSupabaseOrders(sbClient) {
    if (!(await checkSupabaseAdminSession(sbClient))) return false;
    const { data: fetchedRows, error: queryErr } = await sbClient
        .from('soulin_orders')
        .select('*')
        .order('timestamp_ms', { ascending: false });
    if (queryErr) {
        console.error('Supabase orders fetch failed:', queryErr);
        return false;
    }
    if (!Array.isArray(fetchedRows)) return false;
    window.orders = fetchedRows.map(mapSupabaseRowToOrder);
    persistCloudCache('soulin_orders', JSON.stringify(window.orders));
    refreshSyncedOrdersUi();
    return true;
}

async function hydrateSupabaseCms(sbClient) {
    const { data: fetchedRows, error: queryErr } = await sbClient
        .from('soulin_cms')
        .select('*')
        .eq('id', 'main');
    if (queryErr) {
        console.error('Supabase CMS fetch failed:', queryErr);
        return false;
    }
    if (!Array.isArray(fetchedRows) || fetchedRows.length === 0) return false;
    window.cmsConfig = mapSupabaseRowToCms(fetchedRows[0]);
    persistCloudCache('soulin_cms', JSON.stringify(window.cmsConfig));
    if (window.cmsConfig.gsheetWebhook) {
        persistCloudCache('soulin_gsheet_webhook', window.cmsConfig.gsheetWebhook);
    }
    refreshSyncedCmsUi();
    return true;
}

async function hydrateSupabaseAuditLogs(sbClient) {
    if (!(await checkSupabaseAdminSession(sbClient))) return false;
    const { data: fetchedRows, error: queryErr } = await sbClient
        .from('soulin_audit_logs')
        .select('*')
        .order('timestamp_ms', { ascending: false });
    if (queryErr) {
        console.error('Supabase audit logs fetch failed:', queryErr);
        return false;
    }
    if (!Array.isArray(fetchedRows)) return false;
    window.auditLogs = fetchedRows.slice(0, 200).map(mapSupabaseRowToAuditLog);
    persistCloudCache('soulin_audit_logs', JSON.stringify(window.auditLogs));
    invokeGlobalUiHooks(['renderAdminAuditLogs']);
    return true;
}

async function syncOrderViaSupabase(sbClient, orderRecord) {
    if (await checkSupabaseAdminSession(sbClient)) {
        const { error: syncErr } = await sbClient
            .from('soulin_orders')
            .upsert(mapOrderToSupabaseRow(orderRecord), { onConflict: 'order_id' });
        if (syncErr) console.error('Supabase order upsert failed:', syncErr);
        return;
    }
    if (typeof sbClient.rpc !== 'function') return;
    const { error: rpcErr } = await sbClient.rpc('place_soulin_order', mapOrderToRpcParams(orderRecord));
    if (rpcErr) {
        console.error('Supabase order RPC failed:', rpcErr);
        return;
    }
    await hydrateSupabaseProducts(sbClient);
}

async function syncProductsViaSupabase(sbClient, productsList) {
    if (!(await checkSupabaseAdminSession(sbClient))) return;
    const rowsToSave = (productsList || []).map((entry, idx) => mapProductToSupabaseRow(entry, idx + 1));
    const { error: syncErr } = await sbClient
        .from('soulin_products')
        .upsert(rowsToSave, { onConflict: 'id' });
    if (syncErr) console.error('Supabase products upsert failed:', syncErr);
}

async function syncCmsViaSupabase(sbClient, cmsSettings) {
    if (!(await checkSupabaseAdminSession(sbClient))) return;
    const { error: syncErr } = await sbClient
        .from('soulin_cms')
        .upsert(mapCmsToSupabaseRow(cmsSettings), { onConflict: 'id' });
    if (syncErr) console.error('Supabase CMS upsert failed:', syncErr);
}

async function syncAuditLogViaSupabase(sbClient, logEntry) {
    const { error: syncErr } = await sbClient
        .from('soulin_audit_logs')
        .insert(mapAuditLogToSupabaseRow(logEntry));
    if (syncErr) console.error('Supabase audit log insert failed:', syncErr);
}

function registerSupabaseSaveHelpers(sbClient) {
    window.hasValidSupabaseAdminSession = () => checkSupabaseAdminSession(sbClient);
    window.signInAdminWithSupabase = signInAdminWithSupabase;
    window.signOutSupabaseAuth = () => performSupabaseSignOut(sbClient);
    window.syncOrderToCloud = (orderRecord) => syncOrderViaSupabase(sbClient, orderRecord);
    window.syncProductsToCloud = (productsList) => syncProductsViaSupabase(sbClient, productsList);
    window.syncCMSToCloud = (cmsSettings) => syncCmsViaSupabase(sbClient, cmsSettings);
    window.syncAuditLogToCloud = (logEntry) => syncAuditLogViaSupabase(sbClient, logEntry);
    window.refreshSupabaseAuditLogs = () => hydrateSupabaseAuditLogs(sbClient);
}

function subscribeSupabaseRealtime(sbClient, isAdminSession) {
    if (typeof sbClient.channel !== 'function') return null;
    const channelBuilder = sbClient
        .channel('soulin-live-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'soulin_products' }, () => hydrateSupabaseProducts(sbClient))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'soulin_cms' }, () => hydrateSupabaseCms(sbClient));
    if (isAdminSession) {
        channelBuilder
            .on('postgres_changes', { event: '*', schema: 'public', table: 'soulin_orders' }, () => hydrateSupabaseOrders(sbClient))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'soulin_audit_logs' }, () => hydrateSupabaseAuditLogs(sbClient));
    }
    return channelBuilder.subscribe();
}

async function initSupabaseCloud(sbSettings) {
    try {
        await loadSupabaseSdkScript();
        const sbClient = window.supabase.createClient(sbSettings.url, sbSettings.publishableKey);
        window.soulinSupabaseClient = sbClient;
        registerSupabaseSaveHelpers(sbClient);
        const isAdminSession = await checkSupabaseAdminSession(sbClient);
        enforceValidAdminUiSession(isAdminSession);
        const hydrateTasks = [hydrateSupabaseProducts(sbClient), hydrateSupabaseCms(sbClient)];
        if (isAdminSession) {
            hydrateTasks.push(hydrateSupabaseOrders(sbClient), hydrateSupabaseAuditLogs(sbClient));
        }
        await Promise.all(hydrateTasks);
        if (sbSettings.enableRealtime) {
            subscribeSupabaseRealtime(sbClient, isAdminSession);
        }
        setCloudSyncBadge('<i class="fa-solid fa-circle text-emerald-400 text-[8px] animate-pulse"></i> Supabase Real-time Sync');
        return true;
    } catch (supabaseErr) {
        console.error('Supabase initialization error:', supabaseErr);
        setCloudSyncBadge('<i class="fa-solid fa-circle text-rose-400 text-[8px]"></i> Supabase Error (Local Fallback)');
        return false;
    }
}

async function authenticateCloudUser(authInstance, authSdk) {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        const cred = await authSdk.signInWithCustomToken(authInstance, __initial_auth_token);
        return cred.user;
    }
    const cred = await authSdk.signInAnonymously(authInstance);
    return cred.user;
}

function listenOrdersCloud(dbInstance, firestoreSdk) {
    let hasSyncedOrdersOnce = false;
    const ordersCol = firestoreSdk.collection(dbInstance, 'artifacts', CLOUD_APP_ID, 'public', 'data', 'orders');
    firestoreSdk.onSnapshot(ordersCol, (snapshot) => {
        if (snapshot.empty && !hasSyncedOrdersOnce) return;
        hasSyncedOrdersOnce = true;
        const cloudOrders = [];
        snapshot.forEach(orderDoc => cloudOrders.push(orderDoc.data()));
        cloudOrders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        window.orders = cloudOrders;
        persistCloudCache('soulin_orders', JSON.stringify(cloudOrders));
        refreshSyncedOrdersUi();
    }, (syncErr) => console.error('Orders sync error:', syncErr));
}

function listenProductsCloud(dbInstance, firestoreSdk) {
    const productsCol = firestoreSdk.collection(dbInstance, 'artifacts', CLOUD_APP_ID, 'public', 'data', 'products');
    firestoreSdk.onSnapshot(productsCol, (snapshot) => {
        if (snapshot.empty) return;
        const cloudProducts = [];
        snapshot.forEach(productDoc => cloudProducts.push(productDoc.data()));
        const orderMap = ['jar-1', 'jar-2', 'jar-3', 'jar-4', 'stick-1', 'stick-2', 'stick-3', 'stick-4'];
        cloudProducts.sort((a, b) => orderMap.indexOf(a.id) - orderMap.indexOf(b.id));
        window.products = cloudProducts;
        persistCloudCache('soulin_products', JSON.stringify(cloudProducts));
        refreshSyncedProductsUi();
    }, (syncErr) => console.error('Products sync error:', syncErr));
}

function listenCmsCloud(dbInstance, firestoreSdk) {
    const cmsDocRef = firestoreSdk.doc(dbInstance, 'artifacts', CLOUD_APP_ID, 'public', 'data', 'settings', 'cms');
    firestoreSdk.onSnapshot(cmsDocRef, (docSnap) => {
        if (!docSnap.exists()) return;
        window.cmsConfig = docSnap.data();
        persistCloudCache('soulin_cms', JSON.stringify(window.cmsConfig));
        if (window.cmsConfig && window.cmsConfig.gsheetWebhook) {
            persistCloudCache('soulin_gsheet_webhook', window.cmsConfig.gsheetWebhook);
        }
        refreshSyncedCmsUi();
    }, (syncErr) => console.error('CMS sync error:', syncErr));
}

function registerCloudSaveHelpers(dbInstance, cloudUser, firestoreSdk) {
    window.syncOrderToCloud = async (orderRecord) => {
        if (!cloudUser || !dbInstance) return;
        try {
            const orderRef = firestoreSdk.doc(dbInstance, 'artifacts', CLOUD_APP_ID, 'public', 'data', 'orders', orderRecord.orderId);
            await firestoreSdk.setDoc(orderRef, orderRecord);
        } catch (syncErr) {
            console.error('Order cloud sync failed:', syncErr);
        }
    };

    window.syncProductsToCloud = async (productsList) => {
        if (!cloudUser || !dbInstance) return;
        try {
            for (const productEntry of productsList) {
                const productRef = firestoreSdk.doc(dbInstance, 'artifacts', CLOUD_APP_ID, 'public', 'data', 'products', productEntry.id);
                await firestoreSdk.setDoc(productRef, productEntry);
            }
        } catch (syncErr) {
            console.error('Products cloud sync failed:', syncErr);
        }
    };

    window.syncCMSToCloud = async (cmsSettings) => {
        if (!cloudUser || !dbInstance) return;
        try {
            const cmsRef = firestoreSdk.doc(dbInstance, 'artifacts', CLOUD_APP_ID, 'public', 'data', 'settings', 'cms');
            await firestoreSdk.setDoc(cmsRef, cmsSettings);
        } catch (syncErr) {
            console.error('CMS cloud sync failed:', syncErr);
        }
    };
}

async function initFirebaseCloud() {
    try {
        const [appSdk, authSdk, firestoreSdk] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js'),
            import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')
        ]);

        const firebaseConfig = JSON.parse(__firebase_config);
        const appInstance = appSdk.initializeApp(firebaseConfig);
        const dbInstance = firestoreSdk.getFirestore(appInstance);
        const authInstance = authSdk.getAuth(appInstance);
        const cloudUser = await authenticateCloudUser(authInstance, authSdk);
        if (!cloudUser) return;

        setCloudSyncBadge('<i class="fa-solid fa-circle text-emerald-400 text-[8px] animate-pulse"></i> Cloud Real-time Sync');
        listenOrdersCloud(dbInstance, firestoreSdk);
        listenProductsCloud(dbInstance, firestoreSdk);
        listenCmsCloud(dbInstance, firestoreSdk);
        registerCloudSaveHelpers(dbInstance, cloudUser, firestoreSdk);
    } catch (initErr) {
        console.error('Cloud initialization error:', initErr);
    }
}

function getSupabaseStorageBucket() {
    const sbConfig = window.SOULIN_SUPABASE_CONFIG;
    if (sbConfig && sbConfig.storageBucket) return String(sbConfig.storageBucket);
    return 'soulin-images';
}

function dataUrlToImageBlob(dataUrl) {
    const segments = String(dataUrl || '').split(',');
    if (segments.length !== 2) {
        throw new Error('รูปแบบข้อมูลรูปภาพไม่ถูกต้อง');
    }
    const mimeMatch = /^data:([^;]+);base64$/i.exec(segments[0]);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binaryText = atob(segments[1]);
    const byteArray = new Uint8Array(binaryText.length);
    for (let idx = 0; idx < binaryText.length; idx++) {
        byteArray[idx] = binaryText.charCodeAt(idx);
    }
    return new Blob([byteArray], { type: mimeType });
}

function buildStorageObjectPath(folderName, prefixLabel) {
    const cleanFolder = String(folderName || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '') || 'uploads';
    const cleanPrefix = String(prefixLabel || 'img').replace(/[^a-zA-Z0-9_-]/g, '') || 'img';
    const randSuffix = Math.random().toString(36).slice(2, 8);
    return `${cleanFolder}/${cleanPrefix}-${Date.now()}-${randSuffix}.jpg`;
}

function getPublicStorageUrl(bucketName, objectPath) {
    const urlOutcome = window.soulinSupabaseClient.storage.from(bucketName).getPublicUrl(objectPath);
    const urlRecord = urlOutcome ? urlOutcome.data : null;
    return urlRecord && urlRecord.publicUrl ? urlRecord.publicUrl : null;
}

async function uploadImageToSupabaseStorage(compressedDataUrl, folderName, prefixLabel) {
    if (!window.soulinSupabaseClient || !window.soulinSupabaseClient.storage) {
        return null;
    }
    try {
        const bucketName = getSupabaseStorageBucket();
        const objectPath = buildStorageObjectPath(folderName, prefixLabel);
        const imageBlob = dataUrlToImageBlob(compressedDataUrl);
        const { error: uploadErr } = await window.soulinSupabaseClient.storage
            .from(bucketName)
            .upload(objectPath, imageBlob, {
                contentType: imageBlob.type,
                cacheControl: '31536000',
                upsert: true
            });
        if (uploadErr) {
            console.error('Supabase Storage upload failed:', uploadErr);
            return null;
        }
        return getPublicStorageUrl(bucketName, objectPath);
    } catch (storageErr) {
        console.error('Supabase image upload error:', storageErr);
        return null;
    }
}

window.uploadImageToCloud = uploadImageToSupabaseStorage;

function extractStoragePathFromPublicUrl(imageUrl) {
    const sbSettings = getSupabaseSettings();
    const bucketName = getSupabaseStorageBucket();
    const cleanBaseUrl = String(sbSettings.url || '').replace(/\/+$/, '');
    const publicPrefix = `${cleanBaseUrl}/storage/v1/object/public/${bucketName}/`;
    if (!cleanBaseUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith(publicPrefix)) {
        return '';
    }
    const rawSlice = imageUrl.slice(publicPrefix.length).split(/[?#]/)[0];
    let decodedPath = rawSlice;
    try {
        decodedPath = decodeURIComponent(rawSlice);
    } catch (decodeErr) {
        console.warn('Storage URL decode skipped:', decodeErr);
    }
    if (!decodedPath || decodedPath.includes('..')) return '';
    return decodedPath;
}

async function deleteImagesFromSupabaseStorage(imageUrls) {
    if (!window.soulinSupabaseClient || !window.soulinSupabaseClient.storage) {
        return { deletedCount: 0, deletedPaths: [] };
    }
    const urlList = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
    const uniquePaths = [...new Set(urlList.map(extractStoragePathFromPublicUrl).filter(Boolean))];
    if (uniquePaths.length === 0) {
        return { deletedCount: 0, deletedPaths: [] };
    }
    try {
        const bucketName = getSupabaseStorageBucket();
        const { error: removeErr } = await window.soulinSupabaseClient.storage
            .from(bucketName)
            .remove(uniquePaths);
        if (removeErr) {
            console.error('Supabase Storage delete failed:', removeErr);
            return { deletedCount: 0, deletedPaths: [] };
        }
        return { deletedCount: uniquePaths.length, deletedPaths: uniquePaths };
    } catch (deleteErr) {
        console.error('Supabase image delete error:', deleteErr);
        return { deletedCount: 0, deletedPaths: [] };
    }
}

async function listBucketFolderPaths(sbClient, bucketName, folderName) {
    const { data: fileEntries, error: listErr } = await sbClient.storage
        .from(bucketName)
        .list(folderName, { limit: 500 });
    if (listErr) {
        console.error(`Supabase Storage list failed (${folderName}):`, listErr);
        return null;
    }
    return (fileEntries || [])
        .filter(entry => entry && entry.id && entry.name && entry.name !== '.emptyFolderPlaceholder')
        .map(entry => `${folderName}/${entry.name}`);
}

function addUrlsToPathSet(urlList, targetSet) {
    urlList.forEach(imageUrl => {
        const objectPath = extractStoragePathFromPublicUrl(imageUrl);
        if (objectPath) targetSet.add(objectPath);
    });
}

async function collectReferencedStoragePaths(sbClient) {
    const [prodQuery, cmsQuery, orderQuery] = await Promise.all([
        sbClient.from('soulin_products').select('img'),
        sbClient.from('soulin_cms').select('img'),
        sbClient.from('soulin_orders').select('payment_slip_url')
    ]);
    if (prodQuery.error || cmsQuery.error || orderQuery.error) {
        console.error('Supabase reference fetch failed:', prodQuery.error || cmsQuery.error || orderQuery.error);
        return null;
    }
    const referencedSet = new Set();
    const stagedState = window.soulinStagedUploads || {};
    addUrlsToPathSet((prodQuery.data || []).map(row => row.img), referencedSet);
    addUrlsToPathSet((cmsQuery.data || []).map(row => row.img), referencedSet);
    addUrlsToPathSet((orderQuery.data || []).map(row => row.payment_slip_url), referencedSet);
    addUrlsToPathSet([stagedState.product, stagedState.cms, stagedState.slip], referencedSet);
    return referencedSet;
}

async function cleanupOrphanedStorageImages() {
    const sbClient = window.soulinSupabaseClient;
    if (!sbClient || !sbClient.storage || !(await checkSupabaseAdminSession(sbClient))) {
        return { ok: false, deletedCount: 0, deletedPaths: [] };
    }
    const referencedSet = await collectReferencedStoragePaths(sbClient);
    if (!referencedSet) {
        return { ok: false, deletedCount: 0, deletedPaths: [] };
    }
    const bucketName = getSupabaseStorageBucket();
    const [productPaths, bannerPaths, slipPaths] = await Promise.all([
        listBucketFolderPaths(sbClient, bucketName, 'products'),
        listBucketFolderPaths(sbClient, bucketName, 'banners'),
        listBucketFolderPaths(sbClient, bucketName, 'slips')
    ]);
    if (!productPaths || !bannerPaths || !slipPaths) {
        return { ok: false, deletedCount: 0, deletedPaths: [] };
    }
    const allFolderPaths = [...productPaths, ...bannerPaths, ...slipPaths];
    const orphanPaths = allFolderPaths.filter(pathStr => !referencedSet.has(pathStr));
    if (orphanPaths.length === 0) {
        return { ok: true, deletedCount: 0, deletedPaths: [] };
    }
    const { error: removeErr } = await sbClient.storage.from(bucketName).remove(orphanPaths);
    if (removeErr) {
        console.error('Supabase orphan cleanup failed:', removeErr);
        return { ok: false, deletedCount: 0, deletedPaths: [] };
    }
    return { ok: true, deletedCount: orphanPaths.length, deletedPaths: orphanPaths };
}

window.extractStoragePathFromPublicUrl = extractStoragePathFromPublicUrl;
window.deleteImageFromCloud = (imageUrl) => deleteImagesFromSupabaseStorage([imageUrl]);
window.deleteImagesFromCloud = deleteImagesFromSupabaseStorage;
window.cleanupOrphanedStorageImages = cleanupOrphanedStorageImages;
window.hasValidSupabaseAdminSession = (explicitClient) => checkSupabaseAdminSession(explicitClient);
window.signInAdminWithSupabase = signInAdminWithSupabase;
window.signOutSupabaseAuth = (explicitClient) => performSupabaseSignOut(explicitClient);

let activeCloudInitPromise = null;

async function initCloudSync() {
    if (activeCloudInitPromise) return activeCloudInitPromise;
    const sbSettings = getSupabaseSettings();
    if (sbSettings.url && sbSettings.publishableKey) {
        activeCloudInitPromise = initSupabaseCloud(sbSettings);
        window.soulinCloudReadyPromise = activeCloudInitPromise;
        return activeCloudInitPromise;
    }
    if (typeof __firebase_config !== 'undefined') {
        activeCloudInitPromise = initFirebaseCloud();
        window.soulinCloudReadyPromise = activeCloudInitPromise;
        return activeCloudInitPromise;
    }
    setCloudSyncBadge('<i class="fa-solid fa-circle text-amber-400 text-[8px]"></i> Local Mode');
    return false;
}
