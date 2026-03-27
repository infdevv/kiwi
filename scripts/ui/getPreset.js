document.addEventListener("DOMContentLoaded", async () => {
    const cardsGrid = document.getElementById("cardsGrid");
    
    function escapeHtml(text) {
        if (!text) return "";
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function getCardImage(card) {
        return card.image || "placeholder";
    }

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

    function generatePresetDescription(presetData) {
        const totalEntries = Object.keys(presetData).length;
        return `${totalEntries} entries`;
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
        });
    });
});