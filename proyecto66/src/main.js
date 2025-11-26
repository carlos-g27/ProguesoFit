import './style.css';

/* src/main.js
   App de seguimiento de ejercicios — todo renderizado desde JS en #app
   + Toggle de tema claro/oscuro (persistido en localStorage)
*/

(() => {
  const STORAGE_KEY = 'gym-tracker:v1';
  const THEME_KEY = 'gym-tracker:theme'; // 'light' | 'dark' | null(auto)'

  // ---------- Utilities ----------
  const qs = (sel, root = document) => root.querySelector(sel);
  const ce = (tag, attrs = {}, ...children) => {
    const el = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    children.flat().forEach(c => {
      if (c == null) return;
      if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    });
    return el;
  };
  const formatNumber = n => (Number.isFinite(n) ? +n : 0);

  // ---------- THEME ----------
  function applyTheme(theme) {
    // theme: 'light' | 'dark' | 'auto' (null or 'auto' => follow OS)
    const html = document.documentElement;
    if (theme === 'dark') {
      html.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      html.removeAttribute('data-theme');
      // ensure explicit light: set data-theme to light (clean)
      html.setAttribute('data-theme', 'light');
      // but our CSS only defines dark overrides — setting light keeps default variables
      html.removeAttribute('data-theme'); // remove to rely on :root (light)
    } else {
      // auto: try to match prefers-color-scheme
      html.removeAttribute('data-theme');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        html.setAttribute('data-theme', 'dark');
      } else {
        html.removeAttribute('data-theme');
      }
    }
  }

  function saveTheme(theme) {
    if (theme === 'auto' || theme == null) {
      localStorage.removeItem(THEME_KEY);
    } else {
      localStorage.setItem(THEME_KEY, theme);
    }
  }

  function loadTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return 'auto';
  }

  // React to OS preference changes if theme is 'auto'
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', e => {
      const current = loadTheme();
      if (current === 'auto') applyTheme('auto');
    });
  }

  // ---------- Storage ----------
  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error leyendo storage', e);
      return [];
    }
  }
  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  // ---------- Data model ----------
  let entries = loadEntries(); // { id, name, weight, reps, dateISO }

  // ---------- App rendering ----------
  const app = qs('#app');
  // (we don't force inline styles here — CSS handles layout now)

  // Header
  const headerLeft = ce('div', {},
    ce('h1', {}, 'Gym Tracker'),
    ce('p', {}, 'Registra tus ejercicios (nombre, peso y repeticiones). Todo se guarda localmente en el dispositivo.')
  );

  // Theme toggle UI
  const themeBtn = ce('button', { type: 'button', title: 'Cambiar tema' }, '🌓');
  const themeLabel = ce('div', { class: 'dot' }); // decorative dot (optional)
  const themeToggle = ce('div', { class: 'theme-toggle' }, themeBtn);

  // Put header as container with left + right
  const header = ce('header', { class: 'header' }, headerLeft, themeToggle);

  // Form
  const inputName = ce('input', { placeholder: 'Ej: Sentadillas', class: 'input-name', type: 'text' });
  const inputWeight = ce('input', { placeholder: 'Peso (kg)', type: 'number', min: '0', step: '0.5', class: 'input-weight' });
  const inputReps = ce('input', { placeholder: 'Reps', type: 'number', min: '1', step: '1', class: 'input-reps' });
  const addBtn = ce('button', { class: 'add' }, 'Agregar');

  const formRow = ce('div', { class: 'form-row' }, inputName, inputWeight, inputReps, addBtn);

  // Controls: export/import/clear
  const exportBtn = ce('button', {}, 'Exportar JSON');
  const importInput = ce('input', { type: 'file', accept: 'application/json', style: 'display:none' });
  const importBtn = ce('button', {}, 'Importar JSON');
  const clearBtn = ce('button', {}, 'Borrar todo');

  const controls = ce('div', { class: 'controls' }, exportBtn, importBtn, clearBtn, importInput);

  // Stats area
  const statsBox = ce('div', { class: 'stats-box' });

  // Entries container (list)
  const listContainer = ce('div', {});

  // Modal for edit (simple)
  const modalOverlay = ce('div', { class: 'modal-overlay' });
  const modalBox = ce('div', { class: 'modal-box' });
  modalOverlay.appendChild(modalBox);

  // Build main layout
  app.appendChild(header);
  app.appendChild(formRow);
  app.appendChild(controls);
  app.appendChild(statsBox);
  app.appendChild(listContainer);
  document.body.appendChild(modalOverlay);

  // ---------- Render functions ----------
  function renderStats() {
    const totalSessions = entries.length;
    const totalReps = entries.reduce((s, e) => s + (Number(e.reps) || 0), 0);
    const totalWeight = entries.reduce((s, e) => s + ((Number(e.weight) || 0) * (Number(e.reps) || 0)), 0);

    statsBox.innerHTML = '';
    const row = ce('div', { class: 'stats-row' },
      ce('div', {}, ce('strong', {}, 'Entrenamientos: '), ' ', totalSessions),
      ce('div', {}, ce('strong', {}, 'Repeticiones totales: '), ' ', totalReps),
      ce('div', {}, ce('strong', {}, 'Carga total (kg·reps): '), ' ', totalWeight.toFixed(1))
    );
    statsBox.appendChild(row);
  }

  function createListItem(entry) {
    const name = ce('div', { class: 'entry-name' }, entry.name);
    const meta = ce('div', { class: 'entry-meta' }, `${entry.weight} kg × ${entry.reps} reps`);
    const date = ce('div', { class: 'entry-date' }, new Date(entry.dateISO).toLocaleString());

    const editBtn = ce('button', {}, 'Editar');
    const delBtn = ce('button', {}, 'Eliminar');

    editBtn.addEventListener('click', () => openEditModal(entry.id));
    delBtn.addEventListener('click', () => {
      if (confirm('¿Eliminar este registro?')) {
        entries = entries.filter(e => e.id !== entry.id);
        saveEntries(entries);
        render();
      }
    });

    const left = ce('div', { class: 'entry-left' }, name, meta, date);
    const rightCol = ce('div', { class: 'entry-buttons' }, editBtn, delBtn);

    const item = ce('div', { class: 'entry-item' }, left, rightCol);
    return item;
  }

  function renderList() {
    listContainer.innerHTML = '';
    if (entries.length === 0) {
      listContainer.appendChild(ce('div', { class: 'list-empty' }, 'Aún no hay registros. Añade tu primer ejercicio.'));
      return;
    }
    const sorted = [...entries].sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));
    sorted.forEach(e => listContainer.appendChild(createListItem(e)));
  }

  function render() {
    renderStats();
    renderList();
  }

  // ---------- Form behavior ----------
  addBtn.addEventListener('click', () => {
    const name = inputName.value.trim();
    const weight = parseFloat(inputWeight.value);
    const reps = parseInt(inputReps.value);

    if (!name) {
      alert('Ingresa el nombre del ejercicio.');
      inputName.focus();
      return;
    }
    if (!Number.isFinite(weight) || weight < 0) {
      alert('Ingresa un peso válido (>= 0).');
      inputWeight.focus();
      return;
    }
    if (!Number.isFinite(reps) || reps < 1) {
      alert('Ingresa un número de repeticiones válido (>= 1).');
      inputReps.focus();
      return;
    }

    const newEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      name,
      weight: +weight,
      reps: +reps,
      dateISO: new Date().toISOString()
    };

    entries.push(newEntry);
    saveEntries(entries);
    inputName.value = '';
    inputWeight.value = '';
    inputReps.value = '';
    render();
  });

  [inputName, inputWeight, inputReps].forEach(el => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addBtn.click();
    });
  });

  // ---------- Export / Import / Clear ----------
  exportBtn.addEventListener('click', () => {
    const data = JSON.stringify(entries, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-tracker-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        alert('El JSON debe ser un arreglo de registros.');
        return;
      }
      const normalized = parsed.map(p => ({
        id: p.id || (Date.now().toString(36) + Math.random().toString(36).slice(2,6)),
        name: String(p.name || 'Ejercicio'),
        weight: formatNumber(p.weight || 0),
        reps: parseInt(p.reps) || 0,
        dateISO: p.dateISO || new Date().toISOString()
      }));
      if (confirm('¿Deseas reemplazar todos los registros actuales? "Aceptar" = reemplazar, "Cancelar" = unirlos')) {
        entries = normalized;
      } else {
        const existingIds = new Set(entries.map(e => e.id));
        entries = [...entries, ...normalized.filter(n => !existingIds.has(n.id))];
      }
      saveEntries(entries);
      render();
      importInput.value = '';
    } catch (err) {
      console.error(err);
      alert('Error al importar JSON: ' + err.message);
    }
  });

  clearBtn.addEventListener('click', () => {
    if (confirm('¿Borrar todos los registros? Esta acción no se puede deshacer.')) {
      entries = [];
      saveEntries(entries);
      render();
    }
  });

  // ---------- Edit modal ----------
  function openEditModal(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    modalBox.innerHTML = '';
    const title = ce('h3', { style: 'margin:0 0 8px 0' }, 'Editar registro');

    const mName = ce('input', { value: entry.name, style: 'width:100%; padding:8px; border-radius:6px; border:1px solid #ccc; margin-bottom:8px' });
    const mWeight = ce('input', { type: 'number', step: '0.5', value: entry.weight, style: 'width:100%; padding:8px; border-radius:6px; border:1px solid #ccc; margin-bottom:8px' });
    const mReps = ce('input', { type: 'number', value: entry.reps, style: 'width:100%; padding:8px; border-radius:6px; border:1px solid #ccc; margin-bottom:8px' });

    const save = ce('button', { style: 'padding:8px 12px; border-radius:6px; margin-right:8px; cursor:pointer' }, 'Guardar');
    const cancel = ce('button', { style: 'padding:8px 12px; border-radius:6px; cursor:pointer' }, 'Cancelar');

    save.addEventListener('click', () => {
      const name = mName.value.trim();
      const weight = parseFloat(mWeight.value);
      const reps = parseInt(mReps.value);
      if (!name) { alert('Nombre requerido'); return; }
      if (!Number.isFinite(weight) || weight < 0) { alert('Peso inválido'); return; }
      if (!Number.isFinite(reps) || reps < 1) { alert('Reps inválido'); return; }

      entry.name = name;
      entry.weight = +weight;
      entry.reps = +reps;
      saveEntries(entries);
      closeModal();
      render();
    });

    cancel.addEventListener('click', closeModal);

    modalBox.append(title, mName, mWeight, mReps, ce('div', { style: 'margin-top:10px; display:flex; justify-content:flex-end' }, save, cancel));
    modalOverlay.style.display = 'flex';
    mName.focus();
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
  }

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // ---------- THEME: initialize UI and handlers ----------
  function updateThemeButtonLabel(theme) {
    if (theme === 'dark') themeBtn.textContent = '🌙';
    else if (theme === 'light') themeBtn.textContent = '☀️';
    else themeBtn.textContent = '🌓';
  }

  // Click cycles: auto -> dark -> light -> auto ...
  themeBtn.addEventListener('click', () => {
    const current = loadTheme();
    let next;
    if (current === 'auto') next = 'dark';
    else if (current === 'dark') next = 'light';
    else next = 'auto';
    if (next === 'auto') {
      saveTheme(null);
      applyTheme('auto');
    } else {
      saveTheme(next);
      applyTheme(next);
    }
    updateThemeButtonLabel(next);
  });

  // Apply initial theme
  const initial = loadTheme();
  applyTheme(initial === 'auto' ? 'auto' : initial);
  updateThemeButtonLabel(initial);

  // ---------- Initial render ----------
  render();

  // Expose for debugging in console (opcional)
  window.__gymTracker = {
    entries,
    save: () => saveEntries(entries),
    load: () => { entries = loadEntries(); render(); }
  };

})();
