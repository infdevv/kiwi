const ThemeManager = {
    colors: {
        bgPrimary: '#070707',
        bgSecondary: '#0a0a0a',
        bgTertiary: '#0f0f0f',
        bgElevated: '#161616',
        
        borderDefault: '#1a1a1a',
        borderLight: '#2a2a2a',
        borderMedium: '#3a3a3a',
        borderHighlight: '#4a4a4a',
        
        textPrimary: '#ffffff',
        textSecondary: '#888888',
        textMuted: '#666666',
        textDisabled: '#333333',
        
        accentPrimary: '#3cd67c',
        accentSecondary: '#75e772',
        accentHighlight: '#4a9eff',
        
        messageBg: '#1a1a1a',
        overlayBg: 'rgba(0, 0, 0, 0.7)',
        overlayBgLight: 'rgba(0, 0, 0, 0.5)',
        
        gradientStart: 'rgb(60, 214, 124)',
        gradientEnd: 'rgb(117, 231, 114)'
    },

    cssVariables: {
        '--bg-primary': 'bgPrimary',
        '--bg-secondary': 'bgSecondary',
        '--bg-tertiary': 'bgTertiary',
        '--bg-elevated': 'bgElevated',
        '--border-default': 'borderDefault',
        '--border-light': 'borderLight',
        '--border-medium': 'borderMedium',
        '--border-highlight': 'borderHighlight',
        '--text-primary': 'textPrimary',
        '--text-secondary': 'textSecondary',
        '--text-muted': 'textMuted',
        '--text-disabled': 'textDisabled',
        '--accent-primary': 'accentPrimary',
        '--accent-secondary': 'accentSecondary',
        '--accent-highlight': 'accentHighlight',
        '--message-bg': 'messageBg',
        '--overlay-bg': 'overlayBg',
        '--overlay-bg-light': 'overlayBgLight',
        '--gradient-start': 'gradientStart',
        '--gradient-end': 'gradientEnd'
    },

    baseAccentColor: '#3cd67c',

    init() {
        console.log('ThemeManager.init() called');
        console.log('chroma.js loaded:', typeof chroma !== 'undefined');
        this.applyTheme();
        this.loadSavedTheme();
        this.setupColorPicker();
        console.log('ThemeManager initialization complete');
    },


    applyTheme() {
        // Set via JavaScript inline style (highest priority)
        const root = document.documentElement;
        for (const [cssVar, colorKey] of Object.entries(this.cssVariables)) {
            root.style.setProperty(cssVar, this.colors[colorKey], 'important');
        }
        
        void root.offsetHeight;
        
        console.log('Theme applied. Checking variables:');
        console.log('--bg-primary:', getComputedStyle(root).getPropertyValue('--bg-primary').trim());
        console.log('--accent-primary:', getComputedStyle(root).getPropertyValue('--accent-primary').trim());
        console.log('Inline style --bg-primary:', root.style.getPropertyValue('--bg-primary'));
    },


    generatePaletteFromColor(baseColor) {
        if (typeof chroma === 'undefined') {
            console.warn('chroma.js not loaded, using base color as accent only');
            return {
                accentPrimary: baseColor,
                accentSecondary: baseColor,
                accentHighlight: baseColor,
                gradientStart: baseColor,
                gradientEnd: baseColor
            };
        }

        const base = chroma(baseColor);
        const [hue, sat, lightness] = base.hsl();

        const accentPrimary = baseColor;
        const accentSecondary = chroma.hsl(hue, sat, Math.min(lightness + 0.15, 0.85)).hex();
        const accentHighlight = chroma.hsl((hue + 30) % 360, Math.min(sat + 0.1, 1), lightness).hex();
        const gradientStart = accentPrimary;
        const gradientEnd = accentSecondary;
        const borderHighlight = chroma.hsl(hue, sat, 0.8).hex();

        const bgPrimary = chroma.hsl(hue, sat * 0.8, 0.05).hex();
        const bgSecondary = chroma.hsl(hue, sat * 0.8, 0.07).hex();
        const bgTertiary = chroma.hsl(hue, sat * 0.8, 0.1).hex();
        const bgElevated = chroma.hsl(hue, sat * 0.85, 0.12).hex();
        const borderDefault = chroma.hsl(hue, sat * 0.8, 0.14).hex();
        const borderLight = chroma.hsl(hue, sat * 0.8, 0.18).hex();
        const borderMedium = chroma.hsl(hue, sat * 0.8, 0.24).hex();
        const messageBg = chroma.hsl(hue, sat * 0.8, 0.12).hex();

        return {
            accentPrimary,
            accentSecondary,
            accentHighlight,
            gradientStart,
            gradientEnd,
            borderHighlight,
            bgPrimary,
            bgSecondary,
            bgTertiary,
            bgElevated,
            borderDefault,
            borderLight,
            borderMedium,
            messageBg
        };
    },

    /**
     * Set the base accent color and regenerate the entire palette
     * @param {string} color - The new base color
     */
    setBaseColor(color) {
        this.baseAccentColor = color;
        const generatedPalette = this.generatePaletteFromColor(color);

        // Update ALL colors (accents + backgrounds + borders)
        this.setColor('accentPrimary', generatedPalette.accentPrimary);
        this.setColor('accentSecondary', generatedPalette.accentSecondary);
        this.setColor('accentHighlight', generatedPalette.accentHighlight);
        this.setColor('gradientStart', generatedPalette.gradientStart);
        this.setColor('gradientEnd', generatedPalette.gradientEnd);
        this.setColor('borderHighlight', generatedPalette.borderHighlight);
        this.setColor('bgPrimary', generatedPalette.bgPrimary);
        this.setColor('bgSecondary', generatedPalette.bgSecondary);
        this.setColor('bgTertiary', generatedPalette.bgTertiary);
        this.setColor('bgElevated', generatedPalette.bgElevated);
        this.setColor('borderDefault', generatedPalette.borderDefault);
        this.setColor('borderLight', generatedPalette.borderLight);
        this.setColor('borderMedium', generatedPalette.borderMedium);
        this.setColor('messageBg', generatedPalette.messageBg);

        // Update individual color picker UI values
        this.updateIndividualColorPickersUI();

        // Save the base color
        try {
            localStorage.setItem('kiwi-base-color', color);
        } catch (e) {
            console.warn('Failed to save base color:', e);
        }
    },

    /**
     * Update individual color picker input values to match generated palette
     */
    updateIndividualColorPickersUI() {
        const pickers = document.querySelectorAll('.individualColorPicker');
        pickers.forEach(picker => {
            const key = picker.dataset.color;
            if (this.colors[key]) {
                picker.value = this.colors[key];
            }
        });
    },

    /**
     * Setup color picker event listener
     */
    setupColorPicker() {
        const colorPicker = document.getElementById('color');
        if (colorPicker) {
            // Load saved base color
            const savedBaseColor = localStorage.getItem('kiwi-base-color');
            if (savedBaseColor) {
                colorPicker.value = savedBaseColor;
                this.baseAccentColor = savedBaseColor;
            } else {
                colorPicker.value = this.baseAccentColor;
            }

            // Update previews on load
            this.updateColorPreviews(colorPicker.value);

            colorPicker.addEventListener('input', (e) => {
                const color = e.target.value;
                this.setBaseColor(color);
                this.updateColorPreviews(color);
            });
        }

        // Setup individual color pickers
        this.setupIndividualColorPickers();
    },

    /**
     * Setup individual color pickers for each color option
     */
    setupIndividualColorPickers() {
        const pickers = document.querySelectorAll('.individualColorPicker');
        pickers.forEach(picker => {
            const colorKey = picker.dataset.color;
            if (this.colors[colorKey]) {
                picker.value = this.colors[colorKey];
            }

            picker.addEventListener('input', (e) => {
                const color = e.target.value;
                const key = picker.dataset.color;
                this.setColor(key, color);
            });
        });
    },

    updateColorPreviews(baseColor) {
        const previewPrimary = document.getElementById('previewPrimary');
        const previewSecondary = document.getElementById('previewSecondary');
        const previewHighlight = document.getElementById('previewHighlight');

        if (previewPrimary && previewSecondary && previewHighlight) {
            const palette = this.generatePaletteFromColor(baseColor);
            previewPrimary.style.backgroundColor = palette.accentPrimary;
            previewSecondary.style.backgroundColor = palette.accentSecondary;
            previewHighlight.style.backgroundColor = palette.accentHighlight;
        }
    },

    setColor(colorKey, newValue) {
        if (this.colors.hasOwnProperty(colorKey)) {
            this.colors[colorKey] = newValue;
            const cssVar = Object.keys(this.cssVariables).find(
                key => this.cssVariables[key] === colorKey
            );
            if (cssVar) {
                document.documentElement.style.setProperty(cssVar, newValue);
            }
            this.saveTheme();
        }
    },

    getColor(colorKey) {
        return this.colors[colorKey];
    },

    setColors(newColors) {
        for (const [key, value] of Object.entries(newColors)) {
            if (this.colors.hasOwnProperty(key)) {
                this.colors[key] = value;
            }
        }
        this.applyTheme();
        this.saveTheme();
    },

    resetToDefault() {
        const defaultColors = {
            bgPrimary: '#070707',
            bgSecondary: '#0a0a0a',
            bgTertiary: '#0f0f0f',
            bgElevated: '#161616',
            borderDefault: '#1a1a1a',
            borderLight: '#2a2a2a',
            borderMedium: '#3a3a3a',
            borderHighlight: '#4a4a4a',
            textPrimary: '#ffffff',
            textSecondary: '#888888',
            textMuted: '#666666',
            textDisabled: '#333333',
            accentPrimary: '#3cd67c',
            accentSecondary: '#75e772',
            accentHighlight: '#4a9eff',
            messageBg: '#1a1a1a',
            overlayBg: 'rgba(0, 0, 0, 0.7)',
            overlayBgLight: 'rgba(0, 0, 0, 0.5)',
            gradientStart: 'rgb(60, 214, 124)',
            gradientEnd: 'rgb(117, 231, 114)'
        };
        this.setColors(defaultColors);
        this.baseAccentColor = '#3cd67c';
        localStorage.removeItem('kiwi-theme');
        localStorage.removeItem('kiwi-base-color');

        // Reset color picker
        const colorPicker = document.getElementById('color');
        if (colorPicker) {
            colorPicker.value = '#3cd67c';
            this.updateColorPreviews('#3cd67c');
        }

        // Reset individual color pickers
        const pickers = document.querySelectorAll('.individualColorPicker');
        pickers.forEach(picker => {
            const key = picker.dataset.color;
            if (defaultColors[key]) {
                picker.value = defaultColors[key];
            }
        });
    },

    saveTheme() {
        try {
            localStorage.setItem('kiwi-theme', JSON.stringify(this.colors));
        } catch (e) {
            console.warn('Failed to save theme:', e);
        }
    },

    loadSavedTheme() {
        try {
            const saved = localStorage.getItem('kiwi-theme');
            if (saved) {
                const savedColors = JSON.parse(saved);
                this.setColors(savedColors);

                // Update individual color pickers
                const pickers = document.querySelectorAll('.individualColorPicker');
                pickers.forEach(picker => {
                    const key = picker.dataset.color;
                    if (savedColors[key]) {
                        picker.value = savedColors[key];
                    }
                });
            }

            // Load saved base color
            const savedBaseColor = localStorage.getItem('kiwi-base-color');
            if (savedBaseColor) {
                this.baseAccentColor = savedBaseColor;
            }
        } catch (e) {
            console.warn('Failed to load theme:', e);
        }
    },

    getAvailableColors() {
        return [
            { key: 'bgPrimary', label: 'Primary Background' },
            { key: 'bgSecondary', label: 'Secondary Background' },
            { key: 'bgTertiary', label: 'Tertiary Background' },
            { key: 'bgElevated', label: 'Elevated Background' },
            { key: 'borderDefault', label: 'Default Border' },
            { key: 'borderLight', label: 'Light Border' },
            { key: 'borderMedium', label: 'Medium Border' },
            { key: 'textPrimary', label: 'Primary Text' },
            { key: 'textSecondary', label: 'Secondary Text' },
            { key: 'accentPrimary', label: 'Primary Accent' },
            { key: 'accentHighlight', label: 'Highlight Accent' },
            { key: 'messageBg', label: 'Message Background' }
        ];
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
} else {
    console.log('DOM ready, initializing ThemeManager');
    ThemeManager.init();
}
