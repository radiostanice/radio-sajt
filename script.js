const CONFIG = {
    DEFAULT_COLOR: 'green', // Only keep color default
    SCROLLBAR_HIDE_DELAY: 1500,
    COLLAPSED_HEIGHT: 155,
    METADATA_CHECK_INTERVAL: 5000,
    METADATA_PROXY: 'https://radiometadata.kosta04miletic.workers.dev',
};

// Theme and Favicon Manager
class ThemeManager {
    constructor() {
        this.initTheme();
        this.initFavicons();
        this.setupMediaQueryListener();
    }

    setupMediaQueryListener() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            this.updateFavicon();
        };

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleChange);
        } else {
            mediaQuery.addListener(handleChange); // Fallback
        }
        
        // Initial check
        handleChange();
    }

    initFavicons() {
        // Remove any existing favicon elements to prevent duplicates
        document.querySelectorAll('link[rel="icon"], link[rel="alternate icon"]').forEach(el => el.remove());

        // Create main favicon element
        this.faviconElement = document.createElement('link');
        this.faviconElement.rel = 'icon';
        this.faviconElement.href = 'icons/favicon.svg';
        document.head.appendChild(this.faviconElement);

        // Create fallback for older browsers
        this.faviconFallback = document.createElement('link');
        this.faviconFallback.rel = 'alternate icon';
        this.faviconFallback.href = 'icons/favicon.ico';
        document.head.appendChild(this.faviconFallback);

        this.updateFavicon();
    }

    updateFavicon() {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const faviconUrl = isDark ? 'icons/favicon-light.svg' : 'icons/favicon.svg';
        
        // Force update by adding timestamp to bypass cache
        const timestamp = Date.now();
        const cacheBuster = `?_=${timestamp}`;
        
        // Update main favicon (SVG)
        this.faviconElement.href = `${faviconUrl}${cacheBuster}`;
        this.faviconElement.type = 'image/svg+xml';
        
        // Update fallback (PNG)
        const fallbackUrl = isDark ? 'icons/favicon-light-96x96.png' : 'icons/favicon-96x96.png';
        this.faviconFallback.href = `${fallbackUrl}${cacheBuster}`;
        
        // Update theme-color meta tag (you can keep this if you want)
        this.updateThemeColor(isDark ? 'dark' : 'light');
    }

    initTheme() {
        const savedTheme = localStorage.getItem("theme");
        const systemPreference = this.getSystemTheme();
        
        // Apply saved theme if exists, otherwise use system preference
        const initialTheme = savedTheme || systemPreference;
        
        this.applyTheme(initialTheme);
        this.updateThemeColor(initialTheme);
    }

    getSystemTheme() {
        if (typeof window.matchMedia !== 'function') return 'light';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

isMediaQuerySupported() {
    return typeof window.matchMedia === 'function';
}

    // Add this method to ThemeManager
    changeColor(color) {
        const colors = {
            green: { dark: "22, 111, 69", light: "146, 244, 164" },
            blue: { dark: "0, 79, 139", light: "190, 219, 255" },
            yellow: { dark: "143, 124, 65", light: "255, 234, 132" },
            red: { dark: "167, 44, 47", light: "255, 195, 195" },
            pink: { dark: "64, 50, 102", light: "217, 206, 237" }
        }[color] || colors.green;

        document.documentElement.style.setProperty('--accent-dark', colors.dark);
        document.documentElement.style.setProperty('--accent-light', colors.light);
    }

    shouldUseDarkMode() {
        // Check localStorage first, then system preference
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme) return savedTheme === 'dark';
        
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    updateThemeColor(theme) {
        const themeColor = theme === 'dark' ? '#1d1d1d' : '#f6f6f6';
        let themeMeta = document.querySelector('meta[name="theme-color"]');
        
        if (!themeMeta) {
            themeMeta = document.createElement('meta');
            themeMeta.name = 'theme-color';
            document.head.appendChild(themeMeta);
        }
        themeMeta.content = themeColor;
    }

    applyTheme(theme) {
        document.body.className = `${theme}-mode`;
    }

    setupThemeListener() {
        // Improved theme change detection
        if (typeof window.matchMedia !== 'function') return;
        
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            this.updateFavicon();
            const currentTheme = localStorage.getItem("theme");
            
            // Only follow system theme if no user preference exists
            if (!currentTheme) {
                const systemTheme = mediaQuery.matches ? 'dark' : 'light';
                this.applyTheme(systemTheme);
                this.updateThemeColor(systemTheme);
            }
        };
        
        // Modern way to add listener
        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleChange);
        } else {
            mediaQuery.addListener(handleChange); // Fallback
        }
    }
	
    setupColorPickers() {
        document.querySelectorAll('.color-picker').forEach(picker => {
            const handler = e => {
                e.preventDefault();
                e.stopPropagation();
                if (picker.dataset.color) {
                    this.changeColor(picker.dataset.color);
                    localStorage.setItem("accentColor", picker.dataset.color);
                    
                    // Update active state
                    document.querySelectorAll('.color-picker').forEach(p => 
                        p.classList.remove('active')
                    );
                    picker.classList.add('active');
                }
            };
            
            picker.addEventListener('click', handler);
            picker.addEventListener('touchend', handler, { passive: false });
        });

        // Set initial color state
        const savedColor = localStorage.getItem("accentColor") || CONFIG.DEFAULT_COLOR;
        document.querySelector(`.color-picker[data-color="${savedColor}"]`)?.classList.add('active');
        this.changeColor(savedColor);
    }
}

// Initialize theme manager when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});

// Main Application Controller
class RadioPlayer {
    constructor() {
        // Initialize elements FIRST
        this.elements = {
            audio: document.getElementById("audioctrl"),
            audioText: document.getElementById('audiotext'),
            playPauseBtn: document.getElementById('playPauseBtn'),
            volumeIcon: document.getElementById('volumeIcon'),
            volumeSlider: document.getElementById('volumeSlider'),
            stationSearch: document.getElementById("stationSearch"),
            clearSearch: document.getElementById("clearSearch"),
            historyDropdown: document.querySelector('.history-dropdown'),
            searchContainer: document.querySelector('.search-container'),
            scrollList: document.querySelector('.scroll-list'),
            audioContainer: document.querySelector('.audio-container')
        };
        
        // Then load preferences
        this.loadPreferences();
        
        // Rest of your constructor
        this.changingStation = false;
        this.currentStation = null;
        this.currentGenre = 'all';
        this.lastVolume = 1;
        this.lastTitle = '';
        this.lastMetadataCheck = 0;
        this.lastScrollTime = 0;
        this.scrollbarHideTimeout = null;
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.toggleSearch = this.toggleSearch.bind(this);
        
        this.init();
    }

init() {
    this.setupEventListeners();
    this.loadPreferences();
    this.ScrollbarManager = new ScrollbarManager(this.elements);
    this.DropdownManager = new DropdownManager(this.elements);
    
    // Initialize scrollbar auto-hide
    this.ScrollbarManager.setupAutoHide();
    
    // Setup search functionality
    this.elements.stationSearch.addEventListener('input', this.debounce(this.filterStations.bind(this), 300));
    
    // Add window resize handler for category expansion
this.handleResize = this.debounce(() => {
    if (!this.elements.stationSearch.value.trim()) {
        // First apply genre filter to ensure we're working with correct stations
        this.applyGenreFilter(); 
        
        // Then setup expandable categories
        this.setupExpandableCategories();
    }
}, 200);
    window.addEventListener('resize', this.handleResize);
    
    this.setupInitialUI();
    this.queueInitializations();
}

setupEventListeners() {
    const { searchContainer, stationSearch, clearSearch, historyDropdown } = this.elements;
    if (searchContainer && stationSearch && clearSearch) {
        searchContainer.addEventListener('click', this.handleSearchContainerClick);
        clearSearch.addEventListener('click', this.handleClearSearch);
        stationSearch.addEventListener('input', this.handleSearchInput);
        document.addEventListener('click', this.handleDocumentClick);
        searchContainer.addEventListener('touchend', this.handleSearchTouch, { passive: false });
    }

    this.elements.playPauseBtn.addEventListener("click", this.togglePlayback);
    this.elements.volumeSlider.addEventListener("input", this.handleVolumeChange);
    this.elements.volumeIcon.addEventListener("click", this.toggleMute);

    this.elements.audio.addEventListener("play", this.updatePlayPauseButton);
    this.elements.audio.addEventListener("pause", this.updatePlayPauseButton);
    this.elements.audio.addEventListener('ended', () => this.checkMetadata(true), { once: true });

        this.elements.scrollList?.addEventListener('click', (e) => {
        let target = e.target;
        // Walk up the DOM tree to find the radio element
        while (target && target !== this.elements.scrollList) {
            if (target.classList.contains('radio')) {
                this.handleStationClick(e);
                break;
            }
            target = target.parentElement;
        }
    });
    

    this.elements.historyDropdown?.addEventListener('click', this.handleStationClick);

    if (historyDropdown) {
        historyDropdown.addEventListener('touchstart', this.handleTouchStart, { passive: true });
        historyDropdown.addEventListener('touchmove', this.handleTouchMove, { passive: true });
        historyDropdown.addEventListener('touchend', this.handleTouchEnd, { passive: false, capture: true });
    }

    window.addEventListener('beforeunload', this.cleanupResources);
}

    // Event Handlers
    handleSearchContainerClick = (e) => {
        if (!this.elements.searchContainer.classList.contains('active')) {
            this.toggleSearch(true);
        }
        e.stopPropagation();
    }

handleClearSearch = (e) => {
    this.elements.stationSearch.value = '';
    this.elements.clearSearch.style.display = 'none';
    this.filterStations();
    
    // Only close search if it's not already closed
    if (this.elements.searchContainer.classList.contains('active')) {
        this.toggleSearch(false);
    }
    
    e.stopPropagation();
}

    handleSearchInput = () => {
        this.elements.clearSearch.style.display = this.elements.stationSearch.value ? 'block' : 'none';
    }

    handleDocumentClick = (e) => {
        if (!this.elements.searchContainer.contains(e.target) && 
            this.elements.searchContainer.classList.contains('active') &&
            !this.elements.stationSearch.value) {
            this.toggleSearch(false);
        }
    }

    handleSearchTouch = (e) => {
        if (!this.elements.searchContainer.classList.contains('active')) {
            this.toggleSearch(true);
            e.preventDefault();
        }
    }

toggleSearch = (expand) => {
    const { searchContainer, stationSearch } = this.elements;
    
    // Clear any existing timeouts
    clearTimeout(this.searchFocusTimeout);
    
    searchContainer.style.width = expand ? '250px' : '44px';
    searchContainer.style.borderRadius = expand ? '10px' : '15px';
    
    if (expand) {
        // Defer adding active class to match animation timing
        this.searchFocusTimeout = setTimeout(() => {
            searchContainer.classList.add('active');
            stationSearch.focus();
        }, 170); // Match the CSS transition duration
    } else {
        searchContainer.classList.remove('active');
        stationSearch.blur();
    }
}

handleStationClick(e) {
    const radio = e.target.closest('.radio');
    if (!radio || (e.type === 'touchend' && radio._touchMoved)) return;

    // Stop all event propagation
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();
    
    const { name, link } = radio.dataset;
    
    // Only proceed if this is a different station
    if (this.currentStation?.name !== name) {
        this.changeStation(name, link);
    }

    if (!radio.closest('.history-dropdown')) return;
    
    // Prevent immediate re-triggering
    radio.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
    }, { once: true, passive: false });

    if (this.DropdownManager?.currentOpen === 'history') {
        requestAnimationFrame(() => this.DropdownManager.keepOpen('history'));
    }
}

    handleTouchStart = (e) => {
        const radio = e.target.closest('.radio');
        if (radio) {
            const touch = e.touches[0];
            radio._touchStart = { x: touch.clientX, y: touch.clientY };
            radio._touchMoved = false;
        }
    }

    handleTouchMove = (e) => {
        const radio = e.target.closest('.radio');
        if (radio?._touchStart) {
            const touch = e.touches[0];
            const moveX = Math.abs(touch.clientX - radio._touchStart.x);
            const moveY = Math.abs(touch.clientY - radio._touchStart.y);
            
            if (moveX > 5 || moveY > 5) {
                radio._touchMoved = true;
            }
        }
    }

handleTouchEnd = (e) => {
    const radio = e.target.closest('.radio');
    if (radio && !radio._touchMoved) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.handleStationClick(e);
        if (this.DropdownManager && this.DropdownManager.currentOpen === 'history') {
            this.DropdownManager.keepOpen('history');
        }
    }
}

    // Station and Playback Functions
async changeStation(name, link) {
    if (this.changingStation) return;
    this.changingStation = true;

    try {
		
        // Close the tooltip explicitly when changing stations
        if (this.DropdownManager.currentOpen === 'tooltip') {
            this.DropdownManager.close('tooltip');
        }

        // Clear previous state
        this.lastTitle = '';
        this.elements.audioText.innerHTML = `<div class="station-name">${name}</div>`;
        this.elements.audioText.classList.remove('has-now-playing');
        this.elements.audioContainer?.classList.remove('has-now-playing');
        this.updateAudioContainerHeight();
        
        // Reset audio
        this.elements.audio.pause();
        this.elements.audio.src = '';
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Set new station
        this.currentStation = { name, link };
        this.elements.audio.src = link;
        document.title = `KlikniPlay | ${name}`;
        
        // Update UI
        this.updateSelectedStation(name);
        this.updateRecentlyPlayed(name, link);
        
        try {
            await this.elements.audio.play();
            
            // Force immediate metadata check with cache busting
            this.checkMetadata(true);
        } catch (e) {
            console.warn('Playback failed:', e);
        }
    } finally {
        this.changingStation = false;
    }
}

setupNowPlayingMetadata() {
    // Clear any existing interval
    clearInterval(this.metadataInterval);
    
    // Immediate check first
    this.checkMetadata(true);
    
    // Then set up periodic checks
    this.metadataInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
            this.checkMetadata();
        }
    }, CONFIG.METADATA_CHECK_INTERVAL);
}

async checkMetadata(force = false) {
    // Add a lock to prevent overlapping requests
    if (this.metadataLock) return;
    this.metadataLock = true;
    
    try {
        if (!this.currentStation?.link) return;
        
        // Completely bypass cache for forced checks
        const cacheBuster = force ? `&_=${Date.now()}` : '';
        const proxyUrl = `${CONFIG.METADATA_PROXY}?url=${encodeURIComponent(this.currentStation.link)}${cacheBuster}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(proxyUrl, {
            signal: controller.signal,
            cache: 'no-store' // Ensure browser doesn't cache either
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) return;
        
        const data = await response.json();
        
        // Enhanced metadata validation
        if (data.success && data.title && !data.isStationName) {
            // Update quality info
            if (this.currentStation) {
                const stationEl = document.querySelector(`.radio[data-name="${this.currentStation.name}"]`);
                if (stationEl) {
                    const bitrate = (data.quality?.bitrate || '')
                        .toString()
                        .replace(/[^\d]/g, '')
                        .replace(/^0+/, '')
                        .slice(0, 3);
                    stationEl.dataset.bitrate = bitrate ? `${bitrate}kbps` : '';
                    stationEl.dataset.format = data.quality?.format || '';
                }
            }
            
            // Only update if different
            if (data.title !== this.lastTitle) {
                this.lastTitle = data.title;
                this.updateNowPlayingUI(data.title);
            }
        } else if (this.lastTitle) {
            // Clear existing metadata if no longer valid
            this.lastTitle = '';
            this.updateNowPlayingUI('');
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('Metadata check failed:', e);
        }
    } finally {
        this.metadataLock = false;
    }
}
    // UI Update Functions
updateSelectedStation(name) {
    document.querySelectorAll(".radio").forEach(radio => {
        const isSelected = radio.dataset.name === name;
        radio.classList.toggle("selected", isSelected);
        
        if (isSelected) {
            let equalizer = radio.querySelector(".equalizer");
            if (!equalizer) {
                equalizer = document.createElement("div");
                equalizer.className = "equalizer animate";
                equalizer.innerHTML = '<div></div>'.repeat(14);
                radio.insertBefore(equalizer, radio.querySelector(".radio-text"));
            } else {
                equalizer.className = "equalizer animate";
            }
        } else {
            radio.querySelector(".equalizer")?.remove();
        }
    });
}

updateNowPlayingUI(title) {
    const { audioText, audioContainer } = this.elements;
    if (!audioText || !this.currentStation) return;

    const stationName = this.currentStation.name;

    let stationNameElement = audioText.querySelector('.station-name');
    if (!stationNameElement) {
        stationNameElement = document.createElement('div');
        stationNameElement.className = 'station-name';
        audioText.appendChild(stationNameElement);
    }
    stationNameElement.textContent = stationName;

    let songTitleElement = audioText.querySelector('.song-title');
    
    if (title && title !== stationName) {
        if (!songTitleElement) {
            songTitleElement = document.createElement('div');
            songTitleElement.className = 'song-title';
            audioText.insertBefore(songTitleElement, stationNameElement);
        }
        songTitleElement.textContent = title;
        audioText.classList.add('has-now-playing');
        audioContainer.classList.add('has-now-playing');
        requestAnimationFrame(() => this.applyMarqueeEffect(songTitleElement));
    } else if (songTitleElement) {
        audioText.removeChild(songTitleElement);
        audioText.classList.remove('has-now-playing');
        audioContainer.classList.remove('has-now-playing');
    }
    
    this.updateAudioContainerHeight();
}

    applyMarqueeEffect(element) {
        this.removeExistingMarqueeElements();
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
        this.setupMarqueeAnimation(element, textWidth);
    }

    removeExistingMarqueeElements() {
        document.querySelectorAll('#marquee-fade-left, .marquee-clone, #marquee-style').forEach(el => el.remove());
    }

    setupMarqueeAnimation(element, textWidth) {
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

    // Playback Control Functions
togglePlayback = () => {
    const { audio } = this.elements;
    audio.paused ? 
        audio.play().then(() => {
            this.checkMetadata(true);
            this.setupNowPlayingMetadata();
        }).catch(this.handlePlayError) : 
        audio.pause();
}

updatePlayPauseButton = () => {
    const { audio, playPauseBtn } = this.elements;
    const audioPlayer = document.querySelector('.audio-player');
    const audioControls = document.querySelector('.audio-controls');
    
    const isPlaying = !audio.paused;
    playPauseBtn.innerHTML = `<span class="material-icons">${isPlaying ? 'stop' : 'play_arrow'}</span>`;
    
    [playPauseBtn, audioPlayer, audioControls].forEach(el => 
        el?.classList.toggle('play-mode', !isPlaying)
    );

    document.querySelectorAll(".radio.selected .equalizer").forEach(equalizer => 
        equalizer.className = `equalizer ${isPlaying ? 'animate' : 'displaypaused'}`
    );
}

    // Volume Control Functions
    handleVolumeChange = () => {
        this.elements.audio.volume = this.elements.volumeSlider.value;
        this.elements.audio.muted = this.elements.audio.volume === 0;
        if (!this.elements.audio.muted) this.lastVolume = this.elements.audio.volume;
        this.updateVolumeIcon();
    }

    toggleMute = () => {
        this.elements.audio.muted = !this.elements.audio.muted;
        this.elements.audio.volume = this.elements.audio.muted ? 0 : this.lastVolume;
        this.elements.volumeSlider.value = this.elements.audio.volume;
        this.updateVolumeIcon();
    }

    updateVolumeIcon = () => {
        const { audio, volumeIcon } = this.elements;
        volumeIcon.textContent = 
            audio.muted || audio.volume === 0 ? "volume_off" :
            audio.volume < 0.5 ? "volume_down" : "volume_up";
    }

    // Search and Filter Functions
     filterStations = this.debounce(function() {
        const query = this.elements.stationSearch.value.toLowerCase();
        const searching = query !== "";
        const noResultsElement = document.querySelector('.no-results');
        
        this.elements.clearSearch.style.display = searching ? "block" : "none";

        if (searching) {
            document.querySelectorAll('.expand-button').forEach(btn => btn.remove());
            document.querySelectorAll('.category-container').forEach(cat => cat.classList.remove("no-radius", "has-expand-button"));
        }

        let hasVisibleStations = false;
        
        document.querySelectorAll('.radio:not(.history-dropdown .radio)').forEach(station => {
            const stationName = station.dataset.name.toLowerCase();
            
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
            this.currentGenre = 'all';
            document.querySelector('.genre-button[data-genre="all"]')?.classList.add('active');
            document.querySelectorAll('.genre-button:not([data-genre="all"])').forEach(btn => btn.classList.remove('active'));
            this.applyGenreFilter();
            this.setupExpandableCategories();
        }
        
        setTimeout(() => this.ScrollbarManager.updateAll(), 10);
    }, 300)

    debounce(func, wait = 300, immediate = false) {
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

    // Genre Filtering Functions
    setupGenreFiltering() {
        document.querySelector('.genre-buttons')?.addEventListener('click', e => {
            const button = e.target.closest('.genre-button');
            if (!button) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            this.elements.stationSearch.value = "";
            this.elements.clearSearch.style.display = "none";
            document.querySelectorAll('.genre-button').forEach(btn => btn.classList.toggle('active', btn === button));
            
            this.currentGenre = button.dataset.genre;
            this.applyGenreFilter();
            this.setupExpandableCategories();
        });
    }

    applyGenreFilter() {
        cancelAnimationFrame(this._genreFilterRAF);
        
        this._genreFilterRAF = requestAnimationFrame(() => {
            const { stationSearch } = this.elements;
            if (stationSearch.value.trim() !== "") return;
            
            const noResultsElement = document.querySelector('.no-results');
            let hasVisibleStations = false;
            
            document.querySelectorAll('.radio:not(.history-dropdown .radio)').forEach(station => {
                const shouldShow = this.currentGenre === 'all' || 
                    (station.dataset.genre?.split(',').includes(this.currentGenre) ?? false);
                station.style.display = shouldShow ? 'flex' : 'none';
                hasVisibleStations ||= shouldShow;
            });

            if (noResultsElement) {
                noResultsElement.style.display = 'none';
            }

            this.updateCategoryVisibility();
            this.setupExpandableCategories();
            
            setTimeout(() => this.ScrollbarManager.updateAll(), 10);
        });
    }

    updateCategoryVisibility() {
        document.querySelectorAll(".category-container").forEach(category => {
            const categoryTitle = category.previousElementSibling;
            if (!categoryTitle?.classList.contains("category")) return;

            const hasVisibleStation = [...category.querySelectorAll(".radio")]
                .some(station => window.getComputedStyle(station).display !== 'none');

            category.style.display = hasVisibleStation ? "flex" : "none";
            categoryTitle.style.display = hasVisibleStation ? "flex" : "none";
        });
    }

    // Recently Played Functions
    updateRecentlyPlayed(name, link, genre = '') {
        const recentlyPlayed = this.safeParseJSON('recentlyPlayed', []);
        const newRecentlyPlayed = [
            { name, link, genre },
            ...recentlyPlayed.filter(item => item.link !== link)
        ].slice(0, 12);
        
        localStorage.setItem('recentlyPlayed', JSON.stringify(newRecentlyPlayed));
        this.loadRecentlyPlayed();
    }

    loadRecentlyPlayed() {
        const container = document.querySelector('.recently-played-stations');
        if (!container) return;
        
        container.scrollTop = 0;
        const recentlyPlayed = this.safeParseJSON('recentlyPlayed', []);
        const uniqueStations = [...new Map(recentlyPlayed.map(item => [item.link, item])).values()];
        
        container.innerHTML = recentlyPlayed.length ? '' : '<div class="empty-message">Nema nedavno slušanih stanica...</div>';
        container.style.flexDirection = 'column';
        container.style.overflowY = 'auto';
        
        uniqueStations.forEach(station => {
            const radio = document.createElement('div');
            radio.className = 'radio';
            if (station.name === (this.currentStation?.name || this.safeParseJSON("lastStation", {}).name)) {
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
                this.changeStation(station.name, station.link);
            });
            
            container.appendChild(radio);
        });
        
        if (this.currentStation?.name) {
            const historyStation = container.querySelector(`.radio[data-name="${this.currentStation.name}"]`);
            historyStation?.classList.contains('selected') && this.updateSelectedStation(this.currentStation.name);
        }
    }

    // Theme Functions
	
// Updated in RadioPlayer class
setupThemeControls() {
    // Initialize theme manager if not already done
    window.themeManager = window.themeManager || new ThemeManager();
    window.themeManager.setupColorPickers();

    // Set up theme options
    document.querySelectorAll('.theme-option').forEach(option => {
        const handler = e => {
            e.preventDefault();
            e.stopPropagation();
            if (option.dataset.theme) {
                this.setTheme(option.dataset.theme);
                
                // Update all theme option states
                document.querySelectorAll('.theme-option').forEach(opt => 
                    opt.classList.remove('active')
                );
                option.classList.add('active');
            }
        };
        
        option.addEventListener('click', handler);
        option.addEventListener('touchend', handler, { passive: false });
    });

    // Set initial theme state
    const savedTheme = localStorage.getItem("theme") || CONFIG.DEFAULT_THEME;
    document.querySelector(`.theme-option[data-theme="${savedTheme}"]`)?.classList.add('active');
}

setTheme(mode) {
    if (mode) {
        // If mode is explicitly set (user choice), store it
        localStorage.setItem('theme', mode);
    } else {
        // If no mode specified (clearing user preference), remove the setting
        localStorage.removeItem('theme');
        // Revert to system theme
        mode = window.themeManager.getSystemTheme();
    }
    
    // Apply the theme through themeManager
    window.themeManager?.applyTheme(mode);
    window.themeManager?.updateThemeColor(mode);
    
    setTimeout(() => this.ScrollbarManager?.updateAll(), 50);
}

setInitialActiveStates() {
    // Set active theme
    const currentTheme = localStorage.getItem("theme") || CONFIG.DEFAULT_THEME;
    document.querySelector(`.theme-option[data-theme="${currentTheme}"]`)?.classList.add('active');
    
    // Set active color
    const currentColor = localStorage.getItem("accentColor") || CONFIG.DEFAULT_COLOR;
    document.querySelector(`.color-picker[data-color="${currentColor}"]`)?.classList.add('active');
}

    // Tooltip Functions
    getGenreIcon(genre) {
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

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    updateTooltipContent() {
        const tooltip = document.querySelector('.genre-tooltip');
        if (!tooltip || !tooltip.classList.contains('visible')) return;
        
        // Additional check for tooltip initialization
        if (!this.DropdownManager) return;
        
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
            const lastStation = this.safeParseJSON("lastStation", null);
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
                const icon = this.getGenreIcon(genre.trim());
                return `<div class="genre-tooltip-item">${icon} ${this.capitalizeFirstLetter(genre.trim())}</div>`;
            }).join('');
        }
        
        // Get quality info
        const bitrate = currentStation.dataset.bitrate;
        const format = currentStation.dataset.format;
        
        let qualitySection = '';
        if (bitrate && !this.isUnknownValue(bitrate) && format && !this.isUnknownValue(format)) {
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
        if (this.DropdownManager.currentOpen === 'tooltip') {
            this.DropdownManager.setupDropdownScroll('tooltip');
        }

        requestAnimationFrame(() => {
            tooltip.scrollTop = scrollTop;
            tooltip.classList.remove('updating');
        });
    }

    isUnknownValue(value) {
        if (!value) return true;
        const val = value.toString().toLowerCase().trim();
        return val === 'undefined' || val === 'undefinedkbps' || val === 'plain' || val === 'html' || val === '';
    }

    // Expandable Categories
setupExpandableCategories() {
    if (this.elements.stationSearch.value.trim()) {
        document.querySelectorAll('.expand-button').forEach(btn => btn.remove());
        return;
    }

    document.querySelectorAll(".category-container").forEach(category => {
        const stations = [...category.querySelectorAll(".radio")].filter(s => 
            window.getComputedStyle(s).display !== "none" && 
            (this.currentGenre === 'all' || 
             s.dataset.genre?.split(',').includes(this.currentGenre))
        );
        
        if (stations.length === 0) {
            category.style.display = "none";
            const title = category.previousElementSibling;
            title?.classList.contains("category") && (title.style.display = "none");
            return;
        }
        
        const isExpanded = category.dataset.expanded === "true";
        const maxVisible = this.calculateMaxStations(stations[0]);
        
        // Always show at least 2 stations if possible
        const effectiveMaxVisible = Math.max(2, maxVisible);
        
        stations.forEach((s, i) => {
            s.style.display = (isExpanded || i < effectiveMaxVisible) ? "flex" : "none";
        });
        
        if (!isExpanded && stations.length > effectiveMaxVisible && !category.querySelector('.expand-button')) {
            category.append(this.createExpandButton(stations, category));
            category.classList.add("no-radius", "has-expand-button");
        } else if (stations.length <= effectiveMaxVisible) {
            category.querySelector('.expand-button')?.remove();
            category.classList.remove("no-radius", "has-expand-button");
        }
    });
    
    setTimeout(() => this.ScrollbarManager?.updateAll(), 10);
}

calculateMaxStations(stationElement) {
    if (!stationElement) return 5; // Default fallback
    
    const stationHeight = stationElement.offsetHeight || 50;
    let maxHeight = window.innerWidth * 0.55;
    
    // On mobile devices, limit to 70% of viewport height
    if (window.innerWidth <= 768) {
        maxHeight = window.innerHeight * 0.7;
    }
    
    return Math.max(1, Math.floor(maxHeight / stationHeight));
}

createExpandButton(stations, category) {
    const expandButton = document.createElement("button");
    expandButton.className = "expand-button";
    expandButton.dataset.expanded = category.dataset.expanded === "true" ? "true" : "false";

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

    // Get all stations in this category (not just currently visible ones)
    const allStations = Array.from(category.querySelectorAll('.radio'))
        .filter(s => window.getComputedStyle(s).display !== 'none' || 
                   (s.dataset.genre?.split(',').includes(window.radioPlayer.currentGenre) || 
                    window.radioPlayer.currentGenre === 'all'));
    
    expandButton.addEventListener("click", (e) => {
        e.stopPropagation();
        const expanded = expandButton.dataset.expanded === "true";
        const newState = !expanded;
        
        expandButton.dataset.expanded = newState.toString();
        expandButton.querySelector('.material-icons').textContent = newState ? "expand_less" : "expand_more";
        expandButton.querySelector('.expand-text').textContent = newState ? "Manje" : "Više";
        
        // Store expansion state in category for resize handling
        category.dataset.expanded = newState.toString();
        
        if (newState) {
            // Show all stations that match current genre filter when expanded
            allStations.forEach(station => {
                const matchesGenre = window.radioPlayer.currentGenre === 'all' || 
                    (station.dataset.genre?.split(',').includes(window.radioPlayer.currentGenre) || false);
                station.style.display = matchesGenre ? "flex" : "none";
            });
        } else {
            // Recalculate visibility on collapse while respecting genre filter
            const maxHeight = window.innerWidth * 0.5;
            let totalHeight = 0;
            let visibleCount = 0;
            
            allStations.forEach(station => {
                const matchesGenre = window.radioPlayer.currentGenre === 'all' || 
                    (station.dataset.genre?.split(',').includes(window.radioPlayer.currentGenre) || false);
                
                if (!matchesGenre) {
                    station.style.display = "none";
                    return;
                }
                
                if (visibleCount < this.calculateMaxStations(stations[0])) {
                    station.style.display = "flex";
                    totalHeight += station.offsetHeight;
                    visibleCount++;
                } else {
                    station.style.display = "none";
                }
            });
        }
        
        setTimeout(() => {
            window.radioPlayer.ScrollbarManager.updateAll();
        }, 300);
    });

    return expandButton;
}
	
    // Audio Container Functions
    setupAudioContainerObserver() {
        this.audioContainerObserver = new ResizeObserver(() => this.ScrollbarManager.updateAll());
        this.elements.audioContainer && this.audioContainerObserver.observe(this.elements.audioContainer);
        window.addEventListener('beforeunload', () => this.audioContainerObserver.disconnect());
    }

    setupAudioContainerGestures() {
        const { audioContainer } = this.elements;
        if (!audioContainer) return;

        audioContainer.addEventListener('touchstart', e => {
            if (!e.target.closest('.toggle-handle')) return;
            
            const touch = e.touches[0];
            const height = audioContainer.clientHeight;
            let startY = touch.clientY;
            
            const moveHandler = e => {
                const deltaY = e.touches[0].clientY - startY;
                audioContainer.style.height = `${Math.min(Math.max(CONFIG.COLLAPSED_HEIGHT, height - deltaY), 300)}px`;
                this.ScrollbarManager.updateAll();
            };
            
            const endHandler = () => {
                document.removeEventListener('touchmove', moveHandler);
                document.removeEventListener('touchend', endHandler);
                audioContainer.classList.toggle('expanded', 
                    audioContainer.clientHeight > CONFIG.COLLAPSED_HEIGHT + 50);
                this.updateAudioContainerHeight();
            };
            
            document.addEventListener('touchmove', moveHandler, { passive: false });
            document.addEventListener('touchend', endHandler);
        }, { passive: true });
    }

updateAudioContainerHeight() {
    const { audioContainer } = this.elements;
    if (!audioContainer) return;
    
    // Force layout calculation before changes
    audioContainer.getBoundingClientRect();
        
        const currentHeight = parseFloat(getComputedStyle(audioContainer).height);
        const expanded = audioContainer.classList.contains('expanded');
        const hasMetadata = audioContainer.classList.contains('has-now-playing');
        
        const targetHeight = expanded ? 
            (hasMetadata ? 240 : 220) : 
            (hasMetadata ? 175 : 155);
        
        if (Math.abs(currentHeight - targetHeight) > 1) {
            audioContainer.style.height = `${targetHeight}px`;
            this.ScrollbarManager.updateAll();
        }
		
    requestAnimationFrame(() => {
        this.ScrollbarManager.updateAll();
    });
}

    setupRecentlyPlayedToggle() {
        const toggleHandle = document.querySelector('#recentlyPlayedToggle .toggle-handle');
        if (!toggleHandle) return;
        
        const toggle = () => {
            const audioContainer = document.querySelector('.audio-container');
            const expand = !audioContainer.classList.contains('expanded');
            
            audioContainer.classList.toggle('expanded', expand);
            expand || this.DropdownManager.currentOpen && this.DropdownManager.close(this.DropdownManager.currentOpen);
            this.updateAudioContainerHeight();
            this.ScrollbarManager.updateAll();
        };
        
        toggleHandle.addEventListener('click', e => (e.preventDefault(), e.stopPropagation(), toggle()));
        toggleHandle.addEventListener('touchstart', e => (e.preventDefault(), e.stopPropagation(), toggle()), { passive: false });
    }

    // Setup Functions
    setupInitialUI() {
        this.setupThemeControls();
        this.setupGenreFiltering();
        this.setupAudioContainerObserver();
        this.setupAudioContainerGestures();
        this.setupRecentlyPlayedToggle();
        this.updateTooltipContent();
    }

    queueInitializations() {
        const initFunctions = [
            this.loadRecentlyPlayed.bind(this),
            this.setupGenreButtonsNavigation.bind(this),
            this.setupGenreCategoriesSwipe.bind(this),
            this.setupNowPlayingMetadata.bind(this),
            () => this.setupExpandableCategories()
        ];
        
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                initFunctions.forEach(fn => fn());
            }, { timeout: 1000 });
        } else {
            initFunctions.forEach(fn => fn());
        }

        setTimeout(() => this.ScrollbarManager.updateAll(), 500);
    }

loadPreferences() {
    const savedColor = localStorage.getItem("accentColor") || CONFIG.DEFAULT_COLOR;
    const savedStation = this.safeParseJSON("lastStation", {});
    
    // Initialize theme manager if needed
    if (!window.themeManager) {
        window.themeManager = new ThemeManager();
    }
    
    // Apply saved theme (or system preference if none saved)
    this.setTheme(localStorage.getItem("theme"));
    
    // Apply saved color through theme manager
    if (window.themeManager && window.themeManager.changeColor) {
        window.themeManager.changeColor(savedColor);
    }
    
    this.setInitialActiveStates();

    // Initialize elements if not already done
    if (!this.elements) {
        this.elements = {
            audio: document.getElementById("audioctrl"),
            audioText: document.getElementById("audiotext")
            // Add other element references as needed
        };
    }

    if (savedStation.name && savedStation.link) {
        const { audioText } = this.elements;
        audioText.innerHTML = `<div class="station-name">${savedStation.name}</div>`;
        document.title = `KlikniPlay | ${savedStation.name}`;
        this.updateSelectedStation(savedStation.name);
        
        this.updatePlayPauseButton();
        
        this.currentStation = savedStation;
        this.elements.audio.src = savedStation.link;
        
        setTimeout(() => {
            this.checkMetadata(true);
            this.setupNowPlayingMetadata();
        }, 300);
    } else {
        document.title = "KlikniPlay";
        this.updatePlayPauseButton();
        this.elements.audioText.innerHTML = `<div class="station-name">Odaberite stanicu</div>`;
    }
}

    // Utility Functions
    safeParseJSON(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key)) || fallback;
        } catch {
            return fallback;
        }
    }

    shouldUpdateTooltip() {
        const tooltip = document.querySelector('.genre-tooltip');
        return tooltip && tooltip.classList.contains('visible') && 
               document.visibilityState === 'visible';
    }

    handlePlayError = (e) => {
        console.error("Playback error:", e);
        this.setupNowPlayingMetadata();
        this.updatePlayPauseButton();
    }

    // Navigation and UI Setup
    setupGenreButtonsNavigation() {
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
       const scrollAmount = genreButtons.clientWidth * 0.6;
       const start = genreButtons.scrollLeft;
       const maxScroll = genreButtons.scrollWidth - genreButtons.clientWidth;
       const target = direction === 'left' 
           ? Math.max(0, start - scrollAmount)
           : Math.min(start + scrollAmount, maxScroll);

       // Set position
       genreButtons.scrollLeft = target;
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

setupGenreCategoriesSwipe() {
    const genreWrapper = document.querySelector('.genre-buttons-wrapper');
    if (!genreWrapper) return;
    
    const genreButtons = genreWrapper.querySelector('.genre-buttons');
    if (!genreButtons) return;

    let touchStartX = 0;
    let isSwiping = false;
    let scrollLeftStart = 0;
    
    genreButtons.addEventListener('touchstart', function(e) {
        // Only handle horizontal swipes when we're at scroll boundaries
        if (genreButtons.scrollLeft > 0 && 
            genreButtons.scrollLeft < genreButtons.scrollWidth - genreButtons.clientWidth) {
            return;
        }
        
        touchStartX = e.changedTouches[0].screenX;
        scrollLeftStart = genreButtons.scrollLeft;
        isSwiping = true;
        
        // Preserve native scrolling behavior by not preventing default
        genreButtons.style.overscrollBehaviorX = 'contain';
    }, { passive: true });

    genreButtons.addEventListener('touchmove', function(e) {
        if (!isSwiping) return;
        const touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        
        // For horizontal swiping at boundaries only
        if ((scrollLeftStart <= 0 && diff < 0) || 
            (scrollLeftStart >= genreButtons.scrollWidth - genreButtons.clientWidth && diff > 0)) {
            e.preventDefault();
            genreButtons.scrollLeft = scrollLeftStart + diff;
            genreButtons.style.scrollBehavior = 'auto';
        }
    }, { passive: false });

    genreButtons.addEventListener('touchend', function() {
        isSwiping = false;
        genreButtons.style.scrollBehavior = 'smooth';
        
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

    // Scrollbar Manager
    cleanupResources = () => {
        // Cleanup tooltip
		clearTimeout(this.searchFocusTimeout);
		window.removeEventListener('resize', this.handleResize);
        const tooltip = document.querySelector('.genre-tooltip');
        if (tooltip) {
            tooltip._scrollHandler && tooltip.removeEventListener('scroll', tooltip._scrollHandler);
            tooltip._mutationObserver?.disconnect();
        }
        
        // Cleanup dropdown manager
        if (this.DropdownManager) {
            document.removeEventListener("click", this.DropdownManager.handleOutsideClick);
            document.removeEventListener("touchend", this.DropdownManager.handleOutsideClick);
            
            Object.values(this.DropdownManager.dropdowns || {}).forEach(dropdown => {
                dropdown.toggle?.removeEventListener("click", this.DropdownManager.toggle);
                dropdown.toggle?.removeEventListener("touchend", this.DropdownManager.toggle);
            });
        }
        
        // Cleanup intervals and styles
        if (this.metadataInterval) clearInterval(this.metadataInterval);
        if (this.scrollbarHideTimeout) clearTimeout(this.scrollbarHideTimeout);
        document.getElementById('marquee-style')?.remove();
        
        document.querySelectorAll('[data-dynamic-style]').forEach(el => el.remove());
        
        // Cleanup observers
        [this.windowResizeObserver, ...(this.ScrollbarManager.resizeObservers || [])]
            .forEach(observer => observer?.disconnect());
        
        // Reset UI states
        if (this.DropdownManager) {
            Object.entries(this.DropdownManager.dropdowns).forEach(([id, dropdown]) => {
                dropdown.toggle?.classList.remove("active");
                if (dropdown.menu) {
                    dropdown.menu.classList.remove("show", "visible");
                    dropdown.menu.style.display = 'none';
                }
            });
        }
    }
}

// Dropdown Manager Class
class DropdownManager {
    constructor(cachedElements = {}) {
        this.isOperating = false;
        this.currentOpen = null;
        this.lastToggleTime = 0;
        this.dropdowns = {
			theme: {
				toggle: document.querySelector(".theme-toggle"),
				menu: document.querySelector(".theme-dropdown__menu")
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

        this.handleOutsideClick = (e) => {
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

        document.addEventListener("click", this.handleOutsideClick);
        document.addEventListener("touchend", this.handleOutsideClick, { passive: true });
    }

toggle(id, event) {
    if (this.isOperating || performance.now() - this.lastToggleTime < 300) return;
    this.lastToggleTime = performance.now();
    this.isOperating = true;

    const dropdown = this.dropdowns[id];
    if (!dropdown) return;

    // Store scroll position before closing
    const currentScroll = dropdown.menu.scrollTop;

    if (this.currentOpen === id) {
        this.close(id);
    } else {
        this.currentOpen && this.close(this.currentOpen);
        // Schedule opening after a brief delay to prevent rendering conflicts
        setTimeout(() => {
            this.open(id);
            // Restore scroll position if available
            if (dropdown._scrollPosition) {
                dropdown.menu.scrollTop = dropdown._scrollPosition;
            }
        }, 50);
    }

    // Store scroll position
    dropdown._scrollPosition = currentScroll;

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
	
    // Reset scroll position
    dropdown.menu.scrollTop = 0;

    requestAnimationFrame(() => {
        dropdown.menu.classList.add('show');
        if (id === 'tooltip') {
            dropdown.menu.classList.add('visible');
            // Wait for the dropdown to be fully visible before updating content
            setTimeout(() => {
                window.radioPlayer?.updateTooltipContent();
                // Then setup scroll after content is loaded
                this.setupDropdownScroll(id);
            }, 50);
        } else if (dropdown.needsScroll) {
            this.setupDropdownScroll(id);
        }
        
        dropdown.menu.style.opacity = '1';
        dropdown.toggle.classList.add('active');
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

    // Preserve scroll position during updates
    const scrollTop = dropdown.menu.scrollTop;

    // Clear existing handlers and buttons
    if (dropdown.menu._handlersCleared) {
        dropdown.menu.removeEventListener('wheel', dropdown.menu._wheelHandler);
        dropdown.menu.removeEventListener('scroll', dropdown.menu._scrollHandler);
        dropdown.menu.removeEventListener('scroll', dropdown.menu._scrollTracker);
    }
    
    dropdown.menu.querySelectorAll(`.${dropdown.navButtonClass}`).forEach(b => b.remove());

    // Add new handlers
    dropdown.menu._wheelHandler = (e) => {
        e.preventDefault();
        dropdown.menu.scrollTop += e.deltaY;
    };
    dropdown.menu.addEventListener('wheel', dropdown.menu._wheelHandler, { passive: false });

    // Restore scroll position after content changes
    dropdown.menu.scrollTop = scrollTop;

    // Calculate if we need scroll buttons AFTER content is loaded
    const checkScroll = () => {
        requestAnimationFrame(() => {
            const hasScroll = dropdown.menu.scrollHeight > dropdown.menu.clientHeight;
            
            if (hasScroll) {
                // Only create buttons if they don't exist to prevent flashing
                if (!dropdown.menu.querySelector(`.${dropdown.navButtonClass}`)) {

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

                    // Modified scroll handler with better boundary detection
                    const checkVisibility = () => {
                        const { scrollTop, scrollHeight, clientHeight } = dropdown.menu;
                        const maxScroll = scrollHeight - clientHeight;
                        const buffer = 2; // Small buffer to prevent flickering at boundaries
                        
                        const showTop = scrollTop > buffer;
                        const showBottom = scrollTop < maxScroll - buffer;
                        
                        topBtn.style.opacity = showTop ? '1' : '0';
                        topBtn.style.pointerEvents = showTop ? 'auto' : 'none';
                        bottomBtn.style.opacity = showBottom ? '1' : '0';
                        bottomBtn.style.pointerEvents = showBottom ? 'auto' : 'none';
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
            topBtn.addEventListener('touchend', (e) => (e.stopPropagation(), smoothScroll('top')), { passive: false });
            bottomBtn.addEventListener('touchend', (e) => (e.stopPropagation(), smoothScroll('bottom')), { passive: false });
            
            // Properly handle scroll events
            const scrollHandler = () => {
                cancelAnimationFrame(dropdown.menu._scrollRAF);
                dropdown.menu._scrollRAF = requestAnimationFrame(checkVisibility);
            };
            
            dropdown.menu.addEventListener('scroll', scrollHandler, { passive: true });
            dropdown.menu._scrollHandler = scrollHandler;
            
            // Initial check
            checkVisibility();
			
            let lastScrollTime = 0;
            dropdown.menu._scrollTracker = () => {
                const now = Date.now();
                if (now - lastScrollTime > 100) {
                    checkVisibility();
                }
                lastScrollTime = now;
            };
            
            dropdown.menu.addEventListener('scroll', dropdown.menu._scrollTracker, { passive: true });
                }
            }
        });
    };

    // Initialize with a small delay to ensure proper measurements
    setTimeout(() => {
        checkScroll();
        // Force a reflow to prevent 1px shifts
        dropdown.menu.getBoundingClientRect();
    }, 50);
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

    keepOpen(id) {
        if (this.currentOpen === id) {
            const dropdown = this.dropdowns[id];
            dropdown.menu?.classList.add('show');
            dropdown.toggle?.classList.add('active');
        }
    }
}

// Scrollbar Manager Class
class ScrollbarManager {
    constructor(cachedElements = {}) {
        this.scrollList = cachedElements.scrollList || document.querySelector('.scroll-list');
        this.scrollbarThumb = document.querySelector('.scrollbar-thumb');
        this.scrollbarTrack = document.querySelector('.scrollbar-track');
        this.resizeObservers = [];
        
        if (!this.scrollList || !this.scrollbarThumb || !this.scrollbarTrack) return;

        this.scrollList.append(this.scrollbarTrack);
        this.scrollbarTrack.append(this.scrollbarThumb);
        
        this.setupEvents();
        this.setupResizeObserver();
        this.updateAll();
        this.setupAutoHide();
    }

    setupEvents() {
        // Thumb dragging
        const handleThumbMove = (startY, startTop) => e => {
            const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            const deltaY = clientY - startY;
            const newTop = Math.max(0, Math.min(
                startTop + deltaY, 
                this.scrollbarTrack.clientHeight - this.scrollbarThumb.clientHeight
            ));
            
            this.scrollbarThumb.style.top = `${newTop}px`;
            this.scrollList.scrollTop = (newTop / (this.scrollbarTrack.clientHeight - this.scrollbarThumb.clientHeight)) * 
                                       (this.scrollList.scrollHeight - this.scrollList.clientHeight);
        };

        // Mouse drag
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
        
        // Touch drag
        this.scrollbarThumb.addEventListener('touchstart', e => {
            e.preventDefault();
            this.scrollbarThumb.classList.add('dragging');
            
            const touch = e.touches[0];
            const moveHandler = handleThumbMove(touch.clientY, parseFloat(this.scrollbarThumb.style.top));
            const endHandler = () => {
                this.scrollbarThumb.classList.remove('dragging');
                document.removeEventListener('touchmove', moveHandler);
                document.removeEventListener('touchend', endHandler);
            };
            
            document.addEventListener('touchmove', moveHandler, { passive: false });
            document.addEventListener('touchend', endHandler, { passive: true });
        });

        // Track click
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
        
        // Window resize
        window.addEventListener('resize', () => {
            cancelAnimationFrame(this.resizeRAF);
            this.resizeRAF = requestAnimationFrame(() => this.updateTrackPosition());
        }, { passive: true });
    }

    updateAll() {
        this.updateThumbSize();
        this.positionThumb();
        this.updateTrackPosition();
    }

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
    }

positionThumb() {
    if (this.scrollList.scrollHeight <= this.scrollList.clientHeight) {
        this.scrollbarThumb.style.display = 'none';
        return;
    }
    
    // Get precise container measurements
    const trackHeight = this.scrollbarTrack.clientHeight;
    const thumbHeight = this.scrollbarThumb.clientHeight;
    
    // Ensure positions are integer values to prevent 1px gaps
    const maxTop = Math.floor(trackHeight - thumbHeight);
    const scrollPercentage = this.scrollList.scrollTop / 
                           (this.scrollList.scrollHeight - this.scrollList.clientHeight);
    const thumbPosition = Math.floor(scrollPercentage * maxTop);
    
    // Set position with integer values
    this.scrollbarThumb.style.top = `${thumbPosition}px`;
}

    setupResizeObserver() {
        this.resizeObserver = new ResizeObserver(() => {
            cancelAnimationFrame(this.resizeRAF);
            this.resizeRAF = requestAnimationFrame(() => this.updateAll());
        });
        
        [document.querySelector('.audio-container'), document.body]
            .filter(Boolean)
            .forEach(el => this.resizeObserver.observe(el));
    }

updateTrackPosition() {
    const audioContainer = document.querySelector('.audio-container');
    if (!audioContainer) return;
    
    // Get precise container measurements
    const containerRect = this.scrollList.getBoundingClientRect();
    const audioContainerRect = audioContainer.getBoundingClientRect();
    
    // Calculate with integer values
    const scrollListBottom = Math.floor(document.documentElement.clientHeight - audioContainerRect.height);
    const availableHeight = Math.floor(document.documentElement.clientHeight - containerRect.top - audioContainerRect.height);
    const finalHeight = Math.max(100, availableHeight);
    
    // Set rounded values
    this.scrollList.style.bottom = `${Math.round(audioContainerRect.height)}px`;
    this.scrollList.style.maxHeight = `${Math.round(finalHeight)}px`;
    this.scrollbarTrack.style.height = `${Math.round(finalHeight)}px`;
    
    this.updateThumbSize();
    this.positionThumb();
}

    setupAutoHide() {
        if (!this.scrollList || !this.scrollbarThumb) return;
        
        const checkHide = () => {
            if (!this.scrollbarThumb.matches(':hover, .dragging')) {
                this.scrollbarThumb.classList.remove('visible');
            }
        };

        this.scrollList.addEventListener('scroll', () => {
            window.lastScrollTime = Date.now();
            this.scrollbarThumb.classList.add('visible');
            clearTimeout(window.scrollbarHideTimeout);
            window.scrollbarHideTimeout = setTimeout(checkHide, CONFIG.SCROLLBAR_HIDE_DELAY);
        });

        this.scrollbarThumb.addEventListener('mouseenter', () => {
            this.scrollbarThumb.classList.add('visible');
            clearTimeout(window.scrollbarHideTimeout);
        });

        this.scrollbarThumb.addEventListener('mouseleave', () => {
            window.scrollbarHideTimeout = setTimeout(checkHide, CONFIG.SCROLLBAR_HIDE_DELAY);
        });

        this.scrollbarThumb.classList.remove('visible');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    window.themeManager = new ThemeManager();
	window.themeManager.setupColorPickers();
    window.radioPlayer = new RadioPlayer();
    window.lastScrollTime = 0;
    window.scrollbarHideTimeout = null;
	window.pwaInstaller = new PWAInstaller();
});

// Register Service Worker
// Register Service Worker with correct scope
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: '/radio-sajt/' })
      .then(registration => {
        console.log('ServiceWorker registration successful with scope:', registration.scope);
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}

// Simplified PWA Installation
class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.installContainer = document.getElementById('pwaInstallContainer');
    
    // Add these checks to ensure elements exist
    if (!this.installContainer) {
      console.warn('PWA install container not found');
      return;
    }
    
    this.setupEvents();
    this.checkInstallStatus();
  }

  setupEvents() {
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallPrompt();
    });

    window.addEventListener('appinstalled', () => {
      console.log('App was installed');
      localStorage.setItem('pwaInstalled', 'true');
      this.dismiss();
    });

    const installBtn = document.getElementById('pwaInstallButton');
    const dismissBtn = document.getElementById('pwaDismissButton');
    
    if (installBtn) {
      installBtn.addEventListener('click', () => this.install());
    }
    
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => this.dismiss());
    }
  }

  checkInstallStatus() {
    if (this.isPWAInstalled()) {
      localStorage.setItem('pwaInstalled', 'true');
      this.dismiss();
    }
  }

  showInstallPrompt() {
    if (this.shouldShowPrompt()) {
      this.installContainer.classList.add('show');
      setTimeout(() => {
        if (this.installContainer.classList.contains('show')) {
          this.dismiss();
        }
      }, 20000);
    }
  }

  shouldShowPrompt() {
    if (this.isPWAInstalled() || localStorage.getItem('pwaInstalled')) {
      return false;
    }
    
    // Only show once per week if dismissed
    const lastDismissed = parseInt(localStorage.getItem('pwaDismissedTimestamp')) || 0;
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    return lastDismissed < oneWeekAgo;
  }

  isPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
  }

  async install() {
    if (!this.deferredPrompt) return;
    
    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      
      console.log(`User ${outcome} the install prompt`);
      // Don't set pwaInstalled here - wait for appinstalled event
    } catch (err) {
      console.error('Install failed:', err);
    } finally {
      this.deferredPrompt = null;
    }
  }

  dismiss() {
    localStorage.setItem('pwaDismissed', 'true');
    localStorage.setItem('pwaDismissedTimestamp', Date.now());
    this.installContainer.classList.remove('show');
  }
}