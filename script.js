document.addEventListener("DOMContentLoaded", () => {
    // Load all initial components
    loadPreferences();
    const cleanupToggle = setupRecentlyPlayedToggle();
    loadRecentlyPlayed();
    setupDropdown();
    setupGenreButtonsNavigation();
    setupGenreCategoriesSwipe();
    setupGenreFiltering();
    setupThemeControls();
    
    // Initialize radio station click handlers
    document.querySelectorAll(".radio").forEach(radio => {
        radio.addEventListener("click", () => changeStation(radio.dataset.name, radio.dataset.link));
    });
    
    applyGenreFilter();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        cleanupToggle?.();
    });

    // Prevent container height changes on scroll
    const audioContainer = document.querySelector('.audio-container');
    if (audioContainer) {
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === audioContainer) {
                    const currentHeight = entry.contentRect.height;
                    if (currentHeight < COLLAPSED_HEIGHT) {
                        audioContainer.style.height = `${COLLAPSED_HEIGHT}px`;
                    }
                }
            }
        });
        observer.observe(audioContainer);
    }
});

// Global Elements and Constants
const audio = document.getElementById("audioctrl");
const playPauseBtn = document.getElementById("playPauseBtn");
const volumeIcon = document.getElementById("volumeIcon");
const volumeSlider = document.getElementById("volumeSlider");
const COLLAPSED_HEIGHT = 160;
let lastVolume = audio.volume || 1;
let currentGenre = 'all';
let recentlyPlayedObserver;
let resizeObserver;

// Station Functions
function changeStation(name, link) {
    audio.pause();
    audio.src = link;
    audio.load();
    
    audio.oncanplay = () => {
        try { audio.play(); } catch (e) { console.error("Audio play failed:", e); }
    };

    document.getElementById("audiotext").textContent = name;
    localStorage.setItem("lastStation", JSON.stringify({ name, link }));
    updateRecentlyPlayed(name, link);
    updateSelectedStation(name);
    updatePlayPauseButton();
}

function updateSelectedStation(name) {
    document.querySelectorAll(".radio").forEach(radio => {
        radio.classList.toggle("selected", radio.dataset.name === name);
        const existingEqualizer = radio.querySelector(".equalizer");
        
        if (radio.dataset.name === name) {
            if (existingEqualizer) {
                existingEqualizer.className = audio.paused ? "equalizer displaypaused" : "equalizer animate";
            } else {
                const equalizer = document.createElement("div");
                equalizer.className = audio.paused ? "equalizer displaypaused" : "equalizer animate";
                equalizer.innerHTML = "<div></div><div></div><div></div>";
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
    document.querySelectorAll('.genre-button').forEach(button => {
        button.addEventListener('click', () => {
            document.getElementById("stationSearch").value = "";
            document.getElementById("clearSearch").style.display = "none";
            
            document.querySelectorAll('.genre-button').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
            
            currentGenre = button.dataset.genre;
            applyGenreFilter();
            setupExpandableCategories();
        });
    });
}

function applyGenreFilter() {
    cancelAnimationFrame(window._genreFilterRAF);
    
    window._genreFilterRAF = requestAnimationFrame(() => {
        if (document.getElementById("stationSearch").value.trim() !== "") return;
        
        document.querySelectorAll('.radio:not(#recentlyPlayedContainer .radio)').forEach(station => {
            const stationGenres = station.dataset.genre?.split(',') || [];
            const shouldShow = currentGenre === 'all' || stationGenres.includes(currentGenre);
            station.style.display = shouldShow ? 'flex' : 'none';
        });

        updateCategoryVisibility();
        setupExpandableCategories();
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
    document.querySelectorAll(".radio").forEach(radio => {
        radio.classList.add("no-transition");
    });
    
    document.body.className = `${mode}-mode`;
    document.documentElement.style.setProperty(
        "--accent-color", 
        `var(--accent-${mode === "dark" ? "light" : "dark"})`
    );
    localStorage.setItem("theme", mode);

    setTimeout(() => {
        document.body.classList.remove("no-transition");
        document.querySelectorAll(".radio").forEach(radio => {
            radio.classList.remove("no-transition");
        });
    }, 50);

    document.querySelectorAll(".theme-icon").forEach(icon => {
        icon.textContent = mode === "dark" ? "dark_mode" : "light_mode";
    });
}

function changeColor(color) {
    const colors = {
        green: ["--green-dark", "--green-light"],
        blue: ["--blue-dark", "--blue-light"],
        yellow: ["--yellow-dark", "--yellow-light"],
        red: ["--red-dark", "--red-light"]
    }[color] || ["--green-dark", "--green-light"];

    document.documentElement.style.setProperty("--accent-dark", `var(${colors[0]})`);
    document.documentElement.style.setProperty("--accent-light", `var(${colors[1]})`);
    
    const currentTheme = document.body.classList.contains("dark-mode") ? "dark" : "light";
    document.documentElement.style.setProperty(
        "--accent-color", 
        `var(${colors[currentTheme === "dark" ? 1 : 0]})`
    );

    localStorage.setItem("accentColor", color);
}

function setupThemeControls() {
    document.querySelectorAll(".theme-option").forEach(option => {
        option.addEventListener("click", () => setTheme(option.dataset.theme));
    });

    document.querySelectorAll(".color-picker").forEach(picker => {
        picker.addEventListener("click", () => changeColor(picker.dataset.color));
    });
}

// Recently Played Functions
function updateRecentlyPlayed(name, link) {
    const recentlyPlayed = safeParseJSON('recentlyPlayed', []);
    const newRecentlyPlayed = [
        { name, link },
        ...recentlyPlayed.filter(item => item.link !== link)
    ].slice(0, 7);
    
    localStorage.setItem('recentlyPlayed', JSON.stringify(newRecentlyPlayed));
    loadRecentlyPlayed();
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
        dropdownMenu.classList.toggle("show");
    });

    document.addEventListener("click", (event) => {
        if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
            dropdownMenu.classList.remove("show");
        }
    });
}

function setupRecentlyPlayedToggle() {
    const container = document.getElementById("recentlyPlayedContainer");
    const title = document.getElementById("recentlyPlayedTitle");
    const toggle = document.getElementById("recentlyPlayedToggle") || createToggleButton();
    const scrollList = document.querySelector('.scroll-list');
    let isExpanded = false;
    let resizeObserver;
    let touchStartY = 0;
    let touchEndY = 0;
    let touchStartTime = 0;

    // Initial setup
    container.style.maxHeight = '0';
    container.style.opacity = '0';
    container.style.display = 'none';
    container.style.padding = '0';
    container.style.overflow = 'hidden';
    title.style.display = 'none';
    title.style.height = '0';
    title.style.opacity = '0';
    title.style.margin = '0';
    title.style.overflow = 'hidden';

    // Setup ResizeObserver with debounce
    let resizeTimeout;
    resizeObserver = new ResizeObserver(entries => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (isExpanded && entries[0].target === container) {
                const containerHeight = container.scrollHeight;
                container.style.maxHeight = `${containerHeight}px`;
                scrollList.style.bottom = `${COLLAPSED_HEIGHT + containerHeight + 35}px`;
                void container.offsetHeight; // Force reflow
            }
        }, 100);
    });

    if (container) {
        resizeObserver.observe(container);
    }

    // Click handler
    toggle.addEventListener('click', function() {
        if (!container.querySelector('.radio')) return;
        toggleRecentlyPlayed();
    });

    // Touch handlers
    function handleContainerTouchStart(e) {
        if (!isExpanded) return;
        touchStartY = e.changedTouches[0].screenY;
        touchStartTime = Date.now();
        container.style.transition = 'none';
    }

    function handleContainerTouchMove(e) {
        if (!isExpanded) return;
        touchEndY = e.changedTouches[0].screenY;
        const swipeDistance = touchEndY - touchStartY;
        
        if (swipeDistance > 0) {
            e.preventDefault();
            const progress = Math.min(swipeDistance / 100, 1);
            container.style.transform = `translateY(${progress * 20}px)`;
            container.style.opacity = `${1 - progress}`;
        }
    }

    function handleContainerTouchEnd(e) {
        if (!isExpanded) return;
        const touchEndTime = Date.now();
        const swipeDistance = touchEndY - touchStartY;
        const swipeDuration = touchEndTime - touchStartTime;
        
        container.style.transform = '';
        container.style.transition = 'max-height 0.2s ease, opacity 0.2s ease, padding 0.2s ease';
        
        if (swipeDistance > 50 && swipeDuration < 300) {
            toggleRecentlyPlayed();
        } else {
            container.style.opacity = '1';
        }
    }

    function handleToggleTouchStart(e) {
        if (isExpanded || !container.querySelector('.radio')) return;
        touchStartY = e.changedTouches[0].screenY;
        touchStartTime = Date.now();
    }

    function handleToggleTouchMove(e) {
        if (isExpanded || !container.querySelector('.radio')) return;
        touchEndY = e.changedTouches[0].screenY;
        const swipeDistance = touchStartY - touchEndY;
        
        if (swipeDistance > 0) {
            e.preventDefault();
            const progress = Math.min(swipeDistance / 100, 1);
            toggle.style.transform = `translateY(-${progress * 20}px)`;
        }
    }

    function handleToggleTouchEnd(e) {
        if (isExpanded || !container.querySelector('.radio')) return;
        const touchEndTime = Date.now();
        const swipeDistance = touchStartY - touchEndY;
        const swipeDuration = touchEndTime - touchStartTime;
        
        toggle.style.transform = '';
        
        if (swipeDistance > 50 && swipeDuration < 300) {
            toggleRecentlyPlayed();
        }
    }

    // Add event listeners
    container.addEventListener('touchstart', handleContainerTouchStart, { passive: true });
    container.addEventListener('touchmove', handleContainerTouchMove, { passive: false });
    container.addEventListener('touchend', handleContainerTouchEnd, { passive: true });
    toggle.addEventListener('touchstart', handleToggleTouchStart, { passive: true });
    toggle.addEventListener('touchmove', handleToggleTouchMove, { passive: false });
    toggle.addEventListener('touchend', handleToggleTouchEnd, { passive: true });

    function toggleRecentlyPlayed() {
        if (!container.querySelector('.radio')) return;
        isExpanded = !isExpanded;
        handleToggleAnimation();
    }

    function handleToggleAnimation() {
        if (isExpanded) {
            // Make sure container is properly initialized
            container.style.display = 'flex';
            container.style.maxHeight = '0';
            container.style.opacity = '0';
            container.style.padding = '0';
            container.style.overflow = 'hidden';
            
            // Force reflow before animation
            void container.offsetHeight;
            
            // Show title first
            title.style.display = 'flex';
            title.style.height = 'auto';
            title.style.opacity = '1';
            title.style.margin = '20px 10px 10px 10px';
            title.style.overflow = 'visible';
            
            // Animate container
            const containerHeight = container.scrollHeight;
            container.style.maxHeight = `${containerHeight}px`;
            container.style.opacity = '1';
            container.style.padding = '5px 5px 10px 5px';
            
            // Adjust scroll list
            scrollList.style.bottom = `${COLLAPSED_HEIGHT + containerHeight + 35}px`;
        } else {
            // Animate container collapse
            container.style.maxHeight = '0';
            container.style.opacity = '0';
            container.style.padding = '0';
            
            // Hide title
            title.style.display = 'none';
            title.style.height = '0';
            title.style.opacity = '0';
            title.style.margin = '0';
            title.style.overflow = 'hidden';
            
            // Adjust scroll list
            scrollList.style.bottom = `${COLLAPSED_HEIGHT}px`;
            
            // Clean up after transition completes
            setTimeout(() => {
                if (!isExpanded) {
                    container.style.display = 'none';
                }
            }, 200);
        }
    }

    function createToggleButton() {
        const btn = document.createElement('button');
        btn.id = "recentlyPlayedToggle";
        btn.className = "recently-played-toggle";
        document.querySelector('.audio-container').prepend(btn);
        return btn;
    }

    return function cleanup() {
        toggle.removeEventListener('click', toggleRecentlyPlayed);
        container.removeEventListener('touchstart', handleContainerTouchStart);
        container.removeEventListener('touchmove', handleContainerTouchMove);
        container.removeEventListener('touchend', handleContainerTouchEnd);
        toggle.removeEventListener('touchstart', handleToggleTouchStart);
        toggle.removeEventListener('touchmove', handleToggleTouchMove);
        toggle.removeEventListener('touchend', handleToggleTouchEnd);
        if (resizeObserver) {
            resizeObserver.disconnect();
        }
    };
}

function loadRecentlyPlayed() {
    const container = document.getElementById("recentlyPlayedContainer");
    const toggle = document.getElementById("recentlyPlayedToggle");
    const title = document.getElementById("recentlyPlayedTitle");
    const scrollList = document.querySelector('.scroll-list');
    const audioContainer = document.querySelector('.audio-container');
    
    if (!container || !toggle) return;

    const recentlyPlayed = safeParseJSON("recentlyPlayed", []);
    const uniqueStations = [...new Map(recentlyPlayed.map(item => [item.link, item])).values()].slice(0, 7);

    container.innerHTML = '';
    uniqueStations.forEach(station => {
        const radio = document.createElement('div');
        radio.className = 'radio';
        radio.dataset.name = station.name;
        radio.dataset.link = station.link;
        radio.innerHTML = `<div class="radio-text">${station.name}</div>`;
        radio.addEventListener('click', () => changeStation(station.name, station.link));
        container.appendChild(radio);
    });

    const hasContent = container.querySelectorAll('.radio').length > 0;
    toggle.classList.toggle('empty', !hasContent);
    toggle.style.cursor = hasContent ? 'pointer' : 'default';
    
    // Reset container state when content changes
    if (!hasContent) {
        container.style.display = 'none';
        container.style.maxHeight = '0';
        container.style.opacity = '0';
        container.classList.remove('expanded');
        title.classList.remove('expanded');
        scrollList.style.bottom = `${COLLAPSED_HEIGHT}px`;
        audioContainer.style.height = `${COLLAPSED_HEIGHT}px`;
    } else {
        // If content exists but container was previously empty
        if (container.classList.contains('expanded')) {
            container.style.display = 'flex';
            const containerHeight = container.scrollHeight;
            container.style.maxHeight = `${containerHeight}px`;
            container.style.opacity = '1';
            scrollList.style.bottom = `${COLLAPSED_HEIGHT + containerHeight}px`;
            audioContainer.style.height = `${COLLAPSED_HEIGHT + containerHeight}px`;
        }
    }
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

    // Hover effects
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
            if (index >= 12) {
                station.style.display = newState ? "flex" : "none";
            }
        });
    });

    return expandButton;
}

// Playback Control Functions
playPauseBtn.addEventListener("click", () => {
    audio[audio.paused ? "play" : "pause"]();
});

audio.addEventListener("play", updatePlayPauseButton);
audio.addEventListener("pause", updatePlayPauseButton);

function updatePlayPauseButton() {
    playPauseBtn.innerHTML = `<span class="material-icons">${audio.paused ? 'play_arrow' : 'pause'}</span>`;

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
    
    // Toggle clear search icon
    document.getElementById("clearSearch").style.display = searching ? "block" : "none";

    // Remove all expand buttons when searching
    if (searching) {
        document.querySelectorAll('.expand-button').forEach(btn => btn.remove());
        document.querySelectorAll('.category-container').forEach(cat => {
            cat.classList.remove("no-radius", "has-expand-button");
        });
    }

    // Search logic - exclude recently played stations
    document.querySelectorAll('.radio:not(#recentlyPlayedContainer .radio)').forEach(station => {
        const matches = station.dataset.name.toLowerCase().includes(query);
        station.style.display = matches ? 'flex' : 'none';
    });

    // Update category visibility (excluding recently played)
    document.querySelectorAll('.category-container:not(#recentlyPlayedContainer)').forEach(category => {
        const hasVisible = [...category.querySelectorAll('.radio:not(#recentlyPlayedContainer .radio)')]
            .some(station => station.style.display !== 'none');
        
        category.style.display = hasVisible ? 'flex' : 'none';
        const title = category.previousElementSibling;
        if (title?.classList.contains("category")) {
            title.style.display = hasVisible ? 'flex' : 'none';
        }
    });
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
        if (stations.length > 12) {
            category.append(createExpandButton(stations, category));
            category.classList.add("no-radius", "has-expand-button");
            
            stations.forEach((station, index) => {
                station.style.display = index < 12 ? "flex" : "none";
            });
        } else {
            stations.forEach(station => {
                station.style.display = "flex";
            });
        }
    });
}

// Initialization Functions
function loadPreferences() {
    const savedTheme = localStorage.getItem("theme") || "dark";
    const savedColor = localStorage.getItem("accentColor") || "green";
    const savedStation = safeParseJSON("lastStation", {});

    setTheme(savedTheme);
    changeColor(savedColor);

    if (savedStation.name && savedStation.link) {
        audio.src = savedStation.link;
        document.getElementById("audiotext").textContent = savedStation.name;
        updateSelectedStation(savedStation.name);
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
    let lastScrollTime = 0;
    let scrollTimeout;

    // Disable scroll chaining on parent elements
    genreButtons.addEventListener('touchstart', () => {
        document.body.style.overscrollBehaviorX = 'contain';
    });

    // Handle touch start
    genreButtons.addEventListener('touchstart', function(e) {
        if (Date.now() - lastScrollTime < 100) return; // Prevent rapid successive touches
        
        touchStartX = e.changedTouches[0].screenX;
        scrollLeftStart = genreButtons.scrollLeft;
        touchStartTime = Date.now();
        isSwiping = true;
        genreButtons.style.scrollBehavior = 'auto';
        genreButtons.style.cursor = 'grabbing';
        
        // Clear any pending momentum scroll
        clearTimeout(scrollTimeout);
    }, { passive: true });

    // Handle touch move
    genreButtons.addEventListener('touchmove', function(e) {
        if (!isSwiping) return;
        
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > 5) {
            e.preventDefault();
            e.stopPropagation();
            
            // Calculate new scroll position with rubber band effect at boundaries
            let newScroll = scrollLeftStart + diff;
            const maxScroll = genreButtons.scrollWidth - genreButtons.clientWidth;
            
            // Apply rubber band effect when at boundaries
            if (newScroll < 0) {
                newScroll = scrollLeftStart + diff * 0.3;
            } else if (newScroll > maxScroll) {
                newScroll = scrollLeftStart + diff * 0.3;
            }
            
            genreButtons.scrollLeft = newScroll;
        }
    }, { passive: false });

    // Handle touch end
    genreButtons.addEventListener('touchend', function(e) {
        if (!isSwiping) return;
        isSwiping = false;
        genreButtons.style.scrollBehavior = 'smooth';
        genreButtons.style.cursor = '';
        lastScrollTime = Date.now();
        
        const diff = touchStartX - touchEndX;
        const swipeDuration = Date.now() - touchStartTime;
        const navButtons = genreWrapper.querySelectorAll('.genre-nav-button');
        
        // Calculate momentum scroll
        const velocity = diff / Math.max(1, swipeDuration);
        let targetScroll = genreButtons.scrollLeft + (velocity * 300);
        
        // Apply limits with bounce effect
        const maxScroll = genreButtons.scrollWidth - genreButtons.clientWidth;
        targetScroll = Math.max(-50, Math.min(targetScroll, maxScroll + 50));
        
        // Snap to nearest button with boundary checks
        const buttons = genreButtons.querySelectorAll('.genre-button');
        if (buttons.length > 0) {
            const buttonWidth = buttons[0].offsetWidth + 10; // Include margin
            let snapScroll = Math.round(targetScroll / buttonWidth) * buttonWidth;
            
            // Ensure we don't snap beyond boundaries
            snapScroll = Math.max(0, Math.min(snapScroll, maxScroll));
            
            // Apply the snap scroll with smooth behavior
            genreButtons.scrollTo({
                left: snapScroll,
                behavior: 'smooth'
            });
            
            // Update navigation buttons visibility after scroll
            scrollTimeout = setTimeout(() => {
                updateNavButtonsVisibility();
            }, 300);
        }
        
        // Trigger navigation button click for significant swipes
        if (Math.abs(diff) > 50 && swipeDuration < 300) {
            const direction = diff > 0 ? 'right' : 'left';
            handleSwipeNavigation(direction, navButtons);
        }
    }, { passive: true });

    // Helper function to handle swipe navigation
    function handleSwipeNavigation(direction, navButtons) {
        if (direction === 'right') {
            const rightButton = navButtons[1];
            if (rightButton && rightButton.style.display !== 'none') {
                rightButton.click();
            }
        } else {
            const leftButton = navButtons[0];
            if (leftButton && leftButton.style.display !== 'none') {
                leftButton.click();
            }
        }
    }

    // Helper function to update nav buttons visibility
    function updateNavButtonsVisibility() {
        const scrollLeft = genreButtons.scrollLeft;
        const maxScroll = genreButtons.scrollWidth - genreButtons.clientWidth;
        const navButtons = genreWrapper.querySelectorAll('.genre-nav-button');
        
        if (navButtons[0]) {
            navButtons[0].style.display = scrollLeft <= 10 ? 'none' : 'flex';
        }
        if (navButtons[1]) {
            navButtons[1].style.display = scrollLeft >= maxScroll - 10 ? 'none' : 'flex';
        }
    }

    // Initialize button visibility
    updateNavButtonsVisibility();
    
    // Handle window resize
    window.addEventListener('resize', () => {
        updateNavButtonsVisibility();
    });
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
    
    // Show all regular stations
    document.querySelectorAll('.radio:not(#recentlyPlayedContainer .radio)').forEach(station => {
        station.style.display = 'flex';
    });
    
    // Recently played remains visible
    document.getElementById("recentlyPlayedContainer").style.display = "flex";
    document.querySelector("#recentlyPlayedTitle").style.display = "flex";
    
    applyGenreFilter();
});

searchInput.addEventListener("input", debounce(filterStations, 300));