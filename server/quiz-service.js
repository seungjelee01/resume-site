import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const idPattern = /^[0-9a-f-]{36}$/i;

const ORACLE_SQL_SEED = Object.freeze([
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
    try {
      await fs.access(markerFile);
      return;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const now = new Date().toISOString();
    for (const [prompt, answers, relatedSlug] of ORACLE_SQL_SEED) {
      await writeRecord({ id: crypto.randomUUID(), prompt, answers, category: 'Oracle', relatedSlug, active: true, createdAt: now, updatedAt: now });
    }
    await fs.writeFile(markerFile, `${now}\n`, { encoding: 'utf8', mode: 0o600 });
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
