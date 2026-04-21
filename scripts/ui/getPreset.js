document.addEventListener("DOMContentLoaded", async () => {
    const cardsGrid = document.getElementById("cardsGrid");
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const backBtn = document.getElementById("backBtn");
    const loading = document.getElementById("loading");
    const noResults = document.getElementById("noResults");

    // Setup back button
    backBtn.addEventListener("click", () => {
        // Force reload to ensure fresh data
        window.location.href = "./index.html?t=" + Date.now();
    });

    // Setup search
    searchBtn.addEventListener("click", filterPresets);
    searchInput.addEventListener("input", filterPresets);

    function filterPresets() {
        const searchTerm = searchInput.value.toLowerCase();
        const cards = document.querySelectorAll(".card");
        let hasResults = false;

        cards.forEach(card => {
            const name = card.querySelector("h3").textContent.toLowerCase();
            const description = card.querySelector(".description").textContent.toLowerCase();
            const creator = card.querySelector("small").textContent.toLowerCase();

            if (name.includes(searchTerm) || description.includes(searchTerm) || creator.includes(searchTerm)) {
                card.style.display = "";
                hasResults = true;
            } else {
                card.style.display = "none";
            }
        });

        // Show/hide no results message
        if (noResults) {
            noResults.style.display = hasResults ? "none" : "flex";
        }
        if (cardsGrid) {
            cardsGrid.style.display = hasResults ? "grid" : "none";
        }
    }

    function escapeHtml(text) {
        if (!text) return "";
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function getCardImage(card) {
        return card.image || "placeholder";
    }

    loading.style.display = "flex";

    const presetsMapping = await fetch("../../storage/presets.json")
        .then((res) => res.json());

    const cards = await Promise.all(
        Object.entries(presetsMapping).map(async ([filePath, creator]) => {
            try {
                const response = await fetch(`../../${filePath}`);
                const presetData = await response.json();

                const fileName = filePath.split("/").pop().replace(".json", "");
                const name = presetData.name || fileName;

                // Generate a description from preset data
                const description = generatePresetDescription(presetData);

                return {
                    id: filePath,
                    name: name,
                    creator: creator,
                    description: description,
                    filePath: filePath,
                    data: presetData
                };
            } catch (error) {
                console.error(`Failed to load preset ${filePath}:`, error);
                return {
                    id: filePath,
                    name: filePath.split("/").pop().replace(".json", ""),
                    creator: creator,
                    description: "Failed to load preset data",
                    filePath: filePath
                };
            }
        })
    );

    loading.style.display = "none";

    function generatePresetDescription(presetData) {
        const totalEntries = Object.keys(presetData).length;
        const activeEntries = Object.values(presetData).filter(v => 
            typeof v === 'string' && v.endsWith('-1')
        ).length;
        return `${totalEntries} entries (${activeEntries} active)`;
    }

    cardsGrid.innerHTML = cards
        .map((card) => {
            const image = getCardImage(card);
            const hasImage = image && !image.includes("placeholder");

            return `
                <div class="card" data-card-id="${escapeHtml(card.id)}">
                    <div class="card-content">
                        <h3 title="${escapeHtml(card.name)}">${escapeHtml(card.name)}</h3>
                        <small>Created by: ${escapeHtml(card.creator || "Unknown")} (off AI Presets)</small>
                        <p class="description" title="${escapeHtml(card.description || "")}">${escapeHtml(card.description?.substring(0, 100) || "No description")}</p>
                        <div class="card-actions">
                            <button class="add-btn">Use</button>
                        </div>
                    </div>
                </div>
            `;
        })
        .join("");

    document.querySelectorAll(".add-btn").forEach((btn, index) => {
        btn.addEventListener("click", () => {
            const card = cards[index];
            console.log('[getPreset] Loading preset:', card.name);
            
            // Store the preset in localStorage
            localStorage.setItem("currentPreset", JSON.stringify(card.data));
            console.log('[getPreset] Stored preset data, keys:', Object.keys(card.data));

            // Store preset name for display
            localStorage.setItem("currentPresetName", card.name);
            console.log('[getPreset] Stored preset name:', card.name);
            
            // Verify it was saved
            const verifyName = localStorage.getItem("currentPresetName");
            console.log('[getPreset] Verified preset name in localStorage:', verifyName);

            // Trigger a custom event to notify index.html
            const presetEvent = new Event('presetLoaded');
            presetEvent.presetData = card.data;
            presetEvent.presetName = card.name;
            window.dispatchEvent(presetEvent);

            // Also set a flag that index.html can check
            localStorage.setItem("presetLoadEvent", JSON.stringify({
                name: card.name,
                timestamp: Date.now()
            }));

            console.log('[getPreset] Preset loaded successfully. Return to main page to use it.');
            alert(`Preset "${card.name}" loaded successfully!\n\nClick OK to return to the main page.`);
            
            // Auto-redirect back to main page
            window.location.href = "./index.html?t=" + Date.now();
        });
    });
});