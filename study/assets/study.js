document.addEventListener('DOMContentLoaded', () => {
    initStudyTheme();
    initStudySidebar();
    initStudyTagFilter();
});

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
    if (notes.length === 0) return;

    const months = Array.from(document.querySelectorAll('[data-study-month]'));
    const status = document.querySelector('[data-filter-status]');
    const activeFilterLabel = document.querySelector('[data-active-filter]');
    const filterKindLabel = document.querySelector('[data-filter-kind]');
    const emptyMessage = document.querySelector('[data-empty-filter]');
    const sidebarTags = Array.from(document.querySelectorAll('[data-sidebar-tag]'));
    const sidebarCategories = Array.from(document.querySelectorAll('[data-sidebar-category]'));

    const applyFilter = () => {
        const params = new URLSearchParams(window.location.search);
        const activeCategory = params.get('category')?.trim() || '';
        const activeTag = activeCategory ? '' : params.get('tag')?.trim() || '';
        const normalizedActiveCategory = activeCategory.toLocaleLowerCase('ko-KR');
        const normalizedActiveTag = activeTag.toLocaleLowerCase('ko-KR');
        let visibleCount = 0;

        notes.forEach((note) => {
            const tags = (note.dataset.tags || '')
                .split('||')
                .map((tag) => tag.trim().toLocaleLowerCase('ko-KR'))
                .filter(Boolean);
            const category = (note.dataset.category || '').trim().toLocaleLowerCase('ko-KR');
            const visible = normalizedActiveCategory
                ? category === normalizedActiveCategory
                : !normalizedActiveTag || tags.includes(normalizedActiveTag);
            note.hidden = !visible;
            if (visible) visibleCount += 1;
        });

        months.forEach((month) => {
            month.hidden = !month.querySelector('[data-study-note]:not([hidden])');
        });

        if (status && activeFilterLabel && filterKindLabel) {
            status.hidden = !activeCategory && !activeTag;
            activeFilterLabel.textContent = activeCategory || activeTag;
            filterKindLabel.textContent = activeCategory ? '카테고리' : '태그';
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
