document.addEventListener("DOMContentLoaded", () => {
    // Initialize core components first
    ScrollbarManager.init();
	ScrollbarManager.setupAutoHide();
    loadPreferences();
	setupAudioContainerObserver();
	setupAudioContainerGestures();
    
    // Initialize all other components
    const initFunctions = [
        setupRecentlyPlayedToggle,
        loadRecentlyPlayed,
        setupGenreInfoIcon,
        setupDropdown,
        setupGenreButtonsNavigation,
        setupGenreCategoriesSwipe,
        setupGenreFiltering,
        setupThemeControls,
        setupNowPlayingMetadata,
		setupExpandableCategories
    ];
    
    initFunctions.forEach(fn => fn());
    
    // Use event delegation for radio stations
    document.querySelector('.scroll-list').addEventListener('click', (e) => {
        const radio = e.target.closest('.radio');
        if (radio) changeStation(radio.dataset.name, radio.dataset.link);
    });
    
    // Final update
    setTimeout(() => ScrollbarManager.updateAll(), 500);
    
    // Cleanup
    window.addEventListener('beforeunload', cleanupResources);
});

function cleanupResources() {
    // Cleanup all observers and timers
    [windowResizeObserver, ...(ScrollbarManager.resizeObservers || [])]
        .forEach(observer => observer?.disconnect());
    
    clearInterval(metadataInterval);
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

// Station Functions
async function changeStation(name, link) {
    // Clear existing metadata immediately
    const audioTextElement = document.getElementById('audiotext');
    if (audioTextElement) {
        audioTextElement.innerHTML = `<div class="station-name">${name}</div>`;
        audioTextElement.classList.remove('has-now-playing');
        document.querySelector('.audio-container').classList.remove('has-now-playing');
        updateAudioContainerHeight();
    }
    
    // Reset metadata state
    lastTitle = '';
    if (metadataInterval) {
        clearInterval(metadataInterval);
        metadataInterval = null;
    }
    
    // Update current station
    currentStation = { name, link };
    lastTitle = '';
    
    // Handle audio playback
    audio.pause();
    audio.src = link;
    audio.load();
    
    // Setup metadata checking
    audio.oncanplay = async () => {
        try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                await playPromise.catch(handlePlayError);
            }
            // Immediate metadata check on play
            checkMetadata(true);
            // Setup continuous checking with shorter interval
            setupNowPlayingMetadata();
        } catch (e) {
            handlePlayError(e);
        }
    };

    // Also check metadata when the song ends
    audio.addEventListener('ended', () => {
        checkMetadata(true);
    });

    // Update UI and storage
    document.title = `Radio | ${name}`;
    localStorage.setItem("lastStation", JSON.stringify({ name, link }));
    
    updateRecentlyPlayed(name, link, document.querySelector(`.radio[data-name="${name}"]`)?.dataset.genre || '');
    updateSelectedStation(name);
    
    // Auto-scroll to the selected station
    const selectedStation = document.querySelector(`.radio[data-name="${name}"]`);
    if (selectedStation) {
        selectedStation.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
    updatePlayPauseButton();
    
    // Check metadata after short delay
    setTimeout(() => checkMetadata(true), 100);
}

function handlePlayError(e) {
    console.error("Playback error:", e);
    setupNowPlayingMetadata();
}

async function getNowPlaying(station) {
    if (!station?.link) return null;

    try {
        const proxyUrl = `${METADATA_PROXY}?url=${encodeURIComponent(station.link)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) return null;
        
        const data = await response.json();
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
        .replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/(https?:\/\/[^\s]+)/g, '')
        .replace(/^\s+|\s+$/g, '')
        .replace(/\|.*$/, '')
        .replace(/\b(?:Radio Paradise|RP)\b/i, '')
        .trim();
}

// Helper function with timeout
function fetchWithTimeout(url, timeout) {
    return Promise.race([
        fetch(url),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
    ]);
}

function updateNowPlayingUI(title) {
    const audioTextElement = document.getElementById('audiotext');
    if (!audioTextElement || !title) return;

    // Add has-now-playing class to audio container
    const audioContainer = document.querySelector('.audio-container');
    audioContainer.classList.add('has-now-playing');
	updateAudioContainerHeight();
    
    // Rest of your existing code...
    let stationNameElement = audioTextElement.querySelector('.station-name') || 
                           document.createElement('div');
    stationNameElement.className = 'station-name';
    stationNameElement.textContent = currentStation?.name || '';
    
    let songTitleElement = audioTextElement.querySelector('.song-title');
    if (!songTitleElement) {
        songTitleElement = document.createElement('div');
        songTitleElement.className = 'song-title';
        audioTextElement.prepend(songTitleElement);
    }
    
    songTitleElement.textContent = title;
    audioTextElement.classList.add('has-now-playing');
    
    setTimeout(() => applyMarqueeEffect(songTitleElement), 300);
}

function applyMarqueeEffect(element) {
    // Clear any existing marquee elements and styles
    removeExistingMarqueeElements();
    
    // Reset element styles
    element.style.animation = 'none';
    element.style.transform = 'translateX(0)';
    element.style.position = 'relative';
    element.style.display = 'inline-block';
    element.style.whiteSpace = 'nowrap';
    element.style.width = 'auto';
    
    // Check if text overflows its container
    const container = element.parentElement;
    if (!container) return;
    
    element.style.overflow = 'visible';
    container.style.overflow = 'hidden';
    
    const containerWidth = container.clientWidth;
    const textWidth = element.scrollWidth;
    const isOverflowing = textWidth > containerWidth;
    
    if (!isOverflowing) {
        // Remove right fade if text doesn't overflow
        element.style.removeProperty('overflow');
        container.style.removeProperty('overflow');
		element.classList.remove('marquee-active');
        return;
    }

    // Add class to indicate marquee is active
    element.classList.add('marquee-active');
	
    // Create fade elements and setup animation only if overflowing
    setupMarqueeAnimation(element, textWidth);
}

function removeExistingMarqueeElements() {
    document.getElementById('marquee-fade-left')?.remove();
    document.querySelectorAll('.marquee-clone').forEach(el => el.remove());
    document.getElementById('marquee-style')?.remove();
}

function setupMarqueeAnimation(element, textWidth) {
    const container = element.parentElement;
    
    // Create left fade element
    const leftFade = document.createElement('div');
    leftFade.id = "marquee-fade-left";
    leftFade.style.position = 'absolute';
    leftFade.style.top = '0';
    leftFade.style.left = '0';
    leftFade.style.width = '30px';
    leftFade.style.height = '100%';
    leftFade.style.pointerEvents = 'none';
    leftFade.style.zIndex = '2';
    leftFade.style.opacity = '0';
    container.appendChild(leftFade);

    // Create wrapper for animation
    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-block';
    wrapper.style.position = 'relative';
    wrapper.style.whiteSpace = 'nowrap';

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
    const scrollSpeed = 40; // pixels per second
    const scrollDuration = scrollDistance / scrollSpeed;
    const pauseDuration = 2; // seconds
    const totalDuration = scrollDuration + pauseDuration * 2;
    
    const initialPauseEnd = (pauseDuration / totalDuration * 100).toFixed(6);
    const scrollEnd = (((pauseDuration + scrollDuration) / totalDuration) * 100).toFixed(6);
    
    // Add 5% buffer before the end to fade out earlier
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

 // Define checkMetadata function
    async function checkMetadata(force = false) {
        if (!currentStation?.link) return;
        
        try {
            const now = Date.now();
            if (!force && now - lastMetadataCheck < METADATA_CHECK_INTERVAL) return;
            
            lastMetadataCheck = now;
            const title = await getNowPlaying(currentStation);
            
            if (title && title !== lastTitle) {
                lastTitle = title;
                updateNowPlayingUI(title);
            }
        } catch (e) {
            console.error('Metadata check failed:', e);
        }
    }

function setupNowPlayingMetadata() {
    if (metadataInterval) clearInterval(metadataInterval);
    
    // Immediate check with no cooldown on first run
    checkMetadata(true);
    
    // Set up more frequent checking (every 5 seconds instead of 15)
    metadataInterval = setInterval(() => {
        checkMetadata();
    }, 5000); // Reduced from 15000 to 5000
    
    // Also check when playback starts
    audio.addEventListener('play', () => {
        checkMetadata(true);
    }, { once: true });
    
    // Check when song ends
    audio.addEventListener('ended', () => {
        checkMetadata(true);
    });
}

function updateSelectedStation(name) {
    document.querySelectorAll(".radio").forEach(radio => {
        radio.classList.toggle("selected", radio.dataset.name === name);
        const existingEqualizer = radio.querySelector(".equalizer");
        
        if (radio.dataset.name === name) {
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
function setupGenreFiltering() {
    // Use event delegation instead of individual listeners
    document.querySelector('.genre-buttons')?.addEventListener('click', (e) => {
        const button = e.target.closest('.genre-button');
        if (!button) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        document.getElementById("stationSearch").value = "";
        document.getElementById("clearSearch").style.display = "none";
        
        document.querySelectorAll('.genre-button').forEach(btn => {
            btn.classList.toggle('active', btn === button);
        });
        
        currentGenre = button.dataset.genre;
        applyGenreFilter();
        setupExpandableCategories();
    });
}

function applyGenreFilter() {
    cancelAnimationFrame(window._genreFilterRAF);
    
    window._genreFilterRAF = requestAnimationFrame(() => {
        if (document.getElementById("stationSearch").value.trim() !== "") return;
        
        const noResultsElement = document.querySelector('.no-results');
        let hasVisibleStations = false;
        
        document.querySelectorAll('.radio:not(#recentlyPlayedContainer .radio)').forEach(station => {
            const stationGenres = station.dataset.genre?.split(',') || [];
            const shouldShow = currentGenre === 'all' || stationGenres.includes(currentGenre);
            station.style.display = shouldShow ? 'flex' : 'none';
            if (shouldShow) hasVisibleStations = true;
        });

        if (noResultsElement) {
            noResultsElement.style.display = 'none'; // Always hide for genre filter
        }

        updateCategoryVisibility();
        setupExpandableCategories();
        
        // Update scrollbar after filtering
        setTimeout(ScrollbarManager.updateAll.bind(ScrollbarManager), 10);
    });
}

function updateCategoryVisibility() {
    document.querySelectorAll(".category-container:not(#recentlyPlayedContainer)").forEach(category => {
        const categoryTitle = category.previousElementSibling;
        if (!categoryTitle?.classList.contains("category")) return;

        const hasVisibleStation = [...category.querySelectorAll(".radio")]
            .some(station => window.getComputedStyle(station).display !== 'none');

        category.style.display = hasVisibleStation ? "flex" : "none";
        categoryTitle.style.display = hasVisibleStation ? "flex" : "none";
    });

    // Always show recently played section
    const recentlyPlayedContainer = document.getElementById("recentlyPlayedContainer");
    const recentlyPlayedTitle = document.querySelector("#recentlyPlayedTitle");
    
    if (recentlyPlayedContainer && recentlyPlayedTitle) {
        recentlyPlayedContainer.style.display = "flex";
        recentlyPlayedTitle.style.display = "flex";
        
        // Ensure all recently played stations are visible
        recentlyPlayedContainer.querySelectorAll(".radio").forEach(station => {
            station.style.display = "flex";
        });
    }
}

// Theme Functions
function setTheme(mode) {
    document.body.classList.add("no-transition");
    document.querySelectorAll("*").forEach(allelements => {
        allelements.classList.add("no-transition");
    });
    
    document.body.className = `${mode}-mode`;
    document.documentElement.style.setProperty(
        "--accent-color", 
        `var(--accent-${mode === "dark" ? "light" : "dark"})`
    );
    localStorage.setItem("theme", mode);

    setTimeout(() => {
        document.body.classList.remove("no-transition");
        document.querySelectorAll("*").forEach(allelements => {
            allelements.classList.remove("no-transition");
        });
        ScrollbarManager.updateAll();
    }, 50);

    document.querySelectorAll(".theme-icon").forEach(icon => {
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

    document.documentElement.style.setProperty("--accent-dark", `var(${colors[0]})`);
    document.documentElement.style.setProperty("--accent-light", `var(${colors[1]})`);
    
    const currentTheme = document.body.classList.contains("dark-mode") ? "dark" : "light";
    document.documentElement.style.setProperty(
        "--accent-color", 
        `var(${colors[currentTheme === "dark" ? 1 : 0]})`
    );

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

function updateRecentlyPlayed(name, link, genre = '') {
    const recentlyPlayed = safeParseJSON('recentlyPlayed', []);
    const newRecentlyPlayed = [
        { name, link, genre },
        ...recentlyPlayed.filter(item => item.link !== link)
    ].slice(0, 7);
    
    localStorage.setItem('recentlyPlayed', JSON.stringify(newRecentlyPlayed));
    
    // Get the current expanded state before loading
    const container = document.getElementById("recentlyPlayedContainer");
    const wasExpanded = container && container.style.maxHeight !== '0px';
    
    loadRecentlyPlayed();
    
    // If it was expanded before updating, ensure it stays expanded with correct height
    if (wasExpanded) {
        setTimeout(() => {
            if (container) {
                const containerHeight = container.scrollHeight;
                container.style.maxHeight = `${containerHeight}px`;
                
                // Update the scroll list position
                const scrollList = document.querySelector('.scroll-list');
                if (scrollList) {
                    scrollList.style.bottom = `${COLLAPSED_HEIGHT + containerHeight + 35}px`;
                }
            }
        }, 10);
    }
}

function safeParseJSON(key, fallback) {
    try { 
        return JSON.parse(localStorage.getItem(key)) || fallback; 
    } catch (e) { 
        return fallback; 
    }
}

// UI Setup Functions
function setupDropdown() {
    const dropdownToggle = document.querySelector(".dropdown-toggle");
    const dropdownMenu = document.querySelector(".dropdown-menu");

    dropdownToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        dropdownToggle.classList.toggle("active");
        if (dropdownMenu.classList.contains('show')) {
            dropdownMenu.classList.remove('show');
        } else {
            dropdownMenu.style.display = 'flex';
            // Trigger reflow before adding class for animation
            void dropdownMenu.offsetWidth;
            dropdownMenu.classList.add('show');
        }
    });

    document.addEventListener("click", (event) => {
        if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
            dropdownToggle.classList.remove("active");
            dropdownMenu.classList.remove('show');
            setTimeout(() => {
                dropdownMenu.style.display = 'none';
            }, 200);
        }
    });
}

function setupGenreInfoIcon() {
    const infoIcon = document.querySelector('.info-icon');
    const tooltip = document.querySelector('.genre-tooltip');
    const audioTitle = document.getElementById('audiotext');

    if (!infoIcon || !tooltip || !audioTitle) return;

    let isTooltipVisible = false;

    // Toggle tooltip on click
    infoIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        isTooltipVisible = !isTooltipVisible;
        infoIcon.classList.toggle("active", isTooltipVisible); // Explicitly set based on visibility
        tooltip.classList.toggle('visible', isTooltipVisible);
        updateTooltipContent();
    });

    // Hide tooltip when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!infoIcon.contains(e.target)) {
            isTooltipVisible = false;
			infoIcon.classList.remove("active");
            tooltip.classList.remove('visible');
        }
    });

    // Update visibility and content when station changes
    audio.addEventListener('play', updateInfoIconVisibility);
    audio.addEventListener('pause', updateInfoIconVisibility);
    
    // Update immediately if there's a station playing
    updateInfoIconVisibility();
    
    function updateInfoIconVisibility() {
        const hasStation = audio.src && audioTitle.textContent !== "Izaberite stanicu";
        infoIcon.classList.toggle('visible', hasStation);
        
        if (!hasStation) {
            isTooltipVisible = false;
            tooltip.classList.remove('visible');
        } else {
            updateTooltipContent();
        }
    }
    
    function updateTooltipContent() {
        const currentStation = document.querySelector('.radio.selected') || 
                             document.querySelector(`.radio[data-name="${audioTitle.textContent}"]`);
        
        if (!currentStation) {
            tooltip.innerHTML = '<strong>Žanrovi:</strong><div class="genre-tooltip-item">Nema informacija o žanru</div>';
            return;
        }
        
        const genres = currentStation.dataset.genre;
		if (!genres) {
			tooltip.innerHTML = '<strong>Žanrovi:</strong><div class="genre-tooltip-item">Nema informacija o žanru</div>';
			return;
    }
        
        const genreArray = genres.split(',');
        const formattedGenres = genreArray.map(genre => {
        const icon = getGenreIcon(genre.trim());
			return `<div class="genre-tooltip-item">${icon} ${capitalizeFirstLetter(genre.trim())}</div>`;
			}).join('');
    
			tooltip.innerHTML = `<strong>Žanrovi:</strong>${formattedGenres}`;
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
            'top': 'trending_up'
        };
        
        return `<span class="material-icons" style="font-size:16px;vertical-align:middle">${genreIcons[genre] || 'queue_music'}</span>`;
    }
    
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
}

function setupRecentlyPlayedToggle() {
    const audioContainer = document.querySelector('.audio-container');
    const toggle = document.getElementById('recentlyPlayedToggle');
    const toggleHandle = toggle.querySelector('.toggle-handle');
    const historyBtn = document.getElementById('historyBtn');
    const historyDropdown = document.getElementById('historyDropdown');
    const infoIcon = document.querySelector('.info-icon');
    const genreTooltip = document.querySelector('.genre-tooltip');
    
    let isExpanded = false;

    // Handle toggle
    toggleHandle.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleCollapse();
    });

	// Handle history button
    historyBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const isVisible = historyDropdown.classList.contains('show');
        
        // Close other open elements
        if (genreTooltip.classList.contains('visible')) {
            genreTooltip.classList.remove('visible');
            infoIcon.classList.remove('active');
        }
        
        // Immediately show/hide dropdown
        if (isVisible) {
            historyDropdown.classList.remove('show');
            setTimeout(() => {
                historyDropdown.style.display = 'none';
                historyBtn.classList.remove('active');
            }, 200);
        } else {
            historyDropdown.style.display = 'flex';
            // Force reflow before adding class for animation
            void historyDropdown.offsetWidth;
            historyDropdown.classList.add('show');
            historyBtn.classList.add('active');
        }
    });

    // Handle info icon
    infoIcon.addEventListener('click', function(e) {
        e.stopPropagation();
        // Close history dropdown immediately if open
        if (historyDropdown.classList.contains('show')) {
            historyDropdown.classList.remove('show');
            setTimeout(() => {
                historyDropdown.style.display = 'none';
                historyBtn.classList.remove('active');
            }, 200);
        }
        // Toggle tooltip
        infoIcon.classList.toggle('active');
        genreTooltip.classList.toggle('visible');
    });

document.addEventListener('click', function(e) {
    // Check if click is outside both the button and dropdown
    const isClickInside = historyBtn.contains(e.target) || 
                         historyDropdown.contains(e.target);
    
    if (!isClickInside && historyDropdown.classList.contains('show')) {
        historyDropdown.classList.remove('show');
        setTimeout(() => {
            historyDropdown.style.display = 'none';
            historyBtn.classList.remove('active');
        }, 200);
    }
    
    // Also handle info icon
    if (!infoIcon.contains(e.target) && !genreTooltip.contains(e.target)) {
        genreTooltip.classList.remove('visible');
        infoIcon.classList.remove('active');
    }
});

    // Helper functions
    function toggleCollapse() {
        isExpanded = !isExpanded;
        audioContainer.classList.toggle('expanded', isExpanded);
        ScrollbarManager.updateAll();
    }

function toggleHistoryDropdown() {
    const isVisible = historyDropdown.classList.contains('show');
    if (isVisible) {
        historyDropdown.classList.remove('show');
        setTimeout(() => {
            historyDropdown.style.display = 'none';
        }, 200); // Match this with your CSS transition duration
    } else {
        historyDropdown.style.display = 'flex';
        // Trigger reflow before adding class for animation
        void historyDropdown.offsetWidth;
        historyDropdown.classList.add('show');
    }
}

function toggleGenreTooltip() {
    const isVisible = genreTooltip.classList.contains('visible');
    if (isVisible) {
        genreTooltip.classList.remove('visible');
    } else {
        // Trigger reflow before adding class for animation
        void genreTooltip.offsetWidth;
        genreTooltip.classList.add('visible');
    }
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
        if (e.target.closest('.audio-player')) return;
        
        startY = e.touches[0].clientY;
        startHeight = audioContainer.clientHeight;
        isDragging = true;
        audioContainer.style.transition = 'none'; // Disable during drag
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
        audioContainer.style.transition = ''; // Re-enable transitions
        
        // Snap to nearest state
        if (currentHeight > COLLAPSED_HEIGHT + 50) {
            audioContainer.classList.add('expanded');
        } else {
            audioContainer.classList.remove('expanded');
        }
        
        updateAudioContainerHeight(); // Let the centralized function handle the final height
    });

    // Handle toggle handle click
    const toggleHandle = document.querySelector('.toggle-handle');
    if (toggleHandle) {
        toggleHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            audioContainer.classList.toggle('expanded');
            updateAudioContainerHeight();
        });
    }
}

function setupRecentlyPlayedNavigation() {
    const wrapper = document.querySelector('.recently-played-wrapper');
    if (!wrapper) return;
    
    const stations = wrapper.querySelector('.recently-played-stations');
    if (!stations) return;

    // Create navigation buttons if they don't exist
    let topButton = wrapper.querySelector('.history-nav-button.top');
    let bottomButton = wrapper.querySelector('.history-nav-button.bottom');
    
    if (!topButton) {
        topButton = document.createElement('button');
        topButton.className = 'history-nav-button top';
        topButton.innerHTML = '<span class="material-icons">expand_less</span>';
        topButton.setAttribute('aria-label', 'Scroll up');
        wrapper.insertBefore(topButton, stations);
    }
    
    if (!bottomButton) {
        bottomButton = document.createElement('button');
        bottomButton.className = 'history-nav-button bottom';
        bottomButton.innerHTML = '<span class="material-icons">expand_more</span>';
        bottomButton.setAttribute('aria-label', 'Scroll down');
        wrapper.appendChild(bottomButton);
    }

    // Initialize as hidden
    topButton.style.display = 'none';
    bottomButton.style.display = 'none';

    function checkOverflow() {
        // Force reflow before checking
        void stations.offsetHeight;
        
        const hasOverflow = stations.scrollHeight > stations.clientHeight;
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
        
        topButton.style.display = scrollTop <= 10 ? 'none' : 'flex';
        bottomButton.style.display = scrollTop >= maxScroll - 10 ? 'none' : 'flex';
    }

    function smoothScroll(direction) {
        const scrollAmount = stations.clientHeight * 0.8;
        const start = stations.scrollTop;
        const target = direction === 'top' 
            ? Math.max(0, start - scrollAmount)
            : Math.min(start + scrollAmount, stations.scrollHeight - stations.clientHeight);
        
        const duration = 200;
        const startTime = performance.now();

        function animateScroll(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease in-out function
            const easedProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            stations.scrollTop = start + (target - start) * easedProgress;
            
            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            } else {
                updateButtonVisibility();
            }
        }

        requestAnimationFrame(animateScroll);
    }

    // Event listeners
    topButton.addEventListener('click', () => smoothScroll('top'));
    bottomButton.addEventListener('click', () => smoothScroll('bottom'));
    stations.addEventListener('scroll', updateButtonVisibility);
    window.addEventListener('resize', checkOverflow);

	// Add this to prevent height jumps
    stations.style.minHeight = '0';
    stations.style.maxHeight = '60vh';
    stations.style.overflowY = 'auto';
    stations.style.overflowX = 'hidden';
    
    // Initial check without delay
    checkOverflow();
    
    // Also check when dropdown is shown - remove setTimeout
    document.getElementById('historyBtn').addEventListener('click', checkOverflow);
}

function loadRecentlyPlayed() {
    const container = document.querySelector('.recently-played-stations');
    if (!container) return;
	
	container.scrollTop = 0;
	
    const recentlyPlayed = safeParseJSON('recentlyPlayed', []);
    const uniqueStations = [...new Map(recentlyPlayed.map(item => [item.link, item])).values()].slice(0, 7);

    container.innerHTML = '';
    
    // Change to vertical layout
    container.style.flexDirection = 'column';
    container.style.overflowY = 'auto';
    container.style.overflowX = 'hidden';
    
    if (uniqueStations.length === 0) {
        container.innerHTML = '<div class="empty-message">Nema nedavno slušanih stanica...</div>';
        return;
    }

    uniqueStations.forEach(station => {
        const radio = document.createElement('div');
        radio.className = 'radio';
        radio.dataset.name = station.name;
        radio.dataset.link = station.link;
        radio.dataset.genre = station.genre || '';
        radio.innerHTML = `<div class="radio-text">${station.name}</div>`;
        radio.addEventListener('click', () => {
            changeStation(station.name, station.link);
            document.getElementById('historyDropdown').style.display = 'none';
        });
        container.appendChild(radio);
    });

    // Setup navigation after stations are loaded
    setTimeout(setupRecentlyPlayedNavigation, 100);
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
            if (index >= 8) {
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
    playPauseBtn.innerHTML = `<span class="material-icons">${audio.paused ? 'play_arrow' : 'pause'}</span>`;
    
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
function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
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
    
    document.querySelectorAll('.radio:not(#recentlyPlayedContainer .radio)').forEach(station => {
        const matches = station.dataset.name.toLowerCase().includes(query);
        station.style.display = matches ? 'flex' : 'none';
        if (matches) hasVisibleStations = true;
    });

    document.querySelectorAll('.category-container:not(#recentlyPlayedContainer)').forEach(category => {
        const hasVisible = [...category.querySelectorAll('.radio:not(#recentlyPlayedContainer .radio)')]
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
    document.querySelectorAll(".category-container:not(#recentlyPlayedContainer)").forEach(category => {
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
        if (stations.length > 8) {
            category.append(createExpandButton(stations, category));
            category.classList.add("no-radius", "has-expand-button");
            
            stations.forEach((station, index) => {
                station.style.display = index < 8 ? "flex" : "none";
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
        audio.src = savedStation.link;
        document.getElementById("audiotext").innerHTML = 
            `<div class="station-name">${savedStation.name}</div>`;
        document.title = `Radio | ${savedStation.name}`;
        updateSelectedStation(savedStation.name);
        
        // Set initial play/pause button state
        updatePlayPauseButton();
        
        // Set current station and check metadata immediately
        currentStation = savedStation;
        setTimeout(() => {
            checkMetadata(true);
            setupNowPlayingMetadata();
        }, 100);
    } else {
        document.title = "Radio";
        updatePlayPauseButton();
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
init() {
    this.scrollList = document.querySelector('.scroll-list');
    this.scrollbarThumb = document.querySelector('.scrollbar-thumb');
    this.scrollbarTrack = document.querySelector('.scrollbar-track');
    
    if (!this.scrollList || !this.scrollbarThumb || !this.scrollbarTrack) return;

    // Move scrollbar elements inside scroll-list
    this.scrollList.appendChild(this.scrollbarTrack);
    this.scrollbarTrack.appendChild(this.scrollbarThumb);
    
    this.setupEvents();
    this.updateAll();
    
    // Observe multiple elements for size changes
    this.setupResizeObservers();
},

setupResizeObservers() {
    // Clean up any existing observers
    if (this.resizeObservers) {
        this.resizeObservers.forEach(observer => observer.disconnect());
    }
    
    this.resizeObservers = [];
    
    // Elements that could affect the scroll list height
    const elementsToObserve = [
        document.querySelector('.audio-container'),
        document.getElementById('recentlyPlayedContainer'),
        document.body
    ];
    
    elementsToObserve.forEach(element => {
        if (element) {
            const observer = new ResizeObserver(() => {
                this.updateTrackPosition();
            });
            observer.observe(element);
            this.resizeObservers.push(observer);
        }
    });
},
  
    setupEvents() {
		window.addEventListener('resize', this.handleWindowResize.bind(this));
		
        // Thumb dragging - mouse
        this.scrollbarThumb.addEventListener('mousedown', this.handleThumbMouseDown.bind(this));
        
        // Thumb dragging - touch
        this.scrollbarThumb.addEventListener('touchstart', this.handleThumbTouchStart.bind(this), { passive: false });
        
        // Track clicking
        this.scrollbarTrack.addEventListener('click', this.handleTrackClick.bind(this));
        
        // Scroll events
        this.scrollList.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
        
        // Wheel event on track
        this.scrollbarTrack.addEventListener('wheel', this.handleTrackWheel.bind(this), { passive: false });
        
        // Hover events
        this.scrollbarTrack.addEventListener('mouseenter', () => {
            this.scrollbarThumb.classList.add('hovering');
        });
        
        this.scrollbarTrack.addEventListener('mouseleave', () => {
            this.scrollbarThumb.classList.remove('hovering');
        });
        
        // Touch events for track
        this.scrollbarTrack.addEventListener('touchstart', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        // Resize observer for scroll list
        this.resizeObserver = new ResizeObserver(() => {
            cancelAnimationFrame(this.resizeRAF);
            this.resizeRAF = requestAnimationFrame(() => this.updateAll());
        });
        this.resizeObserver.observe(this.scrollList);
    },
    
	handleWindowResize() {
		// Debounce the resize handling
		clearTimeout(this.resizeTimeout);
		this.resizeTimeout = setTimeout(() => {
			this.updateTrackPosition();
		}, 100);
	},
	
    handleTrackWheel(e) {
        // Prevent page scrolling when hovering scrollbar
        e.preventDefault();
        e.stopPropagation();
        
        // Apply wheel scrolling to the scroll list
        this.scrollList.scrollTop += e.deltaY;
        
        // Update thumb position immediately
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
        const scrollHeight = this.scrollList.scrollHeight;
        const clientHeight = this.scrollList.clientHeight;
        
        if (scrollHeight <= clientHeight) {
            this.scrollbarThumb.style.display = 'none';
            return;
        }
        
        this.scrollbarThumb.style.display = 'block';
        
        const thumbHeight = Math.max(30, (clientHeight / scrollHeight) * clientHeight);
        this.scrollbarThumb.style.height = `${thumbHeight}px`;
    },
  
    positionThumb() {
        const scrollHeight = this.scrollList.scrollHeight;
        const clientHeight = this.scrollList.clientHeight;
        const scrollTop = this.scrollList.scrollTop;
        
        if (scrollHeight <= clientHeight) {
            return;
        }
        
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
            let newTop = startTop + deltaY;
            
            // Constrain the thumb within track bounds
            newTop = Math.max(0, Math.min(newTop, trackHeight - thumbHeight));
            
            const scrollPercentage = newTop / (trackHeight - thumbHeight);
            const maxScroll = this.scrollList.scrollHeight - this.scrollList.clientHeight;
            const scrollPosition = Math.min(scrollPercentage * maxScroll, maxScroll);
            
            this.scrollbarThumb.style.top = `${newTop}px`;
            this.scrollList.scrollTop = scrollPosition;
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
            let newTop = startTop + deltaY;
            
            // Constrain the thumb within track bounds
            newTop = Math.max(0, Math.min(newTop, trackHeight - thumbHeight));
            
            const scrollPercentage = newTop / (trackHeight - thumbHeight);
            const maxScroll = this.scrollList.scrollHeight - this.scrollList.clientHeight;
            const scrollPosition = Math.min(scrollPercentage * maxScroll, maxScroll);
            
            this.scrollbarThumb.style.top = `${newTop}px`;
            this.scrollList.scrollTop = scrollPosition;
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
        const scrollPosition = Math.min(scrollPercentage * maxScroll, maxScroll);
        
        this.scrollList.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
        });
    },
  
    scrollBy(amount) {
        const currentScroll = this.scrollList.scrollTop;
        const maxScroll = this.scrollList.scrollHeight - this.scrollList.clientHeight;
        const targetScroll = Math.max(0, Math.min(currentScroll + amount, maxScroll));
        
        this.scrollList.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });
    },
    
updateTrackPosition() {
    const audioContainer = document.querySelector('.audio-container');
    if (!audioContainer) return;
    
    // Use getComputedStyle to get the actual rendered height
    const audioContainerHeight = parseFloat(getComputedStyle(audioContainer).height);
    
    // Calculate recently played height if expanded
    let recentlyPlayedHeight = 0;
    const recentlyPlayedContainer = document.getElementById('recentlyPlayedContainer');
    if (recentlyPlayedContainer && 
        recentlyPlayedContainer.style.maxHeight !== '0px' && 
        recentlyPlayedContainer.style.display !== 'none') {
        recentlyPlayedHeight = recentlyPlayedContainer.scrollHeight;
    }
    
    // Calculate available height for scroll list
    const viewportHeight = window.innerHeight;
    const scrollListTop = this.scrollList.getBoundingClientRect().top;
    const availableHeight = viewportHeight - scrollListTop - audioContainerHeight;
    
    // Ensure minimum height
    const minHeight = 100;
    const finalHeight = Math.max(minHeight, availableHeight);
    
    // Update the scroll list dimensions
    this.scrollList.style.bottom = `${audioContainerHeight}px`;
    this.scrollList.style.maxHeight = `${finalHeight}px`;
    this.scrollbarTrack.style.height = `${finalHeight}px`;
    
    // Update scrollbar thumb
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

        // Show on thumb hover
        this.scrollbarThumb.addEventListener('mouseenter', () => {
            this.scrollbarThumb.classList.add('visible');
            clearTimeout(scrollbarHideTimeout);
        });

        // Hide after delay when mouse leaves
        this.scrollbarThumb.addEventListener('mouseleave', () => {
            scrollbarHideTimeout = setTimeout(() => {
                if (!this.scrollbarThumb.classList.contains('dragging') && 
                    Date.now() - lastScrollTime >= SCROLLBAR_HIDE_DELAY) {
                    this.scrollbarThumb.classList.remove('visible');
                }
            }, SCROLLBAR_HIDE_DELAY);
        });

        // Initial hide
        this.scrollbarThumb.classList.remove('visible');
    }
}

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
    leftButton.style.display = 'none';
    
    const rightButton = document.createElement('button');
    rightButton.className = 'genre-nav-button right';
    rightButton.innerHTML = '<span class="material-icons">chevron_right</span>';
    rightButton.setAttribute('aria-label', 'Scroll right');
    rightButton.style.display = 'none';
    
    genreWrapper.append(leftButton, rightButton);

    function checkOverflow() {
        const hasOverflow = genreButtons.scrollWidth > genreButtons.clientWidth;
        leftButton.style.display = hasOverflow ? 'flex' : 'none';
        rightButton.style.display = hasOverflow ? 'flex' : 'none';
        updateButtonVisibility();
    }

    function updateButtonVisibility() {
        const scrollLeft = genreButtons.scrollLeft;
        const maxScroll = genreButtons.scrollWidth - genreButtons.clientWidth;
        leftButton.style.display = scrollLeft <= 10 ? 'none' : 'flex';
        rightButton.style.display = scrollLeft >= maxScroll - 10 ? 'none' : 'flex';
    }

    function smoothScroll(direction) {
        const scrollAmount = genreButtons.clientWidth * 0.8;
        const start = genreButtons.scrollLeft;
        const target = direction === 'left' 
            ? Math.max(0, start - scrollAmount)
            : Math.min(start + scrollAmount, genreButtons.scrollWidth - genreButtons.clientWidth);
        
        const duration = 200; // milliseconds
        const startTime = performance.now();

        function animateScroll(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease in-out function
            const easedProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
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
    genreButtons.addEventListener('scroll', updateButtonVisibility);
    window.addEventListener('resize', checkOverflow);

    // Initial check
    checkOverflow();
}

function setupGenreCategoriesSwipe() {
    const genreWrapper = document.querySelector('.genre-buttons-wrapper');
    if (!genreWrapper) return;
    
    const genreButtons = genreWrapper.querySelector('.genre-buttons');
    if (!genreButtons) return;

    let touchStartX = 0;
    let touchEndX = 0;
    let isSwiping = false;
    let scrollLeftStart = 0;
    let touchStartTime = 0;
    let touchMoved = false;

    genreButtons.addEventListener('touchstart', function(e) {
        // Only respond to direct touches on buttons
        if (!e.target.classList.contains('genre-button')) return;
        
        touchStartX = e.changedTouches[0].screenX;
        scrollLeftStart = genreButtons.scrollLeft;
        touchStartTime = Date.now();
        isSwiping = true;
        touchMoved = false;
        genreButtons.style.scrollBehavior = 'auto';
    }, { passive: true });

    genreButtons.addEventListener('touchmove', function(e) {
        if (!isSwiping) return;
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        
        // Only consider it a swipe if movement exceeds threshold
        if (Math.abs(diff) > 10) {
            touchMoved = true;
            e.preventDefault();
            genreButtons.scrollLeft = scrollLeftStart + diff;
        }
    }, { passive: false });

    genreButtons.addEventListener('touchend', function(e) {
        if (!isSwiping) return;
        isSwiping = false;
        
        // If touch didn't move much, it's a click - don't swipe
        if (!touchMoved) {
            genreButtons.style.scrollBehavior = 'auto';
            return;
        }
        
        const diff = touchStartX - touchEndX;
        const swipeDuration = Date.now() - touchStartTime;
        
        // Only apply momentum if it was a quick swipe
        if (swipeDuration < 300 && Math.abs(diff) > 30) {
            const velocity = diff / swipeDuration;
            let targetScroll = genreButtons.scrollLeft + (velocity * 100);
            
            // Apply limits
            const maxScroll = genreButtons.scrollWidth - genreButtons.clientWidth;
            targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));
            
            // Smooth scroll to target position
            genreButtons.style.scrollBehavior = 'smooth';
            genreButtons.scrollLeft = targetScroll;
            
            setTimeout(() => {
                genreButtons.style.scrollBehavior = 'auto';
                updateButtonVisibility(); // Call this if you have nav buttons
            }, 500);
        }
        
        // Always update button visibility after swipe
        setTimeout(() => {
            const buttons = genreWrapper.querySelectorAll('.genre-nav-button');
            if (buttons.length) updateButtonVisibility();
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