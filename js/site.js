const STORAGE_KEY = 'kelvin-keylight-state';
const HIDE_DELAY = 3000;

let hideTimer = null;

/**
 * Read persisted state from localStorage.
 * @returns {{temperature?: string, color?: string, brightness?: number}|null}
 */
function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

/**
 * Persist current state to localStorage.
 * @param {{temperature?: string, color?: string, brightness?: number}} state
 */
function saveState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        /* ignore quota / privacy-mode errors */
    }
}

function getState() {
    return loadState() || {};
}

function patchState(patch) {
    saveState({ ...getState(), ...patch });
}

/**
 * Normalize any CSS color string ("rgb(...)" or "#abc") into "#rrggbb".
 * @param {string} color
 * @returns {string}
 */
function toHex(color) {
    if (!color) return '#000000';
    if (color.startsWith('#')) {
        if (color.length === 4) {
            return '#' + [...color.slice(1)].map(c => c + c).join('').toLowerCase();
        }
        return color.toLowerCase();
    }
    const match = color.match(/rgba?\(([^)]+)\)/);
    if (!match) return '#000000';
    const parts = match[1].split(',').map(p => parseFloat(p.trim()));
    const [r, g, b] = parts;
    const hex = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Relative luminance (0..1) of a hex color, per WCAG.
 * @param {string} hex "#rrggbb"
 * @returns {number}
 */
function luminance(hex) {
    const h = toHex(hex).slice(1);
    const rgb = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = rgb.map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * Toggle a light/dark text class on <body> so #display and #title-bar stay readable.
 * @param {string} color the active background color (any CSS form)
 */
function applyContrast(color) {
    const dark = luminance(color) < 0.55; // dark background -> need light text
    document.body.classList.toggle('on-dark', dark);
    document.body.classList.toggle('on-light', !dark);
}

/**
 * Apply a background color to the app and sync display + picker + contrast.
 * @param {string} color any CSS color
 * @param {string} label text to show in #display
 * @param {boolean} syncPicker whether to update the color input's value
 */
function applyColor(color, label, syncPicker) {
    document.body.style.backgroundColor = color;
    const display = document.getElementById('display');
    if (display) display.textContent = label;
    if (syncPicker) setPickerValue(toHex(color));
    applyContrast(color);
}

/**
 * Set the Coloris field value and update its swatch without firing input handlers.
 * @param {string} hex "#rrggbb"
 */
function setPickerValue(hex) {
    const picker = document.getElementById('colorPicker');
    if (!picker) return;
    picker.value = hex;
    const field = picker.closest('.clr-field');
    if (field) field.style.color = hex; // Coloris draws the swatch from the field's color
}

/**
 * Select a preset button: mark it selected, apply its color, persist.
 * @param {HTMLButtonElement} button
 */
function change(button) {
    const buttons = document.querySelectorAll('#presets button[aria-selected]');
    buttons.forEach(btn => btn.removeAttribute('aria-selected'));
    const picker = document.getElementById('colorPicker');
    if (picker) picker.removeAttribute('aria-selected');
    button.setAttribute('aria-selected', 'true');

    const color = window.getComputedStyle(button).backgroundColor;
    applyColor(color, button.title, false);
    patchState({ temperature: button.dataset.temperature, color: undefined });
}

/**
 * Move preset selection left/right by a delta.
 * @param {number} delta -1 or 1
 */
function moveSelection(delta) {
    const buttons = [...document.querySelectorAll('#presets button')];
    if (!buttons.length) return;
    const current = buttons.findIndex(b => b.hasAttribute('aria-selected'));
    let next = current + delta;
    if (current === -1) next = delta > 0 ? 0 : buttons.length - 1;
    next = (next + buttons.length) % buttons.length;
    change(buttons[next]);
    buttons[next].focus();
}

/* ---- Brightness (black overlay whose opacity = 1 - brightness) ---- */

function applyBrightness(value) {
    const overlay = document.getElementById('dimmer');
    if (overlay) overlay.style.opacity = String(1 - value);
}

/* ---- Fullscreen ---- */

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
        document.exitFullscreen?.();
    }
}

/* ---- Auto-hide controls ---- */

function showControls() {
    document.body.classList.remove('controls-hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
        document.body.classList.add('controls-hidden');
    }, HIDE_DELAY);
}

function init() {
    /* Initialize the in-page Coloris picker (replaces the native OS color panel). */
    if (window.Coloris) {
        window.Coloris({
            el: '#colorPicker',
            wrap: true,
            themeMode: 'auto',
            format: 'hex',
            alpha: false
        });
    }

    const buttons = document.querySelectorAll('#presets button');
    buttons.forEach(button => {
        button.addEventListener('click', () => change(button));
    });

    const picker = document.getElementById('colorPicker');

    /** Apply the picker's color as the active light and mark it selected. */
    function selectCustomColor(color) {
        document.querySelectorAll('#presets button[aria-selected]')
            .forEach(btn => btn.removeAttribute('aria-selected'));
        picker.setAttribute('aria-selected', 'true');
        applyColor(color, color.toUpperCase(), false);
        patchState({ color, customColor: color, temperature: undefined });
    }

    /* Immediate feedback: applying the current color the moment the picker opens. */
    picker.addEventListener('open', () => selectCustomColor(picker.value));
    /* Live updates while dragging in the picker. */
    picker.addEventListener('input', event => selectCustomColor(event.target.value));

    const brightness = document.getElementById('brightness');
    brightness.addEventListener('input', event => {
        const value = Number(event.target.value);
        applyBrightness(value);
        patchState({ brightness: value });
    });

    const fsButton = document.getElementById('fullscreenBtn');
    fsButton.addEventListener('click', toggleFullscreen);

    /* Keyboard: arrows move presets, F toggles fullscreen. */
    document.addEventListener('keydown', event => {
        showControls();
        const tag = event.target.tagName;
        if (event.key === 'ArrowRight') {
            if (tag === 'INPUT') return;
            event.preventDefault();
            moveSelection(1);
        } else if (event.key === 'ArrowLeft') {
            if (tag === 'INPUT') return;
            event.preventDefault();
            moveSelection(-1);
        } else if (event.key === 'f' || event.key === 'F') {
            toggleFullscreen();
        }
    });

    document.addEventListener('mousemove', showControls);

    /* Restore persisted state, else default preset (aria-selected in markup). */
    const state = getState();

    const savedBrightness = typeof state.brightness === 'number' ? state.brightness : 1;
    brightness.value = String(savedBrightness);
    applyBrightness(savedBrightness);

    /* Restore the remembered custom color into the picker regardless of active mode. */
    if (state.customColor) {
        setPickerValue(toHex(state.customColor));
    }

    if (state.color) {
        setPickerValue(toHex(state.color));
        picker.setAttribute('aria-selected', 'true');
        applyColor(state.color, state.color.toUpperCase(), false);
    } else if (state.temperature) {
        const btn = document.querySelector(`#presets button[data-temperature="${state.temperature}"]`);
        if (btn) {
            change(btn);
        } else {
            defaultSelect();
        }
    } else {
        defaultSelect();
    }

    showControls();
}

function defaultSelect() {
    const selected = document.querySelector('#presets button[aria-selected="true"]')
        || document.querySelector('#presets button');
    if (selected) change(selected);
}

document.addEventListener('DOMContentLoaded', init);
