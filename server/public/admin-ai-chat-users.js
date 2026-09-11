const statusElement = document.querySelector('[data-ai-users-status]');
const tableElement = document.querySelector('[data-ai-users-table]');
const bodyElement = document.querySelector('[data-ai-users-body]');
const emptyElement = document.querySelector('[data-ai-users-empty]');
const refreshButton = document.querySelector('[data-ai-users-refresh]');

const statusLabels = { pending: '승인 대기', approved: '사용 가능', blocked: '사용 중지' };
const roleLabels = { admin: '관리자', user: '사용자' };

function showMessage(message) {
  statusElement.textContent = message;
  tableElement.hidden = true;
  emptyElement.hidden = false;
  emptyElement.textContent = message;
}

function cell(text) {
  const element = document.createElement('td');
  element.textContent = text;
  return element;
}

async function loadUsers() {
  refreshButton.disabled = true;
  statusElement.textContent = '사용자 정보를 불러오는 중입니다.';
  emptyElement.hidden = true;
  try {
    const response = await fetch('/ai-chat/api/admin/users', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) {
      if (response.status === 404) return showMessage('AI Chat 입장 인증이 필요합니다. 인증을 연 뒤 다시 시도해 주세요.');
      if (response.status === 401) return showMessage('AI Chat에서 Google 로그인이 필요합니다.');
      if (response.status === 403) return showMessage('승인된 AI Chat 관리자 계정으로 로그인해야 합니다.');
      throw new Error('사용자 정보를 불러오지 못했습니다.');
    }
    const data = await response.json();
    const users = Array.isArray(data.users) ? data.users : [];
    bodyElement.replaceChildren();
    for (const user of users) {
      const row = document.createElement('tr');
      row.append(
        cell(String(user.name || '—')),
        cell(String(user.email || '—')),
        cell(statusLabels[user.status] || '확인 불가'),
        cell(roleLabels[user.role] || '확인 불가'),
        cell(Number.isFinite(user.created_at) ? new Date(user.created_at).toLocaleString('ko-KR') : '—'),
        cell(`${Number.isSafeInteger(user.requests_today) ? user.requests_today : 0}회`),
      );
      bodyElement.append(row);
    }
    statusElement.textContent = `총 ${users.length}명의 사용자`;
    tableElement.hidden = !users.length;
    emptyElement.hidden = !!users.length;
    emptyElement.textContent = users.length ? '' : '등록된 사용자가 없습니다.';
  } catch (error) {
    showMessage(error instanceof Error ? error.message : '사용자 정보를 불러오지 못했습니다.');
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton?.addEventListener('click', loadUsers);
loadUsers();
