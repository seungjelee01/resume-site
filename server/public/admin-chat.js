const panel = document.querySelector('[data-admin-chat]');
const messages = document.querySelector('[data-admin-chat-messages]');
const status = document.querySelector('[data-admin-chat-status]');
const form = document.querySelector('[data-admin-chat-form]');
const input = document.querySelector('[data-admin-chat-input]');

if (panel && messages && status && form && input) {
  const conversationId = panel.dataset.conversationId;
  let socket;
  let reconnectTimer;
  const renderMessage = (message) => {
    if (messages.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`)) return;
    const item = document.createElement('li');
    item.dataset.messageId = message.id;
    item.className = `is-${message.sender}`;
    const sender = document.createElement('span');
    sender.textContent = message.sender === 'admin' ? '관리자' : `방문자 #${conversationId.slice(0, 4).toUpperCase()}`;
    const content = document.createElement('p');
    content.textContent = message.content;
    const time = document.createElement('time');
    time.textContent = new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt));
    item.append(sender, content, time);
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
      else if (payload.type === 'error') status.textContent = payload.message;
    });
    socket.addEventListener('close', () => { status.textContent = '연결이 끊겨 재연결 중입니다.'; reconnectTimer = setTimeout(connect, 2000); });
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content || socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'message', content }));
    input.value = '';
  });
  window.addEventListener('beforeunload', () => clearTimeout(reconnectTimer));
  connect();
}
