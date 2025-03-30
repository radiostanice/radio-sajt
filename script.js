document.addEventListener("DOMContentLoaded", () => {
    // Load all initial components
    loadPreferences();
    loadRecentlyPlayed();
    setupDropdown();
    setupGenreButtonsNavigation();
    setupGenreFiltering();
    setupThemeControls();
    
    // Initialize radio station click handlers
    document.querySelectorAll(".radio").forEach(radio => {
        radio.addEventListener("click", () => {
            changeStation(radio.dataset.name, radio.dataset.link);
        });
    });
    
    // Initial UI setup
    applyGenreFilter();
});

// Global Elements
const audio = document.getElementById("audioctrl");
const playPauseBtn = document.getElementById("playPauseBtn");
const volumeIcon = document.getElementById("volumeIcon");
const volumeSlider = document.getElementById("volumeSlider");
let lastVolume = audio.volume || 1;
let currentGenre = 'all';

// Station Functions
function changeStation(name, link) {
    audio.pause();
    audio.src = link;
    audio.load();

    audio.oncanplay = () => {
        try { audio.play(); } 
        catch (e) { console.error("Audio play failed:", e); }
    };

    document.getElementById("audiotext").textContent = name;
    localStorage.setItem("lastStation", JSON.stringify({ name, link }));

    updateRecentlyPlayed(name, link);
    updateSelectedStation(name);
    updatePlayPauseButton();
}

function updateSelectedStation(name) {
    document.querySelectorAll(".radio").forEach(radio => {
        radio.classList.remove("selected");
        const existingEqualizer = radio.querySelector(".equalizer");
        if (existingEqualizer) radio.removeChild(existingEqualizer);
        
        if (radio.dataset.name === name) {
            radio.classList.add("selected");
            const equalizer = document.createElement("div");
            equalizer.className = audio.paused ? "equalizer displaypaused" : "equalizer animate";
            equalizer.innerHTML = "<div></div><div></div><div></div>";
            
            const radioText = radio.querySelector(".radio-text");
            if (radioText) {
                radio.insertBefore(equalizer, radioText);
            }
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

    // Recently played section visibility
    const searchQuery = document.getElementById("stationSearch").value.trim();
    const recentlyPlayedContainer = document.getElementById("recentlyPlayedContainer");
    const recentlyPlayedTitle = document.querySelector("#recentlyPlayedTitle");
    
    if (recentlyPlayedContainer && recentlyPlayedTitle) {
        const shouldShow = searchQuery === "";
        recentlyPlayedContainer.style.display = shouldShow ? "flex" : "none";
        recentlyPlayedTitle.style.display = shouldShow ? "flex" : "none";
        
        if (shouldShow) {
            recentlyPlayedContainer.querySelectorAll(".radio").forEach(station => {
                station.style.display = "flex";
            });
        }
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
    icon.style.marginRight = "4px";

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
    
    // Toggle recently played visibility
    const recentContainer = document.getElementById("recentlyPlayedContainer");
    const recentTitle = document.querySelector("#recentlyPlayedTitle");
    if (recentContainer) recentContainer.style.display = searching ? "none" : "flex";
    if (recentTitle) recentTitle.style.display = searching ? "none" : "flex";

    // Remove all expand buttons when searching
    if (searching) {
        document.querySelectorAll('.expand-button').forEach(btn => btn.remove());
        document.querySelectorAll('.category-container').forEach(cat => {
            cat.classList.remove("no-radius", "has-expand-button");
        });
    }

    // Show all stations when not searching
    if (!searching) {
        document.querySelectorAll('.radio').forEach(station => {
            station.style.display = 'flex';
        });
        applyGenreFilter();
        return;
    }

    // Search logic
    document.querySelectorAll('.radio').forEach(station => {
        const matches = station.dataset.name.toLowerCase().includes(query);
        station.style.display = matches ? 'flex' : 'none';
    });

    // Update category visibility
    document.querySelectorAll('.category-container').forEach(category => {
        if (category.id === "recentlyPlayedContainer") return;
        
        const hasVisible = [...category.querySelectorAll('.radio')]
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

function loadRecentlyPlayed() {
    const container = document.getElementById("recentlyPlayedContainer");
    if (!container) return;
    
    const recentlyPlayedTitle = container.previousElementSibling;
    const recentlyPlayed = safeParseJSON("recentlyPlayed", []);

    // Get unique stations
    const uniqueStations = recentlyPlayed.filter((station, index, self) =>
        index === self.findIndex(s => s.link === station.link)
    ).slice(0, 7);

    // Generate HTML content
    container.innerHTML = uniqueStations.map(station => `
        <div class="radio" 
             data-name="${station.name.replace(/"/g, '&quot;')}" 
             data-link="${station.link.replace(/"/g, '&quot;')}">
            <div class="radio-text">${station.name}</div>
        </div>
    `).join("");

    // Add click handlers
    container.querySelectorAll(".radio").forEach(radio => {
        radio.addEventListener("click", () => {
            changeStation(radio.dataset.name, radio.dataset.link);
        });
    });

    // Toggle visibility
    const shouldShow = uniqueStations.length > 0;
    container.style.display = shouldShow ? "flex" : "none";
    if (recentlyPlayedTitle) {
        recentlyPlayedTitle.style.display = shouldShow ? "flex" : "none";
    }

    // Update selected station if exists
    const savedStation = safeParseJSON("lastStation", {});
    if (savedStation.name) {
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
        
        const duration = 300; // milliseconds
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
    
    // Show all content
    document.querySelectorAll('.radio').forEach(station => {
        station.style.display = 'flex';
    });
    
    document.getElementById("recentlyPlayedContainer").style.display = "flex";
    document.querySelector("#recentlyPlayedTitle").style.display = "flex";
    
    applyGenreFilter();
});

searchInput.addEventListener("input", debounce(filterStations, 300));