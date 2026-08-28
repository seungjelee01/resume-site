document.addEventListener('DOMContentLoaded', () => {
    initStudyTheme();
    initStudySidebar();
    initStudyTagFilter();
    initStudyChat();
});

function initStudyChat() {
    const panel = document.querySelector('[data-chat]');
    const openButton = document.querySelector('[data-chat-open]');
    const closeButton = document.querySelector('[data-chat-close]');
    const status = document.querySelector('[data-chat-status]');
    const messages = document.querySelector('[data-chat-messages]');
    const form = document.querySelector('[data-chat-form]');
    const input = document.querySelector('[data-chat-input]');
    if (!panel || !openButton || !closeButton || !status || !messages || !form || !input) return;
    let socket;
    let reconnectTimer;
    let initialized = false;

    const renderMessage = (message) => {
        if (messages.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`)) return;
        const item = document.createElement('li');
        item.dataset.messageId = message.id;
        item.className = message.sender === 'admin' ? 'is-admin' : 'is-visitor';
        const content = document.createElement('p');
        content.textContent = message.content;
        const time = document.createElement('time');
        time.textContent = new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt));
        item.append(content, time);
        messages.append(item);
        messages.scrollTop = messages.scrollHeight;
    };
    const connect = async () => {
        try {
            if (!initialized) {
                const response = await fetch('/study/chat/session/', { credentials: 'same-origin' });
                if (!response.ok) throw new Error('문의 세션을 만들 수 없습니다.');
                initialized = true;
            }
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            socket = new WebSocket(`${protocol}//${location.host}/study/ws/chat`);
            status.textContent = '연결 중';
            socket.addEventListener('open', () => { status.textContent = '온라인'; });
            socket.addEventListener('message', (event) => {
                const payload = JSON.parse(event.data);
                if (payload.type === 'ready') {
                    messages.replaceChildren();
                    payload.messages.forEach(renderMessage);
                } else if (payload.type === 'message') renderMessage(payload.message);
                else if (payload.type === 'error') status.textContent = payload.message;
            });
            socket.addEventListener('close', () => {
                status.textContent = '재연결 중';
                initialized = false;
                clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(connect, 2000);
            });
        } catch (error) { status.textContent = error.message; }
    };
    openButton.addEventListener('click', () => {
        panel.hidden = false;
        openButton.hidden = true;
        openButton.setAttribute('aria-expanded', 'true');
        if (!socket || socket.readyState > WebSocket.OPEN) connect();
        input.focus();
    });
    closeButton.addEventListener('click', () => { panel.hidden = true; openButton.hidden = false; openButton.setAttribute('aria-expanded', 'false'); openButton.focus(); });
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const content = input.value.trim();
        if (!content || socket?.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ type: 'message', content }));
        input.value = '';
    });
}

function initStudyTheme() {
    const dialog = document.querySelector('[data-study-settings]');
    const openButton = document.querySelector('[data-study-settings-open]');
    const themeSelect = document.querySelector('[data-study-theme]');
    if (!dialog || !openButton || !themeSelect) return;

    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const legacyTheme = localStorage.getItem('darkMode');
    const savedTheme = localStorage.getItem('study-theme')
        || (legacyTheme === null ? 'system' : legacyTheme === 'true' ? 'dark' : 'light');

    const applyTheme = (theme) => {
        const isDark = theme === 'dark' || (theme === 'system' && systemTheme.matches);
        document.body.classList.toggle('dark-mode', isDark);
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#151b20' : '#ffffff');
    };

    themeSelect.value = savedTheme;
    applyTheme(savedTheme);
    openButton.addEventListener('click', () => dialog.showModal());
    themeSelect.addEventListener('change', () => {
        localStorage.setItem('study-theme', themeSelect.value);
        localStorage.removeItem('darkMode');
        applyTheme(themeSelect.value);
    });
    systemTheme.addEventListener?.('change', () => {
        if (themeSelect.value === 'system') applyTheme('system');
    });
}

function initStudySidebar() {
    const sidebar = document.querySelector('[data-study-sidebar]');
    const openButton = document.querySelector('[data-sidebar-open]');
    const closeButton = document.querySelector('[data-sidebar-close]');
    const overlay = document.querySelector('[data-sidebar-overlay]');
    const mobileQuery = window.matchMedia('(max-width: 900px)');
    if (!sidebar || !openButton || !closeButton || !overlay) return;

    let wasOpenedBy = null;

    const getFocusableItems = () => Array.from(sidebar.querySelectorAll('a[href], button:not([disabled])'));
    const setDesktopState = () => {
        if (mobileQuery.matches) {
            const isOpen = document.body.classList.contains('drawer-open');
            sidebar.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
            sidebar.inert = !isOpen;
            return;
        }
        document.body.classList.remove('drawer-open');
        sidebar.setAttribute('aria-hidden', 'false');
        sidebar.inert = false;
        openButton.setAttribute('aria-expanded', 'false');
        overlay.hidden = true;
    };

    const openSidebar = () => {
        if (!mobileQuery.matches) return;
        wasOpenedBy = document.activeElement;
        document.body.classList.add('drawer-open');
        sidebar.setAttribute('aria-hidden', 'false');
        sidebar.inert = false;
        openButton.setAttribute('aria-expanded', 'true');
        overlay.hidden = false;
        closeButton.focus();
    };

    const closeSidebar = ({ restoreFocus = true } = {}) => {
        document.body.classList.remove('drawer-open');
        if (mobileQuery.matches) {
            sidebar.setAttribute('aria-hidden', 'true');
            sidebar.inert = true;
        }
        openButton.setAttribute('aria-expanded', 'false');
        overlay.hidden = true;
        if (restoreFocus && wasOpenedBy instanceof HTMLElement) wasOpenedBy.focus();
    };

    openButton.addEventListener('click', openSidebar);
    closeButton.addEventListener('click', () => closeSidebar());
    overlay.addEventListener('click', () => closeSidebar());
    sidebar.addEventListener('click', (event) => {
        if (mobileQuery.matches && event.target.closest('a')) closeSidebar({ restoreFocus: false });
    });

    document.addEventListener('keydown', (event) => {
        if (!document.body.classList.contains('drawer-open')) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeSidebar();
            return;
        }
        if (event.key !== 'Tab') return;

        const focusableItems = getFocusableItems();
        const first = focusableItems[0];
        const last = focusableItems[focusableItems.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', setDesktopState);
    } else {
        mobileQuery.addListener(setDesktopState);
    }
    setDesktopState();
}

function initStudyTagFilter() {
    const notes = Array.from(document.querySelectorAll('[data-study-note]'));
    const months = Array.from(document.querySelectorAll('[data-study-month]'));
    const status = document.querySelector('[data-filter-status]');
    const filterSummary = document.querySelector('[data-filter-summary]');
    const emptyMessage = document.querySelector('[data-empty-filter]');
    const sidebarTags = Array.from(document.querySelectorAll('[data-sidebar-tag]'));
    const sidebarCategories = Array.from(document.querySelectorAll('[data-sidebar-category]'));
    const searchForm = document.querySelector('[data-study-search-form]');
    const searchInput = document.querySelector('[data-study-search]');

    if (notes.length === 0) return;

    const applyFilter = () => {
        const params = new URLSearchParams(window.location.search);
        const activeCategory = params.get('category')?.trim() || '';
        const activeTag = activeCategory ? '' : params.get('tag')?.trim() || '';
        const searchTerm = params.get('q')?.trim() || '';
        const normalizedActiveCategory = activeCategory.toLocaleLowerCase('ko-KR');
        const normalizedActiveTag = activeTag.toLocaleLowerCase('ko-KR');
        const normalizedSearchTerm = searchTerm.toLocaleLowerCase('ko-KR');
        let visibleCount = 0;

        if (searchInput && searchInput.value !== searchTerm) searchInput.value = searchTerm;

        notes.forEach((note) => {
            const tags = (note.dataset.tags || '')
                .split('||')
                .map((tag) => tag.trim().toLocaleLowerCase('ko-KR'))
                .filter(Boolean);
            const category = (note.dataset.category || '').trim().toLocaleLowerCase('ko-KR');
            const matchesFilter = normalizedActiveCategory
                ? category === normalizedActiveCategory
                : !normalizedActiveTag || tags.includes(normalizedActiveTag);
            const searchableText = (note.dataset.search || '').toLocaleLowerCase('ko-KR');
            const visible = matchesFilter && (!normalizedSearchTerm || searchableText.includes(normalizedSearchTerm));
            note.hidden = !visible;
            if (visible) visibleCount += 1;
        });

        months.forEach((month) => {
            month.hidden = !month.querySelector('[data-study-note]:not([hidden])');
        });

        if (status && filterSummary) {
            const conditions = [];
            if (activeCategory) conditions.push(`${activeCategory} 카테고리`);
            else if (activeTag) conditions.push(`#${activeTag} 태그`);
            if (searchTerm) conditions.push(`“${searchTerm}” 검색`);
            status.hidden = conditions.length === 0;
            filterSummary.textContent = `${conditions.join(' · ')} 결과 ${visibleCount}개`;
        }
        if (emptyMessage) emptyMessage.hidden = visibleCount > 0;
        sidebarTags.forEach((link) => {
            const isActive = (link.dataset.sidebarTag || '').toLocaleLowerCase('ko-KR') === normalizedActiveTag;
            link.classList.toggle('is-active', Boolean(activeTag) && isActive);
            if (isActive && activeTag) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
        sidebarCategories.forEach((link) => {
            const isActive = (link.dataset.sidebarCategory || '').toLocaleLowerCase('ko-KR') === normalizedActiveCategory;
            link.classList.toggle('is-active', Boolean(activeCategory) && isActive);
            if (isActive && activeCategory) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
    };

    const updateSearch = () => {
        const params = new URLSearchParams(window.location.search);
        const searchTerm = searchInput?.value.trim() || '';
        if (searchTerm) params.set('q', searchTerm);
        else params.delete('q');
        const query = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
        applyFilter();
    };

    searchForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        updateSearch();
    });
    searchInput?.addEventListener('input', updateSearch);

    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href*="?tag="], a[href*="?category="]');
        if (!link || link.origin !== window.location.origin || link.pathname !== window.location.pathname) return;
        event.preventDefault();
        window.history.pushState({}, '', link.href);
        applyFilter();
    });
    window.addEventListener('popstate', applyFilter);
    applyFilter();
}
