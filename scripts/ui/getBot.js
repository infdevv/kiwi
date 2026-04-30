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
  getJannyCharactersByIds,
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
  searchSpicychat,
  transformSpicychatCard,
  getSpicychatCharacter,
  transformFullSpicychatCharacter,
} from "../services/modules/services/spicychatApi.js";
import {
  searchJoylandBots,
  transformJoylandCard,
  getJoylandBot,
  transformFullJoylandBot,
} from "../services/modules/services/joylandApi.js";
import {
  searchPolybuzzCharacters,
  transformPolybuzzCard,
  getPolybuzzCharacter,
  transformFullPolybuzzCharacter,
} from "../services/modules/services/polybuzzApi.js";
import {
  searchHarpyCharacters,
  transformHarpyCard,
  getHarpyCharacter,
  transformFullHarpyCharacter,
} from "../services/modules/services/harpyApi.js";
import {
  searchXoulCharacters,
  transformXoulCard,
  getXoulCharacter,
  transformFullXoulCharacter,
} from "../services/modules/services/xoulApi.js";
import {
  searchBot3Characters,
  transformBot3Card,
  getBot3Character,
  transformFullBot3Character,
} from "../services/modules/services/bot3Api.js";
import {
  searchBotify,
  transformBotifyCard,
  getBotifyBot,
  transformFullBotifyBot,
} from "../services/modules/services/botifyApi.js";
import {
  searchCaibotlistCharacters,
  transformCaibotlistCard,
  getCaibotlistCharacter,
  transformFullCaibotlistCharacter,
} from "../services/modules/services/caibotlistApi.js";
import {
  searchCrushonCharacters,
  transformCrushonCard,
  getCrushonCharacter,
  transformFullCrushonCharacter,
} from "../services/modules/services/crushonApi.js";
import {
  searchCharavaultCards,
  transformCharavaultCard,
  getCharavaultCard,
} from "../services/modules/services/charavaultApi.js";
import {
  searchTalkieCharacters,
  transformTalkieCard,
  getTalkieCharacter,
  transformFullTalkieCharacter,
} from "../services/modules/services/talkieApi.js";
import {
  searchSaucepanCompanions,
  transformSaucepanCard,
  getSaucepanCompanion,
  transformFullSaucepanCompanion,
} from "../services/modules/services/saucepanApi.js";
import { StorageManager } from "../storageManager.js";

const storageManager = new StorageManager();

const urlParams = new URLSearchParams(window.location.search);
const returnUrl = urlParams.get("returnUrl") || "index.html";

window.returnUrl = returnUrl;

let currentSource = "jannyai";
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
      }
    });
  });
}

async function addBot(card, btn) {
  const originalText = btn.textContent;
  btn.textContent = "Adding...";
  btn.disabled = true;

  try {
    let fullCard = null;

    try {
      const svc = card.service;
      if (svc === "jannyai" || card.isJannyAI) {
        // Try HTML scrape first (needs proxy that can bypass Cloudflare).
        // Fall back to the JSON API endpoint which returns a richer payload
        // than the search result without needing to touch the CF-protected page.
        try {
          fullCard = transformFullJannyCharacter(
            await fetchJannyCharacterDetails(card.id, card.slug)
          );
        } catch {
          const apiResults = await getJannyCharactersByIds(card.id);
          if (apiResults && apiResults.length > 0) {
            fullCard = transformFullJannyCharacter({ character: apiResults[0] });
          }
        }
      } else if (svc === "chub" || card.isChub) {
        fullCard = transformFullChubCharacter(
          await getChubCharacter(card.fullPath)
        );
      } else if (svc === "pygmalion" || card.isPygmalion) {
        fullCard = transformFullPygmalionCharacter(
          await getPygmalionCharacter(card.id)
        );
      } else if (svc === "risuai_realm" || card.isRisuRealm) {
        fullCard = transformFullRisuRealmCharacter(
          await fetchRisuRealmCharacter(card.id)
        );
      } else if (svc === "backyard" || card.isBackyard) {
        fullCard = transformFullBackyardCharacter(
          await getBackyardCharacter(card.characterConfigId || card.id)
        );
      } else if (svc === "spicychat" || card.isSpicychat) {
        fullCard = transformFullSpicychatCharacter(
          await getSpicychatCharacter(card.id)
        );
      } else if (svc === "joyland" || card.isJoyland) {
        fullCard = transformFullJoylandBot(await getJoylandBot(card.id));
      } else if (svc === "polybuzz" || card.isPolybuzz) {
        fullCard = transformFullPolybuzzCharacter(
          await getPolybuzzCharacter(card.id)
        );
      } else if (svc === "harpy" || card.isHarpy) {
        fullCard = transformFullHarpyCharacter(
          await getHarpyCharacter(card.id)
        );
      } else if (svc === "xoul" || card.isXoul) {
        fullCard = transformFullXoulCharacter(
          await getXoulCharacter(card.slug || card.id)
        );
      } else if (svc === "bot3" || card.isBot3) {
        fullCard = transformFullBot3Character(
          await getBot3Character(card.id)
        );
      } else if (svc === "botify" || card.isBotify) {
        fullCard = transformFullBotifyBot(await getBotifyBot(card.id));
      } else if (svc === "caibotlist" || card.isCaibotlist) {
        fullCard = transformFullCaibotlistCharacter(
          await getCaibotlistCharacter(card.id)
        );
      } else if (svc === "crushon" || card.isCrushon) {
        fullCard = transformFullCrushonCharacter(
          await getCrushonCharacter(card.id)
        );
      } else if (svc === "charavault" || card.isCharaVault) {
        const [folder, file] = card.id.split("/");
        fullCard = await getCharavaultCard(folder, file);
      } else if (svc === "talkie" || card.isTalkie) {
        fullCard = transformFullTalkieCharacter(
          await getTalkieCharacter(card.id)
        );
      } else if (svc === "saucepan" || card.isSaucepan) {
        fullCard = transformFullSaucepanCompanion(
          await getSaucepanCompanion(card.id)
        );
      }
    } catch (fetchError) {
      console.warn("[Bot Browser] Failed to fetch full character data, using search data:", fetchError.message);
    }

    const charData = fullCard || card;

    const characterData = {
      name: charData.name,
      description: charData.description,
      personality: charData.personality,
      scenario: charData.scenario,
      first_mes: charData.first_mes || charData.first_message || charData.firstMessage || '',
      mes_example: charData.mes_example || charData.example_messages || charData.exampleMessage || charData.exampleDialogs || '',
      system_prompt: charData.system_prompt || '',
      creator: charData.creator || '',
      creator_notes: charData.creator_notes || charData.website_description || '',
      tags: charData.tags || [],
      extensions: charData.extensions || {},
      alternate_greetings: charData.alternate_greetings || [],
    };

    await storageManager.saveBotFromJson(
      characterData,
      charData.avatar_url || charData.image_url || card.avatar_url || card.image_url,
    );

    btn.textContent = "Added!";
    btn.style.backgroundColor = "#22c55e";

    setTimeout(() => { window.location.href = returnUrl; }, 800);
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
        result = await searchChubCards({ search: query, page, limit, nsfw });
        return (result.nodes || []).map(transformChubCard);

      case "jannyai":
        result = await searchJannyCharacters({ search: query, page, limit, nsfw });
        return (result?.results?.[0]?.hits || []).map(transformJannyCard);

      case "wyvern":
        result = await searchWyvernCharacters({ search: query, page, limit, hideNsfw: !nsfw });
        return (result.results || []).map(transformWyvernCard);

      case "pygmalion":
        result = await searchPygmalionCharacters({ query, page, pageSize: limit, includeSensitive: nsfw });
        return (result.characters || []).map(transformPygmalionCard);

      case "character_tavern":
        result = await searchCharacterTavern({ query, page, limit });
        return result || [];

      case "risuai_realm":
        result = await searchRisuRealm({ search: query, page, nsfw });
        return (result.cards || []).map(transformRisuRealmCard);

      case "backyard":
        result = await browseBackyardCharacters({ type: nsfw ? "all" : "sfw", search: query });
        return (result.characters || []).map(transformBackyardCard);

      case "spicychat":
        result = await searchSpicychat({ search: query, page, limit, nsfw });
        return (result.characters || result.results || []).map(transformSpicychatCard);

      case "joyland":
        result = await searchJoylandBots({ query, page, limit });
        return (result.bots || result.results || []).map(transformJoylandCard);

      case "polybuzz":
        result = await searchPolybuzzCharacters({ query, page, limit });
        return (result.characters || result.results || []).map(transformPolybuzzCard);

      case "harpy":
        result = await searchHarpyCharacters({ query, page, limit });
        return (result.cards || result.results || []).map(transformHarpyCard);

      case "xoul":
        result = await searchXoulCharacters({ query, page, limit });
        return (result.xouls || result.results || []).map(transformXoulCard);

      case "bot3":
        result = await searchBot3Characters({ query, page, limit });
        return (result.bots || result.results || []).map(transformBot3Card);

      case "botify":
        result = await searchBotify({ query, page, limit });
        return (result.bots || result.results || []).map(transformBotifyCard);

      case "caibotlist":
        result = await searchCaibotlistCharacters({ query, page, limit });
        return (result.characters || result.results || []).map(transformCaibotlistCard);

      case "crushon":
        result = await searchCrushonCharacters({ query, page, limit, nsfw });
        return (result.characters || result.results || []).map(transformCrushonCard);

      case "charavault":
        result = await searchCharavaultCards({ query, page, limit, nsfw });
        return (result.cards || result.results || []).map(transformCharavaultCard);

      case "talkie":
        result = await searchTalkieCharacters({ query, page, limit });
        return (result.npcs || result.results || []).map(transformTalkieCard);

      case "saucepan":
        result = await searchSaucepanCompanions({ query, page, limit });
        return (result.companions || result.results || []).map(transformSaucepanCard);

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
