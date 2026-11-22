const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_LOCKOUT_MS = 30000;
const ADMIN_REMEMBER_KEY = 'soulin_remembered_admin';
const ADMIN_ATTEMPT_KEY = 'soulin_admin_failed_attempts';
const ADMIN_LOCK_UNTIL_KEY = 'soulin_admin_lock_until';

let memoryAdminGuard = {};

function readGuardValue(storageKey) {
    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            return window.sessionStorage.getItem(storageKey) || '';
        }
    } catch (storageErr) {
        console.error('Admin guard storage read failed:', storageErr);
    }
    return memoryAdminGuard[storageKey] || '';
}

function writeGuardValue(storageKey, serializedText) {
    memoryAdminGuard[storageKey] = String(serializedText);
    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.setItem(storageKey, String(serializedText));
        }
    } catch (storageErr) {
        console.error('Admin guard storage write failed:', storageErr);
    }
}

function removeGuardValue(storageKey) {
    delete memoryAdminGuard[storageKey];
    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.removeItem(storageKey);
        }
    } catch (storageErr) {
        console.error('Admin guard storage delete failed:', storageErr);
    }
}

function getAdminLockRemainingSeconds() {
    const rawUntil = readGuardValue(ADMIN_LOCK_UNTIL_KEY);
    const lockUntil = Number(rawUntil) || 0;
    if (!lockUntil) return 0;
    const remainingMs = lockUntil - Date.now();
    if (remainingMs <= 0) {
        removeGuardValue(ADMIN_LOCK_UNTIL_KEY);
        return 0;
    }
    return Math.ceil(remainingMs / 1000);
}

function recordAdminFailedAttempt() {
    const prevCount = Number(readGuardValue(ADMIN_ATTEMPT_KEY)) || 0;
    const nextCount = prevCount + 1;
    if (nextCount >= ADMIN_MAX_ATTEMPTS) {
        writeGuardValue(ADMIN_LOCK_UNTIL_KEY, String(Date.now() + ADMIN_LOCKOUT_MS));
        removeGuardValue(ADMIN_ATTEMPT_KEY);
        return { isLocked: true, remainingAttempts: 0 };
    }
    writeGuardValue(ADMIN_ATTEMPT_KEY, String(nextCount));
    return { isLocked: false, remainingAttempts: ADMIN_MAX_ATTEMPTS - nextCount };
}

function clearAdminLoginAttempts() {
    removeGuardValue(ADMIN_ATTEMPT_KEY);
    removeGuardValue(ADMIN_LOCK_UNTIL_KEY);
}

function setAdminLoginError(messageText) {
    const errorEl = document.getElementById('admin-login-error');
    if (!errorEl) return;
    errorEl.textContent = messageText || '';
    errorEl.classList.toggle('hidden', !messageText);
}

function renderAdminLockState() {
    const submitBtn = document.getElementById('admin-login-submit-btn');
    const remainingSec = getAdminLockRemainingSeconds();
    const isLocked = remainingSec > 0;
    if (submitBtn) {
        submitBtn.disabled = isLocked;
    }
    if (isLocked) {
        setAdminLoginError(`ลองผิดเกิน ${ADMIN_MAX_ATTEMPTS} ครั้ง กรุณารอ ${remainingSec} วินาทีแล้วลองใหม่`);
    }
}

function prefillRememberedAdmin() {
    const rememberedAdmin = localStorage.getItem(ADMIN_REMEMBER_KEY) || '';
    const usernameEl = document.getElementById('admin-login-username');
    const rememberEl = document.getElementById('admin-remember-username');
    if (usernameEl && rememberedAdmin && !usernameEl.value) {
        usernameEl.value = rememberedAdmin;
    }
    if (rememberEl) {
        rememberEl.checked = Boolean(rememberedAdmin);
    }
}

function renderCustomerSessionNotice() {
    const noticeBox = document.getElementById('admin-customer-switch-notice');
    const noticeNameEl = document.getElementById('admin-customer-notice-name');
    const hasCustomerSession = Boolean(window.currentUser && window.currentUser.role !== 'admin');
    if (noticeBox) {
        noticeBox.classList.toggle('hidden', !hasCustomerSession);
    }
    if (noticeNameEl && hasCustomerSession) {
        noticeNameEl.textContent = window.currentUser.name || window.currentUser.username;
    }
}

function renderAdminSignedInView() {
    const activeUserEl = document.getElementById('admin-active-username');
    if (activeUserEl && window.currentUser) {
        activeUserEl.textContent = window.currentUser.username;
    }
}

function renderAdminLoginState() {
    const formCard = document.getElementById('admin-login-form-card');
    const signedInCard = document.getElementById('admin-already-signed-in');
    const isAdminSignedIn = Boolean(window.currentUser && window.currentUser.role === 'admin');

    if (formCard) formCard.classList.toggle('hidden', isAdminSignedIn);
    if (signedInCard) signedInCard.classList.toggle('hidden', !isAdminSignedIn);

    if (isAdminSignedIn) {
        renderAdminSignedInView();
        return;
    }
    prefillRememberedAdmin();
    renderCustomerSessionNotice();
    renderAdminLockState();
}

function persistAdminRememberPreference(usernameText, shouldRemember) {
    if (shouldRemember) {
        safeStorageSet(ADMIN_REMEMBER_KEY, usernameText);
        return;
    }
    localStorage.removeItem(ADMIN_REMEMBER_KEY);
}

function emitAdminAuthAudit(actionName, actorName, summaryText, severityLevel, metaSpec) {
    if (typeof recordAuditLog !== 'function') return;
    recordAuditLog({
        category: 'auth',
        action: actionName,
        actor: actorName || 'unknown',
        actorRole: 'admin',
        targetId: actorName || 'admin',
        summary: summaryText,
        severity: severityLevel || 'info',
        metadata: metaSpec || {}
    });
}

function handleAdminFailedLogin(errorMessage, passwordEl, attemptedUser) {
    const attemptOutcome = recordAdminFailedAttempt();
    if (passwordEl) passwordEl.value = '';
    const finalMessage = attemptOutcome.isLocked
        ? `ลองผิดเกิน ${ADMIN_MAX_ATTEMPTS} ครั้ง ระบบล็อกชั่วคราว 30 วินาที`
        : `${errorMessage} (เหลือโอกาสลองอีก ${attemptOutcome.remainingAttempts} ครั้ง)`;
    emitAdminAuthAudit(
        attemptOutcome.isLocked ? 'ADMIN_LOGIN_LOCKOUT' : 'ADMIN_LOGIN_FAILED',
        attemptedUser || 'unknown',
        attemptOutcome.isLocked
            ? `ล็อกหน้าเข้าสู่ระบบแอดมินชั่วคราวหลังกรอกผิดเกิน ${ADMIN_MAX_ATTEMPTS} ครั้ง`
            : `เข้าสู่ระบบแอดมินไม่สำเร็จ (${attemptedUser || '-'}): ${errorMessage}`,
        attemptOutcome.isLocked ? 'error' : 'warning',
        { remainingAttempts: attemptOutcome.remainingAttempts, locked: attemptOutcome.isLocked }
    );
    setAdminLoginError(finalMessage);
    showToast(finalMessage, 'error');
    renderAdminLockState();
}

function getInputValueById(elementId) {
    const inputEl = document.getElementById(elementId);
    return inputEl ? inputEl.value : '';
}

function finalizeAdminSignIn(adminSession, passwordEl, rememberEl) {
    clearAdminLoginAttempts();
    window.currentUser = adminSession;
    if (!safeStorageSet('soulin_user', JSON.stringify(window.currentUser))) return false;
    persistAdminRememberPreference(adminSession.username, Boolean(rememberEl && rememberEl.checked));
    emitAdminAuthAudit(
        'ADMIN_LOGIN_SUCCESS',
        adminSession.username,
        `ผู้ดูแลระบบ "${adminSession.username}" เข้าสู่ระบบสำเร็จ`,
        'success'
    );
    if (passwordEl) passwordEl.value = '';
    showToast('เข้าสู่ระบบแอดมิน SOULIN สำเร็จ!', 'success');
    window.location.href = './soulin.html?tab=admin';
    return true;
}

function handleAdminLoginSubmit(submitEvent) {
    if (submitEvent) submitEvent.preventDefault();
    setAdminLoginError('');

    if (getAdminLockRemainingSeconds() > 0) {
        renderAdminLockState();
        showToast('กรุณารอสักครู่ก่อนลองเข้าสู่ระบบแอดมินอีกครั้ง', 'error');
        return false;
    }

    const attemptedUser = getInputValueById('admin-login-username').trim();
    const passwordEl = document.getElementById('admin-login-password');
    const rememberEl = document.getElementById('admin-remember-username');
    const authOutcome = verifyAdminCredentials(
        attemptedUser,
        getInputValueById('admin-login-password')
    );

    if (!authOutcome.ok) {
        handleAdminFailedLogin(authOutcome.message, passwordEl, attemptedUser);
        return false;
    }

    return finalizeAdminSignIn(authOutcome.user, passwordEl, rememberEl);
}

function handleAdminLoginPageLogout() {
    const prevUser = window.currentUser ? window.currentUser.username : 'admin';
    emitAdminAuthAudit('ADMIN_LOGOUT', prevUser, `ผู้ดูแลระบบ "${prevUser}" ออกจากระบบจากหน้า Admin Login`, 'info');
    window.currentUser = null;
    localStorage.removeItem('soulin_user');
    renderAdminLoginState();
    showToast('ออกจากระบบแอดมินเรียบร้อยแล้ว', 'info');
}

function bootstrapAdminLoginPage() {
    const brandLogo = document.getElementById('admin-brand-logo');
    if (brandLogo) {
        const safeLogoUrl = sanitizeImageUrl(window.cmsConfig && window.cmsConfig.img) || DEFAULT_CMS_CONFIG.img;
        brandLogo.src = safeLogoUrl;
    }
    renderAdminLoginState();
    if (typeof initCloudSync === 'function') {
        initCloudSync();
    }
}

window.addEventListener('DOMContentLoaded', bootstrapAdminLoginPage);
