const storageKeys = {
  theme: 'admin-theme',
  language: 'admin-language',
};

const translations = {
  관리자: 'Administrator',
  대시보드: 'Dashboard',
  '비공개 파일 저장소': 'Private File Storage',
  'Tech Notes 보기': 'View Tech Notes',
  '이력서 보기': 'View Résumé',
  설정: 'Settings',
  테마: 'Theme',
  '시스템 설정': 'System',
  라이트: 'Light',
  다크: 'Dark',
  언어: 'Language',
  한국어: 'Korean',
  'Tech Notes 접근': 'Tech Notes Access',
  '공유 링크 필요': 'Share Link Required',
  공개: 'Public',
  '변경 즉시 새 요청부터 적용됩니다.': 'Changes apply to new requests immediately.',
  '공유 링크 모드를 사용하려면 서버에 STUDY_SHARE_TOKEN을 먼저 설정하세요.': 'Set STUDY_SHARE_TOKEN on the server before enabling share-link access.',
  완료: 'Done',
  계정: 'Account',
  로그아웃: 'Log Out',
  '서비스 정상': 'Service Healthy',
  '서버 상태': 'Server Status',
  '정상 작동 중': 'Running Normally',
  '메모리 사용량': 'Memory Usage',
  'Node.js RSS 기준': 'Based on Node.js RSS',
  '비공개 파일': 'Private Files',
  '글 관리 →': 'Manage Notes →',
  '파일 관리 →': 'Manage Files →',
  '실행 환경': 'Runtime Environment',
  환경: 'Environment',
  '프로세스 ID': 'Process ID',
  '글 목록': 'Post List',
  날짜: 'Date',
  제목: 'Title',
  카테고리: 'Category',
  태그: 'Tags',
  '쉼표로 구분': 'Comma separated',
  보기: 'View',
  '새 글 작성': 'New Post',
  파일명: 'Filename',
  크기: 'Size',
  수정일: 'Modified',
  다운로드: 'Download',
  삭제: 'Delete',
  '파일 선택': 'Choose Files',
  업로드: 'Upload',
  '저장된 파일이 없습니다.': 'No files are stored.',
  '글 수정': 'Edit Post',
  '주소용 슬러그': 'URL Slug',
  본문: 'Content',
  '첨부 파일': 'Attachments',
  저장: 'Save',
  취소: 'Cancel',
  '글 삭제': 'Delete Post',
  '파일 목록': 'File List',
};

const originalText = new WeakMap();

function initAdminSidebar() {
  const sidebar = document.querySelector('[data-admin-sidebar]');
  const openButton = document.querySelector('[data-admin-sidebar-open]');
  const closeButton = document.querySelector('[data-admin-sidebar-close]');
  const overlay = document.querySelector('[data-admin-sidebar-overlay]');
  const mobileQuery = window.matchMedia('(max-width: 760px)');
  if (!sidebar || !openButton || !closeButton || !overlay) return;

  let wasOpenedBy = null;
  const focusableItems = () => Array.from(sidebar.querySelectorAll('a[href], button:not([disabled])'));
  const closeSidebar = ({ restoreFocus = true } = {}) => {
    document.body.classList.remove('admin-drawer-open');
    if (mobileQuery.matches) {
      sidebar.setAttribute('aria-hidden', 'true');
      sidebar.inert = true;
    }
    openButton.setAttribute('aria-expanded', 'false');
    overlay.hidden = true;
    if (restoreFocus && wasOpenedBy instanceof HTMLElement) wasOpenedBy.focus();
  };
  const setResponsiveState = () => {
    if (mobileQuery.matches) return closeSidebar({ restoreFocus: false });
    document.body.classList.remove('admin-drawer-open');
    sidebar.setAttribute('aria-hidden', 'false');
    sidebar.inert = false;
    openButton.setAttribute('aria-expanded', 'false');
    overlay.hidden = true;
  };
  const openSidebar = () => {
    if (!mobileQuery.matches) return;
    wasOpenedBy = document.activeElement;
    document.body.classList.add('admin-drawer-open');
    sidebar.setAttribute('aria-hidden', 'false');
    sidebar.inert = false;
    openButton.setAttribute('aria-expanded', 'true');
    overlay.hidden = false;
    closeButton.focus();
  };

  openButton.addEventListener('click', openSidebar);
  closeButton.addEventListener('click', () => closeSidebar());
  overlay.addEventListener('click', () => closeSidebar());
  sidebar.addEventListener('click', (event) => {
    if (mobileQuery.matches && event.target.closest('a')) closeSidebar({ restoreFocus: false });
  });
  document.addEventListener('keydown', (event) => {
    if (!document.body.classList.contains('admin-drawer-open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSidebar();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusableItems();
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', setResponsiveState);
  } else {
    mobileQuery.addListener(setResponsiveState);
  }
  setResponsiveState();
}

function translatePage(language) {
  document.documentElement.lang = language;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA'].includes(node.parentElement?.tagName)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });
  let node;
  while ((node = walker.nextNode())) {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const source = originalText.get(node);
    const trimmed = source.trim();
    let translated = language === 'en' ? translations[trimmed] : null;
    if (language === 'en' && !translated && /^\d+개$/.test(trimmed)) translated = `${trimmed.slice(0, -1)} items`;
    if (language === 'en' && !translated && trimmed.startsWith('가동 시간 ')) {
      translated = `Uptime ${trimmed.slice(6).replace('일', 'd').replace('시간', 'h').replace('분', 'm')}`;
    }
    node.nodeValue = translated ? source.replace(trimmed, translated) : source;
  }
}

function applyTheme(theme) {
  if (theme === 'system') delete document.documentElement.dataset.adminTheme;
  else document.documentElement.dataset.adminTheme = theme;
}

const dialog = document.querySelector('[data-admin-settings]');
const themeSelect = document.querySelector('[data-admin-theme]');
const languageSelect = document.querySelector('[data-admin-language]');
const savedTheme = localStorage.getItem(storageKeys.theme) || 'system';
const savedLanguage = localStorage.getItem(storageKeys.language) || 'ko';

initAdminSidebar();
themeSelect.value = savedTheme;
languageSelect.value = savedLanguage;
applyTheme(savedTheme);
translatePage(savedLanguage);

document.querySelector('[data-admin-settings-open]')?.addEventListener('click', () => dialog.showModal());

themeSelect.addEventListener('change', () => {
  localStorage.setItem(storageKeys.theme, themeSelect.value);
  applyTheme(themeSelect.value);
});

languageSelect.addEventListener('change', () => {
  localStorage.setItem(storageKeys.language, languageSelect.value);
  translatePage(languageSelect.value);
});

document.querySelector('[data-admin-logout]')?.addEventListener('click', (event) => {
  const message = languageSelect.value === 'en'
    ? 'Log out of Cloudflare Access?'
    : 'Cloudflare Access에서 로그아웃할까요?';
  if (!window.confirm(message)) event.preventDefault();
});
