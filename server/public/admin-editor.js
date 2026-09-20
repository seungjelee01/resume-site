async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Use the selection-based fallback below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('copy failed');
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy-markdown]');
  if (!button) return;
  const code = button.querySelector('code');
  const label = button.querySelector('[data-copy-label]');
  if (!code || !label) return;

  try {
    await copyText(code.textContent);
    label.textContent = '복사됨';
  } catch {
    label.textContent = '복사 실패';
  }

  window.setTimeout(() => { label.textContent = '복사'; }, 1600);
});
