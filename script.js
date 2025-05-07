document.addEventListener("DOMContentLoaded", () => {
    // Cache frequently used elements
    const cachedElements = {
        scrollList: document.querySelector('.scroll-list'),
        audioContainer: document.querySelector('.audio-container'),
        audioText: document.getElementById('audiotext'),
        playPauseBtn: document.getElementById('playPauseBtn'),
        volumeIcon: document.getElementById('volumeIcon'),
        volumeSlider: document.getElementById('volumeSlider'),
        stationSearch: document.getElementById("stationSearch"),
        clearSearch: document.getElementById("clearSearch"),
        historyDropdown: document.querySelector('.history-dropdown')
    };

    // Initialize core components
    ScrollbarManager.init(cachedElements);
    ScrollbarManager.setupAutoHide();
    loadPreferences();
    setupAudioContainerObserver(cachedElements);
    setupAudioContainerGestures(cachedElements);
    
    // Initialize dropdown manager with cached elements
    window.dropdownManager = new DropdownManager(cachedElements);
    
    // Initialize other components
    const initFunctions = [
        () => setupRecentlyPlayedToggle(cachedElements),
        () => loadRecentlyPlayed(cachedElements),
        setupGenreButtonsNavigation,
        setupGenreCategoriesSwipe,
        () => setupGenreFiltering(cachedElements),
        setupThemeControls,
        setupNowPlayingMetadata,
        () => setupExpandableCategories(cachedElements)
    ];
    
    // Use requestIdleCallback for non-critical initializations
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
            initFunctions.forEach(fn => fn());
        }, { timeout: 1000 });
    } else {
        initFunctions.forEach(fn => fn());
    }

cachedElements.scrollList?.addEventListener('click', handleRadioClick, { passive: true });
cachedElements.scrollList?.addEventListener('touchend', handleRadioClick, { passive: false });

function handleRadioClick(e) {
    const radio = e.target.closest('.radio');
    if (!radio) return;
    
    // Prevent default for touch events to avoid double-tap zoom
    if (e.type === 'touchend') {
        e.preventDefault();
    }
    
    // Check if the radio is inside the history dropdown
    const isHistoryItem = radio.closest('.history-dropdown');
    
    if (isHistoryItem) {
        // Prevent the dropdown from closing
        e.stopPropagation();
        
        // Change station
        changeStation(radio.dataset.name, radio.dataset.link, cachedElements);
        
        // Scroll history dropdown to top
        const historyDropdown = document.querySelector('.history-dropdown');
        if (historyDropdown) {
            historyDropdown.scrollTop = 0;
        }
    } else {
        // Regular station click behavior
        changeStation(radio.dataset.name, radio.dataset.link, cachedElements);
    }
}
    
    // Final update with timeout
    setTimeout(() => ScrollbarManager.updateAll(), 500);
    
    // Cleanup
    window.addEventListener('beforeunload', cleanupResources);
});

function cleanupResources() {
    // Use a single DOM query for all tooltip elements
    const tooltip = document.querySelector('.genre-tooltip');
    
    // Cleanup dropdown listeners
    if (window.dropdownManager) {
        document.removeEventListener("click", dropdownManager.handleOutsideClick);
        document.removeEventListener("touchend", dropdownManager.handleOutsideClick);
        
        Object.values(dropdownManager.dropdowns || {}).forEach(dropdown => {
            if (dropdown.toggle) {
                dropdown.toggle.removeEventListener("click", dropdownManager.toggle);
                dropdown.toggle.removeEventListener("touchend", dropdownManager.toggle);
            }
        });
    }
    
    // Cleanup tooltip listeners
    if (tooltip) {
        if (tooltip._wheelHandler) tooltip.removeEventListener('wheel', tooltip._wheelHandler);
        if (tooltip._scrollHandler) tooltip.removeEventListener('scroll', tooltip._scrollHandler);
        if (tooltip._mutationObserver) tooltip._mutationObserver.disconnect();
    }
    
    // Cleanup intervals and timeouts
    clearInterval(metadataInterval);
    clearTimeout(scrollbarHideTimeout);
    
    // Cleanup dynamic styles
    document.getElementById('marquee-style')?.remove();
    const dynamicStyles = document.querySelectorAll('[data-dynamic-style]');
    dynamicStyles.forEach(el => el.remove());
    
    // Cleanup observers
    [windowResizeObserver, ...(ScrollbarManager.resizeObservers || [])]
        .forEach(observer => observer?.disconnect());
    
    // Reset UI states
    if (window.dropdownManager) {
        Object.keys(dropdownManager.dropdowns).forEach(id => {
            const dropdown = dropdownManager.dropdowns[id];
            if (dropdown.toggle) dropdown.toggle.classList.remove("active");
            if (dropdown.menu) {
                dropdown.menu.classList.remove("show", "visible");
                dropdown.menu.style.display = 'none';
            }
        });
    }
}

// Global Elements and Constants
const audio = document.getElementById("audioctrl");
const METADATA_PROXY = 'https://radiometadata.kosta04miletic.workers.dev';
const METADATA_CHECK_INTERVAL = 15000;
const playPauseBtn = document.getElementById("playPauseBtn");
const volumeIcon = document.getElementById("volumeIcon");
const volumeSlider = document.getElementById("volumeSlider");
const COLLAPSED_HEIGHT = 150;
const SCROLLBAR_HIDE_DELAY = 1500;
const debounceMetadata = debounce((force) => checkMetadata(force), 500);
let lastVolume = audio.volume || 1;
let currentGenre = 'all';
let recentlyPlayedObserver;
let resizeObserver;
let windowResizeObserver;
let scrollbarHideTimeout;
let lastScrollTime = 0;
let isScrolling = false;
let currentStation = null;
let metadataInterval = null;
let lastMetadataCheck = 0;
let lastTitle = '';
let handleDocumentClick, handleDocumentTouch;

function easeOutQuad(t) {
    return t * (2 - t);
}

// Station Functions
async function changeStation(name, link, cachedElements = {}) {
    // Use cached elements where available
    const audioTextElement = cachedElements.audioText || document.getElementById('audiotext');
    const audioContainer = cachedElements.audioContainer || document.querySelector('.audio-container');
    
    // Clear UI immediately
    if (audioTextElement) {
        audioTextElement.innerHTML = `<div class="station-name">${name}</div>`;
        audioTextElement.classList.remove('has-now-playing');
        audioContainer?.classList.remove('has-now-playing');
        lastTitle = '';
        
        const songTitleElement = audioTextElement.querySelector('.song-title');
        if (songTitleElement) audioTextElement.removeChild(songTitleElement);
        updateAudioContainerHeight(cachedElements);
    }

    // Stop metadata requests
    if (metadataInterval) {
        clearInterval(metadataInterval);
        metadataInterval = null;
    }

    // Store current station
    const currentStationName = name;
    currentStation = { name, link };

    // Reset audio
    audio.pause();
    audio.currentTime = 0;
    audio.src = link;

    // Update UI
    document.title = `Radio | ${name}`;
    localStorage.setItem("lastStation", JSON.stringify({ name, link }));
    updateSelectedStation(name);
    updatePlayPauseButton(cachedElements);
    updateRecentlyPlayed(name, link, document.querySelector(`.radio[data-name="${name}"]`)?.dataset.genre || '', cachedElements);

    // Scroll to station
    const selectedStation = document.querySelector(`.radio[data-name="${name}"]`);
    if (selectedStation) {
        requestAnimationFrame(() => {
            selectedStation.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        });
    }
    
    updateTooltipContent();
    
    // Define play function
    const playAudio = async () => {
        try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                await playPromise.catch(e => handlePlayError(e, cachedElements));
            }
            
            if (currentStation?.name === currentStationName) {
                await checkMetadata(true, cachedElements);
                setupNowPlayingMetadata();
            }
        } catch (e) {
            handlePlayError(e, cachedElements);
            setTimeout(playAudio, 1000);
        }
    };

    // Set up audio event handlers
    audio.oncanplay = playAudio;
    audio.onerror = () => {
        console.log('Audio error occurred, retrying...');
        setTimeout(playAudio, 1000);
    };
    
    // Metadata handler
    const metadataEndHandler = () => {
        if (currentStation?.name === currentStationName) {
            checkMetadata(true, cachedElements);
        }
    };
    
    audio.removeEventListener('ended', metadataEndHandler);
    audio.addEventListener('ended', metadataEndHandler);

    // Try to play
    try {
        await playAudio();
    } catch (e) {
        console.error('Initial play failed:', e);
    }
}

function isLikelyStationName(title) {
    if (!title) return false;
    
    // Pre-compiled regex patterns
    const stationPatterns = [
        /radio\s*/i,
        /fm\s*\d*/i,
        /^\d+\s*[kK][hH]z/i,
        /live\s*stream/i,
        /webradio/i,
        /^\w+\s*-\s*\w+$/i,
        /^\d{2}:\d{2}/,
        /^now playing:/i,
        /^currently playing:/i
    ];
    
    return stationPatterns.some(pattern => pattern.test(title));
}

function handlePlayError(e, cachedElements = {}) {
    console.error("Playback error:", e);
    setupNowPlayingMetadata();
    updatePlayPauseButton(cachedElements);
}

async function getNowPlaying(station) {
    if (!station?.link) return null;

    try {
        const proxyUrl = `${METADATA_PROXY}?url=${encodeURIComponent(station.link)}`;
        const response = await fetchWithTimeout(proxyUrl, 5000);
        
        if (!response.ok) return null;
        
        const data = await response.json();
        
        // Update station quality info
        const stationElement = document.querySelector(`.radio[data-name="${station.name}"]`);
        if (stationElement && data.quality) {
            let bitrate = data.quality.bitrate || '';
            bitrate = bitrate.toString()
                .replace(/[^\d]/g, '')
                .replace(/^0+/, '')
                .slice(0, 3);
            
            if (bitrate) bitrate = `${bitrate}kbps`;
            
            stationElement.dataset.bitrate = bitrate;
            stationElement.dataset.format = data.quality.format || '';
        }
        
        if (data.success && data.title && !data.isStationName) {
            return cleanMetadata(data.title);
        }
        return null;
    } catch (e) {
        console.error('Metadata fetch failed:', e);
        return null;
    }
}

// Enhanced metadata cleaning
function cleanMetadata(title) {
    if (!title) return null;
    
    return title
        .replace(/<\/?[^>]+(>|$)/g, '') // Remove HTML tags
        .replace(/(https?:\/\/[^\s]+)/g, '') // Remove URLs
        .trim() // Trim whitespace
        .replace(/^\s+|\s+$/g, '') // Trim again
        .replace(/\|.*$/, '') // Remove everything after pipe
        .replace(/\b(?:Radio Paradise|RP)\b/i, ''); // Remove specific strings
}

// Helper function with timeout
function fetchWithTimeout(url, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    return fetch(url, { signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
}

function updateNowPlayingUI(title, cachedElements = {}) {
    const audioTextElement = cachedElements.audioText || document.getElementById('audiotext');
    if (!audioTextElement || !currentStation) return;

    const audioContainer = cachedElements.audioContainer || document.querySelector('.audio-container');
    const stationName = currentStation.name;

    // Update station name
    let stationNameElement = audioTextElement.querySelector('.station-name');
    if (!stationNameElement) {
        stationNameElement = document.createElement('div');
        stationNameElement.className = 'station-name';
        audioTextElement.appendChild(stationNameElement);
    }
    stationNameElement.textContent = stationName;

    // Handle song title
    let songTitleElement = audioTextElement.querySelector('.song-title');
    
    if (title && !isLikelyStationName(title) && title !== stationName) {
        if (!songTitleElement) {
            songTitleElement = document.createElement('div');
            songTitleElement.className = 'song-title';
            audioTextElement.insertBefore(songTitleElement, stationNameElement);
        }
        songTitleElement.textContent = title;
        audioTextElement.classList.add('has-now-playing');
        audioContainer.classList.add('has-now-playing');
        
        requestAnimationFrame(() => applyMarqueeEffect(songTitleElement));
    } else if (songTitleElement) {
        audioTextElement.removeChild(songTitleElement);
        audioTextElement.classList.remove('has-now-playing');
        audioContainer.classList.remove('has-now-playing');
    }
    
    updateAudioContainerHeight(cachedElements);
}

function applyMarqueeEffect(element) {
    removeExistingMarqueeElements();
    
    // Reset element styles
    element.style.cssText = 'animation: none; transform: translateX(0); position: relative; display: inline-block; white-space: nowrap; width: auto; overflow: visible;';
    
    const container = element.parentElement;
    if (!container) return;
    
    container.style.overflow = 'hidden';
    
    const containerWidth = container.clientWidth;
    const textWidth = element.scrollWidth;
    const isOverflowing = textWidth > containerWidth;
    
    if (!isOverflowing) {
        element.style.overflow = '';
        container.style.overflow = '';
        element.classList.remove('marquee-active');
        return;
    }

    element.classList.add('marquee-active');
    setupMarqueeAnimation(element, textWidth);
}

function removeExistingMarqueeElements() {
    const existingElements = [
        document.getElementById('marquee-fade-left'),
        ...document.querySelectorAll('.marquee-clone')
    ];
    
    existingElements.forEach(el => el?.remove());
    document.getElementById('marquee-style')?.remove();
}

function setupMarqueeAnimation(element, textWidth) {
    const container = element.parentElement;
    
    // Create left fade element
    const leftFade = document.createElement('div');
    leftFade.id = "marquee-fade-left";
    leftFade.style.cssText = 'position: absolute; top: 0; left: 0; width: 30px; height: 100%; pointer-events: none; z-index: 2; opacity: 0;';
    container.appendChild(leftFade);

    // Create wrapper for animation
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: inline-block; position: relative; white-space: nowrap;';

    // Original content
    const originalContent = element.innerHTML;
    const originalSpan = document.createElement('span');
    originalSpan.innerHTML = originalContent;
    wrapper.appendChild(originalSpan);
    
    // Clone for seamless looping
    const cloneSpan = document.createElement('span');
    cloneSpan.className = 'marquee-clone';
    cloneSpan.innerHTML = originalContent;
    cloneSpan.style.paddingLeft = '100px';
    wrapper.appendChild(cloneSpan);
    
    element.innerHTML = '';
    element.appendChild(wrapper);

    // Animation parameters
    const scrollDistance = textWidth + 100;
    const scrollSpeed = 40;
    const scrollDuration = scrollDistance / scrollSpeed;
    const pauseDuration = 2;
    const totalDuration = scrollDuration + pauseDuration * 2;
    
    const initialPauseEnd = (pauseDuration / totalDuration * 100).toFixed(6);
    const scrollEnd = (((pauseDuration + scrollDuration) / totalDuration) * 100).toFixed(6);
    const fadeOutStart = (Number(scrollEnd) - 5).toFixed(6);

    // Animation definitions
    const animationName = `marquee-${Date.now()}`;
    
    const keyframes = `
        @keyframes ${animationName} {
            0% { transform: translateX(0); }
            ${initialPauseEnd}% { transform: translateX(0); }
            ${scrollEnd}% { transform: translateX(-${scrollDistance}px); }
            100% { transform: translateX(-${scrollDistance}px); }
        }
        
        @keyframes ${animationName}-left-fade {
            0%, ${(Number(initialPauseEnd) - 0.0001).toFixed(6)}% { opacity: 0; }
            ${initialPauseEnd}%, ${fadeOutStart}% { opacity: 1; }
            ${(Number(fadeOutStart) + 0.0001).toFixed(6)}%, 100% { opacity: 0; }
        }
    `;

    const style = document.createElement('style');
    style.id = 'marquee-style';
    style.innerHTML = keyframes;
    document.head.appendChild(style);
    
    wrapper.style.animation = `${animationName} ${totalDuration}s linear infinite`;
    leftFade.style.animation = `${animationName}-left-fade ${totalDuration}s linear infinite`;
}

async function checkMetadata(force = false, cachedElements = {}) {
    if (!currentStation?.link) return;
    
    try {
        const now = Date.now();
        if (!force && now - lastMetadataCheck < METADATA_CHECK_INTERVAL) return;
        
        lastMetadataCheck = now;
        const title = await getNowPlaying(currentStation);
        
        if (title && title !== lastTitle) {
            lastTitle = title;
            updateNowPlayingUI(title, cachedElements);
        }

        if (document.querySelector('.genre-tooltip.visible')) {
            updateTooltipContent();
        }
    } catch (e) {
        console.error('Metadata check failed:', e);
    }
}

function setupNowPlayingMetadata() {
    if (metadataInterval) clearInterval(metadataInterval);
    
    const checkMetadataIdle = () => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => debounceMetadata(), { timeout: 1000 });
        } else {
            debounceMetadata();
        }
    };
    
    debounceMetadata(true);
    
    metadataInterval = setInterval(() => {
        if (document.hidden) {
            if (Date.now() - lastMetadataCheck > 30000) {
                checkMetadataIdle();
            }
        } else {
            checkMetadataIdle();
        }
    }, 5000);
    
    audio.addEventListener('play', () => {
        checkMetadata(true);
    }, { once: true });
    
    audio.addEventListener('ended', () => {
        checkMetadata(true);
    });
}

function updateSelectedStation(name) {
    const radios = document.querySelectorAll(".radio");
    radios.forEach(radio => {
        const isSelected = radio.dataset.name === name;
        radio.classList.toggle("selected", isSelected);
        const existingEqualizer = radio.querySelector(".equalizer");
        
        if (isSelected) {
            if (existingEqualizer) {
                existingEqualizer.className = "equalizer animate";
            } else {
                const equalizer = document.createElement("div");
                equalizer.className = "equalizer animate";
                equalizer.innerHTML = "<div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>";
                const radioText = radio.querySelector(".radio-text");
                                if (radioText) radio.insertBefore(equalizer, radioText);
            }
        } else if (existingEqualizer) {
            radio.removeChild(existingEqualizer);
        }
    });
}

// Genre Filtering Functions
function setupGenreFiltering(cachedElements = {}) {
    const genreButtons = document.querySelector('.genre-buttons');
    if (!genreButtons) return;
    
    genreButtons.addEventListener('click', (e) => {
        const button = e.target.closest('.genre-button');
        if (!button) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const searchInput = cachedElements.stationSearch || document.getElementById("stationSearch");
        const clearSearch = cachedElements.clearSearch || document.getElementById("clearSearch");
        
        searchInput.value = "";
        clearSearch.style.display = "none";
        
        document.querySelectorAll('.genre-button').forEach(btn => {
            btn.classList.toggle('active', btn === button);
        });
        
        currentGenre = button.dataset.genre;
        applyGenreFilter(cachedElements);
        setupExpandableCategories(cachedElements);
    });
}

function applyGenreFilter(cachedElements = {}) {
    cancelAnimationFrame(window._genreFilterRAF);
    
    window._genreFilterRAF = requestAnimationFrame(() => {
        const searchInput = cachedElements.stationSearch || document.getElementById("stationSearch");
        if (searchInput.value.trim() !== "") return;
        
        const noResultsElement = document.querySelector('.no-results');
        let hasVisibleStations = false;
        
        document.querySelectorAll('.radio:not(.history-dropdown .radio)').forEach(station => {
            const stationGenres = station.dataset.genre?.split(',') || [];
            const shouldShow = currentGenre === 'all' || stationGenres.includes(currentGenre);
            station.style.display = shouldShow ? 'flex' : 'none';
            if (shouldShow) hasVisibleStations = true;
        });

        if (noResultsElement) {
            noResultsElement.style.display = 'none';
        }

        updateCategoryVisibility();
        setupExpandableCategories(cachedElements);
        
        setTimeout(ScrollbarManager.updateAll.bind(ScrollbarManager), 10);
    });
}

function updateCategoryVisibility() {
    document.querySelectorAll(".category-container").forEach(category => {
        const categoryTitle = category.previousElementSibling;
        if (!categoryTitle?.classList.contains("category")) return;

        const hasVisibleStation = [...category.querySelectorAll(".radio")]
            .some(station => window.getComputedStyle(station).display !== 'none');

        category.style.display = hasVisibleStation ? "flex" : "none";
        categoryTitle.style.display = hasVisibleStation ? "flex" : "none";
    });
}

// Theme Functions
function setTheme(mode) {
    // Batch DOM updates
    const allElements = document.querySelectorAll("*");
    const body = document.body;
    
    // Add transition class to all elements
    allElements.forEach(el => el.classList.add("no-transition"));
    body.classList.add("no-transition");
    
    // Set theme class
    body.className = `${mode}-mode`;
    document.documentElement.style.setProperty(
        "--accent-color", 
        `var(--accent-${mode === "dark" ? "light" : "dark"})`
    );
    localStorage.setItem("theme", mode);

    // Remove transition class after a delay
    setTimeout(() => {
        allElements.forEach(el => el.classList.remove("no-transition"));
        body.classList.remove("no-transition");
        ScrollbarManager.updateAll();
    }, 50);

    // Update theme icons
    const themeIcons = document.querySelectorAll(".theme-icon");
    themeIcons.forEach(icon => {
        icon.textContent = mode === "dark" ? "dark_mode" : "light_mode";
    });
}

function changeColor(color) {
    const colors = {
        blue: ["--blue-dark", "--blue-light"],
        green: ["--green-dark", "--green-light"],
        yellow: ["--yellow-dark", "--yellow-light"],
        red: ["--red-dark", "--red-light"]
    }[color] || ["--blue-dark", "--blue-light"];

    // Batch style updates
    const docStyle = document.documentElement.style;
    docStyle.setProperty("--accent-dark", `var(${colors[0]})`);
    docStyle.setProperty("--accent-light", `var(${colors[1]})`);
    
    const currentTheme = document.body.classList.contains("dark-mode") ? "dark" : "light";
    docStyle.setProperty("--accent-color", `var(${colors[currentTheme === "dark" ? 1 : 0]})`);

    localStorage.setItem("accentColor", color);
    ScrollbarManager.updateAll();
}

function setupThemeControls() {
    document.querySelectorAll(".theme-option").forEach(option => {
        option.addEventListener("click", () => setTheme(option.dataset.theme));
    });

    document.querySelectorAll(".color-picker").forEach(picker => {
        picker.addEventListener("click", () => changeColor(picker.dataset.color));
    });
}

function updateRecentlyPlayed(name, link, genre = '', cachedElements = {}) {
    const recentlyPlayed = safeParseJSON('recentlyPlayed', []);
    const newRecentlyPlayed = [
        { name, link, genre },
        ...recentlyPlayed.filter(item => item.link !== link)
    ].slice(0, 12);
    
    localStorage.setItem('recentlyPlayed', JSON.stringify(newRecentlyPlayed));
    
    loadRecentlyPlayed(cachedElements);

}

function safeParseJSON(key, fallback) {
    try { 
        return JSON.parse(localStorage.getItem(key)) || fallback; 
    } catch (e) { 
        return fallback; 
    }
}

// UI Setup Functions
class DropdownManager {
    constructor(cachedElements = {}) {
        this.currentOpen = null;
        this.dropdowns = {
            theme: {
                toggle: document.querySelector(".dropdown-toggle"),
                menu: document.querySelector(".dropdown-menu"),
                needsScroll: false
            },
            history: {
                toggle: document.getElementById("historyBtn"),
                menu: document.getElementById("historyDropdown"),
                navButtonClass: 'history-nav-button',
                needsScroll: true,
                overflowBehavior: 'contain'
            },
            tooltip: {
                toggle: document.querySelector(".info-icon"),
                menu: document.querySelector(".genre-tooltip"),
                navButtonClass: 'tooltip-nav-button',
                needsScroll: true,
                overflowBehavior: 'contain'
            }
        };
        
        // Position dropdown groups
        document.querySelectorAll('.dropdown-group').forEach(group => {
            group.style.position = 'relative';
        });
        
        this.init();
    }

    init() {
        Object.entries(this.dropdowns).forEach(([id, dropdown]) => {
            if (!dropdown.toggle || !dropdown.menu) return;
            
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggle(id);
            };
            
            // Use passive listeners where possible
            dropdown.toggle.addEventListener("click", handler);
            dropdown.toggle.addEventListener("touchend", handler, { passive: false });
            dropdown.toggle.addEventListener("touchstart", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggle(id);
            }, { passive: false });
            dropdown.menu.addEventListener('click', (e) => e.stopPropagation());
        });

        // Use passive listeners for document events
        document.addEventListener("click", this.handleOutsideClick.bind(this));
        document.addEventListener("touchend", this.handleOutsideClick.bind(this), { passive: true });
    }

    toggle(id) {
        // Add early return if already processing
        if (this._processingToggle) return;
        this._processingToggle = true;
        
        const dropdown = this.dropdowns[id];
        if (!dropdown) {
            this._processingToggle = false;
            return;
        }
    
        // Use requestAnimationFrame for smoother animations
        requestAnimationFrame(() => {
            // If clicking inside an already open dropdown, don't close it
            if (this.currentOpen === id && dropdown.menu.contains(event.target)) {
                this._processingToggle = false;
                return;
            }
    
            // If clicking the toggle of an open dropdown, close it
            if (this.currentOpen === id && dropdown.toggle.contains(event.target)) {
                this.close(id);
                this._processingToggle = false;
                return;
            }
    
            // Close any other open dropdown
            if (this.currentOpen) {
                this.close(this.currentOpen);
            }
    
            // Open the new dropdown
            dropdown.menu.style.display = 'block';
            dropdown.menu.scrollTop = 0;
            dropdown.menu.classList.add('show');
            
            if (id === 'tooltip') {
                dropdown.menu.classList.add('visible');
                updateTooltipContent();
            }
            
            dropdown.toggle.classList.add('active');
            
            if (dropdown.needsScroll) {
                this.setupDropdownScroll(id);
            }
            
            this.currentOpen = id;
            this.updateDropdownHeights();
            this._processingToggle = false;
        });
    }
    
    setupDropdownScroll(id) {
        const dropdown = this.dropdowns[id];
        if (!dropdown || !dropdown.menu) return;
        // In the setupDropdownScroll method, use will-change for better performance:
        dropdown.menu.style.willChange = 'transform';

const resizeObserver = new ResizeObserver(() => {
    checkButtons();
});
resizeObserver.observe(dropdown.menu);

dropdown.menu._resizeObserver = resizeObserver;

if (dropdown.menu._resizeObserver) {
    dropdown.menu._resizeObserver.disconnect();
}

        // Remove existing buttons first
        dropdown.menu.querySelectorAll(`.${dropdown.navButtonClass}`).forEach(btn => btn.remove());
    
        // Create navigation buttons
        const topButton = document.createElement('button');
        topButton.className = `${dropdown.navButtonClass} top`;
        topButton.innerHTML = '<span class="material-icons">expand_less</span>';
        
        const bottomButton = document.createElement('button');
        bottomButton.className = `${dropdown.navButtonClass} bottom`;
        bottomButton.innerHTML = '<span class="material-icons">expand_more</span>';
    
        // Add buttons to the dropdown
        dropdown.menu.insertBefore(topButton, dropdown.menu.firstChild);
        dropdown.menu.appendChild(bottomButton);
    
        const checkButtons = () => {
            const scrollTop = dropdown.menu.scrollTop;
            const buffer = 1;
            const maxScroll = dropdown.menu.scrollHeight - dropdown.menu.clientHeight;
            
            const atTop = scrollTop <= buffer;
            const atBottom = scrollTop >= maxScroll - buffer;
            
            topButton.style.opacity = atTop ? '0' : '1';
            topButton.style.pointerEvents = atTop ? 'none' : 'auto';
            
            bottomButton.style.opacity = atBottom ? '0' : '1';
            bottomButton.style.pointerEvents = atBottom ? 'none' : 'auto';
        };
    
        // Improved touch handling with better isolation
        let touchStartY = 0;
        let isDragging = false;
        let initialScrollTop = 0;
        
        dropdown.menu.addEventListener('touchstart', (e) => {
            if (e.target.closest(`.${dropdown.navButtonClass}`)) return;
            touchStartY = e.touches[0].clientY;
            initialScrollTop = dropdown.menu.scrollTop;
            isDragging = true;
            dropdown.menu.style.scrollBehavior = 'auto';
            e.stopPropagation(); // Prevent event from reaching parent
            e.preventDefault();
        }, { passive: false });
    
        dropdown.menu.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const currentY = e.touches[0].clientY;
            const diff = touchStartY - currentY;
            dropdown.menu.scrollTop = initialScrollTop + diff;
            e.stopPropagation(); // Prevent event from reaching parent
            e.preventDefault();
        }, { passive: false });
    
        dropdown.menu.addEventListener('touchend', () => {
            isDragging = false;
            dropdown.menu.style.scrollBehavior = 'smooth';
            e.stopPropagation(); // Prevent event from reaching parent
        }, { passive: true });
    
        // Regular scroll events
        dropdown.menu.addEventListener('scroll', () => {
            cancelAnimationFrame(dropdown.menu._scrollTimer);
            dropdown.menu._scrollTimer = requestAnimationFrame(checkButtons);
        }, { passive: true });
    
        // Button event handlers
        topButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            smoothScroll('top');
        });
    
        bottomButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            smoothScroll('bottom');
        });
    
        const smoothScroll = (direction) => {
            if (dropdown.menu._isScrolling) return;
            dropdown.menu._isScrolling = true;
            
            const amount = dropdown.menu.clientHeight * 0.8;
            const start = dropdown.menu.scrollTop;
            const target = direction === 'top' 
                ? Math.max(0, start - amount)
                : Math.min(start + amount, dropdown.menu.scrollHeight - dropdown.menu.clientHeight);
            
            const duration = 300;
            const startTime = performance.now();
    
            const animate = (time) => {
                const elapsed = time - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easedProgress = easeOutQuad(progress);
                dropdown.menu.scrollTop = start + (target - start) * easedProgress;
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    dropdown.menu._isScrolling = false;
                    checkButtons();
                }
            };
            
            requestAnimationFrame(animate);
        };
    
        checkButtons();
    }    

    close(id) {
        const dropdown = this.dropdowns[id];
        if (!dropdown) return;

        dropdown.menu.classList.remove('show', 'visible');
        dropdown.toggle.classList.remove('active');
        
        setTimeout(() => {
            if (!dropdown.menu.classList.contains('show') && 
                !dropdown.menu.classList.contains('visible')) {
                dropdown.menu.style.display = 'none';
            }
        }, 300);
        
        if (this.currentOpen === id) {
            this.currentOpen = null;
        }
    }

handleOutsideClick(e) {
    // Get the actual target for touch events
    const target = e.target || (e.touches && e.touches[0] && e.touches[0].target);
    if (!target) return;

    // Check if click was on any dropdown toggle or menu
    const clickedInside = Object.values(this.dropdowns).some(dropdown => {
        return dropdown.toggle?.contains(target) || 
               dropdown.menu?.contains(target) ||
               target.closest('.history-nav-button') ||
               target.closest('.tooltip-nav-button') ||
               target.closest('.history-dropdown .radio');
    });
    
    if (!clickedInside && this.currentOpen) {
        this.close(this.currentOpen);
    }
}

    updateDropdownHeights() {
        const audioContainer = document.querySelector('.audio-container');
        if (!audioContainer) return;
        
        const containerRect = audioContainer.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const headerHeight = document.querySelector('.header')?.clientHeight || 0;
        const safeAreaBottom = window.visualViewport?.offsetTop || 0;
        
        // Calculate max height with safe area consideration
        const maxDropdownHeight = Math.max(150, 
            windowHeight - headerHeight - containerRect.bottom - safeAreaBottom);
    
        Object.values(this.dropdowns).forEach(dropdown => {
            if (!dropdown.menu) return;
            
            dropdown.menu.style.maxHeight = `${maxDropdownHeight}px`;
            
            if (dropdown.needsScroll) {
                dropdown.menu.style.overflowY = 'auto';
                dropdown.menu.style.overscrollBehavior = 'contain';
            }
        });
    } 
}

function getGenreIcon(genre) {
    const genreIcons = {
        'pop': 'mic_external_on',
        'rock': 'rocket',
        'hiphop': 'mic',
        'zabavna': 'auto_awesome',
        'narodna': 'nature_people',
        'exyu': 'language',
        'strana': 'public',
        'kids': 'child_care',
        'classical': 'piano',
        'chill': 'air',
        'house': 'cottage',
        'dance': 'celebration',
        'metal': 'flash_on',
        'techno': 'speaker',
        'top': 'leaderboard'
    };
    
    return `<span class="material-icons" style="font-size:18px;">${genreIcons[genre] || 'queue_music'}</span>`;
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function updateTooltipContent() {
    const tooltip = document.querySelector('.genre-tooltip');
    if (!tooltip) return;
    
    // Store reference to existing buttons
    const existingButtons = {
        top: tooltip.querySelector('.tooltip-nav-button.top'),
        bottom: tooltip.querySelector('.tooltip-nav-button.bottom')
    };
    
    // Get current station
    let currentStation = document.querySelector('.radio.selected');
    if (!currentStation) {
        const audioText = document.getElementById('audiotext')?.textContent?.trim();
        if (audioText) {
            currentStation = document.querySelector(`.radio[data-name="${audioText}"]`);
        }
    }
    
    if (!currentStation) {
        const lastStation = safeParseJSON("lastStation", null);
        if (lastStation?.name) {
            currentStation = document.querySelector(`.radio[data-name="${lastStation.name}"]`);
        }
    }

    // Default content when no station is found
    if (!currentStation) {
        tooltip.innerHTML = `
            <div class="tooltip-section">
                <strong>Žanrovi:</strong>
                <div class="genre-tooltip-item">Nema informacija o stanici</div>
            </div>
            <div class="tooltip-section">
                <strong>Kvalitet:</strong>
                <div class="quality-info">
                    <span>Nepoznato</span>
                </div>
            </div>
        `;
        return;
    }
    
    // Get genres
    const genres = currentStation.dataset.genre;
    let formattedGenres = '<div class="genre-tooltip-item">Nema informacija o žanru</div>';
    
    if (genres) {
        const genreArray = genres.split(',');
        formattedGenres = genreArray.map(genre => {
            const icon = getGenreIcon(genre.trim());
            return `<div class="genre-tooltip-item">${icon} ${capitalizeFirstLetter(genre.trim())}</div>`;
        }).join('');
    }
    
    // Get quality info
    const bitrate = currentStation.dataset.bitrate;
    const format = currentStation.dataset.format;
    
    let qualitySection = '';
    if (bitrate && !isUnknownValue(bitrate) && format && !isUnknownValue(format)) {
        const displayBitrate = bitrate.toLowerCase().endsWith('kbps') ? 
            bitrate : 
            (bitrate.match(/\d+/) ? `${bitrate}kbps` : '');
        
        qualitySection = `
            <div class="tooltip-section">
                <strong class="quality-title">Kvalitet:</strong>
                <div class="quality-info">
                    ${displayBitrate ? `<span title="Bitrate">${displayBitrate}</span>` : ''}
					<br/>
                    ${format ? `<div class="format"><span class="material-icons">audiotrack</span><span title="Format">${format}</span></div>` : ''}
                </div>
            </div>
        `;
    }
    
    // Create a container for the new content
    const contentContainer = document.createElement('div');
    contentContainer.innerHTML = `
        <div class="tooltip-section">
            <strong>Žanrovi:</strong>
            ${formattedGenres}
        </div>
        ${qualitySection}
    `;
    
    // Clear existing content but preserve buttons
    tooltip.innerHTML = '';
	
	// Re-add buttons if they existed
    if (existingButtons.top) tooltip.appendChild(existingButtons.top);
    tooltip.appendChild(contentContainer);
    if (existingButtons.bottom) tooltip.appendChild(existingButtons.bottom);
    
    // Reinitialize button functionality if dropdown is open
    if (dropdownManager.currentOpen === 'tooltip') {
        dropdownManager.setupTooltipScroll();
    }
}

// Helper function to check for unknown values
function isUnknownValue(value) {
    if (!value) return true;
    const val = value.toString().toLowerCase().trim();
    return val === 'undefined' || val === 'undefinedkbps' || val === 'plain' || val === 'html' || val === '';
}

function setupRecentlyPlayedToggle() {
    const audioContainer = document.querySelector('.audio-container');
    const toggle = document.getElementById('recentlyPlayedToggle');
    const toggleHandle = toggle?.querySelector('.toggle-handle');

    if (!toggleHandle) return;

    // Handle toggle
    const toggleCollapse = () => {
        const isExpanded = !audioContainer.classList.contains('expanded');
        audioContainer.classList.toggle('expanded', isExpanded);
        
        // Close any open dropdowns when collapsing
        if (!isExpanded && dropdownManager.currentOpen) {
            dropdownManager.close(dropdownManager.currentOpen);
        }
        
        updateAudioContainerHeight();
        ScrollbarManager.updateAll();
    };

    toggleHandle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCollapse();
    });

    // Add touch event for mobile
    toggleHandle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCollapse();
    }, { passive: false });
}

function updateDropdownHeights() {
    const audioContainer = document.querySelector('.audio-container');
    if (!audioContainer) return;
    
    const containerRect = audioContainer.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const headerHeight = document.querySelector('.header')?.clientHeight || 0;
    
    // Calculate max height based on available space
    const maxDropdownHeight = `${Math.max(150, windowHeight - headerHeight - containerRect.bottom - 20)}px`;

    // Apply to all dropdowns
    if (dropdownManager.dropdowns.history?.menu) {
        dropdownManager.dropdowns.history.menu.style.maxHeight = maxDropdownHeight;
    }
    
    if (dropdownManager.dropdowns.tooltip?.menu) {
        // First set max-height to calculate proper scroll height
        dropdownManager.dropdowns.tooltip.menu.style.maxHeight = 'none';
        const naturalHeight = dropdownManager.dropdowns.tooltip.menu.scrollHeight;
        
        // Then apply constrained height
        dropdownManager.dropdowns.tooltip.menu.style.maxHeight = 
            naturalHeight > parseFloat(maxDropdownHeight) ? maxDropdownHeight : `${naturalHeight}px`;
        
        // Check overflow after height change
        requestAnimationFrame(() => {
            if (dropdownManager.dropdowns.tooltip.menu._updateButtons) {
                dropdownManager.dropdowns.tooltip.menu._updateButtons();
            }
        });
    }
}

function setupAudioContainerObserver() {
    const audioContainer = document.querySelector('.audio-container');
    if (!audioContainer) return;
    
    const observer = new ResizeObserver(() => {
        ScrollbarManager.updateAll();
    });
    observer.observe(audioContainer);
    
    // Add to cleanup:
    window.addEventListener('beforeunload', () => {
        observer.disconnect();
    });
}

function setupAudioContainerGestures() {
    const audioContainer = document.querySelector('.audio-container');
    if (!audioContainer) return;

    let startY = 0;
    let startHeight = 0;
    let isDragging = false;

    audioContainer.addEventListener('touchstart', (e) => {
        // Only start drag if touching the toggle handle
        if (!e.target.closest('.toggle-handle')) {
            return;
        }
        
        startY = e.touches[0].clientY;
        startHeight = audioContainer.clientHeight;
        isDragging = true;
        audioContainer.style.transition = 'none';
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        
        const currentY = e.touches[0].clientY;
        const deltaY = startY - currentY;
        const newHeight = Math.min(Math.max(COLLAPSED_HEIGHT, startHeight + deltaY), 300);
        
        audioContainer.style.height = `${newHeight}px`;
        ScrollbarManager.updateAll();
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        
        const currentHeight = audioContainer.clientHeight;
        audioContainer.style.transition = '';
        
        // Snap to nearest state
        if (currentHeight > COLLAPSED_HEIGHT + 50) {
            audioContainer.classList.add('expanded');
        } else {
            audioContainer.classList.remove('expanded');
        }
        
        updateAudioContainerHeight();
    });
}

function setupScrollableContainer(container, wrapperClass, buttonClass) {
    // Clear existing buttons and debounced handlers
    [...container.querySelectorAll(`.${buttonClass}`)].forEach(btn => btn.remove());
    if (container._scrollHandler) {
        container.removeEventListener('scroll', container._scrollHandler);
    }

    // Create navigation buttons
    const topButton = document.createElement('button');
    topButton.className = `${buttonClass} top`;
    topButton.innerHTML = '<span class="material-icons">expand_less</span>';
    topButton.setAttribute('aria-label', 'Scroll up');
    
    const bottomButton = document.createElement('button');
    bottomButton.className = `${buttonClass} bottom`;
    bottomButton.innerHTML = '<span class="material-icons">expand_more</span>';
    bottomButton.setAttribute('aria-label', 'Scroll down');

    container.insertBefore(topButton, container.firstChild);
    container.appendChild(bottomButton);

    // Initialize as hidden
    topButton.style.display = 'none';
    bottomButton.style.display = 'none';

    function checkOverflow() {
        // Force reflow before checking
        container.style.overflowY = 'hidden';
        void container.offsetWidth;
        container.style.overflowY = 'auto';
        
        const hasOverflow = container.scrollHeight > container.clientHeight;
        topButton.style.display = hasOverflow ? 'flex' : 'none';
        bottomButton.style.display = hasOverflow ? 'flex' : 'none';
        
        if (hasOverflow) {
            updateButtonVisibility();
        } else {
            topButton.style.display = 'none';
            bottomButton.style.display = 'none';
        }
    }

function updateButtonVisibility() {
    const scrollTop = stations.scrollTop;
    const maxScroll = stations.scrollHeight - stations.clientHeight;
    const buffer = 1;
    
    // More precise detection
    const atTop = scrollTop <= buffer;
    const atBottom = scrollTop >= maxScroll - buffer;
    
        topButton.style.opacity = atTop ? '0' : '1';
        topButton.style.pointerEvents = atTop ? 'none' : 'auto';
        
        bottomButton.style.opacity = atBottom ? '0' : '1';
        bottomButton.style.pointerEvents = atBottom ? 'none' : 'auto';
    
    // Force reflow to ensure smooth transitions

}

    function smoothScroll(direction) {
        if (container._isAnimating) return;
        container._isAnimating = true;
        
        const scrollAmount = container.clientHeight * 0.8;
        const start = container.scrollTop;
        const target = direction === 'top' 
            ? Math.max(0, start - scrollAmount)
            : Math.min(start + scrollAmount, container.scrollHeight - container.clientHeight);
        
        const duration = 300;
        const startTime = performance.now();

        function animateScroll(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out function
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            
            container.scrollTop = start + (target - start) * easedProgress;
            
            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            } else {
                container._isAnimating = false;
                updateButtonVisibility();
            }
        }

        requestAnimationFrame(animateScroll);
    }

    // Event listeners
    topButton.addEventListener('click', (e) => {
        e.stopPropagation();
        smoothScroll('top');
    });
    bottomButton.addEventListener('click', (e) => {
        e.stopPropagation();
        smoothScroll('bottom');
    });
    
    // Debounced scroll handler
    const debouncedScroll = () => {
        cancelAnimationFrame(container._scrollRAF);
        container._scrollRAF = requestAnimationFrame(updateButtonVisibility);
    };
    container._scrollHandler = debouncedScroll;

    // Touch events for Android Chrome
    container.addEventListener('touchmove', (e) => {
        if (e.target === container || container.contains(e.target)) {
            e.preventDefault();
        }
    }, { passive: false });

    // Initial check with resize observer
    const resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(container._resizeTimer);
        container._resizeTimer = requestAnimationFrame(checkOverflow);
    });
    resizeObserver.observe(container);

    // Store references for cleanup
    container._resizeObserver = resizeObserver;
    
    return { checkOverflow, updateButtonVisibility };
}

function loadRecentlyPlayed() {
    const container = document.querySelector('.recently-played-stations');
    if (!container) return;
    
    container.scrollTop = 0;
    
    const recentlyPlayed = safeParseJSON('recentlyPlayed', []);
    const uniqueStations = [...new Map(recentlyPlayed.map(item => [item.link, item])).values()].slice(0, 12);

    container.innerHTML = '';
    
    // Change to vertical layout
    container.style.flexDirection = 'column';
    container.style.overflowY = 'auto';
    container.style.overflowX = 'hidden';
    
    if (uniqueStations.length === 0) {
        container.innerHTML = '<div class="empty-message">Nema nedavno slušanih stanica...</div>';
        return;
    }

    // Get current station name
    const currentStationName = currentStation?.name || 
                             safeParseJSON("lastStation", {}).name;

    uniqueStations.forEach(station => {
        const radio = document.createElement('div');
        radio.className = 'radio';
        if (station.name === currentStationName) {
            radio.classList.add('selected');
        }
        radio.dataset.name = station.name;
        radio.dataset.link = station.link;
        radio.dataset.genre = station.genre || '';
        radio.innerHTML = `<div class="radio-text">${station.name}</div>`;
        radio.addEventListener('click', (e) => {
            e.stopPropagation();
            changeStation(station.name, station.link);
        });
        container.appendChild(radio);
    });
}

function createExpandButton(stations, category) {
    const expandButton = document.createElement("button");
    expandButton.className = "expand-button";
    expandButton.dataset.expanded = "false";

    const content = document.createElement("div");
    Object.assign(content.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    });

    const icon = document.createElement("span");
    icon.className = "material-icons";
    icon.textContent = "expand_more";
    icon.style.margin = "0px";

    const text = document.createElement("span");
    text.className = "expand-text";
    text.textContent = "Još stanica";
    Object.assign(text.style, {
        fontSize: '0px',
        transition: 'font-size 0.15s ease-in-out'
    });

    content.append(icon, text);
    expandButton.append(content);

    expandButton.addEventListener("mouseover", () => {
        expandButton.querySelector('.expand-text').style.fontSize = '15px';
    });

    expandButton.addEventListener("mouseout", () => {
        expandButton.querySelector('.expand-text').style.fontSize = '0px';
    });

    expandButton.addEventListener("click", (e) => {
        e.stopPropagation();
        const expanded = expandButton.dataset.expanded === "true";
        const newState = !expanded;
        
        expandButton.dataset.expanded = newState.toString();
        expandButton.querySelector('.material-icons').textContent = newState ? "expand_less" : "expand_more";
        expandButton.querySelector('.expand-text').textContent = newState ? "Manje" : "Još stanica";
        
        stations.forEach((station, index) => {
            if (index >= 10) {
                station.style.display = newState ? "flex" : "none";
            }
        });
        
        // Update scrollbar after expanding/collapsing
        setTimeout(() => {
            ScrollbarManager.updateAll();
        }, 10);
    });

    return expandButton;
}

// Playback Control Functions
playPauseBtn.addEventListener("click", () => {
    if (audio.paused) {
        audio.play().then(() => {
            // Immediately check metadata after play starts
            checkMetadata(true);
            setupNowPlayingMetadata();
        }).catch(handlePlayError);
    } else {
        audio.pause();
    }
});

audio.addEventListener("play", updatePlayPauseButton);
audio.addEventListener("pause", updatePlayPauseButton);

function updatePlayPauseButton() {
    const audioPlayer = document.querySelector('.audio-player');
    playPauseBtn.innerHTML = `<span class="material-icons">${audio.paused ? 'play_arrow' : 'stop'}</span>`;
    
    // Toggle play-mode class based on paused state
    if (audio.paused) {
        playPauseBtn.classList.add('play-mode');
        audioPlayer.classList.add('play-mode');
    } else {
        playPauseBtn.classList.remove('play-mode');
        audioPlayer.classList.remove('play-mode');
        // Check metadata when playback starts
        checkMetadata(true);
        setupNowPlayingMetadata();
    }

    document.querySelectorAll(".radio.selected .equalizer").forEach(equalizer => {
        equalizer.className = audio.paused ? "equalizer displaypaused" : "equalizer animate";
    });
}

// Volume Control Functions
volumeSlider.addEventListener("input", () => {
    audio.volume = volumeSlider.value;
    audio.muted = audio.volume === 0;
    if (!audio.muted) lastVolume = audio.volume;
    updateVolumeIcon();
});

volumeIcon.addEventListener("click", () => {
    audio.muted = !audio.muted;
    audio.volume = audio.muted ? 0 : lastVolume;
    volumeSlider.value = audio.volume;
    updateVolumeIcon();
});

function updateVolumeIcon() {
    volumeIcon.innerHTML = audio.muted || audio.volume === 0 ? "volume_off" :
                         audio.volume < 0.5 ? "volume_down" : "volume_up";
}

// Search and Filter Functions
function debounce(func, wait, immediate) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

function filterStations() {
    const query = document.getElementById("stationSearch").value.toLowerCase();
    const searching = query !== "";
    const noResultsElement = document.querySelector('.no-results');
    
    document.getElementById("clearSearch").style.display = searching ? "block" : "none";

    if (searching) {
        document.querySelectorAll('.expand-button').forEach(btn => btn.remove());
        document.querySelectorAll('.category-container').forEach(cat => {
            cat.classList.remove("no-radius", "has-expand-button");
        });
    }

    let hasVisibleStations = false;
    
    document.querySelectorAll('.radio:not(.history-dropdown .radio)').forEach(station => {
        const matches = station.dataset.name.toLowerCase().includes(query);
        station.style.display = matches ? 'flex' : 'none';
        if (matches) hasVisibleStations = true;
    });

    document.querySelectorAll('.category-container').forEach(category => {
        const hasVisible = [...category.querySelectorAll('.radio:not(.history-dropdown .radio)')]
            .some(station => station.style.display !== 'none');
        
        category.style.display = hasVisible ? 'flex' : 'none';
        const title = category.previousElementSibling;
        if (title?.classList.contains("category")) {
            title.style.display = hasVisible ? 'flex' : 'none';
        }
        
        if (hasVisible) hasVisibleStations = true;
    });
    
    // Show/hide no results message
    if (noResultsElement) {
        noResultsElement.style.display = (searching && !hasVisibleStations) ? 'flex' : 'none';
    }
    
    // When search is cleared by backspacing, reapply genre filter and setup expand buttons
    if (!searching) {
        currentGenre = 'all';
        document.querySelector('.genre-button[data-genre="all"]')?.classList.add('active');
        document.querySelectorAll('.genre-button:not([data-genre="all"])').forEach(btn => {
            btn.classList.remove('active');
        });
        applyGenreFilter();
        setupExpandableCategories();
    }
    
    // Update scrollbar after filtering
    setTimeout(() => {
        ScrollbarManager.updateAll();
    }, 10);
}

function setupExpandableCategories() {
    // Remove all existing expand buttons
    document.querySelectorAll('.expand-button').forEach(btn => btn.remove());
    
    // Skip if searching
    if (document.getElementById("stationSearch").value.trim() !== "") return;
    
    // Process each category
    document.querySelectorAll(".category-container").forEach(category => {
        category.classList.remove("no-radius", "has-expand-button");
        
        const stations = [...category.querySelectorAll(".radio")]
            .filter(station => window.getComputedStyle(station).display !== "none");
        
        if (stations.length === 0) {
            category.style.display = "none";
            const title = category.previousElementSibling;
            if (title?.classList.contains("category")) {
                title.style.display = "none";
            }
            return;
        }
        
        // Show category and title
        category.style.display = "flex";
        const title = category.previousElementSibling;
        if (title?.classList.contains("category")) {
            title.style.display = "flex";
        }
        
        // Add expand button if needed
        if (stations.length > 10) {
            category.append(createExpandButton(stations, category));
            category.classList.add("no-radius", "has-expand-button");
            
            stations.forEach((station, index) => {
                station.style.display = index < 10 ? "flex" : "none";
            });
        } else {
            stations.forEach(station => {
                station.style.display = "flex";
            });
        }
    });
    
    // Update scrollbar after setting up expandable categories
    setTimeout(() => {
		ScrollbarManager.updateAll();
    }, 10);
}

function loadPreferences() {
    const savedTheme = localStorage.getItem("theme") || "dark";
    const savedColor = localStorage.getItem("accentColor") || "blue";
    const savedStation = safeParseJSON("lastStation", {});

    setTheme(savedTheme);
    changeColor(savedColor);

    if (savedStation.name && savedStation.link) {
        // Update UI immediately
        document.getElementById("audiotext").innerHTML = 
            `<div class="station-name">${savedStation.name}</div>`;
        document.title = `Radio | ${savedStation.name}`;
        updateSelectedStation(savedStation.name);
        
        // Set initial play/pause button state
        updatePlayPauseButton();
        
        // Set current station but don't auto-play
        currentStation = savedStation;
        audio.src = savedStation.link;
        
        // Check metadata after a short delay
        setTimeout(() => {
            checkMetadata(true);
            setupNowPlayingMetadata();
        }, 300);
    } else {
        document.title = "Radio";
        updatePlayPauseButton();
        
        // Ensure empty state is handled
        document.getElementById("audiotext").innerHTML = 
            `<div class="station-name">Odaberite stanicu</div>`;
    }
}

function updateAudioContainerHeight() {
    const audioContainer = document.querySelector('.audio-container');
    if (!audioContainer) return;
    
    // Calculate new height based on current state
    let newHeight = COLLAPSED_HEIGHT;
    
    if (audioContainer.classList.contains('has-now-playing')) {
        newHeight = audioContainer.classList.contains('expanded') ? 235 : 170;
    } else {
        newHeight = audioContainer.classList.contains('expanded') ? 215 : 150;
    }
    
    // Only update if height is actually changing
    const currentHeight = parseFloat(getComputedStyle(audioContainer).height);
    if (Math.abs(currentHeight - newHeight) < 1) return;
    
    // Apply the new height with transition
    audioContainer.style.height = `${newHeight}px`;
    
    // Update scrollbar and other dependent elements
    ScrollbarManager.updateAll();
}

const ScrollbarManager = {
    resizeObservers: [],
    resizeTimeout: null,
    
    init(cachedElements = {}) {
        this.scrollList = cachedElements.scrollList || document.querySelector('.scroll-list');
        this.scrollbarThumb = document.querySelector('.scrollbar-thumb');
        this.scrollbarTrack = document.querySelector('.scrollbar-track');
        
        if (!this.scrollList || !this.scrollbarThumb || !this.scrollbarTrack) return;

        // Move scrollbar elements inside scroll-list
        this.scrollList.appendChild(this.scrollbarTrack);
        this.scrollbarTrack.appendChild(this.scrollbarThumb);
        
        this.setupEvents();
        this.updateAll();
        this.setupResizeObservers();
    },

    setupResizeObservers() {
        // Clean up existing observers
        this.resizeObservers.forEach(observer => observer.disconnect());
        this.resizeObservers = [];
        
        const debouncedResize = debounce(() => {
            this.updateTrackPosition();
        }, 100);
        
        const observer = new ResizeObserver(debouncedResize);
        
        [
            document.querySelector('.audio-container'),
            document.body
        ].filter(Boolean).forEach(el => observer.observe(el));
        
        this.resizeObservers.push(observer);
    },
      
    setupEvents() {
        // Use passive listeners where possible
        window.addEventListener('resize', this.handleWindowResize.bind(this), { passive: true });
        
        // Thumb dragging
        this.scrollbarThumb.addEventListener('mousedown', this.handleThumbMouseDown.bind(this));
        this.scrollbarThumb.addEventListener('touchstart', this.handleThumbTouchStart.bind(this), { passive: false });
        
        // Track interaction
        this.scrollbarTrack.addEventListener('click', this.handleTrackClick.bind(this));
        this.scrollbarTrack.addEventListener('wheel', this.handleTrackWheel.bind(this), { passive: false });
        this.scrollbarTrack.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        
        // Scroll events
        this.scrollList.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
        
        // Hover effects
        this.scrollbarTrack.addEventListener('mouseenter', () => {
            this.scrollbarThumb.classList.add('hovering');
        });
        
        this.scrollbarTrack.addEventListener('mouseleave', () => {
            this.scrollbarThumb.classList.remove('hovering');
        });
        
        // Resize observer for scroll list
        this.resizeObserver = new ResizeObserver(() => {
            cancelAnimationFrame(this.resizeRAF);
            this.resizeRAF = requestAnimationFrame(() => this.updateAll());
        });
        this.resizeObserver.observe(this.scrollList);
    },
    
    handleWindowResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.updateTrackPosition();
        }, 100);
    },
    
    handleTrackWheel(e) {
        e.preventDefault();
        e.stopPropagation();
        this.scrollList.scrollTop += e.deltaY * 2;
        this.positionThumb();
    },
    
    handleScroll() {
        cancelAnimationFrame(this.scrollRAF);
        this.scrollRAF = requestAnimationFrame(() => {
            this.positionThumb();
        });
    },
    
    updateAll() {
        this.updateThumbSize();
        this.positionThumb();
        this.updateTrackPosition();
    },
    
    updateThumbSize() {
        const { scrollHeight, clientHeight } = this.scrollList;
        
        if (scrollHeight <= clientHeight) {
            this.scrollbarThumb.style.display = 'none';
            return;
        }
        
        const thumbHeight = Math.max(30, (clientHeight / scrollHeight) * clientHeight);
        this.scrollbarThumb.style.display = 'block';
        this.scrollbarThumb.style.height = `${thumbHeight}px`;
    },
  
    positionThumb() {
        const { scrollHeight, clientHeight, scrollTop } = this.scrollList;
        
        if (scrollHeight <= clientHeight) return;
        
        const scrollPercentage = scrollTop / (scrollHeight - clientHeight);
        const trackHeight = this.scrollbarTrack.clientHeight;
        const thumbHeight = this.scrollbarThumb.clientHeight;
        const maxThumbPosition = trackHeight - thumbHeight;
        const thumbPosition = Math.min(scrollPercentage * maxThumbPosition, maxThumbPosition);
        
        this.scrollbarThumb.style.top = `${thumbPosition}px`;
    },
  
    handleThumbMouseDown(e) {
        e.preventDefault();
        this.scrollbarThumb.classList.add('dragging');
        
        const startY = e.clientY;
        const startTop = parseFloat(this.scrollbarThumb.style.top) || 0;
        const trackHeight = this.scrollbarTrack.clientHeight;
        const thumbHeight = this.scrollbarThumb.clientHeight;
        
        const moveHandler = (e) => {
            const deltaY = e.clientY - startY;
            let newTop = Math.max(0, Math.min(startTop + deltaY, trackHeight - thumbHeight));
            
            const scrollPercentage = newTop / (trackHeight - thumbHeight);
            const maxScroll = this.scrollList.scrollHeight - this.scrollList.clientHeight;
            
            this.scrollbarThumb.style.top = `${newTop}px`;
            this.scrollList.scrollTop = Math.min(scrollPercentage * maxScroll, maxScroll);
        };
        
        const upHandler = () => {
            this.scrollbarThumb.classList.remove('dragging');
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
        };
        
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    },
    
    handleThumbTouchStart(e) {
        e.preventDefault();
        this.scrollbarThumb.classList.add('dragging');
        
        const touch = e.touches[0];
        const startY = touch.clientY;
        const startTop = parseFloat(this.scrollbarThumb.style.top) || 0;
        const trackHeight = this.scrollbarTrack.clientHeight;
        const thumbHeight = this.scrollbarThumb.clientHeight;
        
        const moveHandler = (e) => {
            const touch = e.touches[0];
            const deltaY = touch.clientY - startY;
            let newTop = Math.max(0, Math.min(startTop + deltaY, trackHeight - thumbHeight));
            
            const scrollPercentage = newTop / (trackHeight - thumbHeight);
            const maxScroll = this.scrollList.scrollHeight - this.scrollList.clientHeight;
            
            this.scrollbarThumb.style.top = `${newTop}px`;
            this.scrollList.scrollTop = Math.min(scrollPercentage * maxScroll, maxScroll);
        };
        
        const endHandler = () => {
            this.scrollbarThumb.classList.remove('dragging');
            document.removeEventListener('touchmove', moveHandler);
            document.removeEventListener('touchend', endHandler);
        };
        
        document.addEventListener('touchmove', moveHandler, { passive: false });
        document.addEventListener('touchend', endHandler, { passive: true });
    },
  
    handleTrackClick(e) {
        if (e.target === this.scrollbarThumb) return;
        
        const trackRect = this.scrollbarTrack.getBoundingClientRect();
        const thumbHeight = this.scrollbarThumb.clientHeight;
        const clickPosition = e.clientY - trackRect.top - (thumbHeight / 2);
        const trackHeight = trackRect.height;
        const thumbPosition = Math.max(0, Math.min(clickPosition, trackHeight - thumbHeight));
        
        const scrollPercentage = thumbPosition / (trackHeight - thumbHeight);
        const maxScroll = this.scrollList.scrollHeight - this.scrollList.clientHeight;
        
        this.scrollList.scrollTo({
            top: Math.min(scrollPercentage * maxScroll, maxScroll),
            behavior: 'smooth'
        });
    },
  
    scrollBy(amount) {
        const currentScroll = this.scrollList.scrollTop;
        const maxScroll = this.scrollList.scrollHeight - this.scrollList.clientHeight;
        
        this.scrollList.scrollTo({
            top: Math.max(0, Math.min(currentScroll + amount, maxScroll)),
            behavior: 'smooth'
        });
    },
    
    updateTrackPosition() {
        const audioContainer = document.querySelector('.audio-container');
        if (!audioContainer) return;
        
        // Calculate heights
        const audioContainerHeight = parseFloat(getComputedStyle(audioContainer).height);
        const viewportHeight = window.innerHeight;
        const scrollListTop = this.scrollList.getBoundingClientRect().top;
        
        // Set dimensions
        const availableHeight = viewportHeight - scrollListTop - audioContainerHeight;
        const finalHeight = Math.max(100, availableHeight);
        
        this.scrollList.style.bottom = `${audioContainerHeight}px`;
        this.scrollList.style.maxHeight = `${finalHeight}px`;
        this.scrollbarTrack.style.height = `${finalHeight}px`;
        
        this.updateThumbSize();
        this.positionThumb();
    },

    setupAutoHide() {
        if (!this.scrollList || !this.scrollbarThumb) return;
        
        // Show scrollbar on scroll
        this.scrollList.addEventListener('scroll', () => {
            lastScrollTime = Date.now();
            this.scrollbarThumb.classList.add('visible');
            clearTimeout(scrollbarHideTimeout);
            
            scrollbarHideTimeout = setTimeout(() => {
                if (Date.now() - lastScrollTime >= SCROLLBAR_HIDE_DELAY && 
                    !this.scrollbarThumb.matches(':hover') && 
                    !this.scrollbarThumb.classList.contains('dragging')) {
                    this.scrollbarThumb.classList.remove('visible');
                }
            }, SCROLLBAR_HIDE_DELAY);
        });

        // Hover effects
        const thumb = this.scrollbarThumb;
        thumb.addEventListener('mouseenter', () => {
            thumb.classList.add('visible');
            clearTimeout(scrollbarHideTimeout);
        });

        thumb.addEventListener('mouseleave', () => {
            scrollbarHideTimeout = setTimeout(() => {
                if (!thumb.classList.contains('dragging') && 
                    Date.now() - lastScrollTime >= SCROLLBAR_HIDE_DELAY) {
                    thumb.classList.remove('visible');
                }
            }, SCROLLBAR_HIDE_DELAY);
        });

        // Initial hide
        thumb.classList.remove('visible');
    }
};

// Helper to check if element is in viewport
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Helper to scroll element into view if needed
function scrollIntoViewIfNeeded(element) {
    if (!isInViewport(element)) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}

function setupGenreButtonsNavigation() {
    const genreWrapper = document.querySelector('.genre-buttons-wrapper');
    if (!genreWrapper) return;
    
    const genreButtons = genreWrapper.querySelector('.genre-buttons');
    if (!genreButtons) return;

    // Create navigation buttons
    const leftButton = document.createElement('button');
    leftButton.className = 'genre-nav-button left';
    leftButton.innerHTML = '<span class="material-icons">chevron_left</span>';
    leftButton.setAttribute('aria-label', 'Scroll left');
    
    const rightButton = document.createElement('button');
    rightButton.className = 'genre-nav-button right';
    rightButton.innerHTML = '<span class="material-icons">chevron_right</span>';
    rightButton.setAttribute('aria-label', 'Scroll right');
    
    // Insert buttons
    genreWrapper.insertBefore(leftButton, genreButtons);
    genreWrapper.appendChild(rightButton);

    function checkOverflow() {
        const hasOverflow = genreButtons.scrollWidth > genreButtons.clientWidth;
        leftButton.style.display = hasOverflow ? 'flex' : 'none';
        rightButton.style.display = hasOverflow ? 'flex' : 'none';
        updateButtonVisibility();
    }

    function updateButtonVisibility() {
        const scrollLeft = genreButtons.scrollLeft;
        const maxScroll = genreButtons.scrollWidth - genreButtons.clientWidth;
        
        leftButton.style.display = scrollLeft <= 1 ? 'none' : 'flex';
        rightButton.style.display = scrollLeft >= maxScroll - 1 ? 'none' : 'flex';
    }

    function smoothScroll(direction) {
        const scrollAmount = genreButtons.clientWidth * 0.8;
        const start = genreButtons.scrollLeft;
        const maxScroll = genreButtons.scrollWidth - genreButtons.clientWidth;
        const target = direction === 'left' 
            ? Math.max(0, start - scrollAmount)
            : Math.min(start + scrollAmount, maxScroll);
        
        const duration = 300;
        const startTime = performance.now();

        function animateScroll(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 2);
            
            genreButtons.scrollLeft = start + (target - start) * easedProgress;
            
            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            } else {
                updateButtonVisibility();
            }
        }

        requestAnimationFrame(animateScroll);
    }

    // Event listeners
    leftButton.addEventListener('click', () => smoothScroll('left'));
    rightButton.addEventListener('click', () => smoothScroll('right'));
    
    genreButtons.addEventListener('scroll', () => {
        cancelAnimationFrame(genreButtons._scrollRAF);
        genreButtons._scrollRAF = requestAnimationFrame(updateButtonVisibility);
    }, { passive: true });

    // Check on resize
    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(genreButtons);
    resizeObserver.observe(genreWrapper);

    // Initial check
    checkOverflow();
}

function setupGenreCategoriesSwipe() {
    const genreWrapper = document.querySelector('.genre-buttons-wrapper');
    if (!genreWrapper) return;
    
    const genreButtons = genreWrapper.querySelector('.genre-buttons');
    if (!genreButtons) return;

    let touchStartX = 0;
    let isSwiping = false;
    let scrollLeftStart = 0;
    let touchMoved = false;

    genreButtons.addEventListener('touchstart', function(e) {
        if (!e.target.classList.contains('genre-button')) return;
        
        touchStartX = e.changedTouches[0].screenX;
        scrollLeftStart = genreButtons.scrollLeft;
        isSwiping = true;
        touchMoved = false;
        genreButtons.style.scrollBehavior = 'auto';
    }, { passive: true });

    genreButtons.addEventListener('touchmove', function(e) {
        if (!isSwiping) return;
        const touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > 10) {
            touchMoved = true;
            e.preventDefault();
            genreButtons.scrollLeft = scrollLeftStart + diff;
        }
    }, { passive: false });

    genreButtons.addEventListener('touchend', function() {
        if (!isSwiping) return;
        isSwiping = false;
        
        if (!touchMoved) {
            genreButtons.style.scrollBehavior = 'auto';
            return;
        }
        
        // Update buttons visibility
        setTimeout(() => {
            const buttons = genreWrapper.querySelectorAll('.genre-nav-button');
            if (buttons.length) {
                buttons[0].style.display = genreButtons.scrollLeft <= 1 ? 'none' : 'flex';
                buttons[1].style.display = genreButtons.scrollLeft >= 
                    (genreButtons.scrollWidth - genreButtons.clientWidth - 1) ? 'none' : 'flex';
            }
        }, 100);
    }, { passive: true });
}

// Event Listeners
const searchInput = document.getElementById("stationSearch");
const clearSearchIcon = document.getElementById("clearSearch");

clearSearchIcon.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchIcon.style.display = "none";
    currentGenre = 'all';

    // Reset active genre button
    document.querySelectorAll('.genre-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.genre-button[data-genre="all"]')?.classList.add('active');
    
    applyGenreFilter();
    setupExpandableCategories();
});

searchInput.addEventListener("input", debounce(filterStations, 300));