function showToast(messageText, toastType = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgColors = {
        success: 'bg-emerald-800 text-white',
        error: 'bg-red-700 text-white',
        info: 'bg-slate-800 text-white'
    };
    const iconMap = {
        success: 'fa-circle-check',
        error: 'fa-circle-exclamation',
        info: 'fa-circle-info'
    };

    toast.className = `${bgColors[toastType] || bgColors.info} px-5 py-3 rounded-2xl shadow-xl text-xs font-semibold tracking-wide pointer-events-auto transform transition-all duration-300 opacity-0 translate-y-2 flex items-center gap-2`;
    const iconEl = document.createElement('i');
    iconEl.className = `fa-solid ${iconMap[toastType] || iconMap.info}`;
    const textEl = document.createElement('span');
    textEl.textContent = String(messageText ?? '');
    toast.appendChild(iconEl);
    toast.appendChild(textEl);

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
