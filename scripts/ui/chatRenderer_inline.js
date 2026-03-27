class ChatRendererInline {
  constructor() {
    this.mdParser = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    if (!window.marked) {
      console.warn('[ChatRenderer] marked not loaded yet, will retry on render');
      return;
    }

    this.mdParser = window.marked;

    this.mdParser.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false
    });

    const renderer = new this.mdParser.Renderer();

    renderer.link = (href, title, text) => {
      return `<a href="${this.escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="message-link">${text}</a>`;
    };

    renderer.code = (code, lang) => {
      const highlighted = this.highlightCode(code, lang);
      return `<div class="code-block" data-lang="${lang || 'text'}">
        <div class="code-header">
          <span class="code-lang">${this.escapeHtml(lang || 'text')}</span>
          <button class="code-copy-btn" type="button">
            <span class="material-symbols-outlined" style="font-size: 16px;">content_copy</span>
          </button>
        </div>
        <pre><code class="language-${this.escapeHtml(lang || 'text')}">${highlighted}</code></pre>
      </div>`;
    };

    renderer.codespan = (code) => {
      return `<code class="inline-code">${this.escapeHtml(code)}</code>`;
    };

    this.mdParser.use({ renderer });
    this.initialized = true;
    console.log('[ChatRenderer] Initialized successfully');
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  highlightCode(code, lang) {
    if (!lang) return this.escapeHtml(code);
    const escaped = this.escapeHtml(code);
    const patterns = {
      javascript: [
        { regex: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this)\b/g, color: '#c678dd' },
        { regex: /\b(true|false|null|undefined|NaN|Infinity)\b/g, color: '#d19a66' },
        { regex: /(['"`])(?:(?!\1)[^\\]|\\.)*?\1/g, color: '#98c379' },
        { regex: /\b\d+\.?\d*\b/g, color: '#d19a66' },
        { regex: /\/\/.*$/gm, color: '#5c6370' }
      ],
      python: [
        { regex: /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|raise|with|lambda|yield|global|nonlocal|pass|break|continue|and|or|not|in|is|None|True|False)\b/g, color: '#c678dd' },
        { regex: /(['"])(?:(?!\1)[^\\]|\\.)*?\1/g, color: '#98c379' },
        { regex: /\b\d+\.?\d*\b/g, color: '#d19a66' },
        { regex: /#.*$/gm, color: '#5c6370' }
      ]
    };
    if (patterns[lang?.toLowerCase()]) {
      let highlighted = escaped;
      patterns[lang.toLowerCase()].forEach(({ regex, color }) => {
        highlighted = highlighted.replace(regex, (match) =>
          `<span style="color: ${color}">${match}</span>`
        );
      });
      return highlighted;
    }
    return escaped;
  }

  renderMarkdown(text) {
    if (!this.initialized) {
      this.initialize();
      if (!this.initialized) {
        return this.escapeHtml(text);
      }
    }
    try {
      return this.mdParser.parse(text);
    } catch (error) {
      console.error('[ChatRenderer] Markdown parsing error:', error);
      return this.escapeHtml(text);
    }
  }

  renderMessage(container, text, isStreaming = false) {
    if (!container) return;
    const html = this.renderMarkdown(text);
    container.innerHTML = html;
    if (!isStreaming) {
      this.attachCopyButtonListeners(container);
    }
  }

  attachCopyButtonListeners(container) {
    const copyBtns = container.querySelectorAll('.code-copy-btn');
    copyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = btn.parentElement.nextElementSibling.textContent;
        navigator.clipboard.writeText(code);
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">check</span>';
        btn.style.color = '#22c55e';
        setTimeout(() => {
          btn.innerHTML = originalContent;
          btn.style.color = '';
        }, 2000);
      });
    });
  }

  createMessageElement(role, text, avatarUrl, name, messageId = null, messageIndex = null, versions = null, currentVersionIndex = null) {
    console.log('[ChatRendererInline.createMessageElement] CALLED with role:', role, 'messageIndex:', messageIndex);
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;
    if (messageId) {
      messageDiv.dataset.messageId = messageId;
    }
    if (messageIndex !== null) {
      messageDiv.dataset.messageIndex = messageIndex;
    }
    messageDiv.dataset.role = role;

    const avatarImg = document.createElement('img');
    avatarImg.src = avatarUrl;
    avatarImg.className = 'message-avatar';
    avatarImg.alt = name;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const namePara = document.createElement('p');
    namePara.className = 'message-name';
    namePara.textContent = name;

    const textSpan = document.createElement('span');
    textSpan.className = 'message-text';

    this.renderMessage(textSpan, text, false);

    contentDiv.appendChild(namePara);
    contentDiv.appendChild(textSpan);

    // Add action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';
    console.log('[ChatRendererInline] Creating action buttons for role:', role);

    if (role === 'assistant') {
      const rerollBtn = document.createElement('button');
      rerollBtn.className = 'message-action-btn';
      rerollBtn.innerHTML = '<span class="material-symbols-outlined">refresh</span>';
      rerollBtn.title = 'Re-roll';
      rerollBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.rerollMessage(messageIndex);
      });
      actionsDiv.appendChild(rerollBtn);
      console.log('[ChatRendererInline] Added reroll button');
    }

    const editBtn = document.createElement('button');
    editBtn.className = 'message-action-btn';
    editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';
    editBtn.title = 'Edit';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.editMessage(messageIndex, role);
    });
    actionsDiv.appendChild(editBtn);
    console.log('[ChatRendererInline] Added edit button');

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'message-action-btn delete-btn';
    deleteBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.deleteMessage(messageIndex);
    });
    actionsDiv.appendChild(deleteBtn);
    console.log('[ChatRendererInline] Added delete button');

    contentDiv.appendChild(actionsDiv);

    // Add version navigation for assistant messages with versions
    if (role === 'assistant' && versions && versions.length > 1) {
      const versionNav = this.createVersionNavigation(versions, currentVersionIndex, messageIndex);
      contentDiv.appendChild(versionNav);
    }

    messageDiv.appendChild(avatarImg);
    messageDiv.appendChild(contentDiv);

    return messageDiv;
  }

  createVersionNavigation(versions, currentIndex, messageIndex) {
    const navDiv = document.createElement('div');
    navDiv.className = 'message-version-nav';
    navDiv.dataset.messageIndex = messageIndex;
    navDiv.dataset.currentIndex = currentIndex;
    navDiv.dataset.totalVersions = versions.length;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'message-version-nav-btn';
    prevBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">chevron_left</span>';
    prevBtn.title = 'Previous version';
    prevBtn.disabled = currentIndex === 0;
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentIdx = parseInt(navDiv.dataset.currentIndex);
      window.navigateMessageVersion(messageIndex, currentIdx - 1);
    });
    navDiv.appendChild(prevBtn);

    const indicator = document.createElement('span');
    indicator.className = 'message-version-indicator';
    indicator.textContent = `${currentIndex + 1} / ${versions.length}`;
    navDiv.appendChild(indicator);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'message-version-nav-btn';
    nextBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">chevron_right</span>';
    nextBtn.title = 'Next version';
    nextBtn.disabled = currentIndex === versions.length - 1;
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentIdx = parseInt(navDiv.dataset.currentIndex);
      window.navigateMessageVersion(messageIndex, currentIdx + 1);
    });
    navDiv.appendChild(nextBtn);

    return navDiv;
  }

  createEditInterface(messageElement, currentText, role, messageIndex) {
    const contentDiv = messageElement.querySelector('.message-content');
    if (!contentDiv) return;

    const textSpan = contentDiv.querySelector('.message-text');
    const actionsDiv = contentDiv.querySelector('.message-actions');

    if (textSpan) textSpan.style.display = 'none';
    if (actionsDiv) actionsDiv.style.display = 'none';

    const versionNav = contentDiv.querySelector('.message-version-nav');
    if (versionNav) versionNav.style.display = 'none';

    const textarea = document.createElement('textarea');
    textarea.className = 'message-edit-textarea';
    textarea.value = currentText;

    const editActionsDiv = document.createElement('div');
    editActionsDiv.className = 'message-edit-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'message-edit-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.saveEditedMessage(messageIndex, role, textarea.value);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'message-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.cancelEditMessage(messageElement, currentText, role, messageIndex);
    });

    editActionsDiv.appendChild(saveBtn);
    editActionsDiv.appendChild(cancelBtn);

    contentDiv.appendChild(textarea);
    contentDiv.appendChild(editActionsDiv);

    textarea.focus();
    textarea.select();
  }

  removeEditInterface(messageElement, textSpan) {
    const contentDiv = messageElement.querySelector('.message-content');
    if (!contentDiv) return;

    const textarea = contentDiv.querySelector('.message-edit-textarea');
    const editActions = contentDiv.querySelector('.message-edit-actions');

    if (textarea) textarea.remove();
    if (editActions) editActions.remove();

    if (textSpan) textSpan.style.display = '';
    const actionsDiv = contentDiv.querySelector('.message-actions');
    if (actionsDiv) actionsDiv.style.display = '';
    const versionNav = contentDiv.querySelector('.message-version-nav');
    if (versionNav) versionNav.style.display = '';
  }

  updateMessageContent(messageElement, newText) {
    const textSpan = messageElement.querySelector('.message-text');
    if (textSpan) {
      this.renderMessage(textSpan, newText, false);
      this.attachCopyButtonListeners(textSpan);
    }
  }

  updateVersionNavigation(messageElement, versions, currentIndex) {
    const contentDiv = messageElement.querySelector('.message-content');
    if (!contentDiv) return;

    let versionNav = contentDiv.querySelector('.message-version-nav');

    if (versions && versions.length > 1) {
      if (!versionNav) {
        const messageIndex = messageElement.dataset.messageIndex;
        versionNav = this.createVersionNavigation(versions, currentIndex, messageIndex);
        contentDiv.appendChild(versionNav);
      } else {
        // Update dataset
        versionNav.dataset.currentIndex = currentIndex;
        versionNav.dataset.totalVersions = versions.length;
        
        // Update indicator text
        const indicator = versionNav.querySelector('.message-version-indicator');
        if (indicator) indicator.textContent = `${currentIndex + 1} / ${versions.length}`;
        
        // Update button disabled states
        const prevBtn = versionNav.querySelector('.message-version-nav-btn:first-child');
        const nextBtn = versionNav.querySelector('.message-version-nav-btn:last-child');
        if (prevBtn) prevBtn.disabled = currentIndex === 0;
        if (nextBtn) nextBtn.disabled = currentIndex === versions.length - 1;
      }
    } else if (versionNav) {
      versionNav.remove();
    }
  }

  updateStreamingMessage(messageElement, text) {
    const textSpan = messageElement.querySelector('.message-text');
    if (textSpan) {
      this.renderMessage(textSpan, text, true);
    }
  }

  finalizeStreamingMessage(messageElement, text) {
    const textSpan = messageElement.querySelector('.message-text');
    if (textSpan) {
      this.renderMessage(textSpan, text, false);
      this.attachCopyButtonListeners(textSpan);
    }
  }
}

window.chatRenderer = new ChatRendererInline();