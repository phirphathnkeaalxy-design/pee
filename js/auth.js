const SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

const SHA256_INIT = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];

const RESERVED_CUSTOMER_USERNAMES = ['admin', 'adminsoulin', 'administrator', 'root', 'system'];
const ALLOWED_REDIRECT_TABS = ['home', 'products', 'cart', 'orders', 'admin', 'member'];

function rightRotate(word, shift) {
    return (word >>> shift) | (word << (32 - shift));
}

function padSha256Bytes(utf8Bytes) {
    const bitLength = utf8Bytes.length * 8;
    const totalLen = Math.ceil((utf8Bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(totalLen);
    padded.set(utf8Bytes);
    padded[utf8Bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(totalLen - 8, Math.floor(bitLength / 0x100000000), false);
    view.setUint32(totalLen - 4, bitLength >>> 0, false);
    return padded;
}

function buildSha256Schedule(paddedBytes, blockOffset) {
    const words = new Int32Array(64);
    const view = new DataView(paddedBytes.buffer);
    for (let idx = 0; idx < 16; idx++) {
        words[idx] = view.getInt32(blockOffset + idx * 4, false);
    }
    for (let idx = 16; idx < 64; idx++) {
        const s0 = rightRotate(words[idx - 15], 7) ^ rightRotate(words[idx - 15], 18) ^ (words[idx - 15] >>> 3);
        const s1 = rightRotate(words[idx - 2], 17) ^ rightRotate(words[idx - 2], 19) ^ (words[idx - 2] >>> 10);
        words[idx] = (words[idx - 16] + s0 + words[idx - 7] + s1) | 0;
    }
    return words;
}

function compressSha256Block(hashState, words) {
    let [a, b, c, d, e, f, g, h] = hashState;
    for (let idx = 0; idx < 64; idx++) {
        const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const sum1 = (h + s1 + ch + SHA256_K[idx] + words[idx]) | 0;
        const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const sum2 = (s0 + maj) | 0;
        h = g; g = f; f = e; e = (d + sum1) | 0;
        d = c; c = b; b = a; a = (sum1 + sum2) | 0;
    }
    const nextWords = [a, b, c, d, e, f, g, h];
    for (let idx = 0; idx < 8; idx++) {
        hashState[idx] = (hashState[idx] + nextWords[idx]) | 0;
    }
}

function sha256Hex(plainText) {
    const utf8Bytes = new TextEncoder().encode(String(plainText));
    const padded = padSha256Bytes(utf8Bytes);
    const hashState = SHA256_INIT.slice();
    for (let offset = 0; offset < padded.length; offset += 64) {
        compressSha256Block(hashState, buildSha256Schedule(padded, offset));
    }
    return hashState.map(word => (word >>> 0).toString(16).padStart(8, '0')).join('');
}

function hashSecret(rawPassword) {
    return sha256Hex(`soulin-v1:${rawPassword}`);
}

function buildLoginPageUrl(redirectTab = '', mode = 'login') {
    const queryParams = [];
    if (ALLOWED_REDIRECT_TABS.includes(redirectTab)) {
        queryParams.push(`redirect=${encodeURIComponent(redirectTab)}`);
    }
    if (mode === 'signup') {
        queryParams.push('mode=signup');
    }
    return queryParams.length > 0 ? `./login.html?${queryParams.join('&')}` : './login.html';
}

function navigateToLoginPage(redirectTab = '', mode = 'login') {
    const targetUrl = buildLoginPageUrl(redirectTab, mode);
    if (typeof window !== 'undefined' && window.location) {
        window.location.href = targetUrl;
    }
}

function openAuthModal(mode = 'login') {
    toggleAuthMode(mode);
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('hidden');
}

function toggleAuthMode(mode) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const title = document.getElementById('auth-modal-title');
    const isLogin = mode === 'login';
    if (loginForm) loginForm.classList.toggle('hidden', !isLogin);
    if (signupForm) signupForm.classList.toggle('hidden', isLogin);
    if (title) title.innerText = isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
}

function authenticateCustomer(usernameInput, passwordInput, enteredHash) {
    const savedUsers = safeJsonParse(localStorage.getItem('soulin_registered_users'), []);
    const foundIndex = savedUsers.findIndex(userRecord => (
        userRecord.username === usernameInput
        && (userRecord.passwordHash === enteredHash || userRecord.password === passwordInput)
    ));
    if (foundIndex === -1) return null;

    const matchedUser = savedUsers[foundIndex];
    if (!matchedUser.passwordHash) {
        matchedUser.passwordHash = enteredHash;
        delete matchedUser.password;
        safeStorageSet('soulin_registered_users', JSON.stringify(savedUsers));
    }
    return matchedUser;
}

function verifyUserCredentials(usernameInput, passwordInput) {
    const cleanUser = String(usernameInput || '').trim();
    const cleanPass = String(passwordInput || '').trim();
    if (!cleanUser || !cleanPass) {
        return { ok: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
    }
    const enteredHash = hashSecret(cleanPass);
    const matchedUser = authenticateCustomer(cleanUser, cleanPass, enteredHash);
    if (!matchedUser) {
        const message = RESERVED_CUSTOMER_USERNAMES.includes(cleanUser.toLowerCase())
            ? 'บัญชีผู้ดูแลระบบกรุณาเข้าสู่ระบบผ่านหน้า /admin-login.html'
            : 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        return { ok: false, message };
    }
    return {
        ok: true,
        user: {
            username: matchedUser.username,
            role: 'user',
            name: matchedUser.fullname,
            phone: matchedUser.phone || '',
            defaultAddress: matchedUser.defaultAddress || ''
        }
    };
}

function validateCustomerRegistration(cleanName, cleanUser, cleanPass, cleanPhone) {
    if (!cleanName) return 'กรุณากรอกชื่อ-นามสกุล';
    if (cleanUser.length < 3) return 'ชื่อผู้ใช้งานต้องมีอย่างน้อย 3 ตัวอักษร';
    if (RESERVED_CUSTOMER_USERNAMES.includes(cleanUser.toLowerCase())) return 'ไม่สามารถใช้ชื่อผู้ใช้นี้ได้';
    if (cleanPass.length < 6) return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    if (cleanPhone && !/^[0-9]{9,10}$/.test(cleanPhone)) {
        return 'กรุณากรอกเบอร์โทรศัพท์ 9-10 หลักให้ถูกต้อง';
    }
    return '';
}

function registerCustomerAccount(profileInput) {
    const cleanName = String(profileInput.fullname || '').trim();
    const cleanUser = String(profileInput.username || '').trim();
    const cleanPass = String(profileInput.password || '').trim();
    const cleanPhone = String(profileInput.phone || '').replace(/[\s-]/g, '');

    const validationMsg = validateCustomerRegistration(cleanName, cleanUser, cleanPass, cleanPhone);
    if (validationMsg) return { ok: false, message: validationMsg };

    const savedUsers = safeJsonParse(localStorage.getItem('soulin_registered_users'), []);
    if (savedUsers.some(userRecord => userRecord.username === cleanUser)) {
        return { ok: false, message: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' };
    }

    const newCustomer = {
        fullname: cleanName,
        username: cleanUser,
        phone: cleanPhone,
        defaultAddress: '',
        passwordHash: hashSecret(cleanPass)
    };
    savedUsers.push(newCustomer);
    if (!safeStorageSet('soulin_registered_users', JSON.stringify(savedUsers))) {
        return { ok: false, message: 'ไม่สามารถบันทึกข้อมูลสมาชิกได้' };
    }
    return {
        ok: true,
        user: { username: cleanUser, role: 'user', name: cleanName, phone: cleanPhone, defaultAddress: '' }
    };
}

function togglePasswordVisibility(inputId, buttonEl) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    const isHidden = inputEl.type === 'password';
    inputEl.type = isHidden ? 'text' : 'password';
    if (!buttonEl) return;

    buttonEl.setAttribute('aria-label', isHidden ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
    const iconEl = buttonEl.querySelector('i');
    if (iconEl) {
        iconEl.classList.toggle('fa-eye', !isHidden);
        iconEl.classList.toggle('fa-eye-slash', isHidden);
    }
}

function evaluatePasswordStrength(rawPassword) {
    const text = String(rawPassword || '');
    if (!text) {
        return { score: 0, label: '', barClass: 'bg-slate-200', widthClass: 'w-0' };
    }
    if (text.length < 6) {
        return { score: 1, label: 'รหัสผ่านสั้นเกินไป (อย่างน้อย 6 ตัวอักษร)', barClass: 'bg-red-500', widthClass: 'w-1/3' };
    }
    const hasLetter = /[A-Za-zก-ฮ]/.test(text);
    const hasDigitOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>_\-+=]/.test(text);
    if (text.length >= 8 && hasLetter && hasDigitOrSymbol) {
        return { score: 3, label: 'ความปลอดภัยระดับสูง', barClass: 'bg-emerald-600', widthClass: 'w-full' };
    }
    return { score: 2, label: 'ความปลอดภัยระดับปานกลาง', barClass: 'bg-amber-500', widthClass: 'w-2/3' };
}

function validateProfileUpdates(cleanName, cleanPhone) {
    if (!cleanName) return 'กรุณากรอกชื่อ-นามสกุล';
    if (cleanPhone && !/^[0-9]{9,10}$/.test(cleanPhone)) {
        return 'กรุณากรอกเบอร์โทรศัพท์ 9-10 หลักให้ถูกต้อง';
    }
    return '';
}

function updateCustomerProfile(username, profileUpdates) {
    const cleanName = String(profileUpdates.fullname || '').trim();
    const cleanPhone = String(profileUpdates.phone || '').replace(/[\s-]/g, '');
    const cleanAddress = String(profileUpdates.defaultAddress || '').trim();
    const errMsg = validateProfileUpdates(cleanName, cleanPhone);
    if (errMsg) return { ok: false, message: errMsg };

    window.currentUser = {
        ...window.currentUser,
        name: cleanName,
        phone: cleanPhone,
        defaultAddress: cleanAddress
    };
    if (!safeStorageSet('soulin_user', JSON.stringify(window.currentUser))) {
        return { ok: false, message: 'ไม่สามารถบันทึกข้อมูลโปรไฟล์ได้' };
    }

    const savedUsers = safeJsonParse(localStorage.getItem('soulin_registered_users'), []);
    const userIdx = savedUsers.findIndex(userRecord => userRecord.username === username);
    if (userIdx !== -1) {
        savedUsers[userIdx].fullname = cleanName;
        savedUsers[userIdx].phone = cleanPhone;
        savedUsers[userIdx].defaultAddress = cleanAddress;
        safeStorageSet('soulin_registered_users', JSON.stringify(savedUsers));
    }
    return { ok: true, user: window.currentUser };
}

function changeCustomerPassword(username, currentPassword, nextPassword) {
    const isProtectedRole = window.currentUser && window.currentUser.role === 'admin';
    if (isProtectedRole || RESERVED_CUSTOMER_USERNAMES.includes(String(username || '').toLowerCase())) {
        return { ok: false, message: 'บัญชีผู้ดูแลระบบกรุณาเปลี่ยนรหัสผ่านผ่าน Supabase Auth' };
    }
    const cleanCurrent = String(currentPassword || '').trim();
    const cleanNext = String(nextPassword || '').trim();
    if (!cleanCurrent || cleanNext.length < 6) {
        return { ok: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' };
    }

    const savedUsers = safeJsonParse(localStorage.getItem('soulin_registered_users'), []);
    const userIdx = savedUsers.findIndex(userRecord => userRecord.username === username);
    if (userIdx === -1) {
        return { ok: false, message: 'ไม่พบข้อมูลบัญชีผู้ใช้ในระบบ' };
    }

    const matched = savedUsers[userIdx];
    if (matched.authProvider === 'google' && !matched.passwordHash) {
        return { ok: false, message: 'บัญชีนี้เชื่อมต่อผ่าน Google กรุณาจัดการรหัสผ่านที่บัญชี Google ของคุณ' };
    }
    const currentHash = hashSecret(cleanCurrent);
    const isCurrentValid = matched.passwordHash === currentHash || matched.password === cleanCurrent;
    if (!isCurrentValid) {
        return { ok: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' };
    }

    matched.passwordHash = hashSecret(cleanNext);
    delete matched.password;
    if (!safeStorageSet('soulin_registered_users', JSON.stringify(savedUsers))) {
        return { ok: false, message: 'ไม่สามารถบันทึกรหัสผ่านใหม่ได้' };
    }
    return { ok: true };
}

function matchesGoogleRecord(userRecord, cleanSub, cleanEmail) {
    if (cleanSub && userRecord.googleSub === cleanSub) return true;
    const savedEmail = String(userRecord.email || '').toLowerCase();
    const savedUser = String(userRecord.username || '').toLowerCase();
    return savedEmail === cleanEmail || savedUser === cleanEmail;
}

function buildGoogleSessionUser(record) {
    return {
        username: record.username,
        role: 'user',
        name: record.fullname,
        email: record.email || record.username,
        phone: record.phone || '',
        defaultAddress: record.defaultAddress || '',
        avatarUrl: record.avatarUrl || '',
        authProvider: record.authProvider || 'google'
    };
}

function createNewGoogleCustomer(savedUsers, cleanEmail, cleanName, cleanSub, cleanPic) {
    const created = {
        fullname: cleanName,
        username: cleanEmail,
        email: cleanEmail,
        googleSub: cleanSub,
        avatarUrl: cleanPic,
        phone: '',
        defaultAddress: '',
        authProvider: 'google'
    };
    savedUsers.push(created);
    if (!safeStorageSet('soulin_registered_users', JSON.stringify(savedUsers))) {
        return { ok: false, message: 'ไม่สามารถบันทึกบัญชี Google ได้' };
    }
    return { ok: true, isNewAccount: true, user: buildGoogleSessionUser(created) };
}

function updateExistingGoogleCustomer(savedUsers, existing, cleanEmail, cleanName, cleanSub, cleanPic) {
    existing.fullname = existing.fullname || cleanName;
    existing.email = cleanEmail;
    existing.googleSub = cleanSub || existing.googleSub || '';
    existing.avatarUrl = cleanPic || existing.avatarUrl || '';
    existing.authProvider = existing.authProvider || 'google';
    if (!safeStorageSet('soulin_registered_users', JSON.stringify(savedUsers))) {
        return { ok: false, message: 'ไม่สามารถอัปเดตบัญชี Google ได้' };
    }
    return { ok: true, isNewAccount: false, user: buildGoogleSessionUser(existing) };
}

function upsertGoogleCustomerAccount(googleProfile) {
    const profile = googleProfile || {};
    const cleanEmail = String(profile.email || '').trim().toLowerCase();
    const cleanName = String(profile.name || '').trim() || cleanEmail.split('@')[0];
    const cleanSub = String(profile.sub || '').trim();
    const cleanPic = sanitizeImageUrl(profile.picture || '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || !cleanName) {
        return { ok: false, message: 'ข้อมูลบัญชี Google ไม่ครบถ้วน' };
    }

    const savedUsers = safeJsonParse(localStorage.getItem('soulin_registered_users'), []);
    const foundIdx = savedUsers.findIndex(userRecord => matchesGoogleRecord(userRecord, cleanSub, cleanEmail));
    if (foundIdx === -1) {
        return createNewGoogleCustomer(savedUsers, cleanEmail, cleanName, cleanSub, cleanPic);
    }
    return updateExistingGoogleCustomer(savedUsers, savedUsers[foundIdx], cleanEmail, cleanName, cleanSub, cleanPic);
}

function handleLogin(submitEvent) {
    if (submitEvent) submitEvent.preventDefault();
    const usernameInput = document.getElementById('login-username').value;
    const passwordEl = document.getElementById('login-password');
    const authOutcome = verifyUserCredentials(usernameInput, passwordEl.value);

    if (!authOutcome.ok) {
        showToast(authOutcome.message, 'error');
        return;
    }

    window.currentUser = authOutcome.user;
    safeStorageSet('soulin_user', JSON.stringify(window.currentUser));
    passwordEl.value = '';
    renderAuthUI();
    closeAuthModal();

    if (authOutcome.user.role === 'admin') {
        showToast('เข้าสู่ระบบแอดมินสำเร็จ!', 'success');
        switchTab('admin');
        return;
    }
    showToast(`ยินดีต้อนรับคุณ ${authOutcome.user.name}`, 'success');
}

function handleSignUp(submitEvent) {
    if (submitEvent) submitEvent.preventDefault();
    const regOutcome = registerCustomerAccount({
        fullname: document.getElementById('signup-fullname').value,
        username: document.getElementById('signup-username').value,
        password: document.getElementById('signup-password').value,
        phone: ''
    });

    if (!regOutcome.ok) {
        showToast(regOutcome.message, 'error');
        return;
    }

    window.currentUser = regOutcome.user;
    safeStorageSet('soulin_user', JSON.stringify(window.currentUser));
    document.getElementById('signup-form').reset();
    renderAuthUI();
    closeAuthModal();
    showToast('ลงทะเบียนสมาชิกสำเร็จ!', 'success');
}

function logout() {
    if (typeof window.signOutSupabaseAuth === 'function') {
        window.signOutSupabaseAuth();
    }
    window.currentUser = null;
    localStorage.removeItem('soulin_user');
    renderAuthUI();
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
    switchTab('home');
}

function adminLogout() {
    if (window.currentUser && typeof recordAuditLog === 'function') {
        recordAuditLog({
            category: 'auth',
            action: 'ADMIN_LOGOUT',
            actor: window.currentUser.username,
            actorRole: window.currentUser.role || 'admin',
            targetId: window.currentUser.username,
            summary: `ผู้ดูแลระบบ "${window.currentUser.username}" ออกจากระบบจากหน้า Backoffice`,
            severity: 'info'
        });
    }
    if (typeof window.signOutSupabaseAuth === 'function') {
        window.signOutSupabaseAuth();
    }
    logout();
}

function buildAuthenticatedNavHtml(userSession, isAdmin) {
    const safeName = escapeHtml(userSession.name);
    const profileLabel = isAdmin ? 'โปรไฟล์ของฉัน' : safeName;
    const safeAvatar = sanitizeImageUrl(userSession.avatarUrl || '');
    const avatarBadge = safeAvatar
        ? `<img src="${escapeHtml(safeAvatar)}" alt="${safeName}" class="w-5 h-5 rounded-full object-cover border border-emerald-200">`
        : '<i class="fa-solid fa-circle-user text-soulin-primary"></i>';
    return `
        <div class="flex items-center space-x-2">
            <a href="./member.html" class="inline-flex items-center gap-1.5 text-xs font-semibold text-soulin-dark bg-soulin-mint/80 hover:bg-soulin-mint px-3 py-1.5 rounded-xl border border-emerald-200/70 transition-all">
                ${avatarBadge}
                <span class="hidden sm:inline">${profileLabel}</span>
                <span class="sm:hidden">บัญชี</span>
            </a>
            <button onclick="logout()" class="text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 font-medium transition-all">
                ออกจากระบบ
            </button>
        </div>
    `;
}

function renderAuthUI() {
    const container = document.getElementById('auth-button-container');
    const adminNav = document.getElementById('admin-nav-item');
    const adminMobileNav = document.getElementById('admin-mobile-nav');
    const isAdmin = Boolean(window.currentUser && window.currentUser.role === 'admin');

    if (adminNav) adminNav.classList.toggle('hidden', !isAdmin);
    if (adminMobileNav) adminMobileNav.classList.toggle('hidden', !isAdmin);
    if (!container) return;

    if (window.currentUser) {
        container.innerHTML = buildAuthenticatedNavHtml(window.currentUser, isAdmin);
        return;
    }

    container.innerHTML = `
        <a href="./login.html" class="bg-soulin-primary text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-soulin-dark transition-all inline-flex items-center">
            <i class="fa-solid fa-user mr-1.5"></i> เข้าสู่ระบบ
        </a>
    `;
}
