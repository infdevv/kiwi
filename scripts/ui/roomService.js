/**
 * Room Service - Group chat with multiple bots
 */

import { ToastService } from './toastService.js';

// botId -> botData map, populated when room dialog opens
let _botDataMap = new Map();

const RoomService = {
  /**
   * Open the room creation dialog, populating the bot picker
   */
  async openCreateRoomDialog(storageManager) {
    const dialog = document.getElementById('roomDialog');
    if (!dialog) return;

    const botPicker = document.getElementById('roomBotPicker');
    botPicker.innerHTML = '';
    _botDataMap.clear();

    try {
      const botIds = await storageManager.getBotList();
      if (botIds.length === 0) {
        botPicker.innerHTML = '<p style="color:#888;font-size:0.9rem;padding:8px;">No bots found. Add some bots first.</p>';
      }
      for (const botId of botIds) {
        const botData = await storageManager.loadBot(botId);
        _botDataMap.set(botId, botData);
        const character = botData.character || {};
        const name = character.name || 'Unknown Bot';
        const avatar = character.avatar || botData.bot || '';

        const item = document.createElement('label');
        item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px;border-radius:8px;cursor:pointer;border:1px solid var(--border-default);transition:background 0.15s;';
        item.onmouseenter = () => { item.style.background = 'rgba(255,255,255,0.04)'; };
        item.onmouseleave = () => { item.style.background = ''; };
        item.innerHTML = `
          <input type="checkbox" value="${botId}" style="width:18px;height:18px;flex-shrink:0;cursor:pointer;accent-color:var(--accent-primary,#3cd67c);">
          <img src="${avatar}" alt="${name}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;">
          <span style="font-size:0.9rem;color:var(--text-primary);">${name}</span>
        `;
        botPicker.appendChild(item);
      }
    } catch (err) {
      console.error('[RoomService] Error loading bots for dialog:', err);
    }

    document.getElementById('roomNameInput').value = '';
    dialog.classList.add('active');
  },

  /**
   * Create a new room from dialog values
   */
  async createRoom(storageManager) {
    const roomName = document.getElementById('roomNameInput').value.trim() || 'Group Chat';
    const checked = [...document.querySelectorAll('#roomBotPicker input[type="checkbox"]:checked')];

    if (checked.length < 2) {
      ToastService.error('Select at least 2 bots to create a room.');
      return;
    }

    const participants = checked
      .map(cb => ({ botId: cb.value }))
      .filter(p => _botDataMap.has(p.botId));

    const id = await storageManager.createRoomChat(roomName, participants);

    document.getElementById('roomDialog').classList.remove('active');

    // Build full participants (with botData) for the UI
    const fullParticipants = participants.map(p => ({ botId: p.botId, botData: _botDataMap.get(p.botId) }));
    this.addRoomToUI(id, roomName, fullParticipants);
    await this.loadRoom(id, storageManager);

    ToastService.success(`Room "${roomName}" created!`);
  },

  /**
   * Add a room entry to the bots-tab sidebar
   */
  addRoomToUI(roomId, roomName, participants) {
    const sidebarContent = document.querySelector('#bots-tab-content');
    if (!sidebarContent) return;
    if (sidebarContent.querySelector(`[data-room-id="${roomId}"]`)) return;

    const firstAvatar = participants[0]?.botData?.character?.avatar || participants[0]?.botData?.bot || '';
    const names = participants.map(p => p.botData?.character?.name || 'Bot').join(', ');

    const div = document.createElement('div');
    div.className = 'bot';
    div.dataset.roomId = roomId;
    div.innerHTML = `
      <img src="${firstAvatar}" alt="${roomName}">
      <p class="bot-name">
        <span class="material-symbols-outlined" style="font-size:0.85rem;vertical-align:middle;margin-right:2px;color:var(--accent-primary,#3cd67c);">group</span>${roomName}
      </p>
      <p style="font-size:0.7rem;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;text-align:center;margin:0;">${names}</p>
      <span class="material-symbols-outlined delete-btn" style="font-size:0.9rem;">delete</span>
    `;

    const deleteBtn = div.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.roomService?.deleteRoom?.(roomId, window.storageManager);
    });

    div.addEventListener('click', () => {
      if (window.loadRoom) window.loadRoom(roomId);
    });

    sidebarContent.appendChild(div);
  },

  /**
   * Load a saved room chat and display it
   */
  async loadRoom(roomId, storageManager) {
    const chat = await storageManager.getChat(roomId);
    if (!chat || chat.type !== 'room') return;

    // Resolve full botData for each participant
    const participants = [];
    for (const p of (chat.participants || [])) {
      try {
        const botData = await storageManager.loadBot(p.botId);
        participants.push({ botId: p.botId, botData });
      } catch (_) {
        participants.push({ botId: p.botId, botData: null });
      }
    }

    window.currentChatId = roomId;
    window.currentBotId = null;
    window.currentBotData = null;
    window.currentRoomData = { roomId, roomName: chat.roomName, participants };

    const chatContainer = document.querySelector('.chat-container');
    chatContainer.innerHTML = '';
    document.querySelector('.chat-name').textContent = chat.roomName || 'Group Chat';

    const selectedPersona = window.personaService?.getSelectedPersona();
    const userName = selectedPersona?.name || 'You';
    const userAvatar = selectedPersona?.avatar || 'https://cataas.com/cat';
    const messages = chat.messages || [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'user') {
        window.chatService.appendMessage('user', msg.content, userAvatar, userName, null, i, null, null);
      } else if (msg.role === 'assistant') {
        const p = participants.find(p => p.botId === msg.botId);
        const avatar = p?.botData?.character?.avatar || p?.botData?.bot || '';
        const name = msg.botName || p?.botData?.character?.name || 'Bot';
        window.chatService.appendMessage('assistant', msg.content, avatar, name, null, i, null, null);
      }
    }

    if (window.innerWidth < 768) window.toggleLeftSidebar?.();
  },

  /**
   * Delete a room
   */
  async deleteRoom(roomId, storageManager) {
    const confirmed = await window.showConfirmDialog(
      'Delete Room',
      'Are you sure you want to delete this room? This cannot be undone.'
    );

    if (!confirmed) return;

    try {
      await storageManager.deleteChat(roomId);

      // Remove from UI
      const roomEntry = document.querySelector(`[data-room-id="${roomId}"]`);
      if (roomEntry) {
        roomEntry.remove();
      }

      // Clear current room if it was loaded
      if (window.currentChatId === roomId) {
        this.cleanupRoom();
      }

      ToastService.success('Room deleted');
    } catch (err) {
      console.error('[RoomService] Error deleting room:', err);
      ToastService.error('Failed to delete room');
    }
  },

  /**
   * Clean up current room (garbage collection / memory cleanup)
   */
  cleanupRoom() {
    window.currentChatId = null;
    window.currentRoomData = null;
    window.currentBotId = null;
    window.currentBotData = null;

    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
      chatContainer.innerHTML = '';
    }

    const chatNameEl = document.querySelector('.chat-name');
    if (chatNameEl) {
      chatNameEl.textContent = 'Select a card';
    }
  },

  /**
   * Clear room data when switching to a single bot chat
   */
  clearRoomContext() {
    if (window.currentRoomData) {
      this.cleanupRoom();
    }
  },

  /**
   * On startup, load all saved room chats into the sidebar
   */
  async loadSavedRooms(storageManager) {
    try {
      const chatIds = await storageManager.getChatList();
      for (const chatId of chatIds) {
        try {
          const chat = await storageManager.getChat(chatId);
          if (!chat || chat.type !== 'room') continue;

          const participants = [];
          for (const p of (chat.participants || [])) {
            try {
              const botData = await storageManager.loadBot(p.botId);
              participants.push({ botId: p.botId, botData });
            } catch (_) {
              participants.push({ botId: p.botId, botData: null });
            }
          }
          this.addRoomToUI(chatId, chat.roomName, participants);
        } catch (err) {
          console.error('[RoomService] Error loading room:', chatId, err);
        }
      }
    } catch (err) {
      console.error('[RoomService] Error loading saved rooms:', err);
    }
  },

  /**
   * Send a message in a room. A random subset of bots (≥1) respond in random order.
   */
  async sendGroupMessage(message, storageManager, inferenceManager) {
    const { roomId, roomName, participants } = window.currentRoomData;

    const input = document.querySelector('.bottom-controls input');
    const sendBtn = document.getElementById('sendBtn');

    window.isGenerating = true;
    input.value = '';
    input.disabled = true;
    sendBtn.innerHTML = 'stop';

    const selectedPersona = window.personaService?.getSelectedPersona();
    const userName = selectedPersona?.name || 'You';
    const userAvatar = selectedPersona?.avatar || 'https://cataas.com/cat';

    const chat = await storageManager.getChat(roomId);
    const messages = chat ? structuredClone(chat.messages || []) : [];

    window.chatService.appendMessage('user', message, userAvatar, userName, null, messages.length, null, null);
    messages.push({ role: 'user', content: message });

    // Pick a random subset (≥1) of bots in random order
    const respondents = this._pickRespondents(participants);

    const config = this._getConfig();
    const streaming = this._isStreaming();
    let preset = {};
    const raw = localStorage.getItem('currentPreset');
    if (raw) { try { preset = JSON.parse(raw); } catch (_) {} }
    const contextLength = parseInt(document.getElementById('contextLength')?.value) || 0;
    const arrangement = parseInt(document.getElementById('arrangement')?.value) || 0;
    const customPrompt = document.getElementById('prompt')?.value || '';
    const promptLocation = document.getElementById('promptLocation')?.value || 'before';
    const chatContainer = document.querySelector('.chat-container');

    for (const { botId, botData } of respondents) {
      if (!window.isGenerating) break;

      const character = botData?.character || {};
      const avatar = character.avatar || botData?.bot || '';
      const botName = character.name || 'Bot';

      const botMessages = this._buildBotMessages(messages, botId, botData, selectedPersona);
      const processed = inferenceManager.preprocessChat(
        structuredClone(botMessages), arrangement, preset, contextLength, customPrompt, promptLocation
      );

      const aiMsgDiv = window.chatService.appendMessage('assistant', '...', avatar, botName, null, messages.length, null, null);
      const textSpan = aiMsgDiv?.querySelector('.message-text');
      if (textSpan) textSpan.innerHTML = window.chatRenderer.createLoadingIndicator();

      let responseText = '';

      try {
        if (streaming) {
          await inferenceManager.generateResponse(processed, config, true, chunk => {
            const text = new TextDecoder().decode(chunk);
            for (const line of text.split('\n').filter(l => l.startsWith('data: '))) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const delta = JSON.parse(data).choices?.[0]?.delta?.content || '';
                responseText += delta;
                window.chatRenderer.updateStreamingMessage(aiMsgDiv, responseText);
                chatContainer.scrollTop = chatContainer.scrollHeight;
              } catch (_) {}
            }
          });
          if (responseText.trim()) {
            window.chatRenderer.finalizeStreamingMessage(aiMsgDiv, responseText);
          } else {
            aiMsgDiv?.remove();
          }
        } else {
          const response = await inferenceManager.generateResponse(processed, config, false);
          responseText = response.choices?.[0]?.message?.content || '';
          if (responseText.trim()) {
            window.chatRenderer.finalizeStreamingMessage(aiMsgDiv, responseText);
          } else {
            aiMsgDiv?.remove();
          }
        }

        if (responseText.trim()) {
          messages.push({ role: 'assistant', content: responseText, botId, botName });
        }
      } catch (err) {
        if (err.name !== 'AbortError' && !err.message?.includes('aborted')) {
          console.error('[RoomService] Error generating for', botName, err);
          ToastService.error(`${botName}: ${err.message}`);
        }
        aiMsgDiv?.remove();
        break;
      }
    }

    try {
      await storageManager.putChat({ id: roomId, type: 'room', roomName, participants: participants.map(p => ({ botId: p.botId })), messages, timestamp: Date.now() });
      window.botService?.updateChatTimestamp?.(roomId);
    } catch (err) {
      console.error('[RoomService] Error saving room chat:', err);
    }

    window.isGenerating = false;
    input.disabled = false;
    sendBtn.innerHTML = 'send';
    input.focus();
  },

  /**
   * Pick a random subset (≥1) of participants in random order.
   * Count is uniformly distributed between 1 and participants.length.
   */
  _pickRespondents(participants) {
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const count = Math.ceil(Math.random() * shuffled.length);
    return shuffled.slice(0, count);
  },

  /**
   * Build message array for a specific bot.
   * Other bots' responses become user-role messages with a [Name]: prefix.
   */
  _buildBotMessages(allMessages, targetBotId, targetBotData, persona) {
    const character = targetBotData?.character || {};
    const systemPrompt = window.chatService.buildSystemPrompt(character, persona);
    const result = [];
    if (systemPrompt) result.push({ role: 'system', content: systemPrompt });

    for (const msg of allMessages) {
      if (msg.role === 'user') {
        result.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        if (msg.botId === targetBotId) {
          result.push({ role: 'assistant', content: msg.content });
        } else {
          result.push({ role: 'user', content: `[${msg.botName || 'Bot'}]: ${msg.content}` });
        }
      }
    }
    return result;
  },

  _getConfig() {
    const topKVal = parseInt(document.getElementById('topK')?.value) || 0;
    const minPVal = parseFloat(document.getElementById('minP')?.value) || 0;
    return {
      temperature: parseFloat(document.getElementById('temperature')?.value) || 0.6,
      top_p: parseFloat(document.getElementById('topP')?.value) || null,
      top_k: topKVal > 0 ? topKVal : null,
      min_p: minPVal > 0 ? minPVal : null,
      max_tokens: parseInt(document.getElementById('maxTokens')?.value) || null,
      presence_penalty: parseFloat(document.getElementById('presencePenalty')?.value) || null,
      frequency_penalty: parseFloat(document.getElementById('frequencyPenalty')?.value) || null,
    };
  },

  _isStreaming() {
    const el = document.querySelector("#api-tab input[type='checkbox']") ||
               document.querySelector("#preset-tab input[type='checkbox']");
    return el?.checked || false;
  }
};

export { RoomService };
