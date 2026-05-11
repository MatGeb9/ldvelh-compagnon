export const el = (id) => document.getElementById(id);

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function raw(htmlString) {
  return { __raw: true, value: htmlString };
}

// Tag function: escapes interpolated values by default.
// Pass raw(htmlString) to bypass escaping for trusted HTML fragments.
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    out += v && typeof v === 'object' && v.__raw ? v.value : escapeHtml(v);
    out += strings[i + 1];
  }
  return out;
}

// Lightweight modal replacement for window.alert / window.confirm.
// Both return Promises so callers can `await` them.
function ensureModalRoot() {
  let root = el('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    document.body.appendChild(root);
  }
  return root;
}

function showModal({ title, message, buttons }) {
  return new Promise(resolve => {
    const root = ensureModalRoot();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        ${title ? `<h3 class="modal-title">${escapeHtml(title)}</h3>` : ''}
        <p class="modal-message">${escapeHtml(message)}</p>
        <div class="modal-actions"></div>
      </div>
    `;
    const actions = overlay.querySelector('.modal-actions');
    buttons.forEach((b, i) => {
      const btn = document.createElement('button');
      btn.className = `btn ${b.class || ''}`;
      btn.textContent = b.label;
      btn.addEventListener('click', () => {
        overlay.remove();
        resolve(b.value);
      });
      actions.appendChild(btn);
      if (i === buttons.length - 1) requestAnimationFrame(() => btn.focus());
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(buttons[0].value);
      }
    });
    root.appendChild(overlay);
  });
}

export const modal = {
  alert(message, title = '') {
    return showModal({
      title,
      message,
      buttons: [{ label: 'OK', value: true, class: 'btn-primary' }],
    });
  },
  confirm(message, title = '') {
    return showModal({
      title,
      message,
      buttons: [
        { label: 'Annuler', value: false, class: 'btn-back' },
        { label: 'OK', value: true, class: 'btn-primary' },
      ],
    });
  },
  // Generic multi-choice modal — returns the chosen button's value (or first option's value if backdrop clicked)
  choice(message, buttons, title = '') {
    return showModal({ title, message, buttons });
  },
};
