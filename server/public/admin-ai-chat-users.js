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

function actionCell(user) {
  const element = document.createElement('td');
  const actions = document.createElement('div');
  actions.className = 'ai-user-actions';
  if (user.role === 'admin') {
    actions.textContent = '환경설정에서 관리';
    element.append(actions);
    return element;
  }
  for (const [status, label] of [['approved', '승인'], ['pending', '대기'], ['blocked', '중지']]) {
    if (user.status === status) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `button ai-user-action is-${status}`;
    button.textContent = label;
    button.addEventListener('click', async () => {
      if (status === 'blocked' && !window.confirm(`${user.name || user.email} 사용자의 AI Chat 이용을 중지할까요?`)) return;
      actions.querySelectorAll('button').forEach((item) => { item.disabled = true; });
      statusElement.textContent = `${user.name || user.email} 사용자의 상태를 변경하는 중입니다.`;
      try {
        const response = await fetch(`/admin/api/ai-chat/users/${encodeURIComponent(user.id)}/status`, {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: new URLSearchParams({ status }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || '사용자 상태를 변경하지 못했습니다.');
        await loadUsers();
      } catch (error) {
        showMessage(error instanceof Error ? error.message : '사용자 상태를 변경하지 못했습니다.');
      }
    });
    actions.append(button);
  }
  element.append(actions);
  return element;
}

async function loadUsers() {
  refreshButton.disabled = true;
  statusElement.textContent = '사용자 정보를 불러오는 중입니다.';
  emptyElement.hidden = true;
  try {
    const response = await fetch('/admin/api/ai-chat/users', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) {
      if (response.status === 403) return showMessage('Cloudflare Access 인증이 필요합니다.');
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
        actionCell(user),
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
