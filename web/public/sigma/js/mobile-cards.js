/* ═══════════════════════════════════════════════════════════════
   SigmaCards — Mobile Card Generator for Responsive Tables
   Genera HTML de cards para vista móvil a partir de config + data
   ═══════════════════════════════════════════════════════════════ */

const SigmaCards = {

    /**
     * Genera el contenedor de cards móvil.
     * @param {Object} config - Configuración de la card
     * @param {Function} config.title - (item) => string título principal
     * @param {Function} [config.subtitle] - (item) => string subtítulo
     * @param {Function} [config.badge] - (item) => string HTML del badge (ej: status-badge)
     * @param {Array} config.fields - [{label: string, value: (item) => string}]
     * @param {Function} [config.actions] - (item) => string HTML de botones
     * @param {Function} [config.cardClass] - (item) => string clase CSS extra
     * @param {Array} data - Array de items
     * @returns {string} HTML string
     */
    generate(config, data) {
        if (!data || data.length === 0) return '';
        const cards = data.map(item => this._card(config, item)).join('');
        return `<div class="sigma-mobile-cards">${cards}</div>`;
    },

    _card(config, item) {
        const extraClass = config.cardClass ? ' ' + config.cardClass(item) : '';

        const headerTitle = config.title(item);
        const subtitle = config.subtitle ? `<small>${config.subtitle(item)}</small>` : '';
        const badge = config.badge ? config.badge(item) : '';

        const header = `<div class="sc-header">
            <div class="sc-title">${headerTitle}${subtitle}</div>
            ${badge}
        </div>`;

        const fields = (config.fields || []).map(f => {
            const val = f.value(item);
            const icon = f.icon ? f.icon : '';
            return `<div class="sc-field">
                <span class="sc-label">${icon}${f.label}</span>
                <span class="sc-value">${val}</span>
            </div>`;
        }).join('');

        const actions = config.actions ? `<div class="sc-actions">${config.actions(item)}</div>` : '';

        return `<div class="sigma-mobile-card${extraClass}">${header}${fields}${actions}</div>`;
    }
};
