import {
  searchChubCards,
  transformChubCard,
  getChubCharacter,
  transformFullChubCharacter,
} from "../services/modules/services/chubApi.js";
import {
  searchJannyCharacters,
  transformJannyCard,
  fetchJannyCharacterDetails,
  transformFullJannyCharacter,
} from "../services/modules/services/jannyApi.js";
import {
  searchWyvernCharacters,
  transformWyvernCard,
} from "../services/modules/services/wyvernApi.js";
import {
  searchPygmalionCharacters,
  transformPygmalionCard,
  getPygmalionCharacter,
  transformFullPygmalionCharacter,
} from "../services/modules/services/pygmalionApi.js";
import {
  searchCharacterTavern,
  transformCharacterTavernCard,
} from "../services/modules/services/characterTavernApi.js";
import {
  searchRisuRealm,
  transformRisuRealmCard,
  fetchRisuRealmCharacter,
  transformFullRisuRealmCharacter,
} from "../services/modules/services/risuRealmApi.js";
import {
  browseBackyardCharacters,
  transformBackyardCard,
  getBackyardCharacter,
  transformFullBackyardCharacter,
} from "../services/modules/services/backyardApi.js";
import {
  proxiedFetch,
  PROXY_TYPES,
} from "../services/modules/services/corsProxy.js";
import { StorageManager } from "../storageManager.js";

const storageManager = new StorageManager();

const urlParams = new URLSearchParams(window.location.search);
const returnUrl = urlParams.get("returnUrl") || "index.html";

window.returnUrl = returnUrl;

let currentSource = "chub";
let currentCards = [];
let currentPage = 1;
let isLoading = false;
let searchQuery = "";

const cardsGrid = document.getElementById("cardsGrid");
const loadingEl = document.getElementById("loading");
const noResultsEl = document.getElementById("noResults");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const sourceBtns = document.querySelectorAll(".source-btn");

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getCardImage(card) {
  const urls = [
    card.avatar_url,
    card.image_url,
    card.thumbnail_url,
    card.preview_url,
  ].filter(Boolean);

  if (urls.length === 0) return null;
  return urls[0];
}

function renderCards(cards) {
  if (cards.length === 0) {
    cardsGrid.innerHTML = "";
    noResultsEl.style.display = "block";
    noResultsEl.innerHTML = `<i class="fa-solid fa-search"></i><p>No characters found${searchQuery ? ' for "' + escapeHtml(searchQuery) + '"' : ""}</p>`;
    return;
  }

  noResultsEl.style.display = "none";
  cardsGrid.innerHTML = cards
    .map((card) => {
      const image = getCardImage(card);
      const hasImage = image && !image.includes("placeholder");

      return `
                    <div class="card" data-card-id="${escapeHtml(card.id)}">
                        <div class="card-image-wrapper ${!hasImage ? "no-image" : ""}">
                            ${hasImage ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(card.name)}" loading="lazy" onerror="this.parentElement.classList.add('no-image')">` : ""}
                        </div>
                        <div class="card-content">
                            <h3 title="${escapeHtml(card.name)}">${escapeHtml(card.name)}</h3>
                            <small>${escapeHtml(card.creator || "Unknown")}</small>
                            <p class="description" title="${escapeHtml(card.description || "")}">${escapeHtml(card.description?.substring(0, 100) || "No description")}</p>
                            <div class="card-actions">
                                <button class="add-btn">Add</button>
                            </div>
                        </div>
                    </div>
                `;
    })
    .join("");

  cardsGrid.querySelectorAll(".card").forEach((cardEl) => {
    cardEl.addEventListener("click", (e) => {
      if (e.target.classList.contains("add-btn")) {
        e.stopPropagation();
        const cardId = cardEl.dataset.cardId;
        const card = cards.find((c) => c.id === cardId);
        addBot(card, e.target);
      } else {
        const cardId = cardEl.dataset.cardId;
        const card = cards.find((c) => c.id === cardId);
        console.log("Card clicked:", card);
      }
    });
  });
}

async function addBot(card, btn) {
  const originalText = btn.textContent;
  btn.textContent = "Adding...";
  btn.disabled = true;

  try {
    console.log('[Bot Browser] Adding bot, card data:', card);
    
    let fullCard = null;

    // Fetch full character data from the respective service
    try {
      if (card.isJannyAI || card.service === 'jannyai') {
        console.log('[Bot Browser] Fetching JannyAI full character:', card.id, card.slug);
        const data = await fetchJannyCharacterDetails(card.id, card.slug);
        console.log('[Bot Browser] JannyAI full data:', data);
        fullCard = transformFullJannyCharacter(data);
        console.log('[Bot Browser] JannyAI transformed fullCard:', fullCard);
      } else if (card.isChub || card.service === 'chub') {
        console.log('[Bot Browser] Fetching Chub full character:', card.fullPath);
        const data = await getChubCharacter(card.fullPath);
        console.log('[Bot Browser] Chub full data:', data);
        fullCard = transformFullChubCharacter(data);
        console.log('[Bot Browser] Chub transformed fullCard:', fullCard);
      } else if (card.isPygmalion || card.service === 'pygmalion') {
        console.log('[Bot Browser] Fetching Pygmalion full character:', card.id);
        const data = await getPygmalionCharacter(card.id);
        console.log('[Bot Browser] Pygmalion full data:', data);
        fullCard = transformFullPygmalionCharacter(data);
        console.log('[Bot Browser] Pygmalion transformed fullCard:', fullCard);
      } else if (card.isRisuRealm || card.service === 'risuai_realm') {
        console.log('[Bot Browser] Fetching RisuRealm full character:', card.id);
        const data = await fetchRisuRealmCharacter(card.id);
        console.log('[Bot Browser] RisuRealm full data:', data);
        fullCard = transformFullRisuRealmCharacter(data);
        console.log('[Bot Browser] RisuRealm transformed fullCard:', fullCard);
      } else if (card.isBackyard || card.service === 'backyard') {
        console.log('[Bot Browser] Fetching Backyard full character:', card.characterConfigId || card.id);
        const configId = card.characterConfigId || card.id;
        const data = await getBackyardCharacter(configId);
        console.log('[Bot Browser] Backyard full data:', data);
        fullCard = transformFullBackyardCharacter(data);
        console.log('[Bot Browser] Backyard transformed fullCard:', fullCard);
      } else {
        console.log('[Bot Browser] No matching service, using search data. Card flags:', {
          isJannyAI: card.isJannyAI,
          isChub: card.isChub,
          isPygmalion: card.isPygmalion,
          isRisuRealm: card.isRisuRealm,
          isBackyard: card.isBackyard,
          service: card.service
        });
      }
      // Wyvern, Character Tavern, and others don't have detail APIs - use search data
    } catch (fetchError) {
      console.warn('[Bot Browser] Failed to fetch full character data, using search data:', fetchError.message);
    }

    // Use full card data if available, otherwise fall back to search data
    const charData = fullCard || card;
    console.log('[Bot Browser] Final charData to save:', charData);

    const characterData = {
      name: charData.name,
      description: charData.description,
      personality: charData.personality,
      scenario: charData.scenario,
      first_mes: charData.first_mes || charData.firstMessage,
      mes_example: charData.mes_example || charData.exampleMessage,
      system_prompt: charData.system_prompt,
      creator: charData.creator,
      creator_notes: charData.creator_notes,
      tags: charData.tags || [],
      extensions: charData.extensions || {},
      alternate_greetings: charData.alternate_greetings || [],
    };
    console.log('[Bot Browser] Final characterData to store:', characterData);

    const botId = await storageManager.saveBotFromJson(
      characterData,
      charData.avatar_url || charData.image_url || card.avatar_url || card.image_url,
    );
    console.log("Bot saved with ID:", botId);

    btn.textContent = "Added!";
    btn.style.backgroundColor = "#22c55e";

    // Show debug info in alert for inspection
    const debugInfo = {
      savedId: botId,
      name: characterData.name,
      hasFirstMes: !!characterData.first_mes,
      hasDescription: !!characterData.description,
      hasPersonality: !!characterData.personality,
      hasScenario: !!characterData.scenario,
      hasMesExample: !!characterData.mes_example,
      hasSystemPrompt: !!characterData.system_prompt,
      hasAltGreetings: (characterData.alternate_greetings || []).length > 0,
      usedFullData: !!fullCard,
      service: card.service || 'unknown'
    };
    console.log('[Bot Browser] Debug info:', debugInfo);
    
    // Longer delay to allow inspecting console
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    window.location.href = returnUrl;
  } catch (error) {
    console.error("Error adding bot:", error);
    btn.textContent = originalText;
    btn.disabled = false;
    alert("Error adding bot: " + error.message);
  }
}

function showLoading(show) {
  isLoading = show;
  loadingEl.style.display = show ? "block" : "none";
  if (show) {
    cardsGrid.innerHTML = "";
    noResultsEl.style.display = "none";
  }
}

async function searchSource(source, query, page = 1) {
  const limit = 48;
  const nsfw = true;

  try {
    let result;

    switch (source) {
      case "chub":
        result = await searchChubCards({
          search: query,
          page: page,
          limit: limit,
          nsfw: nsfw,
        });
        return (result.nodes || []).map(transformChubCard);

      case "jannyai":
        result = await searchJannyCharacters({
          search: query,
          page: page,
          limit: limit,
          nsfw: nsfw,
        });
        const hits = result?.results?.[0]?.hits || [];
        return hits.map(transformJannyCard);

      case "wyvern":
        result = await searchWyvernCharacters({
          search: query,
          page: page,
          limit: limit,
          hideNsfw: !nsfw,
        });
        return (result.results || []).map(transformWyvernCard);

      case "pygmalion":
        result = await searchPygmalionCharacters({
          query: query,
          page: page,
          pageSize: limit,
          includeSensitive: nsfw,
        });
        return (result.characters || []).map(transformPygmalionCard);

      case "character_tavern":
        result = await searchCharacterTavern({
          query: query,
          page: page,
          limit: limit,
        });
        return result || [];

      case "risuai_realm":
        result = await searchRisuRealm({
          search: query,
          page: page,
          nsfw: nsfw,
        });
        return (result.cards || []).map(transformRisuRealmCard);

      case "backyard":
        result = await browseBackyardCharacters({
          type: nsfw ? "all" : "sfw",
          search: query,
        });
        return (result.characters || []).map(transformBackyardCard);

      default:
        return [];
    }
  } catch (error) {
    console.error(`[Bot Browser] Error searching ${source}:`, error);
    return [];
  }
}

async function loadCards(query = "", page = 1) {
  showLoading(true);
  searchQuery = query;
  currentPage = page;

  const cards = await searchSource(currentSource, query, page);
  currentCards = cards;

  showLoading(false);
  renderCards(cards);
}

sourceBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    sourceBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentSource = btn.dataset.source;

    loadCards(searchInput.value.trim(), 1);
  });
});

searchBtn.addEventListener("click", () => {
  loadCards(searchInput.value.trim(), 1);
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    loadCards(searchInput.value.trim(), 1);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".source-btn.active")?.click();
});
