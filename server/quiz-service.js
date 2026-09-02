import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const idPattern = /^[0-9a-f-]{36}$/i;

const INITIAL_ORACLE_SQL_SEED = Object.freeze([
  ['데이터베이스에 저장된 데이터를 조회하는 명령어 분류는?', ['DQL'], 'oracle-sql-command-types-and-select'],
  ['데이터베이스에 데이터를 입력·수정·삭제하는 명령어 분류는?', ['DML'], 'oracle-sql-command-types-and-select'],
  ['데이터의 일관성을 유지하면서 확정·취소·저장점을 관리하는 명령어 분류는?', ['TCL'], 'oracle-sql-command-types-and-select'],
  ['데이터베이스의 보안성을 제어하고 사용자 권한을 관리하는 명령어 분류는?', ['DCL'], 'oracle-sql-command-types-and-select'],
  ['데이터베이스 객체를 생성·변경·삭제하는 명령어 분류는?', ['DDL'], 'oracle-sql-command-types-and-select'],
  ['데이터베이스에 저장된 데이터를 조회하는 SQL 문은?', ['SELECT'], 'oracle-sql-command-types-and-select'],
  ['SELECT 문에서 필요한 열을 추출하는 기능은?', ['Projection', '프로젝션'], 'oracle-sql-command-types-and-select'],
  ['SELECT 문에서 조건에 맞는 행을 추출하는 기능은?', ['Selection', '셀렉션'], 'oracle-sql-command-types-and-select'],
  ['서로 다른 테이블에서 관련된 행을 찾아 함께 조회하는 기능은?', ['Join', '조인'], 'oracle-sql-command-types-and-select'],
  ['Oracle에서 실제 테이블 데이터 없이 계산식이나 함수 결과를 조회할 때 사용하는 테이블은?', ['DUAL'], 'oracle-select-expressions'],
  ['사용할 수 없거나 할당되지 않았거나 알 수 없거나 적용할 수 없는 값 또는 결측치를 의미하는 것은?', ['NULL'], 'oracle-select-expressions'],
  ['Oracle에서 값이 NULL일 때 대신 사용할 값을 지정하는 함수는?', ['NVL', 'NVL()'], 'oracle-select-expressions'],
  ['열 이름과 열 별칭 사이에 선택적으로 사용할 수 있는 키워드는?', ['AS'], 'oracle-select-expressions'],
  ['SELECT 결과의 중복 행을 제거하는 대표 키워드는?', ['DISTINCT', 'UNIQUE'], 'oracle-select-expressions'],
  ['Oracle에서 열이나 문자열을 연결하는 두 개의 세로선 연산자는?', ['||'], 'oracle-select-expressions'],
  ['문자 패턴을 검색하는 연산자는?', ['LIKE'], 'oracle-like-and-escape'],
  ['LIKE 패턴에서 0개 이상의 문자를 의미하는 와일드카드는?', ['%'], 'oracle-like-and-escape'],
  ['LIKE 패턴에서 정확히 한 개의 문자를 의미하는 와일드카드는?', ['_'], 'oracle-like-and-escape'],
  ['LIKE에서 와일드카드 문자를 실제 문자로 검색하도록 이스케이프 문자를 지정하는 키워드는?', ['ESCAPE'], 'oracle-like-and-escape'],
  ['SELECT 문에서 조건을 만족하는 행만 조회하도록 조건을 작성하는 절은?', ['WHERE'], 'oracle-where-conditions'],
  ['SELECT 결과를 지정한 열을 기준으로 정렬하는 절은?', ['ORDER BY'], 'oracle-order-by'],
  ['ORDER BY에서 오름차순을 나타내며 생략할 수도 있는 키워드는?', ['ASC'], 'oracle-order-by'],
  ['ORDER BY에서 내림차순을 나타내는 키워드는?', ['DESC'], 'oracle-order-by'],
  ['문자열을 소문자로 변환하는 Oracle 함수는?', ['LOWER', 'LOWER()'], 'oracle-character-functions'],
  ['문자열을 대문자로 변환하는 Oracle 함수는?', ['UPPER', 'UPPER()'], 'oracle-character-functions'],
  ['첫 글자는 대문자, 나머지는 소문자로 변환하는 Oracle 함수는?', ['INITCAP', 'INITCAP()'], 'oracle-character-functions'],
  ['문자열의 바이트 수를 반환하는 Oracle 함수는?', ['LENGTHB', 'LENGTHB()'], 'oracle-character-functions'],
  ['문자열에서 찾는 문자열의 위치를 반환하는 Oracle 함수는?', ['INSTR', 'INSTR()'], 'oracle-character-functions'],
  ['문자열의 일부를 추출하는 Oracle 함수는?', ['SUBSTR', 'SUBSTR()'], 'oracle-character-functions'],
  ['CHAR와 VARCHAR2의 저장 가능 문자와 문자별 바이트 수에 영향을 주는 데이터베이스 문자 집합 설정은?', ['NLS_CHARACTERSET'], 'oracle-character-functions'],
]);

const ORACLE_SEED_V2 = Object.freeze([
  ['관계형 데이터베이스에서 데이터를 정의·조회·변경하고 권한과 트랜잭션을 제어하는 언어는?', ['SQL', 'Structured Query Language'], 'oracle-sql-command-types-and-select'],
  ['Oracle Database를 학습하거나 소규모 환경에서 사용할 수 있는 무료 버전은?', ['XE', 'Oracle Database XE', 'Express Edition'], 'oracle-xe-and-storage-architecture'],
  ['클라이언트 프로그램이 데이터베이스 서버에 직접 접속하는 환경은?', ['2-Tier', '2 Tier', '2티어'], 'oracle-xe-and-storage-architecture'],
  ['명령행에서 SQL과 SQL*Plus 명령을 실행하는 Oracle 도구는?', ['SQL*Plus', 'SQL Plus', 'SQLPLUS'], 'oracle-xe-and-storage-architecture'],
  ['Oracle에서 제공하는 그래픽 기반 데이터베이스 개발 도구는?', ['SQL Developer'], 'oracle-xe-and-storage-architecture'],
  ['Oracle의 논리적 저장 구조에서 관련된 논리적 저장 공간을 묶는 단위는?', ['Tablespace', '테이블스페이스'], 'oracle-xe-and-storage-architecture'],
  ['Oracle에서 테이블이나 인덱스 같은 객체가 사용하는 저장 공간은?', ['Segment', '세그먼트'], 'oracle-xe-and-storage-architecture'],
  ['Oracle의 논리적 저장 구조에서 연속된 Oracle Block의 묶음은?', ['Extent', '익스텐트'], 'oracle-xe-and-storage-architecture'],
  ['Oracle이 데이터를 읽고 쓰는 기본 단위는?', ['Oracle Block', '오라클 블록'], 'oracle-xe-and-storage-architecture'],
  ['Tablespace가 운영체제에 실제로 저장되는 물리적 파일은?', ['Data File', 'Datafile', '데이터 파일'], 'oracle-xe-and-storage-architecture'],
  ['운영체제가 파일을 읽고 쓰는 단위는?', ['OS Block', 'OS 블록'], 'oracle-xe-and-storage-architecture'],
  ['클라이언트의 접속 요청을 받아 Oracle Database 서비스로 연결하는 구성 요소는?', ['Listener', '리스너'], 'oracle-xe-and-storage-architecture'],
  ['Oracle Listener의 현재 상태를 확인하는 명령은?', ['lsnrctl status'], 'oracle-xe-and-storage-architecture'],
  ['중지된 Oracle Listener를 시작하는 명령은?', ['lsnrctl start'], 'oracle-xe-and-storage-architecture'],
  ['작은따옴표가 포함된 문자열을 읽기 쉽게 작성하는 Oracle의 대체 인용 연산자는?', ['q', 'q 연산자'], 'oracle-select-expressions'],
  ['행마다 조작하여 한 행의 필드값에서 하나의 결과를 반환하는 함수 분류는?', ['단일행 함수', 'Single Row Function', 'Single-Row Function'], 'oracle-character-functions'],
  ['여러 행에서 하나의 결과를 반환하는 함수 분류는?', ['여러행 함수', '여러 행 함수', '그룹 함수', 'Multiple Row Function', 'Group Function'], 'oracle-character-functions'],
  ['연결 연산자와 동일하게 두 문자열을 연결하는 Oracle 함수는?', ['CONCAT', 'CONCAT()'], 'oracle-character-functions'],
  ['문자열의 문자 수를 반환하는 Oracle 함수는?', ['LENGTH', 'LENGTH()'], 'oracle-character-functions'],
  ['전 세계 문자를 지원하고 한글이 3바이트를 사용하는 Oracle 유니코드 문자 집합은?', ['AL32UTF8'], 'oracle-character-functions'],
  ['한글 환경에서 사용하며 한글이 2바이트를 사용하는 Oracle 문자 집합은?', ['KO16MSWIN949'], 'oracle-character-functions'],
  ['데이터베이스에 설정된 NLS_CHARACTERSET을 확인할 수 있는 데이터 딕셔너리 뷰는?', ['NLS_DATABASE_PARAMETERS'], 'oracle-character-functions'],
  ['테이블의 구조와 컬럼 자료형을 확인하는 명령은?', ['DESC', 'DESCRIBE'], 'oracle-where-conditions'],
  ['세션에서 문자열과 날짜의 암시적 형변환에 영향을 주는 기본 날짜 표시 형식 설정은?', ['NLS_DATE_FORMAT'], 'oracle-where-conditions'],
  ['두 조건이 모두 참일 때 TRUE가 되는 논리 연산자는?', ['AND'], 'oracle-where-conditions'],
  ['두 조건 중 하나가 참일 때 TRUE가 되는 논리 연산자는?', ['OR'], 'oracle-where-conditions'],
  ['TRUE와 FALSE를 반대로 변경하는 논리 연산자는?', ['NOT'], 'oracle-where-conditions'],
  ['하한값 이상이고 상한값 이하인 범위를 검색하는 연산자는?', ['BETWEEN', 'BETWEEN AND'], 'oracle-where-conditions'],
  ['하한값과 상한값 사이의 범위에 속하지 않는 값을 검색하는 연산자는?', ['NOT BETWEEN', 'NOT BETWEEN AND'], 'oracle-where-conditions'],
  ['지정한 목록의 값 중 하나와 일치하는 값을 검색하는 연산자는?', ['IN'], 'oracle-where-conditions'],
  ['지정한 목록의 어느 값과도 일치하지 않는 행을 검색하는 연산자는?', ['NOT IN'], 'oracle-where-conditions'],
  ['NULL 값인지 확인할 때 등호 대신 사용하는 연산자는?', ['IS NULL'], 'oracle-where-conditions'],
  ['NULL 값이 아닌지 확인할 때 사용하는 연산자는?', ['IS NOT NULL'], 'oracle-where-conditions'],
  ['SELECT 절에 작성한 열의 순서를 숫자로 지정해 정렬하는 방법은?', ['위치 표기법', '위치표기법', 'Position Notation'], 'oracle-order-by'],
]);

const SEED_VERSION = 2;

function normalizeText(value, label, maxLength, required = false) {
  const text = String(value || '').trim();
  if (required && !text) throw new Error(`${label}을 입력하세요.`);
  if (text.length > maxLength || /\0/.test(text)) throw new Error(`${label}을 확인하세요.`);
  return text;
}

export function createQuizService(directory) {
  const quizDir = path.resolve(directory);
  const markerFile = path.join(quizDir, '.initialized');
  let initialization;

  const filePath = (id) => {
    if (!idPattern.test(id)) throw new Error('퀴즈 문제 주소를 확인하세요.');
    return path.join(quizDir, `${id}.json`);
  };

  const writeRecord = async (record) => {
    const temporaryFile = path.join(quizDir, `.${crypto.randomUUID()}.tmp`);
    await fs.writeFile(temporaryFile, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporaryFile, filePath(record.id));
    await fs.chmod(filePath(record.id), 0o600);
  };

  const initialize = async () => {
    await fs.mkdir(quizDir, { recursive: true, mode: 0o700 });
    await fs.chmod(quizDir, 0o700);
    let version = 0;
    try {
      const marker = await fs.readFile(markerFile, 'utf8');
      const match = marker.match(/^version:(\d+)$/m);
      version = match ? Number(match[1]) : 1;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (version >= SEED_VERSION) return;
    const existingPrompts = new Set();
    for (const name of await fs.readdir(quizDir)) {
      if (!/^[0-9a-f-]{36}\.json$/i.test(name)) continue;
      try {
        const record = JSON.parse(await fs.readFile(path.join(quizDir, name), 'utf8'));
        if (typeof record.prompt === 'string') existingPrompts.add(record.prompt);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
    const now = new Date().toISOString();
    const seeds = version === 0 ? [...INITIAL_ORACLE_SQL_SEED, ...ORACLE_SEED_V2] : ORACLE_SEED_V2;
    for (const [prompt, answers, relatedSlug] of seeds) {
      if (existingPrompts.has(prompt)) continue;
      await writeRecord({ id: crypto.randomUUID(), prompt, answers, category: 'Oracle', relatedSlug, active: true, createdAt: now, updatedAt: now });
    }
    await fs.writeFile(markerFile, `version:${SEED_VERSION}\nupdated:${now}\n`, { encoding: 'utf8', mode: 0o600 });
  };

  const ensureInitialized = () => {
    if (!initialization) initialization = initialize().catch((error) => {
      initialization = null;
      throw error;
    });
    return initialization;
  };

  const load = async (id) => {
    await ensureInitialized();
    if (!idPattern.test(id)) return null;
    try {
      const record = JSON.parse(await fs.readFile(filePath(id), 'utf8'));
      return record.id === id ? record : null;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  };

  const list = async () => {
    await ensureInitialized();
    const names = await fs.readdir(quizDir);
    const records = await Promise.all(names.filter((name) => /^[0-9a-f-]{36}\.json$/i.test(name)).map((name) => load(name.slice(0, -5))));
    return records.filter(Boolean).sort((a, b) => a.category.localeCompare(b.category, 'ko') || a.prompt.localeCompare(b.prompt, 'ko'));
  };

  const save = async (input, id = '') => {
    await ensureInitialized();
    const existing = id ? await load(id) : null;
    if (id && !existing) return null;
    const answers = String(input.answers || '').split(/\r?\n/).map((answer) => answer.trim()).filter(Boolean);
    if (!answers.length || answers.length > 10 || answers.some((answer) => answer.length > 100)) throw new Error('허용 정답을 한 줄에 하나씩 1~10개 입력하세요.');
    const now = new Date().toISOString();
    const record = {
      id: existing?.id || crypto.randomUUID(),
      prompt: normalizeText(input.prompt, '문제 설명', 500, true),
      answers: [...new Set(answers)],
      category: normalizeText(input.category, '카테고리', 40, true),
      relatedSlug: normalizeText(input.relatedSlug, '관련 글', 100),
      active: input.active === 'on',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await writeRecord(record);
    return record;
  };

  const remove = async (id) => fs.rm(filePath(id), { force: true });

  return { list, load, save, remove };
}
