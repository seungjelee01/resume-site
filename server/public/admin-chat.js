const panel = document.querySelector('[data-admin-chat]');
const messages = document.querySelector('[data-admin-chat-messages]');
const status = document.querySelector('[data-admin-chat-status]');
const form = document.querySelector('[data-admin-chat-form]');
const input = document.querySelector('[data-admin-chat-input]');
const fileInput = document.querySelector('[data-admin-chat-file]');
const selectedFile = document.querySelector('[data-admin-chat-selected-file]');
const selectedFileName = document.querySelector('[data-admin-chat-selected-name]');
const selectedFileSize = document.querySelector('[data-admin-chat-selected-size]');
const clearFileButton = document.querySelector('[data-admin-chat-file-clear]');
const fileButtonLabel = document.querySelector('[data-admin-chat-file-label]');
const submitButton = document.querySelector('[data-admin-chat-submit]');

if (panel && messages && status && form && input && fileInput && selectedFile && selectedFileName && selectedFileSize && clearFileButton && fileButtonLabel && submitButton) {
  const conversationId = panel.dataset.conversationId;
  const visitorLabel = panel.dataset.visitorLabel || `방문자 #${conversationId.slice(0, 4).toUpperCase()}`;
  let socket;
  let reconnectTimer;
  const formatFileSize = (size) => size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
  const updateSelectedFile = () => {
    const file = fileInput.files[0];
    selectedFile.hidden = !file;
    selectedFileName.textContent = file?.name || '';
    selectedFileSize.textContent = file ? formatFileSize(file.size) : '';
    fileButtonLabel.textContent = file ? 'TXT 선택됨' : 'TXT 첨부';
    fileButtonLabel.closest('.admin-chat-file-button')?.classList.toggle('is-selected', Boolean(file));
  };
  const clearSelectedFile = () => {
    fileInput.value = '';
    updateSelectedFile();
  };
  const renderMessage = (message) => {
    if (messages.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`)) return;
    const item = document.createElement('li');
    item.dataset.messageId = message.id;
    item.className = `is-${message.sender}`;
    const sender = document.createElement('span');
    sender.textContent = message.sender === 'admin' ? '관리자' : visitorLabel;
    const content = message.attachment ? document.createElement('a') : document.createElement('p');
    if (message.attachment) {
      content.className = 'admin-chat-file';
      content.href = `/admin/chats/${encodeURIComponent(conversationId)}/files/${encodeURIComponent(message.id)}/`;
      content.download = message.attachment.name;
      const name = document.createElement('strong');
      name.textContent = message.attachment.name;
      const size = document.createElement('small');
      size.textContent = formatFileSize(message.attachment.size);
      const action = document.createElement('span');
      action.textContent = '다운로드';
      content.append(name, size, action);
    } else content.textContent = message.content;
    const time = document.createElement('time');
    time.textContent = new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt));
    item.append(sender, content, time);
    if (message.sender === 'admin' || message.attachment) {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'admin-chat-message-delete';
      deleteButton.dataset.deleteMessage = message.id;
      deleteButton.textContent = '삭제';
      deleteButton.setAttribute('aria-label', '이 메시지 삭제');
      item.append(deleteButton);
    }
    messages.append(item);
    messages.scrollTop = messages.scrollHeight;
  };
  const connect = () => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${location.host}/admin/ws/chat?conversation=${encodeURIComponent(conversationId)}`);
    socket.addEventListener('open', () => { status.textContent = '실시간 문의 서버에 연결되었습니다.'; });
    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'ready') {
        messages.replaceChildren();
        payload.messages.forEach(renderMessage);
      } else if (payload.type === 'message') renderMessage(payload.message);
      else if (payload.type === 'message-deleted') messages.querySelector(`[data-message-id="${CSS.escape(payload.messageId)}"]`)?.remove();
      else if (payload.type === 'error') status.textContent = payload.message;
    });
    socket.addEventListener('close', () => { status.textContent = '연결이 끊겨 재연결 중입니다.'; reconnectTimer = setTimeout(connect, 2000); });
  };
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    form.requestSubmit();
  });
  fileInput.addEventListener('change', () => {
    updateSelectedFile();
    if (fileInput.files[0]) status.textContent = `${fileInput.files[0].name} 파일이 첨부되었습니다. 전송 버튼을 눌러 보내세요.`;
  });
  clearFileButton.addEventListener('click', () => {
    clearSelectedFile();
    status.textContent = '첨부 파일 선택을 취소했습니다.';
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = fileInput.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.txt') || file.size > 2 * 1024 * 1024) {
        status.textContent = '2MB 이하의 .txt 파일만 전송할 수 있습니다.';
        return;
      }
      const data = new FormData();
      data.append('file', file);
      try {
        submitButton.disabled = true;
        fileInput.disabled = true;
        clearFileButton.disabled = true;
        selectedFile.classList.add('is-sending');
        status.textContent = '파일을 전송하는 중입니다.';
        const response = await fetch(`/admin/chats/${encodeURIComponent(conversationId)}/files`, { method: 'POST', body: data });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || '파일을 전송하지 못했습니다.');
        if (result.message) renderMessage(result.message);
        clearSelectedFile();
        status.textContent = '파일을 전송했습니다.';
      } catch (error) { status.textContent = error.message; }
      finally {
        submitButton.disabled = false;
        fileInput.disabled = false;
        clearFileButton.disabled = false;
        selectedFile.classList.remove('is-sending');
      }
      return;
    }
    const content = input.value.trim();
    if (!content || socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'message', content }));
    input.value = '';
  });
  messages.addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-message]');
    if (!button || socket?.readyState !== WebSocket.OPEN || !window.confirm('이 메시지와 첨부 파일을 삭제할까요?')) return;
    button.disabled = true;
    socket.send(JSON.stringify({ type: 'delete-message', messageId: button.dataset.deleteMessage }));
  });
  window.addEventListener('beforeunload', () => clearTimeout(reconnectTimer));
  connect();
}
