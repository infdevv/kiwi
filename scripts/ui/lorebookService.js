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

  /**
   * Parse an uploaded JSON object into a normalised lorebook.
   * Throws if the JSON is clearly not a lorebook.
   */
  _parse(json) {
    if (!json || typeof json !== 'object') throw new Error('Invalid lorebook file');

    const name = json.name || json.title || 'Unnamed Lorebook';
    const description = json.description || '';
    let entries = [];

    if (Array.isArray(json.entries)) {
      entries = json.entries.map((e, i) => this._normaliseEntry(e, i));
    } else if (json.entries && typeof json.entries === 'object') {
      // SillyTavern object-keyed format
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

  /**
   * Load a lorebook from a JSON object and add it to the list.
   * @param {object} json
   * @returns {number} Index of the added lorebook
   */
  addLorebook(json) {
    const lorebook = this._parse(json);
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

  /**
   * Return lorebook entries that should be injected given the current messages.
   * @param {Array<{role:string, content:string}>} messages
   * @returns {Array<{name:string, content:string}>}
   */
  getActiveEntries(messages) {
    if (!this.activeLorebook) return [];

    const enabled = this.activeLorebook.entries.filter(e => e.enabled);

    // Build searchable context from recent non-system messages (last 15)
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

    // Higher priority value = inserted later (lower number = more important)
    matched.sort((a, b) => a.priority - b.priority);
    return matched;
  },

  /**
   * Build the text block to append to the system prompt.
   * Returns empty string if nothing to inject.
   * @param {Array} messages
   * @returns {string}
   */
  buildLorebookPrompt(messages) {
    const entries = this.getActiveEntries(messages);
    if (entries.length === 0) return '';
    const parts = entries.map(e => e.content.trim()).filter(Boolean);
    if (parts.length === 0) return '';
    return '[World Info:\n' + parts.join('\n---\n') + '\n]';
  },

  // ── UI ──────────────────────────────────────────────────────────────────

  _renderUI() {
    const list = document.getElementById('lorebookList');
    if (!list) return;
    list.innerHTML = '';

    if (this.lorebooks.length === 0) {
      list.innerHTML = '<p style="color:#888;font-size:0.85rem;padding:8px 0;">No lorebooks loaded.</p>';
      return;
    }

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

      const viewBtn = document.createElement('span');
      viewBtn.className = 'material-symbols-outlined';
      viewBtn.textContent = 'visibility';
      viewBtn.title = 'View entries';
      viewBtn.style.cssText = 'font-size:18px; cursor:pointer; color:#888; flex-shrink:0;';
      viewBtn.addEventListener('click', (e) => { e.stopPropagation(); this._openEntryViewer(idx); });

      const delBtn = document.createElement('span');
      delBtn.className = 'material-symbols-outlined';
      delBtn.textContent = 'delete';
      delBtn.title = 'Remove';
      delBtn.style.cssText = 'font-size:18px; cursor:pointer; color:#888; flex-shrink:0;';
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); this.removeLorebook(idx); ToastService.success(`Removed "${lb.name}"`); });

      item.appendChild(nameSpan);
      item.appendChild(entryCount);
      item.appendChild(viewBtn);
      item.appendChild(delBtn);

      // Click the row to toggle active
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

    // Active status badge
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

  _openEntryViewer(lorebookIndex) {
    const lb = this.lorebooks[lorebookIndex];
    if (!lb) return;

    const dialog = document.getElementById('lorebookEntryDialog');
    const title = document.getElementById('lorebookEntryDialogTitle');
    const container = document.getElementById('lorebookEntryList');
    if (!dialog || !container) return;

    if (title) title.textContent = lb.name;
    container.innerHTML = '';

    if (lb.entries.length === 0) {
      container.innerHTML = '<p style="color:#888;font-size:0.85rem;">No entries in this lorebook.</p>';
    } else {
      lb.entries.forEach((entry, eIdx) => {
        const row = document.createElement('div');
        row.style.cssText = `
          padding:10px; border:1px solid var(--border-default);
          border-radius:8px; margin-bottom:8px;
          background:rgba(255,255,255,0.02);
          opacity:${entry.enabled ? 1 : 0.5};
        `;

        const header = document.createElement('div');
        header.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:6px;';

        const switchLabel = document.createElement('label');
        switchLabel.className = 'switch';
        switchLabel.style.cssText = 'position:relative;display:inline-block;width:36px;height:18px;margin:0;flex-shrink:0;';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = entry.enabled;
        checkbox.style.cssText = 'opacity:0;width:0;height:0;';
        const slider = document.createElement('span');
        slider.className = 'slider';
        slider.style.cssText = `position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:${entry.enabled?'#3cd67c':'#333'};border-radius:18px;transition:.3s;`;
        const dot = document.createElement('span');
        dot.style.cssText = `position:absolute;height:12px;width:12px;left:${entry.enabled?'21px':'3px'};bottom:3px;background:white;border-radius:50%;transition:.3s;`;
        slider.appendChild(dot);
        switchLabel.appendChild(checkbox);
        switchLabel.appendChild(slider);

        checkbox.addEventListener('change', () => {
          entry.enabled = checkbox.checked;
          slider.style.background = entry.enabled ? '#3cd67c' : '#333';
          dot.style.left = entry.enabled ? '21px' : '3px';
          row.style.opacity = entry.enabled ? '1' : '0.5';
          this._save();
        });

        const nameEl = document.createElement('strong');
        nameEl.style.cssText = 'font-size:0.85rem; flex:1; color:var(--text-primary);';
        nameEl.textContent = entry.name;

        const badges = document.createElement('div');
        badges.style.cssText = 'display:flex; gap:4px; flex-shrink:0;';
        if (entry.constant) {
          const cb = document.createElement('span');
          cb.textContent = 'constant';
          cb.style.cssText = 'font-size:0.7rem;padding:2px 6px;border-radius:4px;background:rgba(74,158,255,0.15);color:#4a9eff;border:1px solid rgba(74,158,255,0.3);';
          badges.appendChild(cb);
        }

        header.appendChild(switchLabel);
        header.appendChild(nameEl);
        header.appendChild(badges);

        const keywords = document.createElement('div');
        keywords.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px;';
        if (entry.keys.length > 0) {
          entry.keys.forEach(kw => {
            const chip = document.createElement('span');
            chip.textContent = kw;
            chip.style.cssText = 'font-size:0.7rem;padding:2px 6px;border-radius:4px;background:rgba(60,214,124,0.1);color:#3cd67c;border:1px solid rgba(60,214,124,0.3);';
            keywords.appendChild(chip);
          });
        } else {
          const noKw = document.createElement('span');
          noKw.textContent = entry.constant ? '(always active)' : '(no keywords)';
          noKw.style.cssText = 'font-size:0.75rem;color:#666;';
          keywords.appendChild(noKw);
        }

        const content = document.createElement('p');
        content.style.cssText = 'font-size:0.8rem;color:#aaa;margin:0;white-space:pre-wrap;max-height:80px;overflow-y:auto;';
        content.textContent = entry.content;

        row.appendChild(header);
        row.appendChild(keywords);
        row.appendChild(content);
        container.appendChild(row);
      });
    }

    dialog.classList.add('active');
  },

  /**
   * Handle a lorebook JSON file upload
   * @param {File} file
   */
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
