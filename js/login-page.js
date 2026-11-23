function getSafeRedirectTab() {
    const rawSearch = typeof window !== 'undefined' && window.location ? window.location.search : '';
    const requestedTab = new URLSearchParams(rawSearch).get('redirect');
    return ALLOWED_REDIRECT_TABS.includes(requestedTab) ? requestedTab : 'member';
}

function buildStoreDestination(userRole) {
    if (userRole === 'admin') {
        return './soulin.html?tab=admin';
    }
    const targetTab = getSafeRedirectTab();
    if (targetTab === 'member') {
        return './member.html';
    }
    return `./soulin.html?tab=${encodeURIComponent(targetTab)}`;
}

function setInlineAuthError(elementId, messageText) {
    const errorEl = document.getElementById(elementId);
    if (!errorEl) return;
    if (!messageText) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
        return;
    }
    errorEl.textContent = messageText;
    errorEl.classList.remove('hidden');
}

function switchLoginPageMode(targetMode) {
    const isSignup = targetMode === 'signup';
    const loginForm = document.getElementById('login-page-form');
    const signupForm = document.getElementById('signup-page-form');
    const loginTabBtn = document.getElementById('tab-btn-login');
    const signupTabBtn = document.getElementById('tab-btn-signup');
    const headingEl = document.getElementById('auth-page-heading');
    const subtitleEl = document.getElementById('auth-page-subtitle');

    if (loginForm) loginForm.classList.toggle('hidden', isSignup);
    if (signupForm) signupForm.classList.toggle('hidden', !isSignup);
    setInlineAuthError('login-inline-error', '');
    setInlineAuthError('signup-inline-error', '');

    const activeTabCls = 'flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-white text-soulin-dark shadow-sm transition-all';
    const idleTabCls = 'flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-medium text-slate-500 hover:text-soulin-dark transition-all';
    if (loginTabBtn) {
        loginTabBtn.className = isSignup ? idleTabCls : activeTabCls;
        loginTabBtn.setAttribute('aria-selected', String(!isSignup));
    }
    if (signupTabBtn) {
        signupTabBtn.className = isSignup ? activeTabCls : idleTabCls;
        signupTabBtn.setAttribute('aria-selected', String(isSignup));
    }
    if (headingEl) {
        headingEl.textContent = isSignup ? 'สมัครสมาชิก SOULIN' : 'ยินดีต้อนรับกลับมา';
    }
    if (subtitleEl) {
        subtitleEl.textContent = isSignup
            ? 'สร้างบัญชีลูกค้าใหม่เพื่อสั่งซื้อและติดตามสถานะพัสดุได้ทันที'
            : 'เข้าสู่ระบบเพื่อสั่งซื้อยาดมสมุนไพรและรับสิทธิพิเศษสมาชิก';
    }
    const googleBtnLabel = document.getElementById('google-auth-btn-label');
    if (googleBtnLabel) {
        googleBtnLabel.textContent = isSignup ? 'สมัครสมาชิกด้วย Google' : 'เข้าสู่ระบบด้วย Google';
    }
}

function updateStrengthIndicator() {
    const passwordInput = document.getElementById('page-signup-password');
    const barEl = document.getElementById('password-strength-bar');
    const labelEl = document.getElementById('password-strength-label');
    if (!passwordInput || !barEl || !labelEl) return;

    const strength = evaluatePasswordStrength(passwordInput.value);
    barEl.className = `h-1.5 rounded-full transition-all duration-300 ${strength.barClass} ${strength.widthClass}`;
    labelEl.textContent = strength.label;
}

function renderSignedInView() {
    const nameEl = document.getElementById('signed-in-name');
    const roleEl = document.getElementById('signed-in-role');
    const adminLink = document.getElementById('signed-in-admin-link');
    const isAdmin = window.currentUser.role === 'admin';
    if (nameEl) nameEl.textContent = window.currentUser.name || window.currentUser.username;
    if (roleEl) roleEl.textContent = isAdmin ? 'ผู้ดูแลระบบ (Admin)' : 'สมาชิกลูกค้า SOULIN';
    if (adminLink) adminLink.classList.toggle('hidden', !isAdmin);
}

function prefillRememberedUsername() {
    const rememberedUser = localStorage.getItem('soulin_remembered_username') || '';
    const usernameEl = document.getElementById('page-login-username');
    const rememberEl = document.getElementById('page-remember-username');
    if (usernameEl && rememberedUser && !usernameEl.value) {
        usernameEl.value = rememberedUser;
    }
    if (rememberEl) {
        rememberEl.checked = Boolean(rememberedUser);
    }
}

function renderLoginPageState() {
    const formsCard = document.getElementById('auth-forms-card');
    const signedInCard = document.getElementById('already-logged-in-card');
    const hasSession = Boolean(window.currentUser);

    if (formsCard) formsCard.classList.toggle('hidden', hasSession);
    if (signedInCard) signedInCard.classList.toggle('hidden', !hasSession);

    if (hasSession) {
        renderSignedInView();
        return;
    }
    prefillRememberedUsername();
}

function completeLoginPageSignIn(userSession, passwordEl, shouldRemember) {
    window.currentUser = userSession;
    if (!safeStorageSet('soulin_user', JSON.stringify(window.currentUser))) return false;

    if (shouldRemember) {
        safeStorageSet('soulin_remembered_username', userSession.username);
    } else {
        localStorage.removeItem('soulin_remembered_username');
    }

    if (passwordEl) passwordEl.value = '';
    const greeting = userSession.role === 'admin'
        ? 'เข้าสู่ระบบแอดมินสำเร็จ!'
        : `ยินดีต้อนรับคุณ ${userSession.name}`;
    showToast(greeting, 'success');
    window.location.href = buildStoreDestination(userSession.role);
    return true;
}

async function handleCloudCustomerLogin(emailText, passwordEl, rememberEl) {
    const authOutcome = await window.signInCustomerWithSupabase(emailText, passwordEl.value);
    if (!authOutcome.ok) {
        setInlineAuthError('login-inline-error', authOutcome.message);
        showToast(authOutcome.message, 'error');
        return false;
    }
    return completeLoginPageSignIn(authOutcome.user, passwordEl, Boolean(rememberEl && rememberEl.checked));
}

function handleLoginPageSubmit(submitEvent) {
    if (submitEvent) submitEvent.preventDefault();
    setInlineAuthError('login-inline-error', '');

    const usernameEl = document.getElementById('page-login-username');
    const passwordEl = document.getElementById('page-login-password');
    const rememberEl = document.getElementById('page-remember-username');
    if (window.soulinSupabaseClient && typeof window.signInCustomerWithSupabase === 'function') {
        return handleCloudCustomerLogin(usernameEl.value, passwordEl, rememberEl);
    }

    const authOutcome = verifyUserCredentials(usernameEl.value, passwordEl.value);
    if (!authOutcome.ok) {
        setInlineAuthError('login-inline-error', authOutcome.message);
        showToast(authOutcome.message, 'error');
        return false;
    }
    return completeLoginPageSignIn(authOutcome.user, passwordEl, Boolean(rememberEl && rememberEl.checked));
}

function recordSignupPdpaConsent() {
    if (localStorage.getItem('soulin_pdpa_consent')) return;
    safeStorageSet('soulin_pdpa_consent', JSON.stringify({
        version: '2026-11-v1',
        acceptedAt: new Date().toISOString(),
        essential: true,
        analytics: false,
        marketing: false,
        termsAccepted: true
    }));
}

async function handleCloudCustomerSignup(signupInput) {
    const regOutcome = await window.signUpCustomerWithSupabase({
        fullname: signupInput.fullname,
        email: signupInput.username,
        password: signupInput.password,
        phone: signupInput.phone
    });
    if (!regOutcome.ok) {
        setInlineAuthError('signup-inline-error', regOutcome.message);
        showToast(regOutcome.message, 'error');
        return false;
    }
    recordSignupPdpaConsent();
    if (regOutcome.needsEmailConfirmation) {
        showToast(regOutcome.message, 'info');
        switchLoginPageMode('login');
        return true;
    }
    window.currentUser = regOutcome.user;
    if (!safeStorageSet('soulin_user', JSON.stringify(window.currentUser))) return false;
    safeStorageSet('soulin_remembered_username', regOutcome.user.username);
    showToast('ลงทะเบียนสมาชิก SOULIN สำเร็จ!', 'success');
    window.location.href = buildStoreDestination('user');
    return true;
}

function validateLoginSignupPrechecks(password, confirmPassword) {
    if (password !== confirmPassword) {
        return 'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน';
    }
    const pdpaBox = document.getElementById('page-signup-pdpa');
    if (pdpaBox && !pdpaBox.checked) {
        return 'กรุณายอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว (PDPA) ก่อนสมัครสมาชิก';
    }
    return '';
}

function handleSignupPageSubmit(submitEvent) {
    if (submitEvent) submitEvent.preventDefault();
    setInlineAuthError('signup-inline-error', '');

    const fullname = document.getElementById('page-signup-fullname').value;
    const phone = document.getElementById('page-signup-phone').value;
    const username = document.getElementById('page-signup-username').value;
    const password = document.getElementById('page-signup-password').value;
    const confirmPassword = document.getElementById('page-signup-confirm').value;

    const precheckError = validateLoginSignupPrechecks(password, confirmPassword);
    if (precheckError) {
        setInlineAuthError('signup-inline-error', precheckError);
        showToast(precheckError, 'error');
        return false;
    }

    if (window.soulinSupabaseClient && typeof window.signUpCustomerWithSupabase === 'function') {
        return handleCloudCustomerSignup({ fullname, username, password, phone });
    }

    const regOutcome = registerCustomerAccount({ fullname, username, password, phone });
    if (!regOutcome.ok) {
        setInlineAuthError('signup-inline-error', regOutcome.message);
        showToast(regOutcome.message, 'error');
        return false;
    }

    window.currentUser = regOutcome.user;
    if (!safeStorageSet('soulin_user', JSON.stringify(window.currentUser))) return false;
    recordSignupPdpaConsent();
    safeStorageSet('soulin_remembered_username', regOutcome.user.username);
    showToast('ลงทะเบียนสมาชิก SOULIN สำเร็จ!', 'success');
    window.location.href = buildStoreDestination('user');
    return true;
}

async function handleLoginPageLogout() {
    if (typeof window.signOutSupabaseAuth === 'function') {
        await window.signOutSupabaseAuth();
    }
    window.currentUser = null;
    localStorage.removeItem('soulin_user');
    renderLoginPageState();
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
}

function updateLoginCartBadge() {
    const badgeEl = document.getElementById('login-cart-badge');
    if (!badgeEl) return;
    const totalCount = Object.values(window.cart || {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
    badgeEl.textContent = String(totalCount);
    badgeEl.classList.toggle('hidden', totalCount <= 0);
}

function bootstrapLoginPage() {
    const brandLogo = document.getElementById('login-brand-logo');
    if (brandLogo) {
        const safeLogoUrl = sanitizeImageUrl(window.cmsConfig && window.cmsConfig.img) || DEFAULT_CMS_CONFIG.img;
        brandLogo.src = safeLogoUrl;
    }

    updateLoginCartBadge();
    const rawSearch = typeof window !== 'undefined' && window.location ? window.location.search : '';
    const requestedMode = new URLSearchParams(rawSearch).get('mode');
    switchLoginPageMode(requestedMode === 'signup' ? 'signup' : 'login');

    const signupPasswordEl = document.getElementById('page-signup-password');
    if (signupPasswordEl) {
        signupPasswordEl.addEventListener('input', updateStrengthIndicator);
    }
    if (typeof initRealGoogleButton === 'function') {
        initRealGoogleButton('google-gsi-btn-wrap');
    }
    if (typeof initCloudSync === 'function') {
        initCloudSync();
    }
    renderLoginPageState();
}

window.addEventListener('DOMContentLoaded', bootstrapLoginPage);
