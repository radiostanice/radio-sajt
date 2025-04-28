let handleDocumentClick, handleDocumentTouch;
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
    }, { passive: true });
    
    // Final update
    setTimeout(() => ScrollbarManager.updateAll(), 500);
    
    // Cleanup
    window.addEventListener('beforeunload', cleanupResources);
});

function cleanupResources() {
    // Remove document listeners
    document.removeEventListener("click", handleDocumentClick);
    document.removeEventListener("touchend", handleDocumentClick);
    
    // Clean up dropdown toggle listeners
    const dropdownToggle = document.querySelector(".dropdown-toggle");
    const historyBtn = document.getElementById("historyBtn");
    const infoIcon = document.querySelector(".info-icon");
	
    // Remove event listeners
    audio.removeEventListener('play', updateInfoIconVisibility);
    audio.removeEventListener('pause', updateInfoIconVisibility);
    dropdownToggle?.removeEventListener("click", toggleThemeDropdown);
    dropdownToggle?.removeEventListener("touchend", handleThemeToggleTouch);
    historyBtn?.removeEventListener("click", toggleHistory);
    historyBtn?.removeEventListener("touchend", handleHistoryToggleTouch);
    infoIcon?.removeEventListener("click", toggleTooltip);
    infoIcon?.removeEventListener("touchend", handleTooltipToggleTouch);

    clearInterval(metadataInterval);
   
    // Clean up any dynamically added styles
    document.getElementById('marquee-style')?.remove();
    document.querySelectorAll('[data-dynamic-style]').forEach(el => el.remove());

	[windowResizeObserver, ...(ScrollbarManager.resizeObservers || [])]
    .forEach(observer => observer?.disconnect());

    const tooltip = document.querySelector('.genre-tooltip');
    if (tooltip && tooltip._mutationObserver) {
        tooltip._mutationObserver.disconnect();
    }
    
    if (dropdownToggle) dropdownToggle.classList.remove("active");
    if (historyBtn) historyBtn.classList.remove("active");
    if (infoIcon) infoIcon.classList.remove("active");
    
    const dropdownMenu = document.querySelector(".dropdown-menu");
    const historyDropdown = document.getElementById("historyDropdown");
    const genreTooltip = document.querySelector(".genre-tooltip");
    
    if (dropdownMenu) dropdownMenu.classList.remove("show");
    if (historyDropdown) {
        historyDropdown.classList.remove("show");
        historyDropdown.style.display = 'none';
    }
    if (genreTooltip) {
        genreTooltip.classList.remove("visible");
        genreTooltip.style.display = 'none';
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
    // Clear UI immediately and reset state
    const audioTextElement = document.getElementById('audiotext');
    if (audioTextElement) {
        audioTextElement.innerHTML = `<div class="station-name">${name}</div>`;
        audioTextElement.classList.remove('has-now-playing');
        document.querySelector('.audio-container').classList.remove('has-now-playing');
        lastTitle = ''; // Reset last title immediately
        
        // Clear any existing song title element
        const songTitleElement = audioTextElement.querySelector('.song-title');
        if (songTitleElement) {
            audioTextElement.removeChild(songTitleElement);
        }
        
        updateAudioContainerHeight();
    }

    // Stop any ongoing metadata requests
    if (metadataInterval) {
        clearInterval(metadataInterval);
        metadataInterval = null;
    }

    // Store the current station name to prevent race conditions
    const currentStationName = name;
    currentStation = { name, link };

    // Reset audio and set new source
    audio.pause();
    audio.currentTime = 0;
    audio.src = link;

    // Update UI immediately
    document.title = `Radio | ${name}`;
    localStorage.setItem("lastStation", JSON.stringify({ name, link }));
    updateSelectedStation(name);
    updatePlayPauseButton();
    updateRecentlyPlayed(name, link, document.querySelector(`.radio[data-name="${name}"]`)?.dataset.genre || '');

    // Scroll to station
    const selectedStation = document.querySelector(`.radio[data-name="${name}"]`);
    if (selectedStation) {
        selectedStation.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
    
    updateTooltipContent();
    
    // Define play function before setting event handlers
    const playAudio = async () => {
        try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                await playPromise.catch(handlePlayError);
            }
            
            // Check if we're still on the same station (prevent race conditions)
            if (currentStation?.name === currentStationName) {
                // Immediate metadata check with forced update
                await checkMetadata(true);
                
                // Setup continuous checking with shorter intervals
                setupNowPlayingMetadata();
            }
        } catch (e) {
            handlePlayError(e);
            // Retry after a short delay
            setTimeout(playAudio, 1000);
        }
    };

    // Set up audio event handlers
    audio.oncanplay = playAudio;
    audio.onerror = () => {
        console.log('Audio error occurred, retrying...');
        setTimeout(playAudio, 1000);
    };
	
    // Add new metadata update handler for song transitions
    const metadataEndHandler = () => {
        if (currentStation?.name === currentStationName) {
            checkMetadata(true);
        }
    };
	
	// Remove previous listeners to avoid duplicates
    audio.removeEventListener('ended', metadataEndHandler);
    audio.addEventListener('ended', metadataEndHandler);

    // Try to play immediately (only after setting up handlers)
    try {
        await playAudio();
    } catch (e) {
        console.error('Initial play failed:', e);
    }
}

function isLikelyStationName(title) {
    if (!title) return false;
    
    // Common patterns that indicate a station name rather than a song
    const stationPatterns = [
        /radio\s*/i,
        /fm\s*\d*/i,
        /^\d+\s*[kK][hH]z/i,
        /live\s*stream/i,
        /webradio/i,
        /^\w+\s*-\s*\w+$/i, // Pattern like "Artist - Song"
        /^\d{2}:\d{2}/, // Time pattern
        /^now playing:/i,
        /^currently playing:/i
    ];
    
    return stationPatterns.some(pattern => pattern.test(title));
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
        
        // Update station data attributes with quality info if available
        if (data.quality) {
            const stationElement = document.querySelector(`.radio[data-name="${station.name}"]`);
            if (stationElement) {
                // Clean up bitrate format
                let bitrate = data.quality.bitrate || '';
                
                // Remove any non-digit characters and 'kbps' if present
                 bitrate = bitrate.toString()
                    .replace(/[^\d]/g, '')  // Remove all non-digit characters
                    .replace(/^0+/, '')     // Remove leading zeros
                    .slice(0, 3);
                
                // Only add kbps suffix if we have actual digits
                if (bitrate) {
                    bitrate = `${bitrate}kbps`;
                }
                
                stationElement.dataset.bitrate = bitrate;
                stationElement.dataset.format = data.quality.format || '';
            }
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
    if (!audioTextElement || !currentStation) return;

    const audioContainer = document.querySelector('.audio-container');
    const stationName = currentStation.name;

    // Always update the station name first
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
        // If we have a valid title that's different from the station name, show it
        if (!songTitleElement) {
            songTitleElement = document.createElement('div');
            songTitleElement.className = 'song-title';
            audioTextElement.insertBefore(songTitleElement, stationNameElement);
        }
        songTitleElement.textContent = title;
        audioTextElement.classList.add('has-now-playing');
        audioContainer.classList.add('has-now-playing');
        
        setTimeout(() => applyMarqueeEffect(songTitleElement), 300);
    } else {
        // No valid title - remove song title if it exists
        if (songTitleElement) {
            audioTextElement.removeChild(songTitleElement);
        }
        audioTextElement.classList.remove('has-now-playing');
        audioContainer.classList.remove('has-now-playing');
    }
    
    updateAudioContainerHeight();
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

        // Update tooltip content if dropdown is open
        if (document.querySelector('.genre-tooltip.visible')) {
            updateTooltipContent();
        }
    } catch (e) {
        console.error('Metadata check failed:', e);
    }
}

function setupNowPlayingMetadata() {
    if (metadataInterval) clearInterval(metadataInterval);
    
    // Use requestIdleCallback for non-critical updates
    const checkMetadataIdle = () => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => checkMetadata(), { timeout: 1000 });
        } else {
            checkMetadata();
        }
    };
    
    // Immediate check with no cooldown on first run
    checkMetadata(true);
    
    // Set up checking with less frequent intervals when tab is inactive
    metadataInterval = setInterval(() => {
        if (document.hidden) {
            // Less frequent checks when tab is in background
            if (Date.now() - lastMetadataCheck > 30000) {
                checkMetadataIdle();
            }
        } else {
            // More frequent checks when tab is active
            checkMetadataIdle();
        }
    }, 5000);
    
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
    const historyBtn = document.getElementById("historyBtn");
    const historyDropdown = document.getElementById("historyDropdown");
    const infoIcon = document.querySelector(".info-icon");
    const genreTooltip = document.querySelector(".genre-tooltip");

    // Track dropdown states
    const dropdownStates = {
        theme: false,
        history: false,
        tooltip: false
    };

    // Toggle theme dropdown
    function toggleThemeDropdown(e) {
        e?.stopPropagation();
        dropdownStates.theme = !dropdownStates.theme;
        dropdownToggle.classList.toggle("active", dropdownStates.theme);
        dropdownMenu.classList.toggle("show", dropdownStates.theme);
        
        // Close other dropdowns if opening this one
        if (dropdownStates.theme) {
            closeOtherDropdowns('theme');
        }
    }

    // Toggle history dropdown (ONLY ON CLICK)
    function toggleHistory(e) {
        e?.stopPropagation();
        dropdownStates.history = !dropdownStates.history;
        historyBtn.classList.toggle("active", dropdownStates.history);
        
        if (dropdownStates.history) {
            historyDropdown.style.display = 'flex';
            // Force reflow before animation
            void historyDropdown.offsetWidth;
            historyDropdown.classList.add('show');
            closeOtherDropdowns('history');
            
            // Setup scroll behavior
            setupRecentlyPlayedNavigation();
            updateDropdownHeights();
        } else {
            historyDropdown.classList.remove('show');
            setTimeout(() => {
                historyDropdown.style.display = 'none';
            }, 300);
        }
    }

    // Toggle genre tooltip
function toggleTooltip(e) {
    e?.stopPropagation();
    dropdownStates.tooltip = !dropdownStates.tooltip;
    infoIcon.classList.toggle("active", dropdownStates.tooltip);
    
    if (dropdownStates.tooltip) {
        genreTooltip.style.display = 'block';
        updateTooltipContent(); // Ensure content is updated before showing
        
        // Force reflow before animation
        void genreTooltip.offsetWidth;
        genreTooltip.classList.add('visible');
        
        closeOtherDropdowns('tooltip');
    } else {
        genreTooltip.classList.remove('visible');
        setTimeout(() => {
            if (!dropdownStates.tooltip) {
                genreTooltip.style.display = 'none';
            }
        }, 300);
    }
}

    // Close all other dropdowns except the current one
    function closeOtherDropdowns(current) {
        if (current !== 'theme' && dropdownStates.theme) {
            dropdownStates.theme = false;
            dropdownToggle.classList.remove("active");
            dropdownMenu.classList.remove("show");
        }
        
        if (current !== 'history' && dropdownStates.history) {
            dropdownStates.history = false;
            historyBtn.classList.remove("active");
            historyDropdown.classList.remove("show");
            
            setTimeout(() => {
                historyDropdown.style.display = 'none';
            }, 300);
        }
        
        if (current !== 'tooltip' && dropdownStates.tooltip) {
            dropdownStates.tooltip = false;
            infoIcon.classList.remove("active");
            genreTooltip.classList.remove("visible");
            
            setTimeout(() => {
                genreTooltip.style.display = 'none';
            }, 300);
        }
    }

    // Close all dropdowns when clicking outside
    function handleDocumentClick(e) {
        const clickedDropdown = e.target.closest(".dropdown-menu") || 
                               e.target.closest(".dropdown-toggle") ||
                               e.target.closest(".info-icon") || 
                               e.target.closest(".genre-tooltip");
        
        if (!clickedDropdown) {
            closeOtherDropdowns('none');
        }
    }

    // Initialize event listeners (CLICK ONLY - NO HOVER)
    dropdownToggle?.addEventListener("click", toggleThemeDropdown);
    historyBtn?.addEventListener("click", toggleHistory);
    infoIcon?.addEventListener("click", toggleTooltip);
    
    // Mobile touch events
    dropdownToggle?.addEventListener("touchend", (e) => {
        e.preventDefault();
        toggleThemeDropdown(e);
    }, { passive: false });
    
    historyBtn?.addEventListener("touchend", (e) => {
        e.preventDefault();
        toggleHistory(e);
    }, { passive: false });
    
    infoIcon?.addEventListener("touchend", (e) => {
        e.preventDefault();
        toggleTooltip(e);
    }, { passive: false });

    // Document-level listeners
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("touchend", handleDocumentClick, { passive: true });

    // Prevent tooltip from closing when clicking inside
    genreTooltip?.addEventListener("click", (e) => e.stopPropagation());
}

function setUpTooltipScrollButtons() {
    const tooltip = document.querySelector('.genre-tooltip');
    if (!tooltip) return;

    // Check if buttons already exist
    let topButton = tooltip.querySelector('.tooltip-nav-button.top');
    let bottomButton = tooltip.querySelector('.tooltip-nav-button.bottom');
    
    // Create buttons only if they don't exist
    if (!topButton) {
        topButton = document.createElement('button');
        topButton.className = 'tooltip-nav-button top';
        topButton.innerHTML = '<span class="material-icons">expand_less</span>';
        topButton.setAttribute('aria-label', 'Scroll up');
        tooltip.insertBefore(topButton, tooltip.firstChild);
    }
    
    if (!bottomButton) {
        bottomButton = document.createElement('button');
        bottomButton.className = 'tooltip-nav-button bottom';
        bottomButton.innerHTML = '<span class="material-icons">expand_more</span>';
        bottomButton.setAttribute('aria-label', 'Scroll down');
        tooltip.appendChild(bottomButton);
    }

    // Add mutation observer to detect content changes
    const observer = new MutationObserver(function() {
        checkOverflow();
    });
    
    // Configure and start observing
    observer.observe(tooltip, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // Store observer for cleanup
    tooltip._mutationObserver = observer;
    
    function checkOverflow() {
        // Ensure tooltip is rendered before checking
        tooltip.style.display = 'block';
        tooltip.style.visibility = 'hidden';
        void tooltip.offsetWidth; // Force reflow
        
        // Temporarily hide overflow for accurate measurement
        tooltip.style.overflow = 'hidden';
        const hasOverflow = tooltip.scrollHeight > tooltip.clientHeight;
        tooltip.style.overflow = 'auto';
        
        tooltip.style.visibility = 'visible';
        
        topButton.style.display = hasOverflow ? 'flex' : 'none';
        bottomButton.style.display = hasOverflow ? 'flex' : 'none';
        
        if (hasOverflow) {
            updateButtonVisibility();
        }
    }

    function updateButtonVisibility() {
        const buffer = 2;
        const scrollTop = tooltip.scrollTop;
        const maxScroll = tooltip.scrollHeight - tooltip.clientHeight;
        
        topButton.style.display = scrollTop <= buffer ? 'none' : 'flex';
        bottomButton.style.display = scrollTop >= maxScroll - buffer ? 'none' : 'flex';
    }

    function smoothScroll(direction) {
        if (tooltip._isAnimating) return;
        tooltip._isAnimating = true;
        
        const scrollAmount = tooltip.clientHeight * 0.8;
        const start = tooltip.scrollTop;
        const target = direction === 'top' 
            ? Math.max(0, start - scrollAmount)
            : Math.min(start + scrollAmount, tooltip.scrollHeight - tooltip.clientHeight);
        
        const duration = 300;
        const startTime = performance.now();

        function animateScroll(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 2);
            
            tooltip.scrollTop = start + (target - start) * easedProgress;
            
            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            } else {
                tooltip._isAnimating = false;
                updateButtonVisibility();
            }
        }

        requestAnimationFrame(animateScroll);
    }

    // Event listeners
    topButton.onclick = (e) => {
        e.stopPropagation();
        smoothScroll('top');
    };
    
    bottomButton.onclick = (e) => {
        e.stopPropagation();
        smoothScroll('bottom');
    };
    
    // Debounced scroll handler
    const scrollHandler = () => {
        cancelAnimationFrame(tooltip._scrollRAF);
        tooltip._scrollRAF = requestAnimationFrame(updateButtonVisibility);
    };
    
    tooltip.addEventListener('scroll', scrollHandler, { passive: true });
    
    // Ensure we check overflow initially
    setTimeout(checkOverflow, 50);
    
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

function updateTooltipContent() {
    const tooltip = document.querySelector('.genre-tooltip');
    if (!tooltip) return;
    
    // Get current station - try multiple ways
    let currentStation = document.querySelector('.radio.selected');
    if (!currentStation) {
        const audioText = document.getElementById('audiotext')?.textContent?.trim();
        if (audioText) {
            currentStation = document.querySelector(`.radio[data-name="${audioText}"]`);
        }
    }
    
    // Fallback to last played station from localStorage if still not found
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
    
    // Get quality info - only show if we have valid data
    const bitrate = currentStation.dataset.bitrate;
    const format = currentStation.dataset.format;
    
    let qualitySection = '';
    if (bitrate && !isUnknownValue(bitrate) && format && !isUnknownValue(format)) {
        // Ensure bitrate is properly formatted
        const displayBitrate = bitrate.toLowerCase().endsWith('kbps') ? 
            bitrate : 
            (bitrate.match(/\d+/) ? `${bitrate}kbps` : '');
        
        qualitySection = `
            <div class="tooltip-section">
                <strong class="quality-title">Kvalitet:</strong>
                <div class="quality-info">
                    ${displayBitrate ? `<span title="Bitrate">${displayBitrate}</span>` : ''}
                    ${format ? `<span title="Format">${format}</span>` : ''}
                </div>
            </div>
        `;
    }
    
    // Render tooltip
    tooltip.innerHTML = `
        <div class="tooltip-section">
            <strong>Žanrovi:</strong>
            ${formattedGenres}
        </div>
        ${qualitySection}
    `;
	
	setTimeout(() => {
        if (tooltip._checkOverflow) {
            tooltip._checkOverflow();
        }
    }, 50);
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
    const toggleHandle = toggle.querySelector('.toggle-handle');
    const historyBtn = document.getElementById('historyBtn');
    const historyDropdown = document.getElementById('historyDropdown');
    const infoIcon = document.querySelector('.info-icon');
    const genreTooltip = document.querySelector('.genre-tooltip');
    
    let isExpanded = false;
    let dropdownStates = {
        history: false,
        tooltip: false
    };

    // Handle toggle
    toggleHandle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleCollapse();
    });

    // Add touch event for mobile
    toggleHandle.addEventListener('touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleCollapse();
    });

    // History dropdown handlers (CLICK/TAP ONLY)
    historyBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (dropdownStates.history) {
            hideHistoryDropdown();
        } else {
            showHistoryDropdown();
        }
    });

    historyBtn.addEventListener('touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (dropdownStates.history) {
            hideHistoryDropdown();
        } else {
            showHistoryDropdown();
        }
    });

    // Handle info icon
    infoIcon.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleGenreTooltip();
    });

    // Add touch event for mobile
    infoIcon.addEventListener('touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleGenreTooltip();
    });

    document.addEventListener('click', function(e) {
        // Check if click is outside both the button and dropdown
        const isClickInside = historyBtn.contains(e.target) || 
                             historyDropdown.contains(e.target);
        
        if (!isClickInside && dropdownStates.history) {
            hideHistoryDropdown();
        }
        
        // Also handle info icon
        if (!infoIcon.contains(e.target) && !genreTooltip.contains(e.target) && dropdownStates.tooltip) {
            hideGenreTooltip();
        }
    });

    document.addEventListener('touchend', function(e) {
        // Check if touch is outside both the button and dropdown
        const isTouchInside = historyBtn.contains(e.target) || 
                             historyDropdown.contains(e.target);
        
        if (!isTouchInside && dropdownStates.history) {
            hideHistoryDropdown();
        }
        
        // Also handle info icon
        if (!infoIcon.contains(e.target) && !genreTooltip.contains(e.target) && dropdownStates.tooltip) {
            hideGenreTooltip();
        }
    });

    function toggleCollapse() {
        isExpanded = !isExpanded;
        audioContainer.classList.toggle('expanded', isExpanded);
        updateAudioContainerHeight();
        ScrollbarManager.updateAll();
    }

    function showHistoryDropdown() {
        dropdownStates.history = true;
        historyBtn.classList.add('active');
        historyDropdown.style.display = 'flex';
        updateDropdownHeights();
        void historyDropdown.offsetWidth;
        historyDropdown.classList.add('show');
        
        if (dropdownStates.tooltip) {
            hideGenreTooltip();
        }
    }

    function hideHistoryDropdown() {
        dropdownStates.history = false;
        historyDropdown.classList.remove('show');
        historyBtn.classList.remove('active');
        
        setTimeout(() => {
            if (!dropdownStates.history) {
                historyDropdown.style.display = 'none';
            }
        }, 300);
    }

    function hideGenreTooltip() {
        dropdownStates.tooltip = false;
        genreTooltip.classList.remove('visible');
        infoIcon.classList.remove('active');
        
        setTimeout(() => {
            if (!dropdownStates.tooltip) {
                genreTooltip.style.display = 'none';
            }
        }, 300);
    }

    function toggleGenreTooltip() {
        dropdownStates.tooltip = !dropdownStates.tooltip;
        if (dropdownStates.tooltip) {
            showGenreTooltip();
        } else {
            hideGenreTooltip();
        }
    }

    function showGenreTooltip() {
        infoIcon.classList.add('active');
        genreTooltip.style.display = 'block';
        updateDropdownHeights();
        void genreTooltip.offsetWidth;
        genreTooltip.classList.add('visible');
        setUpTooltipScrollButtons();
        
        if (dropdownStates.history) {
            hideHistoryDropdown();
        }
    }

    updateDropdownHeights();
}

function updateDropdownHeights() {
    const audioContainer = document.querySelector('.audio-container');
    if (!audioContainer) return;
    
    // Get current dimensions
    const viewportHeight = window.innerHeight;
    const audioContainerHeight = audioContainer.clientHeight;
    const headerHeight = document.querySelector('.header')?.clientHeight || 0;
    
    // Calculate max height for dropdowns (viewport - header - audio container - margins)
    const maxDropdownHeight = Math.max(100, viewportHeight - headerHeight - audioContainerHeight - 30);
    
    // Update history dropdown
    const historyDropdown = document.getElementById('historyDropdown');
    if (historyDropdown) {
        historyDropdown.style.maxHeight = `${maxDropdownHeight}px`;

    }
    
    // Update genre tooltip
    const genreTooltip = document.querySelector('.genre-tooltip');
    if (genreTooltip) {
        genreTooltip.style.maxHeight = `${maxDropdownHeight}px`;
    }
    
    // Force update of scroll behavior if tooltip is visible
    if (genreTooltip && genreTooltip.classList.contains('visible')) {
        setupTooltipScrollBehavior();
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
        // Don't start drag if touching interactive elements
        if (e.target.closest('.audio-player') || 
            e.target.closest('.toggle-handle') ||
            e.target.closest('.info-icon') ||
            e.target.closest('#historyBtn')) {
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

    // Handle toggle handle click - already handled in setupRecentlyPlayedToggle
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
        const scrollTop = container.scrollTop;
        const maxScroll = container.scrollHeight - container.clientHeight;
        const buffer = 5; // Add small buffer to account for rounding
        
        topButton.style.display = scrollTop <= buffer ? 'none' : 'flex';
        bottomButton.style.display = scrollTop >= maxScroll - buffer ? 'none' : 'flex';
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

function setupRecentlyPlayedNavigation() {
    const wrapper = document.querySelector('.recently-played-wrapper');
    if (!wrapper) return;
    
    const stations = wrapper.querySelector('.recently-played-stations');
    if (!stations) return;

    // Use the shared function
    const { checkOverflow } = setupScrollableContainer(stations, 'recently-played-wrapper', 'history-nav-button');
    
    // Remove the passive:false option and don't prevent default scrolling
    stations.addEventListener('touchmove', function(e) {
        if (!e.target.closest('.radio')) {
            e.stopPropagation();
        }
    }, { passive: true }); // Changed to passive:true
    
    // Remove the wheel event handler that was preventing default behavior
    stations.removeEventListener('wheel', preventDefaultWheel);
    
    // Set container styles
    stations.style.minHeight = '0';
    stations.style.maxHeight = '60vh';
    stations.style.overflowY = 'auto';
    stations.style.overflowX = 'hidden';
    
    // Enable smooth scrolling
    stations.style.scrollBehavior = 'smooth';
    
    // Initial check
    checkOverflow();
    
    // Also check when dropdown is shown
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
    
    // Debounce the resize handler
    const debouncedResize = debounce(() => {
        this.updateTrackPosition();
    }, 100);
    
    // Single observer for all elements
    const observer = new ResizeObserver(debouncedResize);
    
    // Elements that could affect the scroll list height
    const elementsToObserve = [
        document.querySelector('.audio-container'),
        document.getElementById('recentlyPlayedContainer'),
        document.body
    ];
    
    elementsToObserve.forEach(element => {
        if (element) {
            observer.observe(element);
        }
    });
    
    this.resizeObservers.push(observer);
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
    
		// Apply wheel scrolling to the scroll list with increased sensitivity
		const scrollAmount = e.deltaY * 2; // Double the scroll speed
		this.scrollList.scrollTop += scrollAmount;
    
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
        leftButton.style.display = scrollLeft <= 10 ? 'none' : 'flex';
        rightButton.style.display = scrollLeft >= maxScroll - 10 ? 'none' : 'flex';
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

    leftButton.addEventListener('click', () => smoothScroll('left'));
    rightButton.addEventListener('click', () => smoothScroll('right'));
    
    // Use passive: true for better performance
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