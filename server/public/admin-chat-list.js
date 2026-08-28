const rooms = document.querySelector('[data-chat-rooms]');
const roomCount = document.querySelector('[data-chat-room-count]');

if (rooms && roomCount) {
  const formatDate = (value) => new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
  const updateCount = () => { roomCount.textContent = `${rooms.querySelectorAll('[data-chat-room]').length}개`; };
  const renderRoom = (room) => {
    let link = rooms.querySelector(`[data-chat-room="${CSS.escape(room.id)}"]`);
    if (!link) {
      link = document.createElement('a');
      link.className = 'admin-chat-room';
      link.dataset.chatRoom = room.id;
      link.href = `/admin/chats/${encodeURIComponent(room.id)}/`;
      link.append(document.createElement('div'), document.createElement('p'), document.createElement('small'));
    }
    const heading = link.firstElementChild;
    heading.replaceChildren();
    const name = document.createElement('strong');
    name.textContent = room.visitorLabel;
    heading.append(name);
    if (room.unread) {
      const unread = document.createElement('span');
      unread.className = 'admin-chat-unread';
      unread.textContent = room.unread;
      heading.append(unread);
    }
    const time = document.createElement('time');
    time.textContent = formatDate(room.updatedAt);
    heading.append(time);
    link.querySelector('p').textContent = room.preview;
    link.querySelector('small').textContent = room.ipMasked;
    link.classList.toggle('is-unread', Boolean(room.unread));
    rooms.querySelector('.private-empty')?.remove();
    rooms.prepend(link);
    updateCount();
  };
  const connect = () => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/admin/ws/chat-list`);
    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'room') renderRoom(payload.room);
      if (payload.type === 'room-deleted') {
        rooms.querySelector(`[data-chat-room="${CSS.escape(payload.id)}"]`)?.remove();
        updateCount();
      }
    });
    socket.addEventListener('close', () => setTimeout(connect, 2000));
  };
  connect();
}
