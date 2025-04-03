// Add these constants at the top of your file
const HOVER_RESET_DELAY = 1000; // 1 second delay to remove hover effects
const SCROLLBAR_HIDE_DELAY = 1500; // 1.5 seconds delay to hide scrollbar
let hoverResetTimeout;
let scrollbarHideTimeout;
let lastScrollTime = 0;
let isScrolling = false;

document.addEventListener("DOMContentLoaded", () => {
    // Initialize scrollbar first
    ScrollbarManager.init();
	ScrollbarManager.setupAutoHide();
    
    // Load all initial components
    loadPreferences();
    const cleanupToggle = setupRecentlyPlayedToggle();
    loadRecentlyPlayed();
    setupDropdown();
    setupGenreButtonsNavigation();
    setupGenreCategoriesSwipe();
    setupGenreFiltering();
    setupThemeControls();
	setupAutoRemoveHover();
    
    // Initialize radio station click handlers
    document.querySelectorAll(".radio").forEach(radio => {
        radio.addEventListener("click", () => changeStation(radio.dataset.name, radio.dataset.link));
    });
    
    applyGenreFilter();

    // Final update after everything is loaded
    setTimeout(() => {
        ScrollbarManager.updateAll();
    }, 500);

    window.addEventListener('beforeunload', () => {
        cleanupToggle?.();
    });

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
    document.title = `Radio | ${name}`;
    
    localStorage.setItem("lastStation", JSON.stringify({ name, link }));
    updateRecentlyPlayed(name, link);
    updateSelectedStation(name);
    updatePlayPauseButton();

    // Scroll the selected station into view
    setTimeout(() => {
        const selectedRadio = document.querySelector(`.radio.selected`);
        if (selectedRadio) {
            selectedRadio.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, 100);
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
        
        // Update scrollbar after filtering
        setTimeout(() => {
            ScrollbarManager.updateThumbSize();
            ScrollbarManager.positionThumb();
            ScrollbarManager.updateScrollButtons();
        }, 10);
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
        ScrollbarManager.updateAll();
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

// Recently Played Functions
function updateRecentlyPlayed(name, link) {
    const recentlyPlayed = safeParseJSON('recentlyPlayed', []);
    const newRecentlyPlayed = [
        { name, link },
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
        }, 10); // Small timeout to allow DOM to update
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
                scrollList.style.bottom = `${COLLAPSED_HEIGHT + containerHeight + 40}px`;
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

    // Touch handlers for the entire container when expanded
    function handleContainerTouchStart(e) {
        if (!isExpanded) return;
        touchStartY = e.changedTouches[0].screenY;
        touchStartTime = Date.now();
        container.style.transition = 'none';
        title.style.transition = 'none';
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
            title.style.opacity = `${1 - progress}`;
        }
    }

    function handleContainerTouchEnd(e) {
        if (!isExpanded) return;
        const touchEndTime = Date.now();
        const swipeDistance = touchEndY - touchStartY;
        const swipeDuration = touchEndTime - touchStartTime;
        
        container.style.transform = '';
        container.style.transition = 'max-height 0.2s ease, opacity 0.2s ease, padding 0.2s ease';
        title.style.transition = 'height 0.2s ease, opacity 0.2s ease, margin 0.2s ease';
        
        if (swipeDistance > 50 && swipeDuration < 300) {
            toggleRecentlyPlayed();
        } else {
            container.style.opacity = '1';
            title.style.opacity = '1';
        }
    }

    // Touch handlers for the toggle button (both states)
    function handleToggleTouchStart(e) {
        touchStartY = e.changedTouches[0].screenY;
        touchStartTime = Date.now();
        
        if (isExpanded) {
            container.style.transition = 'none';
            title.style.transition = 'none';
        }
    }

    function handleToggleTouchMove(e) {
        touchEndY = e.changedTouches[0].screenY;
        const swipeDistance = touchEndY - touchStartY;
        
        if (isExpanded) {
            // Swipe down to close
            if (swipeDistance > 0) {
                e.preventDefault();
                const progress = Math.min(swipeDistance / 100, 1);
                container.style.opacity = `${1 - progress}`;
                title.style.opacity = `${1 - progress}`;
            }
        } else {
            // Swipe up to open
            if (swipeDistance < 0) {
                e.preventDefault();
                const progress = Math.min(-swipeDistance / 100, 1);
                toggle.style.transform = `translateY(-${progress * 20}px)`;
            }
        }
    }

    function handleToggleTouchEnd(e) {
        const touchEndTime = Date.now();
        const swipeDistance = touchEndY - touchStartY;
        const swipeDuration = touchEndTime - touchStartTime;
        
        if (isExpanded) {
            container.style.transition = 'max-height 0.2s ease, opacity 0.2s ease';
            title.style.transition = 'height 0.2s ease, opacity 0.2s ease';
            
            if (swipeDistance > 50 && swipeDuration < 300) {
                toggleRecentlyPlayed();
            } else {
                container.style.opacity = '1';
                title.style.opacity = '1';
            }
        } else {
            toggle.style.transform = '';
            
            if (swipeDistance < -50 && swipeDuration < 300 && container.querySelector('.radio')) {
                toggleRecentlyPlayed();
            }
        }
    }

    // Add event listeners
    container.addEventListener('touchstart', handleContainerTouchStart, { passive: true });
    container.addEventListener('touchmove', handleContainerTouchMove, { passive: false });
    container.addEventListener('touchend', handleContainerTouchEnd, { passive: true });
    title.addEventListener('touchstart', handleContainerTouchStart, { passive: true });
    title.addEventListener('touchmove', handleContainerTouchMove, { passive: false });
    title.addEventListener('touchend', handleContainerTouchEnd, { passive: true });
    toggle.addEventListener('touchstart', handleToggleTouchStart, { passive: true });
    toggle.addEventListener('touchmove', handleToggleTouchMove, { passive: false });
    toggle.addEventListener('touchend', handleToggleTouchEnd, { passive: true });

    function toggleRecentlyPlayed() {
        if (!container.querySelector('.radio')) return;
        isExpanded = !isExpanded;
        handleToggleAnimation();
        
        // Update scrollbar after toggling
        setTimeout(() => {
            ScrollbarManager.updateAll();
        }, 210); // Match the transition duration
    }

    function handleToggleAnimation() {
        if (isExpanded) {
            // Make sure container is properly initialized
            container.style.display = 'flex';
            container.style.maxHeight = '0';
            container.style.opacity = '0';
            container.style.padding = '5px 5px 10px 5px';
            container.style.overflow = 'hidden';
            container.style.transform = '';
            
            // Show title first
            title.style.display = 'flex';
            title.style.height = 'auto';
            title.style.opacity = '0';
            title.style.margin = '20px 10px 10px 10px';
            title.style.overflow = 'visible';
            
            // Force reflow before animation
            void container.offsetHeight;
            
            // Animate both elements together
            const containerHeight = container.scrollHeight;
            container.style.maxHeight = `${containerHeight}px`;
            container.style.opacity = '1';
            title.style.opacity = '1';
            
            // Adjust scroll list
            scrollList.style.bottom = `${COLLAPSED_HEIGHT + containerHeight + 40}px`;
        } else {
            // Animate both elements together
            container.style.maxHeight = '0';
            container.style.opacity = '0';
            container.style.padding = '0';
            
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
                    title.style.display = 'none';
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
        title.removeEventListener('touchstart', handleContainerTouchStart);
        title.removeEventListener('touchmove', handleContainerTouchMove);
        title.removeEventListener('touchend', handleContainerTouchEnd);
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

    // Store the current expanded state
    const wasExpanded = container.style.maxHeight !== '0px';
    
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
    
    if (!hasContent) {
        container.style.display = 'none';
        container.style.maxHeight = '0';
        container.style.opacity = '0';
        container.classList.remove('expanded');
        title.classList.remove('expanded');
        scrollList.style.bottom = `${COLLAPSED_HEIGHT}px`;
        audioContainer.style.height = `${COLLAPSED_HEIGHT}px`;
    } else {
        if (wasExpanded) {
            container.style.display = 'flex';
            const containerHeight = container.scrollHeight;
            container.style.maxHeight = `${containerHeight}px`;
            container.style.opacity = '1';
            
            if (scrollList) {
                scrollList.style.bottom = `${COLLAPSED_HEIGHT + containerHeight + 40}px`;
            }
            
            if (audioContainer) {
                audioContainer.style.height = 'auto';
            }
        } else if (container.classList.contains('expanded')) {
            container.style.display = 'flex';
            const containerHeight = container.scrollHeight;
            container.style.maxHeight = `${containerHeight}px`;
            container.style.opacity = '1';
            
            if (scrollList) {
                scrollList.style.bottom = `${COLLAPSED_HEIGHT + containerHeight}px`;
            }
            
            if (audioContainer) {
                audioContainer.style.height = `${COLLAPSED_HEIGHT + containerHeight}px`;
            }
        }
    }
    
    // Update scrollbar after loading
    setTimeout(() => {
        ScrollbarManager.updateAll();
    }, 10);
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
    
    document.getElementById("clearSearch").style.display = searching ? "block" : "none";

    if (searching) {
        document.querySelectorAll('.expand-button').forEach(btn => btn.remove());
        document.querySelectorAll('.category-container').forEach(cat => {
            cat.classList.remove("no-radius", "has-expand-button");
        });
    }

    document.querySelectorAll('.radio:not(#recentlyPlayedContainer .radio)').forEach(station => {
        const matches = station.dataset.name.toLowerCase().includes(query);
        station.style.display = matches ? 'flex' : 'none';
    });

    document.querySelectorAll('.category-container:not(#recentlyPlayedContainer)').forEach(category => {
        const hasVisible = [...category.querySelectorAll('.radio:not(#recentlyPlayedContainer .radio)')]
            .some(station => station.style.display !== 'none');
        
        category.style.display = hasVisible ? 'flex' : 'none';
        const title = category.previousElementSibling;
        if (title?.classList.contains("category")) {
            title.style.display = hasVisible ? 'flex' : 'none';
        }
    });
    
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
        ScrollbarManager.updateThumbSize();
        ScrollbarManager.positionThumb();
        ScrollbarManager.updateScrollButtons();
    }, 10);
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
        document.title = `Radio | ${savedStation.name}`;
        updateSelectedStation(savedStation.name);
    } else {
        document.title = "Radio";
    }
}

const ScrollbarManager = {
    init() {
        this.scrollList = document.querySelector('.scroll-list');
        this.scrollbarThumb = document.querySelector('.scrollbar-thumb');
        this.scrollbarTrack = document.querySelector('.scrollbar-track');
        this.scrollUpBtn = document.querySelector('.scroll-button.up');
        this.scrollDownBtn = document.querySelector('.scroll-button.down');
        
        if (!this.scrollList || !this.scrollbarThumb || !this.scrollbarTrack) return;
    
        // Move scrollbar elements inside scroll-list
        this.scrollList.appendChild(this.scrollbarTrack);
        this.scrollbarTrack.appendChild(this.scrollbarThumb);
        this.scrollbarTrack.appendChild(this.scrollUpBtn);
        this.scrollbarTrack.appendChild(this.scrollDownBtn);
        
        // Initially hide buttons
        if (this.scrollUpBtn) this.scrollUpBtn.style.opacity = '0';
        if (this.scrollDownBtn) this.scrollDownBtn.style.opacity = '0';
        
        this.setupEvents();
        this.updateAll();
        
        // Observe audio container for height changes
        this.audioContainerObserver = new ResizeObserver(() => {
            this.updateTrackPosition();
        });
        this.audioContainerObserver.observe(document.querySelector('.audio-container'));
    },
  
    setupEvents() {
        // Thumb dragging - mouse
        this.scrollbarThumb.addEventListener('mousedown', this.handleThumbMouseDown.bind(this));
        
        // Thumb dragging - touch
        this.scrollbarThumb.addEventListener('touchstart', this.handleThumbTouchStart.bind(this), { passive: false });
        
        // Track clicking
        this.scrollbarTrack.addEventListener('click', this.handleTrackClick.bind(this));
        
        // Scroll buttons
        this.scrollUpBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.scrollBy(-this.scrollList.clientHeight * 0.8);
        });
        this.scrollDownBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.scrollBy(this.scrollList.clientHeight * 0.8);
        });
        
        // Scroll events
        this.scrollList.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
        
        // Wheel event on track
        this.scrollbarTrack.addEventListener('wheel', this.handleTrackWheel.bind(this), { passive: false });
        
        // Hover events
        this.scrollbarTrack.addEventListener('mouseenter', () => {
            this.showScrollButtons();
            this.scrollbarThumb.classList.add('hovering');
        });
        
        this.scrollbarTrack.addEventListener('mouseleave', () => {
            this.hideScrollButtons();
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
    
    handleTrackWheel(e) {
        // Prevent page scrolling when hovering scrollbar
        e.preventDefault();
        e.stopPropagation();
        
        // Apply wheel scrolling to the scroll list
        this.scrollList.scrollTop += e.deltaY;
        
        // Update thumb position immediately
        this.positionThumb();
    },
    
    showScrollButtons() {
        if (this.scrollUpBtn) this.scrollUpBtn.style.opacity = '1';
        if (this.scrollDownBtn) this.scrollDownBtn.style.opacity = '1';
    },
    
    hideScrollButtons() {
        if (this.scrollUpBtn) this.scrollUpBtn.style.opacity = '0';
        if (this.scrollDownBtn) this.scrollDownBtn.style.opacity = '0';
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
            if (this.scrollUpBtn) this.scrollUpBtn.style.display = 'none';
            if (this.scrollDownBtn) this.scrollDownBtn.style.display = 'none';
            return;
        }
        
        this.scrollbarThumb.style.display = 'block';
        if (this.scrollUpBtn) this.scrollUpBtn.style.display = 'flex';
        if (this.scrollDownBtn) this.scrollDownBtn.style.display = 'flex';
        
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
        const trackHeight = this.scrollbarTrack.clientHeight - 36; // Account for buttons
        const thumbHeight = this.scrollbarThumb.clientHeight;
        const maxThumbPosition = trackHeight - thumbHeight;
        const thumbPosition = Math.min(scrollPercentage * maxThumbPosition, maxThumbPosition);
        
        this.scrollbarThumb.style.top = `${thumbPosition + 18}px`;
    },
  
    handleThumbMouseDown(e) {
        e.preventDefault();
        this.scrollbarThumb.classList.add('dragging');
        
        const startY = e.clientY;
        const startTop = parseFloat(this.scrollbarThumb.style.top) || 18;
        const trackHeight = this.scrollbarTrack.clientHeight - 36;
        const thumbHeight = this.scrollbarThumb.clientHeight;
        
        const moveHandler = (e) => {
            const deltaY = e.clientY - startY;
            let newTop = startTop + deltaY;
            
            // Constrain the thumb within track bounds
            newTop = Math.max(18, Math.min(newTop, trackHeight - thumbHeight + 18));
            
            const scrollPercentage = (newTop - 18) / (trackHeight - thumbHeight);
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
        const startTop = parseFloat(this.scrollbarThumb.style.top) || 18;
        const trackHeight = this.scrollbarTrack.clientHeight - 36;
        const thumbHeight = this.scrollbarThumb.clientHeight;
        
        const moveHandler = (e) => {
            const touch = e.touches[0];
            const deltaY = touch.clientY - startY;
            let newTop = startTop + deltaY;
            
            // Constrain the thumb within track bounds
            newTop = Math.max(18, Math.min(newTop, trackHeight - thumbHeight + 18));
            
            const scrollPercentage = (newTop - 18) / (trackHeight - thumbHeight);
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
        if (e.target === this.scrollbarThumb || 
            e.target === this.scrollUpBtn || 
            e.target === this.scrollDownBtn) return;
        
        const trackRect = this.scrollbarTrack.getBoundingClientRect();
        const thumbHeight = this.scrollbarThumb.clientHeight;
        const clickPosition = e.clientY - trackRect.top - 18 - (thumbHeight / 2);
        const trackHeight = trackRect.height - 36;
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
        const recentlyPlayedContainer = document.getElementById('recentlyPlayedContainer');
        const audioContainer = document.querySelector('.audio-container');
        
        if (recentlyPlayedContainer && audioContainer) {
            const recentlyPlayedHeight = recentlyPlayedContainer.style.maxHeight !== '0px' ? 
                recentlyPlayedContainer.scrollHeight : 0;
            
            const audioContainerHeight = audioContainer.clientHeight;
            const bottomPosition = audioContainerHeight;
            
            this.scrollList.style.bottom = `${bottomPosition}px`;
            
            // Adjust scrollbar track height to match visible area
            const viewportHeight = window.innerHeight;
            const scrollListTop = this.scrollList.getBoundingClientRect().top;
            const availableHeight = viewportHeight - scrollListTop - bottomPosition;
            
            if (availableHeight > 0) {
                this.scrollList.style.maxHeight = `${availableHeight}px`;
                this.scrollbarTrack.style.height = `${availableHeight}px`;
            }
            
            // Ensure scroll position stays within bounds
            const maxScroll = this.scrollList.scrollHeight - this.scrollList.clientHeight;
            if (this.scrollList.scrollTop > maxScroll) {
                this.scrollList.scrollTop = maxScroll;
            }
        }
    }
}
ScrollbarManager.setupAutoHide = function() {
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

function setupAutoRemoveHover() {
    const elements = [
        ...document.querySelectorAll('.radio'),
        ...document.querySelectorAll('.recently-played-toggle')
    ];

    elements.forEach(el => {
        // Clear any existing event listeners to avoid duplicates
        el.removeEventListener('mouseenter', handleMouseEnter);
        el.removeEventListener('mouseleave', handleMouseLeave);
        
        el.addEventListener('mouseenter', handleMouseEnter);
        el.addEventListener('mouseleave', handleMouseLeave);
    });

    function handleMouseEnter() {
        this.classList.add('hover-active');
        clearTimeout(hoverResetTimeout);
    }

    function handleMouseLeave() {
        hoverResetTimeout = setTimeout(() => {
            this.classList.remove('hover-active');
        }, HOVER_RESET_DELAY);
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

    genreButtons.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
        scrollLeftStart = genreButtons.scrollLeft;
        touchStartTime = Date.now();
        isSwiping = true;
        genreButtons.style.scrollBehavior = 'auto';
    }, { passive: true });

    genreButtons.addEventListener('touchmove', function(e) {
        if (!isSwiping) return;
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > 5) {
            e.preventDefault();
            genreButtons.scrollLeft = scrollLeftStart + diff;
        }
    }, { passive: false });

    genreButtons.addEventListener('touchend', function(e) {
        if (!isSwiping) return;
        isSwiping = false;
        genreButtons.style.scrollBehavior = 'smooth';
        
        const diff = touchStartX - touchEndX;
        const swipeDuration = Date.now() - touchStartTime;
        
        // Calculate momentum scroll
        const velocity = diff / swipeDuration;
        let targetScroll = genreButtons.scrollLeft + (velocity * 200);
        
        // Apply limits
        targetScroll = Math.max(0, Math.min(targetScroll, genreButtons.scrollWidth - genreButtons.clientWidth));
        
        // Snap to nearest button
        const buttonWidth = genreButtons.querySelector('.genre-button')?.offsetWidth || 0;
        if (buttonWidth > 0) {
            targetScroll = Math.round(targetScroll / buttonWidth) * buttonWidth;
        }
        
        // Smooth scroll to target position
        genreButtons.scrollTo({
            left: targetScroll,
            behavior: 'smooth'
        });
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