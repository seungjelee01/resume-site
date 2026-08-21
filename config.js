// 이력서 설정 파일 - 여기서 모든 텍스트와 이미지를 쉽게 변경할 수 있습니다

const resumeConfigs = {
    ko: {
    ui: {
        language: "ko",
        documentTitle: "Seungje Lee",
        languageSelectorLabel: "이력서 언어 선택",
        sectionNavLabel: "이력서 섹션",
        profileImageAlt: "이승제 프로필 사진",
        contactNote: "이메일로 연락 부탁드립니다.",
        lastUpdated: "최종 수정",
        skillsNote: "현재 직접 사용한 기술을 기준으로 작성했으며, Oracle 운영 기술은 교육 수료 후 실제 실습 범위에 맞춰 추가합니다.",
        current: "재직 중",
        skillKeywords: "기술 키워드",
        emailCopyTitle: "클릭하여 이메일 복사",
        copySuccess: "이메일 주소를 복사했습니다.",
        positionToggleTitle: "클릭하여 기술 키워드 보기/숨기기",
        darkModeOn: "다크 모드 켜기",
        lightModeOn: "라이트 모드 켜기"
    },
    // 기본 정보
    profile: {
        name: "이승제",
        targetTitle: "Oracle 기반 데이터베이스 운영 역량을 준비하는 신입 DBA",
        email: "lsj0158@gmail.com",
        profileImage: "profile.png", // 프로필 이미지 파일명
        socialLinks: {
            github: "https://github.com/seungjelee01",
            study: "/study/",
        }
    },

    // 자기소개
    introduce: {
        content: `Amazon RDS for MySQL 기반 성적 관리 시스템의 데이터 구조와 백엔드 API를 설계했습니다. Smart Ring Mobile App과 관제센터 사이의 중계 서버에서는 MongoDB를 처리 기록 보관에 활용했습니다. 이 경험을 바탕으로 데이터베이스 운영을 전문 분야로 확장하고 있습니다.

Oracle DBA 교육과정에서 Database 구조, SQL·PL/SQL, 사용자·권한 관리, 백업·복구, 성능 분석과 장애 대응을 학습할 예정입니다. 실습 환경과 분석 과정, 확인한 결과는 이력서와 Tech Notes에 기록합니다.

Linux와 AWS 환경에서 백엔드 서비스를 배포·운영한 경험을 기반으로, 장애 원인을 분석하고 안정적인 데이터 서비스를 지원하는 DBA를 준비하고 있습니다.`
    },

    // 현재 직접 사용한 기술만 노출합니다. Oracle 교육 기술은 수료 후 실제 실습 범위에 맞춰 추가합니다.
    dbaCompetencies: {
        database: ["Amazon RDS for MySQL", "MongoDB", "데이터베이스 설계", "백엔드 API 연동"],
        databaseTools: ["DBeaver"],
        infrastructure: ["Amazon EC2 (Linux)", "Nginx", "Bunny CDN"],
        development: ["Python", "TypeScript", "JavaScript", "Node.js", "Nest.js", "Express.js", "Git"],
        additional: ["C#", "Unity"]
    },

    // Oracle 교육 수료 후 institution, period, hours와 실제 수행 항목을 업데이트합니다.
    training: [
        {
            period: "수강 예정 · 5개월",
            institution: "Oracle DBA 교육과정",
            status: "수강 예정",
            description: "교육기관과 세부 일정 확정 후 업데이트",
            topics: [
                "Oracle Database 구조와 SQL·PL/SQL",
                "사용자 및 권한 관리, 백업·복구",
                "실행계획 기반 성능 분석과 장애 대응"
            ]
        }
    ],

    // 수료 후 실제 결과만 추가합니다.
    // { title, environment, problem, analysis, action, result } 형식으로 작성합니다.
    dbaProjects: [],

    // 경력
    experience: {
        totalExperience: "총 0년 11개월",
        companies: [
            {
                name: "래빗홀컴퍼니 주식회사",
                period: "2024. 09 ~ 2025. 07",
                duration: "0년 11개월",
                isCurrent: false,
                positions: [
                    {
                        period: "2024. 09 ~ 2025. 07",
                        title: "VR Product: 깡총영어 / 개발 팀장",
                        description: [
                            "Amazon RDS for MySQL 기반 성적 관리 시스템의 데이터 구조와 백엔드 API 설계·구현",
                            "별도의 Amazon EC2 Linux 인스턴스에 깡총영어 백엔드 WAS를 배포·운영",
                            "WebRTC 모니터링 시스템의 안정성 개선 및 유지보수",
                            "VR 교육용 콘텐츠 개발, 최적화 및 유지보수",
                            "실시간 웹 소켓과 Google Cloud STT·TTS를 활용한 음성 피드백 시스템 구축"
                        ],
                        skills: "C# JavaScript Node.js Express.js Unity AWS EC2 RDS MySQL DBeaver Linux"
                    },
                    {
                        period: "2024. 11 ~ 2025. 02",
                        title: "VR Product: 마음평화 / 개발 팀장",
                        description: [
                            "마음평화와 Smart Ring의 Node.js WAS를 동일한 Amazon EC2 Linux 인스턴스에서 포트별로 구성",
                            "Nginx 리버스 프록시를 통해 서비스별 요청 라우팅, HTTP→HTTPS 리디렉션 및 TLS 인증서 처리 적용",
                            "기기별 접속 코드 기반 로그인 기능을 위한 Amazon RDS for MySQL 데이터 구조와 백엔드 API 설계·구현",
                            "Bunny CDN 기반 영상 파일 원격 다운로드 로직 구현",
                            "VR 360도 영상 콘텐츠와 Stereoscopic 3D 영상 처리 시스템 구축 및 유지보수"
                        ],
                        skills: "C# JavaScript Node.js Express.js Unity AWS EC2 RDS MySQL Bunny-CDN Nginx Linux"
                    },
                    {
                        period: "2025. 03 ~ 2025. 05",
                        title: "Smart Ring / 백엔드 개발자",
                        description: [
                            "Smart Ring Mobile App과 관제센터 사이의 생체 데이터 중계 서버 및 백엔드 API 설계·구현",
                            "사용자 식별정보와 주요 생체 데이터 필드를 애플리케이션 레벨에서 암호화해 관제센터 API로 전송",
                            "중계 데이터의 기록 보관을 위해 동일 EC2 인스턴스 내 MongoDB 연동"
                        ],
                        skills: "TypeScript Nest.js MongoDB Nginx Linux"
                    }
                ]
            }
        ]
    },

    // 학력
    education: [
        {
            period: "2018. 03 ~ 2024. 02",
            school: "건국대학교",
            major: "컴퓨터공학 학사 졸업"
        },
        {
            period: "2015. 03 ~ 2018. 02",
            school: "고색고등학교",
            major: "자연계 졸업 (경기도 수원시)"
        }
    ],

    // 자격증
    certifications: [
        {
            period: "2026. 06",
            title: "정보처리기사",
            issuer: "한국산업인력공단 발급"
        }
    ],

    // 기타 활동
    etc: [
        {
            period: "2023. 12 ~ 2024. 11",
            title: "G-STAR 2024 Indie Showcase 'The Cloud VR' 전시 및 Steam 출시",
            description: "Unity 기반 VR 힐링 인터랙티브 비주얼 노벨 개발 프로젝트"
        },
        {
            period: "2023. 09 ~ 2023. 11",
            title: "건국대학교 2023 SW경진대회 대상",
            description: "Unity 기반 VR 방탈출 공포 게임 개발 프로젝트"
        },
        {
            period: "2020. 05 ~ 2021. 11",
            title: "육군 병장 만기 전역",
            description: "통신병"
        }
    ]
    },
    en: {
        ui: {
            language: "en",
            documentTitle: "Seungje Lee",
            languageSelectorLabel: "Select resume language",
            sectionNavLabel: "Resume sections",
            profileImageAlt: "Profile photo of Seungje Lee",
            contactNote: "Please contact me by email.",
            lastUpdated: "Latest Updated",
            skillsNote: "This section lists technologies I have used directly. Oracle administration skills will be added after training based on the hands-on work completed.",
            current: "Current",
            skillKeywords: "Skill Keywords",
            emailCopyTitle: "Click to copy email address",
            copySuccess: "Email address copied.",
            positionToggleTitle: "Click to show or hide skill keywords",
            darkModeOn: "Enable dark mode",
            lightModeOn: "Enable light mode"
        },
        profile: {
            name: "Seungje Lee",
            targetTitle: "Entry-Level DBA Building Expertise in Oracle Database Operations",
            email: "lsj0158@gmail.com",
            profileImage: "profile.png",
            socialLinks: {
                github: "https://github.com/seungjelee01",
                study: "/study/"
            }
        },
        introduce: {
            content: `I designed the data model and backend APIs for a grade management system on Amazon RDS for MySQL. I also used MongoDB to retain processing records on an intermediary server between a Smart Ring mobile app and a monitoring center. These projects led me to expand my focus toward database operations.

My planned Oracle DBA training covers database architecture, SQL and PL/SQL, user and privilege management, backup and recovery, performance analysis, and incident response. I will document the environments, analysis steps, and verified results from hands-on work in this portfolio and Tech Notes.

With experience deploying and operating backend services on Linux and AWS, I am preparing to analyze incidents and support reliable data services as a DBA.`
        },
        dbaCompetencies: {
            database: ["Amazon RDS for MySQL", "MongoDB", "Database Design", "Backend API Integration"],
            databaseTools: ["DBeaver"],
            infrastructure: ["Amazon EC2 (Linux)", "Nginx", "Bunny CDN"],
            development: ["Python", "TypeScript", "JavaScript", "Node.js", "Nest.js", "Express.js", "Git"],
            additional: ["C#", "Unity"]
        },
        training: [
            {
                period: "Planned · 5 months",
                institution: "Oracle DBA Training Program",
                status: "Planned",
                description: "To be updated after the institution and detailed schedule are confirmed",
                topics: [
                    "Oracle Database architecture and SQL/PL/SQL",
                    "User and privilege management, backup and recovery",
                    "Execution plan-based performance analysis and incident response"
                ]
            }
        ],
        dbaProjects: [],
        experience: {
            totalExperience: "Total: 11 months",
            companies: [
                {
                    name: "Rabbithole Company Co., Ltd.",
                    period: "2024. 09 ~ 2025. 07",
                    duration: "11 months",
                    isCurrent: false,
                    positions: [
                        {
                            period: "2024. 09 ~ 2025. 07",
                            title: "VR Product: Kkangchong English / Development Lead",
                            description: [
                                "Designed and implemented the data model and backend APIs for a grade management system using Amazon RDS for MySQL",
                                "Deployed and operated the Kkangchong English backend service on a dedicated Amazon EC2 Linux instance",
                                "Improved the stability of and maintained a WebRTC monitoring system",
                                "Developed, optimized, and maintained VR educational content",
                                "Built a voice feedback system using real-time WebSocket communication and Google Cloud STT/TTS"
                            ],
                            skills: "C# JavaScript Node.js Express.js Unity AWS EC2 RDS MySQL DBeaver Linux"
                        },
                        {
                            period: "2024. 11 ~ 2025. 02",
                            title: "VR Product: Mind Peace / Development Lead",
                            description: [
                                "Hosted the Node.js backend services for Mind Peace and Smart Ring on the same Amazon EC2 Linux instance, separated by ports",
                                "Configured an Nginx reverse proxy for service routing, HTTP-to-HTTPS redirection, and TLS certificate handling",
                                "Designed and implemented the data model and backend APIs for device-specific access-code login using Amazon RDS for MySQL",
                                "Implemented remote video downloads through Bunny CDN",
                                "Built and maintained VR 360-degree content and a stereoscopic 3D video processing system"
                            ],
                            skills: "C# JavaScript Node.js Express.js Unity AWS EC2 RDS MySQL Bunny-CDN Nginx Linux"
                        },
                        {
                            period: "2025. 03 ~ 2025. 05",
                            title: "Smart Ring / Backend Developer",
                            description: [
                                "Designed and implemented an intermediary server and backend APIs for biometric data exchanged between the Smart Ring mobile app and the monitoring center",
                                "Encrypted user identifiers and key biometric data fields at the application layer before sending them to the monitoring center API",
                                "Integrated MongoDB on the same EC2 instance to retain intermediary processing records"
                            ],
                            skills: "TypeScript Nest.js MongoDB Nginx Linux"
                        }
                    ]
                }
            ]
        },
        education: [
            {
                period: "2018. 03 ~ 2024. 02",
                school: "Konkuk University",
                major: "B.S. in Computer Engineering"
            },
            {
                period: "2015. 03 ~ 2018. 02",
                school: "Gosaek High School",
                major: "Natural Sciences Track · Suwon, Gyeonggi-do"
            }
        ],
        certifications: [
            {
                period: "2026. 06",
                title: "Engineer Information Processing (정보처리기사)",
                issuer: "Issued by Human Resources Development Service of Korea (HRD Korea)"
            }
        ],
        etc: [
            {
                period: "2023. 12 ~ 2024. 11",
                title: "Exhibited 'The Cloud VR' at the G-STAR 2024 Indie Showcase and released it on Steam",
                description: "Unity-based, healing-themed interactive VR visual novel project"
            },
            {
                period: "2023. 09 ~ 2023. 11",
                title: "Grand Prize, 2023 Konkuk University Software Competition",
                description: "Unity-based VR escape-room horror game project"
            },
            {
                period: "2020. 05 ~ 2021. 11",
                title: "Completed mandatory military service as a Sergeant in the Republic of Korea Army",
                description: "Signal Corps"
            }
        ]
    }
};

const supportedResumeLanguages = ['ko', 'en'];

function readStoredResumeLanguage() {
    try {
        return localStorage.getItem('resumeLanguage');
    } catch {
        return null;
    }
}

function resolveResumeLanguage() {
    const queryLanguage = new URLSearchParams(window.location.search).get('lang');
    if (supportedResumeLanguages.includes(queryLanguage)) return queryLanguage;

    const storedLanguage = readStoredResumeLanguage();
    return supportedResumeLanguages.includes(storedLanguage) ? storedLanguage : 'ko';
}

let currentResumeLanguage = resolveResumeLanguage();
let resumeConfig = resumeConfigs[currentResumeLanguage];

function updateResumeLanguageUrl(language, historyMethod = 'replaceState') {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', language);
    window.history[historyMethod]({}, '', url);
}

function setResumeLanguage(language, { updateUrl = true, historyMethod = 'pushState' } = {}) {
    const nextLanguage = supportedResumeLanguages.includes(language) ? language : 'ko';
    currentResumeLanguage = nextLanguage;
    resumeConfig = resumeConfigs[nextLanguage];
    window.resumeConfig = resumeConfig;

    try {
        localStorage.setItem('resumeLanguage', nextLanguage);
    } catch {
        // 저장소를 사용할 수 없는 환경에서는 현재 세션에만 적용합니다.
    }

    if (updateUrl) updateResumeLanguageUrl(nextLanguage, historyMethod);
    applyConfig();
}

function initLanguageSwitcher() {
    document.querySelectorAll('[data-language]').forEach((button) => {
        button.addEventListener('click', () => setResumeLanguage(button.dataset.language));
    });

    window.addEventListener('popstate', () => {
        const language = new URLSearchParams(window.location.search).get('lang');
        setResumeLanguage(supportedResumeLanguages.includes(language) ? language : 'ko', { updateUrl: false });
    });

    try {
        localStorage.setItem('resumeLanguage', currentResumeLanguage);
    } catch {
        // 저장소를 사용할 수 없는 환경에서는 URL 값만 사용합니다.
    }
    updateResumeLanguageUrl(currentResumeLanguage, 'replaceState');
}

// 전역 노출 (디버깅 및 수동 재적용 용이)
// 일부 환경에서 const 전역 바인딩 접근성 이슈를 방지
try {
    window.resumeConfig = resumeConfig;
    window.resumeConfigs = resumeConfigs;
    window.setResumeLanguage = setResumeLanguage;
} catch (e) {
    // 무시
}

// 설정을 HTML에 적용하는 함수
function applyConfig() {
    console.log('[resume] applyConfig start', { readyState: document.readyState });
    const ui = resumeConfig.ui || resumeConfigs.ko.ui;
    document.documentElement.lang = ui.language;
    document.title = ui.documentTitle;
    document.querySelector('.language-switcher')?.setAttribute('aria-label', ui.languageSelectorLabel);
    document.querySelector('.section-nav')?.setAttribute('aria-label', ui.sectionNavLabel);

    document.querySelectorAll('[data-language]').forEach((button) => {
        const isActive = button.dataset.language === ui.language;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });

    // 프로필 정보 적용
    document.getElementById('name').textContent = resumeConfig.profile.name;
    document.getElementById('target-title').textContent = resumeConfig.profile.targetTitle;
    document.getElementById('email').textContent = resumeConfig.profile.email;
    document.getElementById('contact-note').textContent = ui.contactNote;
    document.getElementById('last-updated-label').textContent = ui.lastUpdated;
    document.getElementById('skills-note').textContent = ui.skillsNote;
    // 이미지 메타데이터 제거된 PNG 우선 사용
    const imgEl = document.getElementById('profile-img');
    if (imgEl) {
        // 설정값이 png가 아니라도, 동일 파일명이면 png를 우선 시도
        const configured = resumeConfig.profile.profileImage || 'profile.png';
        const pngFallback = 'profile.png';
        imgEl.alt = ui.profileImageAlt;
        imgEl.src = pngFallback;
        imgEl.onerror = function() {
            imgEl.src = configured;
        };
    }

    // 소셜 링크 적용
    // 현재 문서를 기준으로 안전한 웹 링크와 상대 경로만 적용
    const safeUrl = (url) => {
        try {
            const u = new URL(url, document.baseURI);
            return ['http:', 'https:'].includes(u.protocol) ? u.href : '#';
        } catch {
            return '#';
        }
    };

    document.getElementById('github-link').href = safeUrl(resumeConfig.profile.socialLinks.github || '#');
    document.getElementById('study-link').href = safeUrl(resumeConfig.profile.socialLinks.study || '#');

    // 자기소개 적용
    // 소개는 텍스트로 안전 렌더링
    const introduceRoot = document.getElementById('introduce-content');
    introduceRoot.textContent = '';
    const paragraphs = (resumeConfig.introduce.content || '').split('\n\n');
    introduceRoot.innerHTML = '';
    paragraphs.forEach((p) => {
        const el = document.createElement('p');
        el.textContent = p;
        introduceRoot.appendChild(el);
    });

    // DBA 직무 중심 역량 적용
    const renderSkillList = (id, skills) => {
        const root = document.getElementById(id);
        if (!root) return;
        root.textContent = '';
        (skills || []).forEach((skill) => {
            const tag = document.createElement('span');
            tag.textContent = skill;
            root.appendChild(tag);
        });
    };
    renderSkillList('database-skills', resumeConfig.dbaCompetencies.database);
    renderSkillList('database-tools', resumeConfig.dbaCompetencies.databaseTools);
    renderSkillList('infrastructure-skills', resumeConfig.dbaCompetencies.infrastructure);
    renderSkillList('development-skills', resumeConfig.dbaCompetencies.development);
    renderSkillList('additional-skills', resumeConfig.dbaCompetencies.additional);

    // 총 경력 적용
    document.getElementById('total-experience').textContent = resumeConfig.experience.totalExperience;
    console.log('[resume] applyConfig done');

    // 경력 섹션 동적 렌더링
    try {
        renderTraining();
        renderDbaProjects();
        renderExperience();
        renderEducation();
        renderCertifications();
        renderEtc();
    } catch (e) {
        console.error('renderExperience 실행 중 오류:', e);
    }

    document.dispatchEvent(new CustomEvent('resume-language-change', {
        detail: { language: ui.language, ui }
    }));
}

// DOM 상태에 따라 즉시 적용 또는 로드 후 적용
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initLanguageSwitcher();
        applyConfig();
    });
} else {
    // 이미 DOM이 준비된 상태면 즉시 적용
    try {
        initLanguageSwitcher();
        applyConfig();
    } catch (e) {
        console.error('applyConfig 실행 중 오류:', e);
    }
}

// 수동 호출을 위한 전역 노출
try {
    window.applyConfig = applyConfig;
} catch (e) {
    // 무시
}

function renderTraining() {
    const root = document.getElementById('training-list');
    if (!root) return;

    root.textContent = '';
    (resumeConfig.training || []).forEach((training) => {
        const item = document.createElement('article');
        item.className = 'training-item';

        const meta = document.createElement('div');
        meta.className = 'training-meta';
        meta.textContent = training.period || '';

        const title = document.createElement('h3');
        title.className = 'training-title';
        title.textContent = training.institution || '';

        if (training.status) {
            const status = document.createElement('span');
            status.className = 'training-status';
            status.textContent = training.status;
            title.appendChild(document.createTextNode(' '));
            title.appendChild(status);
        }

        const description = document.createElement('p');
        description.className = 'training-description';
        description.textContent = training.description || '';

        const topics = document.createElement('ul');
        topics.className = 'training-topics';
        (training.topics || []).forEach((topic) => {
            const li = document.createElement('li');
            li.textContent = topic;
            topics.appendChild(li);
        });

        item.appendChild(meta);
        item.appendChild(title);
        item.appendChild(description);
        item.appendChild(topics);
        root.appendChild(item);
    });
}

function renderDbaProjects() {
    const section = document.getElementById('dba-projects');
    const root = document.getElementById('dba-project-list');
    const navLink = document.getElementById('dba-projects-nav');
    if (!section || !root) return;

    const projects = resumeConfig.dbaProjects || [];
    section.hidden = projects.length === 0;
    if (navLink) navLink.hidden = projects.length === 0;
    root.textContent = '';

    projects.forEach((project) => {
        const item = document.createElement('article');
        item.className = 'dba-project-item';

        const title = document.createElement('h3');
        title.className = 'dba-project-title';
        title.textContent = project.title || '';

        const environment = document.createElement('div');
        environment.className = 'dba-project-environment';
        environment.textContent = project.environment || '';

        const details = document.createElement('ul');
        details.className = 'dba-project-details';
        ['problem', 'analysis', 'action', 'result'].forEach((key) => {
            if (!project[key]) return;
            const li = document.createElement('li');
            li.textContent = project[key];
            details.appendChild(li);
        });

        item.appendChild(title);
        item.appendChild(environment);
        item.appendChild(details);
        root.appendChild(item);
    });
}

// 경력 섹션을 resumeConfig 기준으로 재구성
function renderExperience() {
    const section = document.querySelector('.experience-section');
    if (!section) return;

    // h2는 유지하고 이후 콘텐츠를 재구성
    const heading = section.querySelector('h2');
    if (!heading) return;

    // 기존 항목 제거
    [...section.children].forEach((child) => {
        if (child !== heading) section.removeChild(child);
    });

    // 회사별 경험 아이템 생성
    resumeConfig.experience.companies.forEach((company) => {
        const item = document.createElement('div');
        item.className = 'experience-item';

        // 헤더
        const header = document.createElement('div');
        header.className = 'experience-header';

        const dateDiv = document.createElement('div');
        dateDiv.className = 'experience-date';
        dateDiv.textContent = company.period || '';

        const companyDiv = document.createElement('div');
        companyDiv.className = 'experience-company';
        companyDiv.textContent = company.name || '';
        if (company.isCurrent) {
            const current = document.createElement('span');
            current.className = 'current';
            current.textContent = resumeConfig.ui.current;
            companyDiv.appendChild(document.createTextNode(' '));
            companyDiv.appendChild(current);
        }
        if (company.duration) {
            const duration = document.createElement('span');
            duration.className = 'duration';
            duration.textContent = company.duration;
            companyDiv.appendChild(duration);
        }

        header.appendChild(dateDiv);
        header.appendChild(companyDiv);
        item.appendChild(header);

        // 포지션 상세
        (company.positions || []).forEach((pos) => {
            const detail = document.createElement('div');
            detail.className = 'experience-detail';

            const period = document.createElement('div');
            period.className = 'experience-period';
            period.textContent = pos.period || '';

            const position = document.createElement('div');
            position.className = 'experience-position';
            position.textContent = pos.title || '';

            const ul = document.createElement('ul');
            ul.className = 'experience-description';
            (pos.description || []).forEach((line) => {
                const li = document.createElement('li');
                li.textContent = line;
                ul.appendChild(li);
            });

            const skills = document.createElement('div');
            skills.className = 'skill-keywords';
            const strong = document.createElement('strong');
            strong.className = 'skill-keywords-title';
            strong.textContent = resumeConfig.ui.skillKeywords;
            skills.appendChild(strong);

            const skillTags = document.createElement('div');
            skillTags.className = 'skill-keyword-tags';
            (pos.skills || '').split(/\s+/).filter(Boolean).forEach((skill) => {
                const tag = document.createElement('span');
                tag.textContent = skill;
                skillTags.appendChild(tag);
            });
            skills.appendChild(skillTags);

            detail.appendChild(period);
            detail.appendChild(position);
            detail.appendChild(ul);
            detail.appendChild(skills);
            item.appendChild(detail);
        });

        section.appendChild(item);
    });
}

function renderEducation() {
    const root = document.getElementById('education-list');
    if (!root) return;

    root.textContent = '';
    (resumeConfig.education || []).forEach((education) => {
        const item = document.createElement('div');
        item.className = 'education-item';

        const date = document.createElement('div');
        date.className = 'education-date';
        date.textContent = education.period || '';

        const school = document.createElement('div');
        school.className = 'education-school';
        school.textContent = education.school || '';

        const major = document.createElement('div');
        major.className = 'education-major';
        major.textContent = education.major || '';

        item.appendChild(date);
        item.appendChild(school);
        item.appendChild(major);
        root.appendChild(item);
    });
}

function renderCertifications() {
    const root = document.getElementById('certification-list');
    if (!root) return;

    root.textContent = '';
    (resumeConfig.certifications || []).forEach((certification) => {
        const item = document.createElement('div');
        item.className = 'certification-item';

        const date = document.createElement('div');
        date.className = 'certification-date';
        date.textContent = certification.period || '';

        const title = document.createElement('div');
        title.className = 'certification-title';
        title.textContent = certification.title || '';

        const issuer = document.createElement('div');
        issuer.className = 'certification-issuer';
        issuer.textContent = certification.issuer || '';

        item.appendChild(date);
        item.appendChild(title);
        item.appendChild(issuer);
        root.appendChild(item);
    });
}

function renderEtc() {
    const root = document.getElementById('etc-list');
    if (!root) return;

    root.textContent = '';
    (resumeConfig.etc || []).forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'etc-item';

        const date = document.createElement('div');
        date.className = 'etc-date';
        date.textContent = entry.period || '';

        const title = document.createElement('div');
        title.className = 'etc-title';
        title.textContent = entry.title || '';

        const description = document.createElement('div');
        description.className = 'etc-description';
        description.textContent = entry.description || '';

        item.appendChild(date);
        item.appendChild(title);
        item.appendChild(description);
        root.appendChild(item);
    });
}
