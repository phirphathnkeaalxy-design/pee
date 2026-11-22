function syncTabVisibility(tabKey, activeTab) {
    const pageEl = document.getElementById(`page-${tabKey}`);
    const navBtn = document.getElementById(`nav-${tabKey}`);
    const isActive = tabKey === activeTab;

    if (pageEl) {
        pageEl.classList.toggle('hidden', !isActive);
    }
    if (navBtn) {
        navBtn.classList.toggle('border-soulin-primary', isActive);
        navBtn.classList.toggle('text-soulin-primary', isActive);
        navBtn.classList.toggle('border-transparent', !isActive);
    }
}

function refreshTabView(tabId) {
    if (tabId === 'admin') renderAdminDashboard();
    else if (tabId === 'cart') renderCart();
    else if (tabId === 'orders') renderOrders();
    else if (tabId === 'products') renderProducts();
}

function toggleAdminShellChrome(isAdminView) {
    const headerEl = document.getElementById('storefront-header');
    const bannerEl = document.getElementById('top-brand-banner');
    const footerEl = document.getElementById('storefront-footer');
    const mainEl = document.getElementById('storefront-main');
    if (headerEl) headerEl.classList.toggle('hidden', isAdminView);
    if (bannerEl) bannerEl.classList.toggle('hidden', isAdminView);
    if (footerEl) footerEl.classList.toggle('hidden', isAdminView);
    if (mainEl) {
        mainEl.className = isAdminView
            ? 'flex-grow w-full max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-5'
            : 'flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8';
    }
}

function switchTab(tabId) {
    const tabs = ['home', 'products', 'cart', 'orders', 'admin'];
    tabs.forEach(tabKey => syncTabVisibility(tabKey, tabId));
    toggleAdminShellChrome(tabId === 'admin');
    refreshTabView(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) menu.classList.toggle('hidden');
}

function handleCrossTabStorage(storageEvent) {
    if (storageEvent.key === 'soulin_orders') {
        window.orders = safeJsonParse(storageEvent.newValue, []);
        renderOrders();
        renderAdminOrdersList();
        updateAdminStats();
        initAnalyticsChart();
    }
    if (storageEvent.key === 'soulin_products') {
        window.products = safeJsonParse(storageEvent.newValue, null) || cloneDefaultProducts();
        renderProducts(window.currentProductFilter);
        renderAdminProductsTable();
        renderCart();
    }
    if (storageEvent.key === 'soulin_addresses' && typeof renderCheckoutAddressCard === 'function') {
        renderCheckoutAddressCard();
    }
}

function getInitialTabFromQuery() {
    const validTabs = ['home', 'products', 'cart', 'orders', 'admin'];
    const rawSearch = typeof window !== 'undefined' && window.location ? window.location.search : '';
    const requestedTab = new URLSearchParams(rawSearch).get('tab');
    return validTabs.includes(requestedTab) ? requestedTab : 'home';
}

function bootstrapApp() {
    setupFileInputListeners();
    renderAuthUI();
    renderPromotions();
    renderProducts(window.currentProductFilter);
    renderCMS();
    updateCartBadge();
    renderCart();
    renderOrders();
    initAnalyticsChart();
    switchTab(getInitialTabFromQuery());
    initCloudSync();
    window.addEventListener('storage', handleCrossTabStorage);
}

window.addEventListener('DOMContentLoaded', bootstrapApp);
