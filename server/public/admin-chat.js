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
  const maxFileSize = 5 * 1024 * 1024 * 1024;
  const formatFileSize = (size) => size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : size < 1024 * 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
  const updateSelectedFile = () => {
    const file = fileInput.files[0];
    selectedFile.hidden = !file;
    selectedFileName.textContent = file?.name || '';
    selectedFileSize.textContent = file ? formatFileSize(file.size) : '';
    fileButtonLabel.textContent = file ? '파일 선택됨' : '파일 첨부';
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
      const name = document.createElement('strong');
      name.textContent = message.attachment.name;
      const size = document.createElement('small');
      size.textContent = formatFileSize(message.attachment.size);
      content.append(name, size);
    } else content.textContent = message.content;
    const time = document.createElement('time');
    time.textContent = new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt));
    item.append(sender, content, time);
    if (message.sender === 'admin') {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'admin-chat-message-delete';
      deleteButton.dataset.deleteMessage = message.id;
      deleteButton.textContent = '삭제';
      deleteButton.setAttribute('aria-label', '이 관리자 메시지 삭제');
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
      if (!file.size || file.size > maxFileSize) {
        status.textContent = '5GB 이하의 파일만 전송할 수 있습니다.';
        return;
      }
      let uploadId = '';
      try {
        submitButton.disabled = true;
        fileInput.disabled = true;
        clearFileButton.disabled = true;
        selectedFile.classList.add('is-sending');
        status.textContent = '업로드를 준비하는 중입니다.';
        const initResponse = await fetch(`/admin/chats/${encodeURIComponent(conversationId)}/uploads`, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ name: file.name, size: String(file.size) }),
        });
        const init = await initResponse.json().catch(() => ({}));
        if (!initResponse.ok) throw new Error(init.error || '파일 업로드를 시작하지 못했습니다.');
        uploadId = init.uploadId;
        const chunkSize = init.chunkSize;
        let offset = init.received || 0;
        const startedAt = Date.now();
        while (offset < file.size) {
          const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
          let response;
          for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
              response = await fetch(`/admin/chats/${encodeURIComponent(conversationId)}/uploads/${encodeURIComponent(uploadId)}/chunks`, {
                method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Upload-Offset': String(offset) }, body: chunk,
              });
              if (response.ok || response.status < 500) break;
            } catch (error) {
              if (attempt === 3) throw error;
            }
          }
          const result = await response?.json().catch(() => ({}));
          if (!response?.ok) throw new Error(result?.error || '파일 조각을 전송하지 못했습니다.');
          offset = result.received;
          const percent = Math.floor(offset / file.size * 100);
          const elapsed = Math.max((Date.now() - startedAt) / 1000, 1);
          status.textContent = `${file.name} 업로드 중 · ${percent}% · ${formatFileSize(offset)} / ${formatFileSize(file.size)} · ${formatFileSize(offset / elapsed)}/s`;
        }
        const completeResponse = await fetch(`/admin/chats/${encodeURIComponent(conversationId)}/uploads/${encodeURIComponent(uploadId)}/complete`, { method: 'POST' });
        const complete = await completeResponse.json().catch(() => ({}));
        if (!completeResponse.ok) throw new Error(complete.error || '파일 전송을 완료하지 못했습니다.');
        if (complete.message) renderMessage(complete.message);
        clearSelectedFile();
        status.textContent = '파일을 전송했습니다.';
      } catch (error) {
        status.textContent = `${error.message} 같은 파일을 다시 선택해 재시도해 주세요.`;
        if (uploadId) fetch(`/admin/chats/${encodeURIComponent(conversationId)}/uploads/${encodeURIComponent(uploadId)}/cancel`, { method: 'POST', keepalive: true }).catch(() => {});
      } finally {
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
    if (!button || socket?.readyState !== WebSocket.OPEN || !window.confirm('이 답변을 삭제할까요?')) return;
    button.disabled = true;
    socket.send(JSON.stringify({ type: 'delete-message', messageId: button.dataset.deleteMessage }));
  });
  window.addEventListener('beforeunload', () => clearTimeout(reconnectTimer));
  connect();
}
