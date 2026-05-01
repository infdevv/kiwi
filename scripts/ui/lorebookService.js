/**
 * Lorebook Service - Manages world info / lorebook entries that are
 * injected into the system prompt when their keywords appear in chat.
 *
 * Supported import formats:
 *   - Kiwi native  : { name, description, entries: [{keys, content, enabled, constant, priority, comment}] }
 *   - SillyTavern  : { entries: { "0": { key: [...], content, enabled, constant, insertion_order } } }
 *   - Generic array: { entries: [{key, content, ...}] }   (key may be string or array)
 */

import { ToastService } from './toastService.js';

const LorebookService = {
  /** @type {Array<{name:string, description:string, entries:Array}>} */
  lorebooks: [],

  /** @type {{name:string, description:string, entries:Array}|null} */
  activeLorebook: null,

  /** Index of active lorebook in this.lorebooks, or -1 */
  activeIndex: -1,

  /** Index of lorebook currently open in the editor, or -1 */
  _editingIndex: -1,

  init() {
    try {
      const saved = localStorage.getItem('kiwi_lorebooks');
      this.lorebooks = saved ? JSON.parse(saved) : [];
    } catch {
      this.lorebooks = [];
    }

    const activeIdx = localStorage.getItem('kiwi_active_lorebook');
    if (activeIdx !== null) {
      const idx = parseInt(activeIdx, 10);
      if (idx >= 0 && idx < this.lorebooks.length) {
        this.activeLorebook = this.lorebooks[idx];
        this.activeIndex = idx;
      }
    }

    this._renderUI();
  },

  _save() {
    localStorage.setItem('kiwi_lorebooks', JSON.stringify(this.lorebooks));
  },

  _parse(json) {
    if (!json || typeof json !== 'object') throw new Error('Invalid lorebook file');

    const name = json.name || json.title || 'Unnamed Lorebook';
    const description = json.description || '';
    let entries = [];

    if (Array.isArray(json.entries)) {
      entries = json.entries.map((e, i) => this._normaliseEntry(e, i));
    } else if (json.entries && typeof json.entries === 'object') {
      entries = Object.values(json.entries).map((e, i) => this._normaliseEntry(e, i));
    } else {
      throw new Error('No entries found in lorebook');
    }

    return { name, description, entries };
  },

  _normaliseEntry(e, fallbackUid) {
    let keys = [];
    if (Array.isArray(e.keys)) keys = e.keys;
    else if (Array.isArray(e.key)) keys = e.key;
    else if (typeof e.key === 'string') keys = e.key.split(',').map(k => k.trim()).filter(Boolean);
    else if (typeof e.keys === 'string') keys = e.keys.split(',').map(k => k.trim()).filter(Boolean);

    return {
      id: e.uid ?? e.id ?? fallbackUid,
      name: e.comment || e.name || `Entry ${fallbackUid + 1}`,
      keys,
      content: e.content || '',
      enabled: e.enabled !== false,
      constant: e.constant || false,
      priority: e.insertion_order ?? e.priority ?? 100,
    };
  },

  _newEntry(index) {
    return {
      id: Date.now() + index,
      name: `Entry ${index + 1}`,
      keys: [],
      content: '',
      enabled: true,
      constant: false,
      priority: 100,
    };
  },

  // ── Lorebook CRUD ─────────────────────────────────────────────────────────

  addLorebook(json) {
    const lorebook = this._parse(json);
    this.lorebooks.push(lorebook);
    this._save();
    this._renderUI();
    return this.lorebooks.length - 1;
  },

  createLorebook(name = 'New Lorebook') {
    const lorebook = { name, description: '', entries: [] };
    this.lorebooks.push(lorebook);
    this._save();
    this._renderUI();
    return this.lorebooks.length - 1;
  },

  removeLorebook(index) {
    if (index < 0 || index >= this.lorebooks.length) return;
    this.lorebooks.splice(index, 1);
    if (this.activeIndex === index) {
      this.activeLorebook = null;
      this.activeIndex = -1;
      localStorage.removeItem('kiwi_active_lorebook');
    } else if (this.activeIndex > index) {
      this.activeIndex--;
      localStorage.setItem('kiwi_active_lorebook', this.activeIndex);
    }
    this._save();
    this._renderUI();
  },

  setActiveLorebook(index) {
    if (index === -1 || index === null) {
      this.activeLorebook = null;
      this.activeIndex = -1;
      localStorage.removeItem('kiwi_active_lorebook');
    } else {
      this.activeLorebook = this.lorebooks[index] || null;
      this.activeIndex = index;
      if (this.activeLorebook) {
        localStorage.setItem('kiwi_active_lorebook', index);
      }
    }
    this._renderUI();
  },

  exportLorebook(index) {
    const lb = this.lorebooks[index];
    if (!lb) return;
    const blob = new Blob([JSON.stringify(lb, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lb.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── Entry CRUD ────────────────────────────────────────────────────────────

  addEntry(lorebookIndex) {
    const lb = this.lorebooks[lorebookIndex];
    if (!lb) return;
    const entry = this._newEntry(lb.entries.length);
    lb.entries.push(entry);
    this._save();
    return lb.entries.length - 1;
  },

  removeEntry(lorebookIndex, entryIndex) {
    const lb = this.lorebooks[lorebookIndex];
    if (!lb) return;
    lb.entries.splice(entryIndex, 1);
    this._save();
  },

  // ── Injection ─────────────────────────────────────────────────────────────

  getActiveEntries(messages) {
    if (!this.activeLorebook) return [];

    const enabled = this.activeLorebook.entries.filter(e => e.enabled);

    const recentText = messages
      .filter(m => m.role !== 'system')
      .slice(-15)
      .map(m => m.content || '')
      .join('\n')
      .toLowerCase();

    const matched = enabled.filter(entry => {
      if (entry.constant) return true;
      return entry.keys.some(kw => kw && recentText.includes(kw.toLowerCase()));
    });

    matched.sort((a, b) => a.priority - b.priority);
    return matched;
  },

  buildLorebookPrompt(messages) {
    const entries = this.getActiveEntries(messages);
    if (entries.length === 0) return '';
    const parts = entries.map(e => e.content.trim()).filter(Boolean);
    if (parts.length === 0) return '';
    return '[World Info:\n' + parts.join('\n---\n') + '\n]';
  },

  // ── Sidebar UI ────────────────────────────────────────────────────────────

  _renderUI() {
    const list = document.getElementById('lorebookList');
    if (!list) return;
    list.innerHTML = '';

    if (this.lorebooks.length === 0) {
      list.innerHTML = '<p style="color:#888;font-size:0.85rem;padding:8px 0;">No lorebooks loaded.</p>';
    } else {
      this.lorebooks.forEach((lb, idx) => {
        const isActive = idx === this.activeIndex;
        const item = document.createElement('div');
        item.style.cssText = `
          display:flex; align-items:center; gap:8px; padding:10px;
          background:${isActive ? 'rgba(60,214,124,0.08)' : 'rgba(255,255,255,0.03)'};
          border:1px solid ${isActive ? 'rgba(60,214,124,0.4)' : 'var(--border-default)'};
          border-radius:8px; margin-bottom:6px; cursor:pointer;
        `;

        const nameSpan = document.createElement('span');
        nameSpan.style.cssText = 'flex:1; font-size:0.875rem; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
        nameSpan.textContent = lb.name;
        nameSpan.title = lb.description || lb.name;

        const entryCount = document.createElement('span');
        entryCount.style.cssText = 'font-size:0.75rem; color:#888; white-space:nowrap;';
        entryCount.textContent = `${lb.entries.length} entries`;

        const editBtn = document.createElement('span');
        editBtn.className = 'material-symbols-outlined';
        editBtn.textContent = 'edit';
        editBtn.title = 'Edit lorebook';
        editBtn.style.cssText = 'font-size:18px; cursor:pointer; color:#888; flex-shrink:0;';
        editBtn.addEventListener('click', (e) => { e.stopPropagation(); this._openEditor(idx); });

        const delBtn = document.createElement('span');
        delBtn.className = 'material-symbols-outlined';
        delBtn.textContent = 'delete';
        delBtn.title = 'Remove';
        delBtn.style.cssText = 'font-size:18px; cursor:pointer; color:#888; flex-shrink:0;';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeLorebook(idx);
          ToastService.success(`Removed "${lb.name}"`);
        });

        item.appendChild(nameSpan);
        item.appendChild(entryCount);
        item.appendChild(editBtn);
        item.appendChild(delBtn);

        item.addEventListener('click', () => {
          if (isActive) {
            this.setActiveLorebook(-1);
            ToastService.info('Lorebook deactivated');
          } else {
            this.setActiveLorebook(idx);
            ToastService.success(`"${lb.name}" is now active`);
          }
        });

        list.appendChild(item);
      });
    }

    const badge = document.getElementById('lorebookActiveBadge');
    if (badge) {
      if (this.activeLorebook) {
        badge.textContent = `Active: ${this.activeLorebook.name}`;
        badge.style.color = '#3cd67c';
      } else {
        badge.textContent = 'No active lorebook';
        badge.style.color = '#888';
      }
    }
  },

  // ── Editor dialog ─────────────────────────────────────────────────────────

  _openEditor(lorebookIndex) {
    const lb = this.lorebooks[lorebookIndex];
    if (!lb) return;

    this._editingIndex = lorebookIndex;

    const dialog = document.getElementById('lorebookEntryDialog');
    const nameInput = document.getElementById('lorebookEditorName');
    const meta = document.getElementById('lorebookEditorMeta');
    const addBtn = document.getElementById('lorebookAddEntryBtn');
    const exportBtn = document.getElementById('lorebookExportBtn');
    if (!dialog) return;

    // Populate name
    if (nameInput) {
      nameInput.value = lb.name;
      nameInput.oninput = () => {
        lb.name = nameInput.value || 'Unnamed Lorebook';
        this._save();
        this._renderUI();
      };
    }

    if (exportBtn) {
      exportBtn.onclick = () => this.exportLorebook(lorebookIndex);
    }

    if (addBtn) {
      addBtn.onclick = () => {
        this.addEntry(lorebookIndex);
        this._refreshEditorList(lorebookIndex);
      };
    }

    this._refreshEditorList(lorebookIndex);
    dialog.classList.add('active');
  },

  _refreshEditorList(lorebookIndex) {
    const lb = this.lorebooks[lorebookIndex];
    const container = document.getElementById('lorebookEntryList');
    const meta = document.getElementById('lorebookEditorMeta');
    if (!container || !lb) return;

    if (meta) meta.textContent = `${lb.entries.length} entr${lb.entries.length === 1 ? 'y' : 'ies'}`;

    container.innerHTML = '';

    if (lb.entries.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'color:#888;font-size:0.85rem;padding:20px 0;text-align:center;';
      empty.textContent = 'No entries yet. Click "Add Entry" to create one.';
      container.appendChild(empty);
      return;
    }

    lb.entries.forEach((entry, eIdx) => {
      const row = this._buildEntryRow(entry, lorebookIndex, eIdx);
      container.appendChild(row);
    });
  },

  _buildEntryRow(entry, lbIdx, eIdx) {
    const row = document.createElement('div');
    row.style.cssText = `
      padding: 12px; border: 1px solid var(--border-default);
      border-radius: 8px; margin-bottom: 10px;
      background: rgba(255,255,255,0.02);
      transition: border-color 0.2s;
    `;
    if (!entry.enabled) row.style.opacity = '0.55';

    // ── Row header: toggle + name + constant badge + delete ──
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:10px;';

    // Enabled toggle
    const enabledToggle = this._makeToggle(entry.enabled, (val) => {
      entry.enabled = val;
      row.style.opacity = val ? '1' : '0.55';
      this._save();
    });

    // Entry name input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = entry.name;
    nameInput.placeholder = 'Entry name';
    nameInput.style.cssText = `
      flex:1; background:transparent; border:none;
      border-bottom:1px solid var(--border-light);
      color:var(--text-primary); font-size:0.9rem; font-weight:600;
      padding:2px 0; outline:none; min-width:0;
    `;
    nameInput.addEventListener('input', () => {
      entry.name = nameInput.value;
      this._save();
    });

    // Constant toggle with label
    const constWrapper = document.createElement('label');
    constWrapper.style.cssText = 'display:flex; align-items:center; gap:5px; cursor:pointer; flex-shrink:0; font-size:0.75rem; color:#888;';
    const constCheck = document.createElement('input');
    constCheck.type = 'checkbox';
    constCheck.checked = entry.constant;
    constCheck.style.cssText = 'cursor:pointer; accent-color: var(--accent-primary);';
    constCheck.addEventListener('change', () => {
      entry.constant = constCheck.checked;
      this._save();
      this._updateKeywordsSection(keywordsSection, entry);
    });
    constWrapper.appendChild(constCheck);
    constWrapper.appendChild(document.createTextNode('Always'));

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'message-action-btn delete-btn';
    delBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">delete</span>';
    delBtn.title = 'Delete entry';
    delBtn.addEventListener('click', () => {
      this.removeEntry(lbIdx, eIdx);
      this._refreshEditorList(lbIdx);
    });

    header.appendChild(enabledToggle);
    header.appendChild(nameInput);
    header.appendChild(constWrapper);
    header.appendChild(delBtn);

    // ── Keywords row ──
    const keywordsSection = document.createElement('div');
    keywordsSection.style.cssText = 'margin-bottom:8px;';
    this._updateKeywordsSection(keywordsSection, entry);

    // ── Content textarea ──
    const contentLabel = document.createElement('p');
    contentLabel.textContent = 'Content';
    contentLabel.style.cssText = 'font-size:0.75rem; color:#888; margin-bottom:4px;';

    const contentArea = document.createElement('textarea');
    contentArea.value = entry.content;
    contentArea.placeholder = 'World info content injected into system prompt…';
    contentArea.style.cssText = `
      width:100%; min-height:72px; max-height:200px;
      background:var(--bg-elevated); border:1px solid var(--border-default);
      border-radius:4px; color:var(--text-primary);
      font-family:Inter,sans-serif; font-size:0.85rem;
      padding:8px 10px; outline:none; resize:vertical;
      box-sizing:border-box; transition:border-color 0.2s;
    `;
    contentArea.addEventListener('focus', () => contentArea.style.borderColor = 'var(--border-highlight)');
    contentArea.addEventListener('blur', () => contentArea.style.borderColor = 'var(--border-default)');
    contentArea.addEventListener('input', () => {
      entry.content = contentArea.value;
      this._save();
    });

    // ── Priority row ──
    const priorityRow = document.createElement('div');
    priorityRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-top:8px;';
    const priorityLabel = document.createElement('span');
    priorityLabel.textContent = 'Priority';
    priorityLabel.style.cssText = 'font-size:0.75rem; color:#888; flex-shrink:0;';
    const priorityInput = document.createElement('input');
    priorityInput.type = 'number';
    priorityInput.value = entry.priority;
    priorityInput.min = 0;
    priorityInput.style.cssText = `
      width:70px; background:var(--bg-elevated); border:1px solid var(--border-default);
      border-radius:4px; color:var(--text-primary); font-size:0.8rem;
      padding:4px 8px; outline:none;
    `;
    priorityInput.addEventListener('change', () => {
      entry.priority = parseInt(priorityInput.value) || 100;
      this._save();
    });
    const priorityHint = document.createElement('span');
    priorityHint.textContent = '(lower = injected first)';
    priorityHint.style.cssText = 'font-size:0.72rem; color:#555;';
    priorityRow.appendChild(priorityLabel);
    priorityRow.appendChild(priorityInput);
    priorityRow.appendChild(priorityHint);

    row.appendChild(header);
    row.appendChild(keywordsSection);
    row.appendChild(contentLabel);
    row.appendChild(contentArea);
    row.appendChild(priorityRow);

    return row;
  },

  _updateKeywordsSection(section, entry) {
    section.innerHTML = '';

    if (entry.constant) {
      const note = document.createElement('p');
      note.style.cssText = 'font-size:0.75rem; color:#4a9eff; margin:0;';
      note.textContent = 'Always injected (no keywords needed)';
      section.appendChild(note);
      return;
    }

    const labelRow = document.createElement('div');
    labelRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:5px;';
    const label = document.createElement('span');
    label.textContent = 'Keywords';
    label.style.cssText = 'font-size:0.75rem; color:#888;';

    // Keyword chips
    const chips = document.createElement('div');
    chips.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; flex:1;';
    entry.keys.forEach((kw, ki) => {
      const chip = document.createElement('span');
      chip.style.cssText = `
        display:inline-flex; align-items:center; gap:3px;
        font-size:0.72rem; padding:2px 8px; border-radius:12px;
        background:rgba(60,214,124,0.1); color:#3cd67c;
        border:1px solid rgba(60,214,124,0.3);
      `;
      chip.textContent = kw;
      const x = document.createElement('span');
      x.textContent = '×';
      x.style.cssText = 'cursor:pointer; font-size:0.85rem; line-height:1; margin-left:2px;';
      x.addEventListener('click', () => {
        entry.keys.splice(ki, 1);
        this._save();
        this._updateKeywordsSection(section, entry);
      });
      chip.appendChild(x);
      chips.appendChild(chip);
    });

    // New keyword input
    const addKwInput = document.createElement('input');
    addKwInput.type = 'text';
    addKwInput.placeholder = 'Add keyword…';
    addKwInput.style.cssText = `
      background:transparent; border:none; border-bottom:1px solid var(--border-light);
      color:var(--text-primary); font-size:0.78rem; padding:2px 4px; outline:none;
      min-width:90px; max-width:160px;
    `;
    addKwInput.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ',') && addKwInput.value.trim()) {
        e.preventDefault();
        const kw = addKwInput.value.trim().replace(/,$/, '');
        if (kw && !entry.keys.includes(kw)) {
          entry.keys.push(kw);
          this._save();
        }
        this._updateKeywordsSection(section, entry);
      }
    });
    addKwInput.addEventListener('blur', () => {
      if (addKwInput.value.trim()) {
        const kw = addKwInput.value.trim();
        if (kw && !entry.keys.includes(kw)) {
          entry.keys.push(kw);
          this._save();
        }
        this._updateKeywordsSection(section, entry);
      }
    });

    labelRow.appendChild(label);
    section.appendChild(labelRow);
    chips.appendChild(addKwInput);
    section.appendChild(chips);
  },

  _makeToggle(initialValue, onChange) {
    const label = document.createElement('label');
    label.className = 'switch';
    label.style.cssText = 'margin:0;flex-shrink:0;';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = initialValue;

    const slider = document.createElement('span');
    slider.className = 'slider';

    input.addEventListener('change', () => onChange(input.checked));

    label.appendChild(input);
    label.appendChild(slider);
    return label;
  },

  // ── File upload ───────────────────────────────────────────────────────────

  async handleFileUpload(file) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const idx = this.addLorebook(json);
      ToastService.success(`Loaded "${this.lorebooks[idx].name}" (${this.lorebooks[idx].entries.length} entries)`);
    } catch (err) {
      ToastService.error('Failed to load lorebook: ' + err.message);
    }
  },
};

export { LorebookService };
