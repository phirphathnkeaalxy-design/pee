function isHttpOrigin() {
    if (typeof window === 'undefined' || !window.location) return false;
    return /^https?:$/i.test(window.location.protocol);
}

function getGoogleClientId() {
    const storedId = localStorage.getItem('soulin_google_client_id') || '';
    const configId = window.SOULIN_GOOGLE_AUTH_CONFIG ? window.SOULIN_GOOGLE_AUTH_CONFIG.clientId : '';
    return String(storedId || configId || '').trim();
}

function decodeBase64UrlUtf8(base64UrlSegment) {
    const normalized = String(base64UrlSegment || '').replace(/-/g, '+').replace(/_/g, '/');
    const padCount = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padCount);
    const binaryText = atob(padded);
    const byteArray = new Uint8Array(binaryText.length);
    for (let idx = 0; idx < binaryText.length; idx++) {
        byteArray[idx] = binaryText.charCodeAt(idx);
    }
    return new TextDecoder('utf-8').decode(byteArray);
}

function decodeGoogleJwtClaims(jwtToken) {
    if (typeof jwtToken !== 'string') return null;
    const segments = jwtToken.split('.');
    if (segments.length !== 3 || !segments[1]) return null;
    try {
        const claimsText = decodeBase64UrlUtf8(segments[1]);
        const claimsMap = JSON.parse(claimsText);
        return claimsMap && typeof claimsMap === 'object' ? claimsMap : null;
    } catch (decodeErr) {
        console.error('Google JWT decode error:', decodeErr);
        return null;
    }
}

function completeGoogleSignIn(googleProfile) {
    const outcome = upsertGoogleCustomerAccount(googleProfile);
    if (!outcome.ok) {
        showToast(outcome.message, 'error');
        return false;
    }

    window.currentUser = outcome.user;
    if (!safeStorageSet('soulin_user', JSON.stringify(window.currentUser))) return false;
    safeStorageSet('soulin_remembered_username', outcome.user.username);
    closeGoogleDemoModal();

    const messageText = outcome.isNewAccount
        ? 'สมัครสมาชิกด้วย Google สำเร็จ!'
        : `ยินดีต้อนรับคุณ ${outcome.user.name}`;
    showToast(messageText, 'success');

    const destination = typeof buildStoreDestination === 'function'
        ? buildStoreDestination('user')
        : './member.html';
    window.location.href = destination;
    return true;
}

function handleGoogleCredentialResponse(credentialEvent) {
    const token = credentialEvent ? credentialEvent.credential : '';
    const claims = decodeGoogleJwtClaims(token);
    if (!claims || !claims.email) {
        showToast('ไม่สามารถอ่านข้อมูลบัญชี Google ได้', 'error');
        return false;
    }
    const displayName = claims.name || claims.email.split('@')[0];
    return completeGoogleSignIn({
        sub: claims.sub || '',
        email: claims.email,
        name: displayName,
        picture: claims.picture || ''
    });
}

function hasGoogleOAuthReady() {
    return Boolean(window.google && window.google.accounts && window.google.accounts.oauth2);
}

function isLoopbackIpHost() {
    return Boolean(typeof window !== 'undefined' && window.location && window.location.hostname === '127.0.0.1');
}

function redirectLoopbackToLocalhost() {
    showToast('กำลังสลับเป็น localhost เพื่อให้เชื่อมต่อบัญชี Google ได้...', 'info');
    if (typeof window !== 'undefined' && window.location && window.location.href) {
        window.location.href = window.location.href.replace('://127.0.0.1', '://localhost');
    }
}

function normalizeGoogleUserProfile(profileJson) {
    if (!profileJson || !profileJson.email) return null;
    return {
        sub: profileJson.sub || '',
        email: profileJson.email,
        name: profileJson.name || profileJson.email.split('@')[0],
        picture: profileJson.picture || ''
    };
}

async function fetchGoogleUserProfile(accessToken) {
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!userResponse.ok) {
        throw new Error(`Google userinfo request failed (${userResponse.status || 0})`);
    }
    return userResponse.json();
}

async function handleGoogleOAuthTokenResponse(tokenReply) {
    const hasValidToken = Boolean(tokenReply && !tokenReply.error && tokenReply.access_token);
    if (!hasValidToken) {
        console.error('Google OAuth token error:', tokenReply);
        showToast('ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองอีกครั้ง', 'error');
        return false;
    }
    try {
        const rawProfile = await fetchGoogleUserProfile(tokenReply.access_token);
        const normalizedProfile = normalizeGoogleUserProfile(rawProfile);
        if (!normalizedProfile) {
            showToast('ไม่สามารถอ่านข้อมูลบัญชี Google ได้', 'error');
            return false;
        }
        return completeGoogleSignIn(normalizedProfile);
    } catch (oauthErr) {
        console.error('Google userinfo error:', oauthErr);
        showToast('ไม่สามารถดึงข้อมูลบัญชี Google ได้ กรุณาลองอีกครั้ง', 'error');
        return false;
    }
}

function handleGoogleOAuthPopupError(popupErr) {
    const errType = popupErr ? popupErr.type : '';
    if (errType === 'popup_closed') {
        showToast('คุณปิดหน้าต่างเลือกบัญชี Google', 'info');
        return;
    }
    if (errType === 'popup_failed_to_open') {
        showToast('เบราว์เซอร์บล็อกป๊อปอัพ กรุณาอนุญาตป๊อปอัพสำหรับเว็บนี้', 'error');
        return;
    }
    console.error('Google popup error:', popupErr);
    showToast('เกิดข้อผิดพลาดในการเปิดหน้าต่าง Google กรุณาลองอีกครั้ง', 'error');
}

function createGoogleTokenClient(clientId) {
    if (!hasGoogleOAuthReady() || !clientId) return null;
    window.soulinGoogleTokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: handleGoogleOAuthTokenResponse,
        error_callback: handleGoogleOAuthPopupError
    });
    return window.soulinGoogleTokenClient;
}

function initGoogleCredentialSilent(clientId) {
    if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredentialResponse
        });
    }
}

function loadGoogleIdentityScript() {
    if (hasGoogleOAuthReady()) {
        return Promise.resolve(true);
    }
    if (window.soulinGsiLoadPromise) {
        return window.soulinGsiLoadPromise;
    }
    window.soulinGsiLoadPromise = new Promise((resolve, reject) => {
        const scriptEl = document.createElement('script');
        scriptEl.src = 'https://accounts.google.com/gsi/client';
        scriptEl.async = true;
        scriptEl.defer = true;
        scriptEl.onload = () => resolve(true);
        scriptEl.onerror = () => {
            window.soulinGsiLoadPromise = null;
            reject(new Error('ไม่สามารถโหลด Google Identity Services ได้'));
        };
        document.head.appendChild(scriptEl);
    });
    return window.soulinGsiLoadPromise;
}

async function launchGoogleTokenFlowAsync(clientId) {
    try {
        await loadGoogleIdentityScript();
        const readyClient = window.soulinGoogleTokenClient || createGoogleTokenClient(clientId);
        if (!readyClient) {
            showToast('ไม่สามารถเริ่มต้นระบบเชื่อมต่อ Google ได้', 'error');
            return false;
        }
        readyClient.requestAccessToken({ prompt: 'select_account' });
        return true;
    } catch (gisLoadErr) {
        console.error('Google Sign-In load failed:', gisLoadErr);
        showToast('ไม่สามารถเชื่อมต่อ Google ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', 'error');
        return false;
    }
}

function triggerRealGooglePopup(clientId) {
    if (isLoopbackIpHost()) {
        redirectLoopbackToLocalhost();
        return;
    }
    if (window.soulinGoogleTokenClient) {
        window.soulinGoogleTokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
    }
    launchGoogleTokenFlowAsync(clientId);
}

async function initRealGoogleButton(containerId) {
    const clientId = getGoogleClientId();
    if (!isHttpOrigin() || !clientId || isLoopbackIpHost()) return false;

    const containerEl = document.getElementById(containerId);
    if (containerEl) containerEl.classList.add('hidden');

    try {
        await loadGoogleIdentityScript();
        createGoogleTokenClient(clientId);
        initGoogleCredentialSilent(clientId);
        return Boolean(window.soulinGoogleTokenClient);
    } catch (gisErr) {
        console.error('Google Sign-In init failed:', gisErr);
        return false;
    }
}

async function signInWithFirebaseGoogle() {
    try {
        const [appSdk, authSdk] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js')
        ]);
        const firebaseConfig = JSON.parse(__firebase_config);
        const appInstance = appSdk.getApps().length > 0
            ? appSdk.getApp()
            : appSdk.initializeApp(firebaseConfig);
        const authInstance = authSdk.getAuth(appInstance);
        const provider = new authSdk.GoogleAuthProvider();
        const signInOutcome = await authSdk.signInWithPopup(authInstance, provider);
        const fbUser = signInOutcome.user;
        return completeGoogleSignIn({
            sub: fbUser.uid,
            email: fbUser.email,
            name: fbUser.displayName || fbUser.email,
            picture: fbUser.photoURL || ''
        });
    } catch (fbErr) {
        console.error('Firebase Google popup error:', fbErr);
        showToast('การเข้าสู่ระบบด้วย Google ถูกยกเลิกหรือไม่สำเร็จ', 'error');
        return false;
    }
}

function getSavedGoogleAccounts() {
    const users = safeJsonParse(localStorage.getItem('soulin_registered_users'), []);
    return users.filter(userRecord => userRecord && userRecord.authProvider === 'google');
}

function buildDemoAccountCard(userRecord) {
    const safeEmail = escapeHtml(userRecord.email || userRecord.username);
    const safeName = escapeHtml(userRecord.fullname || safeEmail);
    const initialChar = escapeHtml((userRecord.fullname || safeEmail).charAt(0).toUpperCase());
    return `
        <button type="button" onclick="selectGoogleDemoAccount('${safeEmail}')" class="w-full flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200 hover:border-soulin-primary hover:bg-soulin-mint/40 transition-all text-left">
            <div class="flex items-center gap-3 min-w-0">
                <span class="w-9 h-9 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">${initialChar}</span>
                <div class="min-w-0">
                    <span class="block text-xs font-bold text-slate-800 truncate">${safeName}</span>
                    <span class="block text-[11px] text-slate-500 truncate">${safeEmail}</span>
                </div>
            </div>
            <i class="fa-solid fa-chevron-right text-[10px] text-slate-400"></i>
        </button>
    `;
}

function renderGoogleDemoAccounts() {
    const listEl = document.getElementById('google-demo-accounts-list');
    if (!listEl) return;
    const saved = getSavedGoogleAccounts();
    if (saved.length === 0) {
        listEl.innerHTML = '';
        listEl.classList.add('hidden');
        return;
    }
    listEl.classList.remove('hidden');
    listEl.innerHTML = `
        <span class="block text-[11px] font-semibold text-slate-500">เลือกบัญชี Google ที่เคยใช้งาน</span>
        ${saved.map(buildDemoAccountCard).join('')}
    `;
}

function openGoogleDemoModal() {
    renderGoogleDemoAccounts();
    const errEl = document.getElementById('google-demo-error');
    if (errEl) {
        errEl.textContent = '';
        errEl.classList.add('hidden');
    }
    const modal = document.getElementById('google-demo-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeGoogleDemoModal() {
    const modal = document.getElementById('google-demo-modal');
    if (modal) modal.classList.add('hidden');
}

function selectGoogleDemoAccount(accountEmail) {
    const matched = getSavedGoogleAccounts().find(entry => (entry.email || entry.username) === accountEmail);
    if (!matched) return false;
    return completeGoogleSignIn({
        sub: matched.googleSub || '',
        email: matched.email || matched.username,
        name: matched.fullname,
        picture: matched.avatarUrl || ''
    });
}

function setGoogleDemoError(messageText) {
    const errEl = document.getElementById('google-demo-error');
    if (!errEl) return;
    errEl.textContent = messageText;
    errEl.classList.toggle('hidden', !messageText);
}

function handleGoogleDemoFormSubmit(submitEvent) {
    if (submitEvent) submitEvent.preventDefault();
    setGoogleDemoError('');
    const nameInput = document.getElementById('google-demo-name');
    const emailInput = document.getElementById('google-demo-email');
    const cleanName = nameInput ? nameInput.value.trim() : '';
    const cleanEmail = emailInput ? emailInput.value.trim().toLowerCase() : '';

    if (!cleanName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        const errMsg = 'กรุณากรอกชื่อและอีเมล Google ที่ถูกต้อง (เช่น name@gmail.com)';
        setGoogleDemoError(errMsg);
        showToast(errMsg, 'error');
        return false;
    }

    const demoSub = `demo-google-${hashSecret(cleanEmail).slice(0, 16)}`;
    return completeGoogleSignIn({
        sub: demoSub,
        email: cleanEmail,
        name: cleanName,
        picture: ''
    });
}

function startGoogleAuthFlow() {
    const clientId = getGoogleClientId();
    if (isHttpOrigin() && clientId) {
        triggerRealGooglePopup(clientId);
        return;
    }
    if (isHttpOrigin() && typeof __firebase_config !== 'undefined') {
        signInWithFirebaseGoogle();
        return;
    }
    const allowDemo = window.SOULIN_GOOGLE_AUTH_CONFIG && window.SOULIN_GOOGLE_AUTH_CONFIG.enableDemoFallback;
    if (allowDemo) {
        openGoogleDemoModal();
        return;
    }
    showToast('กรุณาตั้งค่า Google Client ID ใน js/google-auth-config.js และเปิดผ่าน http:// หรือ https://', 'error');
}
