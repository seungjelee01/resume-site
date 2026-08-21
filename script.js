// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    reorderResumeSections();
    // 현재 날짜로 업데이트 날짜 설정
    updateLastUpdatedDate();

    // 인쇄 기능
    initPrintFunctionality();

    // 다크모드 토글 (선택사항)
    initDarkModeToggle();
    initSettingsPanel();

    // 우측 섹션 네비게이터
    initSectionNavigation();
});

function reorderResumeSections() {
    const main = document.querySelector('.container');
    if (!main) return;

    const footer = main.querySelector('.footer');
    ['profile', 'introduce', 'skills', 'experience', 'dba-projects', 'certification', 'training', 'education', 'etc']
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .forEach((section) => main.appendChild(section));

    if (footer) main.appendChild(footer);
}

function getActiveResumeUi() {
    return window.resumeConfig?.ui || {};
}

function updateResumeInteractionLabels(ui = getActiveResumeUi()) {
    const emailElement = document.getElementById('email');
    if (emailElement) emailElement.title = ui.emailCopyTitle || '';

    document.querySelectorAll('.experience-position').forEach((position) => {
        position.title = ui.positionToggleTitle || '';
    });

    const toggleButton = document.querySelector('[data-resume-theme-toggle]');
    if (toggleButton) {
        const isDark = document.body.classList.contains('dark-mode');
        toggleButton.setAttribute('aria-label', isDark ? ui.lightModeOn : ui.darkModeOn);
        toggleButton.title = isDark ? ui.lightModeOn : ui.darkModeOn;
    }
}

document.addEventListener('resume-language-change', (event) => {
    initEmailCopyInteraction();
    initSkillHoverEffects();
    initExperienceDetailToggles();
    updateResumeInteractionLabels(event.detail?.ui);
});

// 마지막 업데이트 날짜를 현재 날짜로 설정
function updateLastUpdatedDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const lastUpdatedElement = document.getElementById('last-updated-date');
    if (lastUpdatedElement) {
        lastUpdatedElement.textContent = `${year}. ${month}. ${day} (D+0)`;
    }
}

// 인쇄 기능 초기화
function initPrintFunctionality() {
    // Ctrl+P 또는 Cmd+P 키 이벤트 리스너
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            window.print();
        }
    });
}

// 다크모드 토글 기능 (선택사항)
function initDarkModeToggle() {
    const toggleButton = document.querySelector('[data-resume-theme-toggle]');
    if (!toggleButton) return;

    // 다크모드 상태 확인
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
    toggleButton.setAttribute('aria-checked', String(isDarkMode));
    updateResumeInteractionLabels();

    // 토글 버튼 클릭 이벤트
    toggleButton.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');

        toggleButton.setAttribute('aria-checked', String(isDark));
        localStorage.setItem('darkMode', isDark);
        updateResumeInteractionLabels();
    });

    // 다크모드 CSS 추가
    const darkModeCSS = `
        .dark-mode {
            background-color: #1a1a1a !important;
            color: #e0e0e0 !important;
        }

        .dark-mode .container {
            background-color: #1a1a1a;
        }

        .dark-mode .profile-info h1,
        .dark-mode .training-title,
        .dark-mode .dba-project-title,
        .dark-mode h2,
        .dark-mode .experience-company,
        .dark-mode .experience-position,
        .dark-mode .education-school,
        .dark-mode .certification-title,
        .dark-mode .etc-title {
            color: #e0e0e0 !important;
        }

        .dark-mode .skill-category h3,
        .dark-mode .training-meta,
        .dark-mode .dba-project-environment,
        .dark-mode .experience-date,
        .dark-mode .experience-period,
        .dark-mode .education-date,
        .dark-mode .certification-date,
        .dark-mode .etc-date,
        .dark-mode .skill-keywords-title {
            color: #74c9f5 !important;
        }

        .dark-mode .experience-description li {
            color: #cbd2d8 !important;
        }

        .dark-mode .experience-detail {
            border-left-color: #4b5963 !important;
        }

        .dark-mode .experience-item,
        .dark-mode .training-item,
        .dark-mode .dba-project-item,
        .dark-mode .education-item,
        .dark-mode .certification-item,
        .dark-mode .etc-item {
            background-color: #2d2d2d !important;
        }

        .dark-mode .experience-item,
        .dark-mode .dba-project-item,
        .dark-mode .training-item,
        .dark-mode .certification-item,
        .dark-mode .education-item,
        .dark-mode .etc-item { border-color: #46535c !important; }

        .dark-mode .skill-items span {
            background-color: #2d2d2d !important;
            color: #e0e0e0 !important;
            border-color: #555 !important;
        }

        .dark-mode .social-links a {
            border-color: #74c9f5 !important;
            color: #74c9f5 !important;
        }

        .dark-mode .profile-info .target-title {
            color: #74c9f5 !important;
        }

        .dark-mode .section-note {
            background-color: #25313a !important;
            border-left-color: #74c9f5 !important;
            color: #cbd2d8 !important;
        }

        .dark-mode .training-description,
        .dark-mode .training-topics,
        .dark-mode .dba-project-details {
            color: #cbd2d8 !important;
        }

        .dark-mode .social-links a:hover {
            background-color: #3498db !important;
            color: white !important;
        }

        .dark-mode .skill-keywords {
            background-color: #2d2d2d !important;
            color: #e0e0e0 !important;
        }

        .dark-mode .skill-keyword-tags span {
            background-color: #3a3a3a !important;
            border-color: #555 !important;
            color: #8fcff0 !important;
        }

        .dark-mode .section-nav {
            background-color: rgba(45, 45, 45, 0.94) !important;
        }

        .dark-mode .section-nav a {
            color: #aaa !important;
            border-color: #444 !important;
        }

        .dark-mode .section-nav a:hover,
        .dark-mode .section-nav a.active {
            background-color: #34495e !important;
            color: #8fcff0 !important;
        }
    `;

    const style = document.createElement('style');
    style.textContent = darkModeCSS;
    document.head.appendChild(style);
}

function initSettingsPanel() {
    const overlay = document.querySelector('[data-settings-overlay]');
    const openButton = document.querySelector('[data-settings-open]');
    const closeButton = document.querySelector('[data-settings-close]');
    const tabs = [...document.querySelectorAll('[data-settings-tab]')];
    const panes = [...document.querySelectorAll('[data-settings-pane]')];
    if (!overlay || !openButton || !closeButton) return;

    const translations = {
        ko: ['설정', '설정 열기', '설정 닫기', '설정 항목', '일반', '화면', '언어', '이력서에 표시할 언어를 선택합니다.', '테마', '편안한 화면 밝기를 선택합니다.', '다크 모드', '어두운 환경에 맞게 화면 색상을 조정합니다.'],
        en: ['Settings', 'Open settings', 'Close settings', 'Settings sections', 'General', 'Appearance', 'Language', 'Choose the language used on this resume.', 'Theme', 'Choose a comfortable display brightness.', 'Dark mode', 'Adjust the colors for darker environments.']
    };
    const selectors = ['#settings-title', null, null, null, '[data-settings-general]', '[data-settings-appearance]', '[data-settings-language-title]', '[data-settings-language-description]', '[data-settings-theme-title]', '[data-settings-theme-description]', '[data-settings-dark-title]', '[data-settings-dark-description]'];
    const updateLabels = () => {
        const copy = translations[document.documentElement.lang] || translations.ko;
        selectors.forEach((selector, index) => { if (selector) document.querySelector(selector).textContent = copy[index]; });
        openButton.setAttribute('aria-label', copy[1]);
        closeButton.setAttribute('aria-label', copy[2]);
        document.querySelector('.settings-sidebar').setAttribute('aria-label', copy[3]);
    };
    const close = () => {
        overlay.classList.remove('open');
        openButton.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('settings-open');
        window.setTimeout(() => { overlay.hidden = true; }, 180);
        openButton.focus();
    };
    openButton.addEventListener('click', () => {
        overlay.hidden = false;
        window.requestAnimationFrame(() => overlay.classList.add('open'));
        openButton.setAttribute('aria-expanded', 'true');
        document.body.classList.add('settings-open');
        closeButton.focus();
    });
    closeButton.addEventListener('click', close);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !overlay.hidden) close(); });
    tabs.forEach((tab) => tab.addEventListener('click', () => {
        tabs.forEach((item) => { const active = item === tab; item.classList.toggle('active', active); item.setAttribute('aria-selected', String(active)); });
        panes.forEach((pane) => { const active = pane.dataset.settingsPane === tab.dataset.settingsTab; pane.classList.toggle('active', active); pane.hidden = !active; });
    }));
    document.addEventListener('resume-language-change', updateLabels);
    updateLabels();
}

// 텍스트 복사 기능 (선택사항)
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function() {
        // 복사 성공 알림
        showNotification(getActiveResumeUi().copySuccess || 'Copied.');
    }).catch(function(err) {
        console.error('복사 실패:', err);
    });
}

// 알림 표시 함수
function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #27ae60;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 1001;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function initEmailCopyInteraction() {
    const emailElement = document.getElementById('email');
    if (!emailElement) return;

    emailElement.style.cursor = 'pointer';
    emailElement.title = getActiveResumeUi().emailCopyTitle || '';
    if (emailElement.dataset.copyBound === 'true') return;

    emailElement.dataset.copyBound = 'true';
    emailElement.addEventListener('click', function() {
        copyToClipboard(this.textContent);
    });
}

// 이메일 클릭 시 복사 기능 추가
document.addEventListener('DOMContentLoaded', initEmailCopyInteraction);

function initSkillHoverEffects() {
    const skillItems = document.querySelectorAll('.skill-items span');

    skillItems.forEach(item => {
        if (item.dataset.hoverBound === 'true') return;
        item.dataset.hoverBound = 'true';
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
            this.style.transition = 'transform 0.2s ease';
        });

        item.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
}

// 스킬 아이템에 호버 효과 추가
document.addEventListener('DOMContentLoaded', initSkillHoverEffects);

function initExperienceDetailToggles() {
    const experienceDetails = document.querySelectorAll('.experience-detail');

    experienceDetails.forEach(detail => {
        const description = detail.querySelector('.experience-description');
        const skillKeywords = detail.querySelector('.skill-keywords');

        if (description && skillKeywords) {
            // 초기에는 설명만 보이도록 설정
            skillKeywords.style.display = 'none';

            // 제목 클릭 시 스킬 키워드 토글
            const position = detail.querySelector('.experience-position');
            if (position) {
                position.style.cursor = 'pointer';
                position.title = getActiveResumeUi().positionToggleTitle || '';
                if (position.dataset.toggleBound === 'true') return;

                position.dataset.toggleBound = 'true';
                position.addEventListener('click', function() {
                    if (skillKeywords.style.display === 'none') {
                        skillKeywords.style.display = 'block';
                        skillKeywords.style.animation = 'fadeIn 0.3s ease';
                    } else {
                        skillKeywords.style.display = 'none';
                    }
                });
            }
        }
    });
}

// 경험 항목에 클릭 시 확장/축소 기능 (선택사항)
document.addEventListener('DOMContentLoaded', function() {
    initExperienceDetailToggles();

    // 페이드인 애니메이션 CSS 추가
    const fadeInCSS = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;

    const style = document.createElement('style');
    style.textContent = fadeInCSS;
    document.head.appendChild(style);
});

// 우측 네비게이터에서 현재 섹션 강조
function initSectionNavigation() {
    const nav = document.querySelector('.section-nav');
    if (!nav) return;

    const links = [...nav.querySelectorAll('a[href^="#"]')].filter((link) => !link.hidden);
    const sections = links
        .map((link) => document.querySelector(link.getAttribute('href')))
        .filter((section) => section && !section.hidden);

    if (!sections.length) return;

    let isTicking = false;

    const updateActiveSection = () => {
        const focusLine = window.innerHeight * 0.35;
        let activeSection = sections[0];

        sections.forEach((section) => {
            if (section.getBoundingClientRect().top <= focusLine) {
                activeSection = section;
            }
        });

        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
            activeSection = sections[sections.length - 1];
        }

        links.forEach((link) => {
            const isActive = link.getAttribute('href') === `#${activeSection.id}`;
            link.classList.toggle('active', isActive);
            if (isActive) {
                link.setAttribute('aria-current', 'true');
            } else {
                link.removeAttribute('aria-current');
            }
        });

        isTicking = false;
    };

    const requestUpdate = () => {
        if (!isTicking) {
            window.requestAnimationFrame(updateActiveSection);
            isTicking = true;
        }
    };

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    updateActiveSection();
}
