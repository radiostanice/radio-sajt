document.addEventListener("DOMContentLoaded", () => {
// Search container functionality
const searchContainer = document.querySelector('.search-container');
const searchInput = document.getElementById("stationSearch");
const clearSearch = document.getElementById("clearSearch");

if (searchContainer && searchInput && clearSearch) {
    const toggleSearch = expand => {
        searchContainer.style.width = expand ? '250px' : '44px';
        searchContainer.style.borderRadius = expand ? '10px' : '15px';
        
        if (expand) {
            setTimeout(() => {
                searchContainer.classList.toggle('active', true);
                searchInput.focus?.();
            }, 170);
        } else if (!searchInput.value) {
            searchContainer.classList.toggle('active', false);
            searchInput.blur?.();
        }
    };

    searchContainer.addEventListener('click', e => {
        !searchContainer.classList.contains('active') && toggleSearch(true);
        e.stopPropagation();
    });
    
    clearSearch.addEventListener('click', e => {
        searchInput.value = '';
        clearSearch.style.display = 'none';
        filterStations();
        toggleSearch(false);
        e.stopPropagation();
    });
    
    searchInput.addEventListener('input', () => {
        clearSearch.style.display = searchInput.value ? 'block' : 'none';
    });
    
    document.addEventListener('click', e => {
        if (!searchContainer.contains(e.target) && 
            searchContainer.classList.contains('active') &&
            !searchInput.value) {
            toggleSearch(false);
        }
    });
    
    searchContainer.addEventListener('touchend', e => {
        if (!searchContainer.classList.contains('active')) {
            toggleSearch(true);
            e.preventDefault();
        }
    }, { passive: false });
}

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

const handleRadioClick = e => {
    e.type === 'touchend' && e.preventDefault();
    const radio = e.target.closest('.radio');
    if (!radio || (e.type === 'touchend' && radio._touchMoved)) return;

    changeStation(radio.dataset.name, radio.dataset.link, cachedElements);

    if (!radio.closest('.history-dropdown')) return;
    
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (e.type === 'touchend') {
        radio.addEventListener('click', clickEvent => {
            clickEvent.stopPropagation();
            clickEvent.stopImmediatePropagation();
            clickEvent.preventDefault();
        }, { once: true });
    }

    dropdownManager?.currentOpen === 'history' && 
        requestAnimationFrame(() => dropdownManager.keepOpen('history'));
};

// Add touch event handlers for history dropdown
if (cachedElements.historyDropdown) {
    cachedElements.historyDropdown.addEventListener('touchstart', e => {
        const radio = e.target.closest('.radio');
        if (radio) {
            const touch = e.touches[0];
            radio._touchStart = { x: touch.clientX, y: touch.clientY };
            radio._touchMoved = false;
        }
    }, { passive: true });

    cachedElements.historyDropdown.addEventListener('touchmove', e => {
        const radio = e.target.closest('.radio');
        if (radio?._touchStart) {
            const touch = e.touches[0];
            const moveX = Math.abs(touch.clientX - radio._touchStart.x);
            const moveY = Math.abs(touch.clientY - radio._touchStart.y);
            
            if (moveX > 5 || moveY > 5) {
                radio._touchMoved = true;
            }
        }
    }, { passive: true });

    cachedElements.historyDropdown.addEventListener('touchend', function(e) {
        const radio = e.target.closest('.radio');
        if (radio && !radio._touchMoved) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            handleRadioClick(e);
            dropdownManager.currentOpen === 'history' && dropdownManager.keepOpen('history');
        }
    }, { passive: false, capture: true });
}

// Add event listeners
cachedElements.scrollList?.addEventListener('click', handleRadioClick);
cachedElements.historyDropdown?.addEventListener('click', handleRadioClick);

// Add capture phase to info icon events
document.querySelector(".info-icon")?.addEventListener('touchend', function(e) {
    e.stopImmediatePropagation();
    dropdownManager.toggle('tooltip', e);
}, { passive: false, capture: true });

// Add listeners to both containers
cachedElements.scrollList?.addEventListener('click', handleRadioClick);
cachedElements.historyDropdown?.addEventListener('click', handleRadioClick);
   
    // Final update with timeout
    setTimeout(() => ScrollbarManager.updateAll(), 500);
    
    // Cleanup
    window.addEventListener('beforeunload', cleanupResources);
});

function cleanupResources() {
    // Cleanup tooltip
    const tooltip = document.querySelector('.genre-tooltip');
    if (tooltip) {
        tooltip._wheelHandler && tooltip.removeEventListener('wheel', tooltip._wheelHandler);
        tooltip._scrollHandler && tooltip.removeEventListener('scroll', tooltip._scrollHandler);
        tooltip._mutationObserver?.disconnect();
    }
    
    // Cleanup dropdown manager
    if (window.dropdownManager) {
        document.removeEventListener("click", dropdownManager.handleOutsideClick);
        document.removeEventListener("touchend", dropdownManager.handleOutsideClick);
        
        Object.values(dropdownManager.dropdowns || {}).forEach(dropdown => {
            dropdown.toggle?.removeEventListener("click", dropdownManager.toggle);
            dropdown.toggle?.removeEventListener("touchend", dropdownManager.toggle);
        });
    }
    
    // Cleanup intervals and styles
    clearInterval(metadataInterval);
    clearTimeout(scrollbarHideTimeout);
    document.getElementById('marquee-style')?.remove();
    
    document.querySelectorAll('[data-dynamic-style]').forEach(el => el.remove());
    
    // Cleanup observers
    [windowResizeObserver, ...(ScrollbarManager.resizeObservers || [])]
        .forEach(observer => observer?.disconnect());
    
    // Reset UI states
    if (window.dropdownManager) {
        Object.entries(dropdownManager.dropdowns).forEach(([id, dropdown]) => {
            dropdown.toggle?.classList.remove("active");
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
const COLLAPSED_HEIGHT = 155;
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
        
        audioTextElement.querySelector('.song-title')?.remove();
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
    document.title = `KlikniPlay | ${name}`;
    localStorage.setItem("lastStation", JSON.stringify({ name, link }));
    updateSelectedStation(name);
    updatePlayPauseButton(cachedElements);
    updateRecentlyPlayed(name, link, document.querySelector(`.radio[data-name="${name}"]`)?.dataset.genre || '', cachedElements);

    // Scroll to station
    const selectedStation = document.querySelector(`.radio[data-name="${name}"]`);
    const historyDropdown = document.querySelector('.history-dropdown');
    if (selectedStation) {
        requestAnimationFrame(() => {
            selectedStation.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
            historyDropdown.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    updateTooltipContent();
    
    // Setup audio handlers
    const playAudio = async () => {
        try {
            await audio.play().catch(handlePlayError);
            if (currentStation?.name === name) {
                await checkMetadata(true);
                setupNowPlayingMetadata();
            }
        } catch (e) {
            handlePlayError(e, cachedElements);
            setTimeout(playAudio, 1000);
        }
    };

    audio.oncanplay = playAudio;
    audio.onerror = () => setTimeout(playAudio, 1000);

    // Set up metadata handler
    audio.addEventListener('ended', () => currentStation?.name === name && checkMetadata(true), { once: true });

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

function handlePlayError(e, cachedElements) {
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

function cleanMetadata(title) {
    return title?.replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/(https?:\/\/[^\s]+)/g, '')
        .trim()
        .replace(/\|.*$/, '')
        .replace(/\b(?:Radio Paradise|RP)\b/i, '') || null;
}

// Helper function with timeout
function fetchWithTimeout(url, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    return fetch(url, { signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
}

async function checkMetadata(force = false) {
    if (!currentStation?.link || !force && Date.now() - lastMetadataCheck < METADATA_CHECK_INTERVAL) return;
    
    const tooltip = document.querySelector('.genre-tooltip');
    if (!force && tooltip && !tooltip.classList.contains('visible')) return;
    
    lastMetadataCheck = Date.now();
    const title = await getNowPlaying(currentStation);
    
    if (title && title !== lastTitle) {
        lastTitle = title;
        updateNowPlayingUI(title);
        tooltip?.classList.contains('visible') && updateTooltipContent();
    }
}

// Add this new function
function shouldUpdateTooltip() {
    const tooltip = document.querySelector('.genre-tooltip');
    return tooltip && tooltip.classList.contains('visible') && 
           document.visibilityState === 'visible';
}

// Modify setupNowPlayingMetadata()
function setupNowPlayingMetadata() {
    clearInterval(metadataInterval);
    metadataInterval = setInterval(() => {
        (shouldUpdateTooltip() || Date.now() - lastMetadataCheck > 30000) && 
        debounceMetadata();
    }, 5000);
    debounceMetadata(true);
}

function updateNowPlayingUI(title, cachedElements = {}) {
    const audioTextElement = cachedElements.audioText || document.getElementById('audiotext');
    if (!audioTextElement || !currentStation) return;

    const audioContainer = cachedElements.audioContainer || document.querySelector('.audio-container');
    const stationName = currentStation.name;

    let stationNameElement = audioTextElement.querySelector('.station-name');
    if (!stationNameElement) {
        stationNameElement = document.createElement('div');
        stationNameElement.className = 'station-name';
        audioTextElement.appendChild(stationNameElement);
    }
    stationNameElement.textContent = stationName;

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
    element.style.cssText = 'animation: none; transform: translateX(0); position: relative; display: inline-block; white-space: nowrap;';
    
    const container = element.parentElement;
    if (!container) return;
    
    container.style.overflow = 'hidden';
    const containerWidth = container.clientWidth;
    const textWidth = element.scrollWidth;
    
    if (textWidth <= containerWidth) {
        element.style.overflow = '';
        container.style.overflow = '';
        element.classList.remove('marquee-active');
        return;
    }

    element.classList.add('marquee-active');
    setupMarqueeAnimation(element, textWidth);
}

function removeExistingMarqueeElements() {
    document.querySelectorAll('#marquee-fade-left, .marquee-clone, #marquee-style').forEach(el => el.remove());
}

function setupMarqueeAnimation(element, textWidth) {
    const container = element.parentElement;
    
    // Create left fade element
    const leftFade = document.createElement('div');
    leftFade.id = "marquee-fade-left";
    leftFade.style.cssText = 'position: absolute; top: 0; left: 0; width: 30px; height: 100%; pointer-events: none; z-index: 2; opacity: 0;';
    container.appendChild(leftFade);

    // Animation parameters
    const scrollDistance = textWidth + 107;
    const scrollSpeed = 40;
    const scrollDuration = scrollDistance / scrollSpeed;
    const pauseDuration = 2;
    const totalDuration = scrollDuration + pauseDuration * 2;
    const initialPauseEnd = (pauseDuration / totalDuration * 100).toFixed(6);
    const scrollEnd = (((pauseDuration + scrollDuration) / totalDuration) * 100).toFixed(6);
    const fadeOutStart = (Number(scrollEnd) - 5).toFixed(6);
    const animationName = `marquee-${Date.now()}`;
    
    // Create style element with keyframes
    const style = document.createElement('style');
    style.id = 'marquee-style';
    style.innerHTML = `
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
    document.head.appendChild(style);
    
    // Clone content for seamless animation
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: inline-block; position: relative; white-space: nowrap;';
    
    wrapper.innerHTML = `
        <span>${element.innerHTML}</span>
        <span class="marquee-clone" style="padding-left:100px">${element.innerHTML}</span>
    `;
    
    element.innerHTML = '';
    element.appendChild(wrapper);
    
    wrapper.style.animation = `${animationName} ${totalDuration}s linear infinite`;
    leftFade.style.animation = `${animationName}-left-fade ${totalDuration}s linear infinite`;
}

function updateSelectedStation(name) {
    document.querySelectorAll(".radio").forEach(radio => {
        const isSelected = radio.dataset.name === name;
        radio.classList.toggle("selected", isSelected);
        
        const equalizer = radio.querySelector(".equalizer");
        if (isSelected) {
            if (!equalizer) {
                const eq = document.createElement("div");
                eq.className = "equalizer animate";
                eq.innerHTML = '<div></div>'.repeat(14);
                radio.insertBefore(eq, radio.querySelector(".radio-text"));
            } else {
                equalizer.className = "equalizer animate";
            }
        } else if (equalizer) {
            equalizer.remove();
        }
    });
}

// Genre Filtering Functions
function setupGenreFiltering(cachedElements = {}) {
    document.querySelector('.genre-buttons')?.addEventListener('click', e => {
        const button = e.target.closest('.genre-button');
        if (!button) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        cachedElements.stationSearch.value = "";
        cachedElements.clearSearch.style.display = "none";
        document.querySelectorAll('.genre-button').forEach(btn => btn.classList.toggle('active', btn === button));
        
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
            const shouldShow = currentGenre === 'all' || 
                (station.dataset.genre?.split(',').includes(currentGenre) ?? false);
            station.style.display = shouldShow ? 'flex' : 'none';
            hasVisibleStations ||= shouldShow;
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
    const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
    const actualMode = mode || (prefersDark ? 'dark' : 'light');
    
    document.body.className = `${actualMode}-mode`;
    document.documentElement.style.setProperty(
        '--accent-color', 
        `var(--accent-${actualMode === 'dark' ? 'light' : 'dark'})`
    );
    localStorage.setItem('theme', actualMode);

    document.querySelectorAll('.theme-icon').forEach(icon => {
        icon.textContent = actualMode === 'dark' ? 'dark_mode' : 'light_mode';
    });
    
    setTimeout(() => ScrollbarManager.updateAll(), 50);
}

function changeColor(color) {
    const colors = {
        green: { dark: "22, 111, 69", light: "123, 242, 145" },
        blue: { dark: "0, 79, 139", light: "164, 205, 255" },
        yellow: { dark: "247, 104, 6", light: "255, 234, 132" }, 
        red: { dark: "167, 44, 47", light: "255, 121, 116" },
        pink: { dark: "64, 50, 102", light: "202, 187, 230" },
    }[color] || colors.green;

    document.documentElement.style.setProperty('--accent-dark', colors.dark);
    document.documentElement.style.setProperty('--accent-light', colors.light);
    localStorage.setItem('accentColor', color);
}

function setupThemeControls() {
    document.querySelectorAll('.color-picker').forEach(picker => {
        const handler = e => {
            e.stopPropagation();
            picker.dataset.color && changeColor(picker.dataset.color);
        };
        picker.addEventListener('click', handler);
        picker.addEventListener('touchend', handler, { passive: false });
    });
    
    document.querySelectorAll('.theme-option').forEach(option => {
        const handler = e => {
            e.stopPropagation();
            option.dataset.theme && setTheme(option.dataset.theme);
        };
        option.addEventListener('click', handler);
        option.addEventListener('touchend', handler, { passive: false });
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

function loadRecentlyPlayed(cachedElements = {}) {
    const container = document.querySelector('.recently-played-stations');
    if (!container) return;
    
    container.scrollTop = 0;
    const recentlyPlayed = safeParseJSON('recentlyPlayed', []);
    const uniqueStations = [...new Map(recentlyPlayed.map(item => [item.link, item])).values()];
    
    container.innerHTML = recentlyPlayed.length ? '' : '<div class="empty-message">Nema nedavno slušanih stanica...</div>';
    container.style.flexDirection = 'column';
    container.style.overflowY = 'auto';
    
    uniqueStations.forEach(station => {
        const radio = document.createElement('div');
        radio.className = 'radio';
        if (station.name === (currentStation?.name || safeParseJSON("lastStation", {}).name)) {
            radio.classList.add('selected');
        }
        
        Object.assign(radio.dataset, {
            name: station.name,
            link: station.link,
            genre: station.genre || ''
        });
        
        const radioText = document.createElement('div');
        radioText.className = 'radio-text';
        radioText.textContent = station.name;
        radio.appendChild(radioText);
        
        radio.addEventListener('click', e => {
            e.stopPropagation();
            changeStation(station.name, station.link);
        });
        
        container.appendChild(radio);
    });
    
    if (currentStation?.name) {
        const historyStation = container.querySelector(`.radio[data-name="${currentStation.name}"]`);
        historyStation?.classList.contains('selected') && updateSelectedStation(currentStation.name);
    }
}

function safeParseJSON(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
        return fallback;
    }
}

// UI Setup Functions
class DropdownManager {
    constructor(cachedElements = {}) {
        this.isOperating = false;
        this.currentOpen = null;
        this.lastToggleTime = 0;
        this.dropdowns = {
            theme: {
                toggle: document.querySelector(".theme-toggle"),
                menu: document.querySelector(".dropdown-menu")
            },
            history: {
                toggle: document.getElementById("historyBtn"),
                menu: document.getElementById("historyDropdown"),
                navButtonClass: 'history-nav-button',
                needsScroll: true
            },
            tooltip: {
                toggle: document.querySelector(".info-icon"),
                menu: document.querySelector(".genre-tooltip"),
                navButtonClass: 'tooltip-nav-button',
                needsScroll: true
            }
        };

        this.init();
    }

    init() {
        Object.entries(this.dropdowns).forEach(([id, dropdown]) => {
            if (!dropdown.toggle || !dropdown.menu) return;
            
            const handler = e => {
                e.type === 'touchend' && e.preventDefault();
                e.stopPropagation();
                this.toggle(id, e);
            };
            
            dropdown.toggle.addEventListener("pointerdown", handler);
            dropdown.menu.addEventListener('click', e => {
                if (!e.target.closest(`.${dropdown.navButtonClass}`)) {
                    e.stopPropagation();
                }
            });
        });

        const handleOutside = e => {
            const target = e.target || (e.touches?.[0]?.target);
            if (!target || !this.currentOpen) return;

            const clickedInside = Object.values(this.dropdowns).some(
                dropdown => (dropdown.toggle?.contains(target) || 
                           dropdown.menu?.contains(target)) &&
                           !target.closest(`.${dropdown.navButtonClass}`)
            );

            if (!clickedInside) {
                this.currentOpen === 'tooltip' ? 
                    setTimeout(() => this.close(this.currentOpen), 100) : 
                    this.close(this.currentOpen);
            }
        };

        document.addEventListener("click", handleOutside);
        document.addEventListener("touchend", handleOutside, { passive: true });
    }

    toggle(id, event) {
        if (this.isOperating || performance.now() - this.lastToggleTime < 300) return;
        this.lastToggleTime = performance.now();
        this.isOperating = true;

        const dropdown = this.dropdowns[id];
        if (!dropdown) return;

        if (this.currentOpen === id) {
            this.close(id);
        } else {
            this.currentOpen && this.close(this.currentOpen);
            event.type === 'touchend' ? 
                setTimeout(() => this.open(id), 50) : 
                this.open(id);
        }

        setTimeout(() => this.isOperating = false, 50);
    }

    open(id) {
        const dropdown = this.dropdowns[id];
        if (!dropdown) return;

        Object.assign(dropdown.menu.style, {
            display: 'block',
            opacity: '0',
            scrollTop: 0
        });

        requestAnimationFrame(() => {
            dropdown.menu.classList.add('show');
            if (id === 'tooltip') {
                dropdown.menu.classList.add('visible');
                updateTooltipContent();
            }
            dropdown.menu.style.opacity = '1';
            dropdown.toggle.classList.add('active');
            
            dropdown.needsScroll && this.setupDropdownScroll(id);
            this.updateDropdownHeights();
        });

        this.currentOpen = id;
    }

    close(id) {
        const dropdown = this.dropdowns[id];
        if (!dropdown) return;

        dropdown.menu.style.opacity = '0';
        dropdown.menu.classList.remove('show', 'visible');
        dropdown.toggle.classList.remove('active');
        
        setTimeout(() => {
            if (!dropdown.menu.classList.contains('show') && 
                !dropdown.menu.classList.contains('visible')) {
                dropdown.menu.style.display = 'none';
            }
        }, 300);
        
        this.currentOpen = null;
    }

    setupDropdownScroll(id) {
        const dropdown = this.dropdowns[id];
        if (!dropdown.menu) return;

        // Clear existing
        dropdown.menu.querySelectorAll(`.${dropdown.navButtonClass}`).forEach(b => b.remove());
        
        // Create buttons
        const createButton = (pos) => {
            const btn = document.createElement('button');
            btn.className = `${dropdown.navButtonClass} ${pos}`;
            btn.innerHTML = `<span class="material-icons">expand_${pos === 'top' ? 'less' : 'more'}</span>`;
            return btn;
        };

        const topBtn = createButton('top');
        const bottomBtn = createButton('bottom');
        dropdown.menu.prepend(topBtn);
        dropdown.menu.append(bottomBtn);

        const checkVisibility = () => {
            const { scrollTop, scrollHeight, clientHeight } = dropdown.menu;
            const maxScroll = scrollHeight - clientHeight;
            
            topBtn.style.opacity = scrollTop <= 1 ? '0' : '1';
            bottomBtn.style.opacity = scrollTop >= maxScroll - 1 ? '0' : '1';
        };

        const smoothScroll = (dir) => {
            if (dropdown.menu._isAnimating) return;
            dropdown.menu._isAnimating = true;
            
            const start = dropdown.menu.scrollTop;
            const target = dir === 'top' ? 
                Math.max(0, start - dropdown.menu.clientHeight * 0.8) :
                Math.min(start + dropdown.menu.clientHeight * 0.8, 
                        dropdown.menu.scrollHeight - dropdown.menu.clientHeight);
            
            const startTime = performance.now();
            const animate = (time) => {
                const progress = Math.min((time - startTime) / 300, 1);
                dropdown.menu.scrollTop = start + (target - start) * (1 - Math.pow(1 - progress, 3));
                
                progress < 1 ? 
                    requestAnimationFrame(animate) : 
                    (dropdown.menu._isAnimating = false, checkVisibility());
            };
            requestAnimationFrame(animate);
        };

        // Event listeners
        topBtn.addEventListener('click', (e) => (e.stopPropagation(), smoothScroll('top')));
        bottomBtn.addEventListener('click', (e) => (e.stopPropagation(), smoothScroll('bottom')));
		topBtn.addEventListener('touchend', (e) => (e.stopPropagation(), smoothScroll('top')));
		bottomBtn.addEventListener('touchend', (e) => (e.stopPropagation(), smoothScroll('bottom')));
        dropdown.menu.addEventListener('scroll', () => {
            cancelAnimationFrame(dropdown.menu._scrollRAF);
            dropdown.menu._scrollRAF = requestAnimationFrame(checkVisibility);
        }, { passive: true });

        checkVisibility();
    }

    updateDropdownHeights() {
        const audioHeight = document.querySelector('.audio-container')?.getBoundingClientRect().bottom || 0;
        const windowHeight = window.innerHeight;
        const maxHeight = Math.max(windowHeight - audioHeight - 10, 100);

        Object.values(this.dropdowns).forEach(dropdown => {
            if (!dropdown.menu) return;

            dropdown.menu.style.maxHeight = 'none';
            const height = Math.min(dropdown.menu.scrollHeight, maxHeight);
            dropdown.menu.style.maxHeight = `${height}px`;
            dropdown.menu.style.overflowY = dropdown.menu.scrollHeight > height ? 'auto' : 'hidden';
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
    if (!tooltip || !tooltip.classList.contains('visible')) return;
    
    // Add a loading state to prevent visual jumps
    tooltip.classList.add('updating');
    
    // Store scroll position
    const scrollTop = tooltip.scrollTop;
    
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
                <strong class="genre-title">Žanrovi</strong>
                <div class="genre-tooltip-item">Nema informacija o žanru</div>
            </div>
            <div class="tooltip-section">
                <strong class="quality-title">Kvalitet</strong>
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
                <strong class="quality-title">Kvalitet</strong>
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
            <strong class="genre-title">Žanrovi</strong>
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
        dropdownManager.setupDropdownScroll('tooltip');
    }

    requestAnimationFrame(() => {
        tooltip.scrollTop = scrollTop;
        tooltip.classList.remove('updating');
    });
}

// Helper function to check for unknown values
function isUnknownValue(value) {
    if (!value) return true;
    const val = value.toString().toLowerCase().trim();
    return val === 'undefined' || val === 'undefinedkbps' || val === 'plain' || val === 'html' || val === '';
}

function setupAudioContainerObserver() {
    const observer = new ResizeObserver(() => ScrollbarManager.updateAll());
    document.querySelector('.audio-container') && observer.observe(document.querySelector('.audio-container'));
    window.addEventListener('beforeunload', () => observer.disconnect());
}

function setupAudioContainerGestures() {
    const audioContainer = document.querySelector('.audio-container');
    if (!audioContainer) return;

    audioContainer.addEventListener('touchstart', e => {
        if (!e.target.closest('.toggle-handle')) return;
        
        const touch = e.touches[0];
        const height = audioContainer.clientHeight;
        let startY = touch.clientY;
        
        const moveHandler = e => {
            const deltaY = e.touches[0].clientY - startY;
            audioContainer.style.height = `${Math.min(Math.max(COLLAPSED_HEIGHT, height - deltaY), 300)}px`;
            ScrollbarManager.updateAll();
        };
        
        const endHandler = () => {
            document.removeEventListener('touchmove', moveHandler);
            document.removeEventListener('touchend', endHandler);
            audioContainer.classList.toggle('expanded', 
                audioContainer.clientHeight > COLLAPSED_HEIGHT + 50);
            updateAudioContainerHeight();
        };
        
        document.addEventListener('touchmove', moveHandler, { passive: false });
        document.addEventListener('touchend', endHandler);
    }, { passive: true });
}

function updateAudioContainerHeight() {
    const audioContainer = document.querySelector('.audio-container');
    if (!audioContainer) return;
    
    const currentHeight = parseFloat(getComputedStyle(audioContainer).height);
    const expanded = audioContainer.classList.contains('expanded');
    const hasMetadata = audioContainer.classList.contains('has-now-playing');
    
    const targetHeight = expanded ? 
        (hasMetadata ? 240 : 220) : 
        (hasMetadata ? 175 : 155);
    
    if (Math.abs(currentHeight - targetHeight) > 1) {
        audioContainer.style.height = `${targetHeight}px`;
        ScrollbarManager.updateAll();
    }
}

function setupRecentlyPlayedToggle() {
    const toggleHandle = document.querySelector('#recentlyPlayedToggle .toggle-handle');
    if (!toggleHandle) return;
    
    const toggle = () => {
        const audioContainer = document.querySelector('.audio-container');
        const expand = !audioContainer.classList.contains('expanded');
        
        audioContainer.classList.toggle('expanded', expand);
        expand || dropdownManager.currentOpen && dropdownManager.close(dropdownManager.currentOpen);
        updateAudioContainerHeight();
        ScrollbarManager.updateAll();
    };
    
    toggleHandle.addEventListener('click', e => (e.preventDefault(), e.stopPropagation(), toggle()));
    toggleHandle.addEventListener('touchstart', e => (e.preventDefault(), e.stopPropagation(), toggle()), { passive: false });
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
    text.textContent = "Više";
    Object.assign(text.style, {
        fontSize: '0px',
        transition: 'font-size 0.15s linear'
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
        
        // Update button state
        expandButton.dataset.expanded = newState.toString();
        expandButton.querySelector('.material-icons').textContent = newState ? "expand_less" : "expand_more";
        expandButton.querySelector('.expand-text').textContent = newState ? "Manje" : "Više";
        
        // Show/hide stations
        stations.forEach((station, index) => {
            if (index >= 10) {
                station.style.display = newState ? "flex" : "none";
            }
        });
        
        // Update scrollbar after transition completes
        setTimeout(() => {
            ScrollbarManager.updateAll();
        }, 300); // Match this with your CSS transition duration
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
    const audioControls = document.querySelector('.audio-controls');
    playPauseBtn.innerHTML = `<span class="material-icons">${audio.paused ? 'play_arrow' : 'stop'}</span>`;
    
    // Toggle play-mode class based on paused state
    if (audio.paused) {
        playPauseBtn.classList.add('play-mode');
        audioPlayer.classList.add('play-mode');
        audioControls.classList.add('play-mode');
    } else {
        playPauseBtn.classList.remove('play-mode');
        audioPlayer.classList.remove('play-mode');
        audioControls.classList.remove('play-mode');
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
    volumeIcon.textContent = 
        audio.muted || audio.volume === 0 ? "volume_off" :
        audio.volume < 0.5 ? "volume_down" : "volume_up";
}

// Search and Filter Functions
function debounce(func, wait = 300, immediate = false) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        const later = () => {
            timeout = null;
            !immediate && func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        immediate && !timeout && func.apply(context, args);
    };
}

function filterStations() {
    const query = document.getElementById("stationSearch").value.toLowerCase();
    const searching = query !== "";
    const noResultsElement = document.querySelector('.no-results');
    
    document.getElementById("clearSearch").style.display = searching ? "block" : "none";

    if (searching) {
        document.querySelectorAll('.expand-button').forEach(btn => btn.remove());
        document.querySelectorAll('.category-container').forEach(cat => cat.classList.remove("no-radius", "has-expand-button"));
    }

    let hasVisibleStations = false;
    
    document.querySelectorAll('.radio:not(.history-dropdown .radio)').forEach(station => {
        const stationName = station.dataset.name.toLowerCase();
        
        // Create a normalized version of the station name for comparison
        let normalizedStationName = stationName;
        
        // Handle special character mappings
        if (query.includes('s')) {
            normalizedStationName = normalizedStationName
                .replace(/š/g, 's')
                .replace(/ś/g, 's');
        }
        
        if (query.includes('c')) {
            normalizedStationName = normalizedStationName
                .replace(/č/g, 'c')
                .replace(/ć/g, 'c');
        }
        
        // Check if the normalized station name includes the query
        const matches = normalizedStationName.includes(query);
        station.style.display = matches ? 'flex' : 'none';
        if (matches) hasVisibleStations = true;
    });

    document.querySelectorAll('.category-container').forEach(category => {
        const hasVisible = [...category.querySelectorAll('.radio:not(.history-dropdown .radio)')]
            .some(station => station.style.display !== 'none');
        
        category.style.display = hasVisible ? 'flex' : 'none';
        const title = category.previousElementSibling;
        if (title?.classList.contains("category")) title.style.display = hasVisible ? 'flex' : 'none';
        if (hasVisible) hasVisibleStations = true;
    });
    
    if (noResultsElement) {
        noResultsElement.style.display = (searching && !hasVisibleStations) ? 'flex' : 'none';
    }
    
    if (!searching) {
        currentGenre = 'all';
        document.querySelector('.genre-button[data-genre="all"]')?.classList.add('active');
        document.querySelectorAll('.genre-button:not([data-genre="all"])').forEach(btn => btn.classList.remove('active'));
        applyGenreFilter();
        setupExpandableCategories();
    }
    
    setTimeout(() => ScrollbarManager.updateAll(), 10);
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
    const savedColor = localStorage.getItem("accentColor") || "green";
    const savedStation = safeParseJSON("lastStation", {});

    setTheme(savedTheme);
    changeColor(savedColor);

    if (savedStation.name && savedStation.link) {
        // Update UI immediately
        document.getElementById("audiotext").innerHTML = 
            `<div class="station-name">${savedStation.name}</div>`;
        document.title = `KlikniPlay | ${savedStation.name}`;
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
        document.title = "KlikniPlay";
        updatePlayPauseButton();
        
        // Ensure empty state is handled
        document.getElementById("audiotext").innerHTML = 
            `<div class="station-name">Odaberite stanicu</div>`;
    }
}

const ScrollbarManager = {
    init(cachedElements = {}) {
        this.scrollList = cachedElements.scrollList || document.querySelector('.scroll-list');
        this.scrollbarThumb = document.querySelector('.scrollbar-thumb');
        this.scrollbarTrack = document.querySelector('.scrollbar-track');
        
        if (!this.scrollList || !this.scrollbarThumb || !this.scrollbarTrack) return;

        this.scrollList.append(this.scrollbarTrack);
        this.scrollbarTrack.append(this.scrollbarThumb);
        
        this.setupEvents();
        this.setupResizeObserver();
        this.updateAll();
    },

    setupEvents() {
        // Thumb dragging
        const handleThumbMove = (startY, startTop) => e => {
            const deltaY = e.clientY - startY;
            const newTop = Math.max(0, Math.min(
                startTop + deltaY, 
                this.scrollbarTrack.clientHeight - this.scrollbarThumb.clientHeight
            ));
            
            this.scrollbarThumb.style.top = `${newTop}px`;
            this.scrollList.scrollTop = (newTop / (this.scrollbarTrack.clientHeight - this.scrollbarThumb.clientHeight)) * 
                                       (this.scrollList.scrollHeight - this.scrollList.clientHeight);
        };

        this.scrollbarThumb.addEventListener('mousedown', e => {
            e.preventDefault();
            this.scrollbarThumb.classList.add('dragging');
            
            const moveHandler = handleThumbMove(e.clientY, parseFloat(this.scrollbarThumb.style.top));
            const upHandler = () => {
                this.scrollbarThumb.classList.remove('dragging');
                document.removeEventListener('mousemove', moveHandler);
                document.removeEventListener('mouseup', upHandler);
            };
            
            document.addEventListener('mousemove', moveHandler);
            document.addEventListener('mouseup', upHandler);
        });

        // Track interaction
        this.scrollbarTrack.addEventListener('click', e => {
            if (e.target === this.scrollbarThumb) return;
            
            this.scrollList.scrollTo({
                top: ((e.clientY - this.scrollbarTrack.getBoundingClientRect().top) / 
                     this.scrollbarTrack.clientHeight) * 
                     (this.scrollList.scrollHeight - this.scrollList.clientHeight),
                behavior: 'smooth'
            });
        });
		
		// Hover effects
        this.scrollbarTrack.addEventListener('mouseenter', () => {
            this.scrollbarThumb.classList.add('hovering');
        });
        
        this.scrollbarTrack.addEventListener('mouseleave', () => {
            this.scrollbarThumb.classList.remove('hovering');
        });
		
        // Scroll events
        this.scrollList.addEventListener('scroll', () => {
            cancelAnimationFrame(this.scrollRAF);
            this.scrollRAF = requestAnimationFrame(() => this.positionThumb());
        }, { passive: true });
    },

    updateAll() {
        this.updateThumbSize();
        this.positionThumb();
        this.updateTrackPosition();
    },

    updateThumbSize() {
        if (this.scrollList.scrollHeight <= this.scrollList.clientHeight) {
            this.scrollbarThumb.style.display = 'none';
            return;
        }
        
        const thumbHeight = Math.max(30, 
            (this.scrollList.clientHeight / this.scrollList.scrollHeight) * 
            this.scrollList.clientHeight
        );
        
        this.scrollbarThumb.style.cssText = `
            display: block;
            height: ${thumbHeight}px;
        `;
    },

    positionThumb() {
        if (this.scrollList.scrollHeight <= this.scrollList.clientHeight) return;
        
        const scrollPercentage = this.scrollList.scrollTop / 
                               (this.scrollList.scrollHeight - this.scrollList.clientHeight);
        const thumbPosition = scrollPercentage * 
                            (this.scrollbarTrack.clientHeight - this.scrollbarThumb.clientHeight);
        
        this.scrollbarThumb.style.top = `${thumbPosition}px`;
    },

    setupResizeObserver() {
        this.resizeObserver = new ResizeObserver(() => {
            cancelAnimationFrame(this.resizeRAF);
            this.resizeRAF = requestAnimationFrame(() => this.updateAll());
        });
        
        [document.querySelector('.audio-container'), document.body]
            .filter(Boolean)
            .forEach(el => this.resizeObserver.observe(el));
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
        
        const checkHide = () => {
            if (Date.now() - lastScrollTime >= SCROLLBAR_HIDE_DELAY && 
                !this.scrollbarThumb.matches(':hover, .dragging')) {
                this.scrollbarThumb.classList.remove('visible');
            }
        };

        this.scrollList.addEventListener('scroll', () => {
            lastScrollTime = Date.now();
            this.scrollbarThumb.classList.add('visible');
            clearTimeout(scrollbarHideTimeout);
            scrollbarHideTimeout = setTimeout(checkHide, SCROLLBAR_HIDE_DELAY);
        });

        this.scrollbarThumb.addEventListener('mouseenter', () => {
            this.scrollbarThumb.classList.add('visible');
            clearTimeout(scrollbarHideTimeout);
        });

        this.scrollbarThumb.addEventListener('mouseleave', () => {
            scrollbarHideTimeout = setTimeout(checkHide, SCROLLBAR_HIDE_DELAY);
        });

        this.scrollbarThumb.classList.remove('visible');
    }
};

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