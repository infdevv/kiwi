import * as exifreader from 'https://cdn.jsdelivr.net/npm/exifreader@4.36.2/+esm'

function gen_uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const DB_NAME = 'kiwi_storage';
const DB_VERSION = 2;
const CHAT_STORE = 'chats';
const BOT_STORE = 'bots';
const PERSONA_STORE = 'personas';

class StorageManager {
    constructor() {
        this.db = null;
    }

    async openDB() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(CHAT_STORE)) {
                    db.createObjectStore(CHAT_STORE, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(BOT_STORE)) {
                    db.createObjectStore(BOT_STORE, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(PERSONA_STORE)) {
                    db.createObjectStore(PERSONA_STORE, { keyPath: 'id' });
                }
            };
        });
    }

    async createChat(bot) {
        const db = await this.openDB();
        const id = gen_uuid();
        const chat = {
            id: id,
            bot: bot,
            timestamp: new Date().getTime(),
            messages: []
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction(CHAT_STORE, 'readwrite');
            const store = tx.objectStore(CHAT_STORE);
            const request = store.put(chat);

            request.onsuccess = () => resolve(id);
            request.onerror = () => reject(request.error);
        });
    }

    async getChatList() {
        const db = await this.openDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(CHAT_STORE, 'readonly');
            const store = tx.objectStore(CHAT_STORE);
            const request = store.getAllKeys();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getChat(chat_id) {
        const db = await this.openDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(CHAT_STORE, 'readonly');
            const store = tx.objectStore(CHAT_STORE);
            const request = store.get(chat_id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveChat(chat_id, chat) {
        const db = await this.openDB();
        const chatWithId = {
            id: chat_id,
            bot: chat.bot ? structuredClone(chat.bot) : undefined,
            botId: chat.botId || null,
            timestamp: chat.timestamp,
            messages: chat.messages ? structuredClone(chat.messages) : []
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction(CHAT_STORE, 'readwrite');
            const store = tx.objectStore(CHAT_STORE);
            const request = store.put(chatWithId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deleteChat(chat_id) {
        const db = await this.openDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(CHAT_STORE, 'readwrite');
            const store = tx.objectStore(CHAT_STORE);
            const request = store.delete(chat_id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async saveBot(bot_img) {
        const db = await this.openDB();
        const id = gen_uuid();
        const bot = {
            id: id,
            img: bot_img,
            type: 'image'
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction(BOT_STORE, 'readwrite');
            const store = tx.objectStore(BOT_STORE);
            const request = store.put(bot);

            request.onsuccess = () => resolve(id);
            request.onerror = () => reject(request.error);
        });
    }

    async saveBotFromJson(characterData, imageUrl) {
        const db = await this.openDB();
        const id = gen_uuid();
        
        const sanitizedCharacterData = {
            name: characterData.name || '',
            description: characterData.description || '',
            personality: characterData.personality || '',
            scenario: characterData.scenario || '',
            first_mes: characterData.first_mes || characterData.firstMessage || '',
            mes_example: characterData.mes_example || characterData.exampleMessage || '',
            system_prompt: characterData.system_prompt || '',
            creator: characterData.creator || '',
            creator_notes: characterData.creator_notes || '',
            tags: characterData.tags || [],
            extensions: characterData.extensions || {},
            alternate_greetings: characterData.alternate_greetings || [],
            avatar: characterData.avatar || characterData.avatar_url || characterData.image_url || imageUrl || ''
        };
        
        const bot = {
            id: id,
            character: sanitizedCharacterData,
            img: imageUrl || null,
            type: 'json'
        };

        console.log('[StorageManager] Saving bot to IndexedDB:', {
            id: id,
            characterName: sanitizedCharacterData.name,
            hasFirstMes: !!sanitizedCharacterData.first_mes,
            hasDescription: !!sanitizedCharacterData.description,
            hasPersonality: !!sanitizedCharacterData.personality,
            hasScenario: !!sanitizedCharacterData.scenario,
            hasMesExample: !!sanitizedCharacterData.mes_example,
            characterDataKeys: Object.keys(sanitizedCharacterData)
        });

        return new Promise((resolve, reject) => {
            const tx = db.transaction(BOT_STORE, 'readwrite');
            const store = tx.objectStore(BOT_STORE);
            const request = store.put(bot);

            request.onsuccess = () => {
                console.log('[StorageManager] Bot saved successfully');
                resolve(id);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getBotList() {
        const db = await this.openDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(BOT_STORE, 'readonly');
            const store = tx.objectStore(BOT_STORE);
            const request = store.getAllKeys();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async loadBot(bot_id) {
        const db = await this.openDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(BOT_STORE, 'readonly');
            const store = tx.objectStore(BOT_STORE);
            const request = store.get(bot_id);

            request.onsuccess = () => {
                const bot = request.result;
                if (!bot) {
                    reject(new Error('Bot not found'));
                    return;
                }
                
                console.log('[StorageManager] Loaded bot from IndexedDB:', {
                    id: bot.id,
                    type: bot.type,
                    hasCharacter: !!bot.character,
                    characterName: bot.character?.name,
                    hasFirstMes: !!bot.character?.first_mes,
                    hasDescription: !!bot.character?.description,
                    hasPersonality: !!bot.character?.personality,
                    hasScenario: !!bot.character?.scenario,
                    hasMesExample: !!bot.character?.mes_example,
                    characterKeys: bot.character ? Object.keys(bot.character) : []
                });

                // Handle JSON-type bots (from getBot.html)
                if (bot.type === 'json' && bot.character) {
                    // Clone the character data to prevent mutations affecting stored data
                    resolve({
                        bot: bot.img,
                        character: structuredClone(bot.character)
                    });
                    return;
                }

                // Handle legacy image-type bots (with EXIF data)
                try {
                    const base64Data = bot.img.split(',')[1];
                    const binaryString = atob(base64Data);

                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    let metadata = exifreader.load(bytes.buffer);
                    let charaData = metadata["chara"]?.description;
                    
                    // Properly decode UTF-8 characters from base64
                    // atob() returns binary string where each char code is a byte
                    // Need to decode UTF-8 bytes to get the original string
                    const characterData = atob(charaData);
                    const utf8String = decodeURIComponent(escape(characterData));
                    let character = JSON.parse(utf8String);
                    
                    resolve({
                        "bot": bot.img,
                        "character": character
                    });
                } catch (exifError) {
                    console.error('Error parsing EXIF data:', exifError);
                    reject(new Error('Failed to parse character data from image'));
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteBot(bot_id) {
        const db = await this.openDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction([BOT_STORE, CHAT_STORE], 'readwrite');
            const botStore = tx.objectStore(BOT_STORE);
            const chatStore = tx.objectStore(CHAT_STORE);

            // First, get all chats to find ones linked to this bot
            const getAllChatsRequest = chatStore.getAll();

            getAllChatsRequest.onsuccess = () => {
                const allChats = getAllChatsRequest.result || [];

                // Delete chats that belong to this bot
                const chatsToDelete = allChats.filter(chat => {
                    // Check if chat.botId matches or if chat.bot.id matches
                    if (chat.botId === bot_id) return true;
                    if (chat.bot && chat.bot.id === bot_id) return true;
                    return false;
                });

                // Delete the associated chats
                chatsToDelete.forEach(chat => {
                    chatStore.delete(chat.id);
                });

                // Then delete the bot
                const deleteBotRequest = botStore.delete(bot_id);

                deleteBotRequest.onsuccess = () => resolve({ deletedChats: chatsToDelete.map(c => c.id) });
                deleteBotRequest.onerror = () => reject(deleteBotRequest.error);
            };

            getAllChatsRequest.onerror = () => reject(getAllChatsRequest.error);
        });
    }

    async savePersona(persona) {
        const db = await this.openDB();
        const id = gen_uuid();
        const personaData = {
            id: id,
            name: persona.name || 'Unnamed Persona',
            description: persona.description || '',
            persona: persona.persona || '',
            scenario: persona.scenario || '',
            mes_example: persona.mes_example || '',
            system_prompt: persona.system_prompt || '',
            creator_notes: persona.creator_notes || '',
            tags: persona.tags || [],
            timestamp: new Date().getTime()
        };

        console.log('[StorageManager] Saving persona to IndexedDB:', {
            id: id,
            name: personaData.name,
            hasPersona: !!personaData.persona,
            hasScenario: !!personaData.scenario,
            hasMesExample: !!personaData.mes_example
        });

        return new Promise((resolve, reject) => {
            const tx = db.transaction(PERSONA_STORE, 'readwrite');
            const store = tx.objectStore(PERSONA_STORE);
            const request = store.put(personaData);

            request.onsuccess = () => {
                console.log('[StorageManager] Persona saved successfully');
                resolve(id);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getPersonaList() {
        const db = await this.openDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(PERSONA_STORE, 'readonly');
            const store = tx.objectStore(PERSONA_STORE);
            const request = store.getAllKeys();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async loadPersona(persona_id) {
        const db = await this.openDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(PERSONA_STORE, 'readonly');
            const store = tx.objectStore(PERSONA_STORE);
            const request = store.get(persona_id);

            request.onsuccess = () => {
                const persona = request.result;
                if (!persona) {
                    reject(new Error('Persona not found'));
                    return;
                }

                console.log('[StorageManager] Loaded persona from IndexedDB:', {
                    id: persona.id,
                    name: persona.name,
                    hasPersona: !!persona.persona,
                    hasScenario: !!persona.scenario,
                    hasMesExample: !!persona.mes_example
                });

                resolve(structuredClone(persona));
            };
            request.onerror = () => reject(request.error);
        });
    }

    async updatePersona(persona_id, persona) {
        const db = await this.openDB();
        const personaData = {
            id: persona_id,
            name: persona.name || 'Unnamed Persona',
            description: persona.description || '',
            persona: persona.persona || '',
            scenario: persona.scenario || '',
            mes_example: persona.mes_example || '',
            system_prompt: persona.system_prompt || '',
            creator_notes: persona.creator_notes || '',
            tags: persona.tags || [],
            timestamp: new Date().getTime()
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction(PERSONA_STORE, 'readwrite');
            const store = tx.objectStore(PERSONA_STORE);
            const request = store.put(personaData);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deletePersona(persona_id) {
        const db = await this.openDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(PERSONA_STORE, 'readwrite');
            const store = tx.objectStore(PERSONA_STORE);
            const request = store.delete(persona_id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAllPersonas() {
        const db = await this.openDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(PERSONA_STORE, 'readonly');
            const store = tx.objectStore(PERSONA_STORE);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }
}

export { StorageManager };