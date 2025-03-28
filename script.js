document.addEventListener("DOMContentLoaded", function() {
    loadPreferences();
    loadRecentlyPlayed();
    setupDropdown();
    setupExpandableCategories();
    setupThemeControls();
    
    // Initialize all radio station click handlers
    var radios = document.querySelectorAll(".radio");
    for (var i = 0; i < radios.length; i++) {
        radios[i].onclick = function() {
            changeStation(this.dataset.name, this.dataset.link);
        };
    }
});

// Global Elements
var audio = document.getElementById("audioctrl");
var playPauseBtn = document.getElementById("playPauseBtn");
var volumeIcon = document.getElementById("volumeIcon");
var volumeSlider = document.getElementById("volumeSlider");
var lastVolume = audio.volume || 1;

// Station Functions
function changeStation(name, link) {
    audio.pause();
    audio.src = link;
    audio.load();

    audio.oncanplay = function() {
        try { audio.play(); } catch (e) { console.error("Audio play failed:", e); }
    };

    document.getElementById("audiotext").textContent = name;
    localStorage.setItem("lastStation", JSON.stringify({ name: name, link: link }));

    updateRecentlyPlayed(name, link);
    updateSelectedStation(name);
    updatePlayPauseButton();
}

function updateSelectedStation(name) {
    var radios = document.querySelectorAll(".radio");
    
    for (var i = 0; i < radios.length; i++) {
        radios[i].classList.remove("selected");
        var existingEqualizer = radios[i].querySelector(".equalizer");
        if (existingEqualizer) radios[i].removeChild(existingEqualizer);
        
        if (radios[i].dataset.name === name) {
            radios[i].classList.add("selected");
            
            var equalizer = document.createElement("div");
            equalizer.className = audio.paused ? "equalizer displaypaused" : "equalizer animate";
            equalizer.innerHTML = "<div></div><div></div><div></div>";
            
            var radioText = radios[i].querySelector(".radio-text");
            if (radioText) {
                radios[i].insertBefore(equalizer, radioText);
            }
        }
    }
}

// Theme Functions
function setTheme(mode) {
    document.body.classList.add("no-transition");
    var radios = document.querySelectorAll(".radio");
    for (var i = 0; i < radios.length; i++) {
        radios[i].classList.add("no-transition");
    }
    
    document.body.className = mode + "-mode";
    document.documentElement.style.setProperty(
        "--accent-color", 
        "var(--accent-" + (mode === "dark" ? "light" : "dark") + ")"
    );
    localStorage.setItem("theme", mode);

    setTimeout(function() {
        document.body.classList.remove("no-transition");
        for (var i = 0; i < radios.length; i++) {
            radios[i].classList.remove("no-transition");
        }
    }, 50);

    var themeIcons = document.getElementsByClassName("theme-icon");
    for (var i = 0; i < themeIcons.length; i++) {
        themeIcons[i].textContent = mode === "dark" ? "dark_mode" : "light_mode";
    }
}

function changeColor(color) {
    var colors = {
        green: ["--green-dark", "--green-light"],
        blue: ["--blue-dark", "--blue-light"],
        yellow: ["--yellow-dark", "--yellow-light"],
        red: ["--red-dark", "--red-light"]
    }[color] || ["--green-dark", "--green-light"];

    document.documentElement.style.setProperty("--accent-dark", "var(" + colors[0] + ")");
    document.documentElement.style.setProperty("--accent-light", "var(" + colors[1] + ")");
    
    var currentTheme = document.body.classList.contains("dark-mode") ? "dark" : "light";
    document.documentElement.style.setProperty(
        "--accent-color", 
        "var(" + colors[currentTheme === "dark" ? 1 : 0] + ")"
    );

    localStorage.setItem("accentColor", color);
}

function setupThemeControls() {
    // Theme options
    var themeOptions = document.querySelectorAll(".theme-option");
    for (var i = 0; i < themeOptions.length; i++) {
        themeOptions[i].onclick = function() {
            setTheme(this.dataset.theme);
        };
    }

    // Color options
    var colorPickers = document.querySelectorAll(".color-picker");
    for (var i = 0; i < colorPickers.length; i++) {
        colorPickers[i].onclick = function() {
            changeColor(this.dataset.color);
        };
    }
}

// Recently Played Functions
function updateRecentlyPlayed(name, link) {
    var recentlyPlayed = safeParseJSON('recentlyPlayed', []);

    var newRecentlyPlayed = [];
    for (var i = 0; i < recentlyPlayed.length; i++) {
        if (recentlyPlayed[i].link !== link) {
            newRecentlyPlayed.push(recentlyPlayed[i]);
        }
    }
    newRecentlyPlayed.unshift({ name: name, link: link });

    newRecentlyPlayed = newRecentlyPlayed.slice(0, 7);
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
    var dropdownToggle = document.querySelector(".dropdown-toggle");
    var dropdownMenu = document.querySelector(".dropdown-menu");

    dropdownToggle.onclick = function(event) {
        event.stopPropagation();
        dropdownMenu.classList.toggle("show");
    };

    document.onclick = function(event) {
        if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
            dropdownMenu.classList.remove("show");
        }
    };
}

// Playback Control Functions
playPauseBtn.onclick = function() {
    audio[audio.paused ? "play" : "pause"]();
};

audio.onplay = audio.onpause = updatePlayPauseButton;

function updatePlayPauseButton() {
    playPauseBtn.innerHTML = '<span class="material-icons">' + (audio.paused ? 'play_arrow' : 'pause') + '</span>';

    var selectedRadios = document.querySelectorAll(".radio.selected");
    for (var i = 0; i < selectedRadios.length; i++) {
        var equalizer = selectedRadios[i].querySelector(".equalizer");
        if (equalizer) {
            equalizer.className = audio.paused ? "equalizer displaypaused" : "equalizer animate";
        }
    }
}

// Volume Control Functions
volumeSlider.oninput = function() {
    audio.volume = volumeSlider.value;
    audio.muted = audio.volume === 0;
    if (!audio.muted) lastVolume = audio.volume;
    updateVolumeIcon();
};

volumeIcon.onclick = function() {
    audio.muted = !audio.muted;
    audio.volume = audio.muted ? 0 : lastVolume;
    volumeSlider.value = audio.volume;
    updateVolumeIcon();
};

function updateVolumeIcon() {
    volumeIcon.innerHTML = audio.muted || audio.volume === 0 ? "volume_off" :
                           audio.volume < 0.5 ? "volume_down" : "volume_up";
}

// Search and Filter Functions
function debounce(func, wait) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            func.apply(context, args);
        }, wait);
    };
}

function filterStations() {
    var query = document.getElementById("stationSearch").value.toLowerCase();
    var categories = document.querySelectorAll(".category-container");
    var recentlyPlayedContainer = document.getElementById("recentlyPlayedContainer");
    var recentlyPlayedTitle = recentlyPlayedContainer ? recentlyPlayedContainer.previousElementSibling : null;

    for (var i = 0; i < categories.length; i++) {
        var category = categories[i];
        var categoryHasVisibleStation = false;
        var stations = category.getElementsByClassName("radio");
        var categoryTitle = category.previousElementSibling;

        if (!categoryTitle || categoryTitle.className.indexOf("category") === -1) {
            continue;
        }

        for (var j = 0; j < stations.length; j++) {
            var station = stations[j];
            var stationName = station.dataset.name.toLowerCase();
            var isVisible = stationName.indexOf(query) !== -1;
            station.style.display = isVisible ? "flex" : "none";
            if (isVisible) categoryHasVisibleStation = true;
        }

        var expandButton = category.querySelector(".expand-button");

        if (query !== "") {
            category.style.display = categoryHasVisibleStation ? "flex" : "none";
            categoryTitle.style.display = categoryHasVisibleStation ? "flex" : "none";
            if (expandButton) expandButton.style.display = "none";
            category.className = category.className.replace(" no-radius", ""); 
        } else {
            category.style.display = categoryHasVisibleStation ? "flex" : "none";
            categoryTitle.style.display = categoryHasVisibleStation ? "flex" : "none";

            if (expandButton && categoryHasVisibleStation && stations.length > 12) {
                expandButton.style.display = "flex";
                if (category.className.indexOf("no-radius") === -1) {
                    category.className += " no-radius";
                }
            } else if (expandButton) {
                expandButton.style.display = "none";
                category.className = category.className.replace(" no-radius", "");
            }
        }
    }

    if (recentlyPlayedContainer) {
        var hasStations = recentlyPlayedContainer.getElementsByClassName("radio").length > 0;
        recentlyPlayedContainer.style.display = query !== "" ? "none" : "flex";
        if (recentlyPlayedTitle) {
            recentlyPlayedTitle.style.display = query !== "" || !hasStations ? "none" : "flex";
        }
    }

    if (query === "") {
        var expandButtons = document.getElementsByClassName("expand-button");
        for (var i = 0; i < expandButtons.length; i++) {
            var button = expandButtons[i];
            button.setAttribute("data-expanded", "false");
            button.getElementsByClassName("expand-text")[0].textContent = "Još stanica";
            button.getElementsByClassName("material-icons")[0].textContent = "expand_more";

            var category = button.closest(".category-container");
            var categoryTitle = category ? category.previousElementSibling : null;

            if (categoryTitle && categoryTitle.className.indexOf("category") !== -1) {
                categoryTitle.style.display = "flex";
            }

            var stations = category ? category.getElementsByClassName("radio") : [];
            for (var j = 0; j < stations.length; j++) {
                stations[j].style.display = j < 12 ? "flex" : "none";
            }
        }
    }
}

// Initialization Functions
function loadPreferences() {
    var savedTheme = localStorage.getItem("theme") || "dark";
    var savedColor = localStorage.getItem("accentColor") || "green";
    var savedStation = safeParseJSON("lastStation", {});

    setTheme(savedTheme);
    changeColor(savedColor);

    if (savedStation.name && savedStation.link) {
        audio.src = savedStation.link;
        document.getElementById("audiotext").textContent = savedStation.name;
        updateSelectedStation(savedStation.name);
    }
}

function loadRecentlyPlayed() {
    var container = document.getElementById("recentlyPlayedContainer");
    var recentlyPlayedTitle = container ? container.previousElementSibling : null;
    var recentlyPlayed = safeParseJSON("recentlyPlayed", []);

    var uniqueStations = [];
    var seenLinks = {};

    for (var i = 0; i < recentlyPlayed.length; i++) {
        if (!seenLinks[recentlyPlayed[i].link]) {
            uniqueStations.push(recentlyPlayed[i]);
            seenLinks[recentlyPlayed[i].link] = true;
        }
    }

    var htmlContent = "";
    for (var i = 0; i < uniqueStations.length; i++) {
        htmlContent += '<div class="radio" data-name="' + 
                      uniqueStations[i].name.replace(/"/g, '&quot;') + 
                      '" data-link="' + 
                      uniqueStations[i].link.replace(/"/g, '&quot;') + 
                      '"><div class="radio-text">' + 
                      uniqueStations[i].name + 
                      '</div></div>';
    }
    container.innerHTML = htmlContent;

    // Add click handlers to new elements
    var recentRadios = container.querySelectorAll(".radio");
    for (var i = 0; i < recentRadios.length; i++) {
        recentRadios[i].onclick = function() {
            changeStation(this.dataset.name, this.dataset.link);
        };
    }

    if (uniqueStations.length === 0) {
        container.style.display = "none";
        if (recentlyPlayedTitle) recentlyPlayedTitle.style.display = "none";
    } else {
        container.style.display = "flex";
        if (recentlyPlayedTitle) recentlyPlayedTitle.style.display = "flex";
    }

    var savedStation = safeParseJSON("lastStation", {});
    if (savedStation.name) {
        updateSelectedStation(savedStation.name);
    }
}

function setupExpandableCategories() {
    var categories = document.getElementsByClassName("category-container");

    for (var i = 0; i < categories.length; i++) {
        var stations = categories[i].getElementsByClassName("radio");

        if (stations.length > 12) {
            for (var j = 12; j < stations.length; j++) {
                stations[j].style.display = "none";
            }

            var expandButton = document.createElement("button");
            expandButton.className = "expand-button";
            expandButton.setAttribute("data-expanded", "false");

            var contentContainer = document.createElement("div");
            contentContainer.style.display = "flex";
            contentContainer.style.alignItems = "center";
            contentContainer.style.justifyContent = "center";

            var textSpan = document.createElement("span");
            textSpan.className = "expand-text";
            textSpan.textContent = "Još stanica";

            var iconSpan = document.createElement("span");
            iconSpan.className = "material-icons";
            iconSpan.textContent = "expand_more";
            iconSpan.style.marginRight = "4px";

            contentContainer.appendChild(iconSpan);
            contentContainer.appendChild(textSpan);
            expandButton.appendChild(contentContainer);

            textSpan.style.fontSize = '0px';
            textSpan.style.transition = 'font-size 0.05s ease-in';
            textSpan.style.webkitTransition = 'font-size 0.05s ease-in';
            textSpan.style.mozTransition = 'font-size 0.05s ease-in';
            textSpan.style.oTransition = 'font-size 0.05s ease-in';
            textSpan.style.msTransition = 'font-size 0.05s ease-in';

            expandButton.addEventListener("mouseover", function() {
                var text = this.querySelector('.expand-text');
                text.style.fontSize = '15px';
            });

            expandButton.addEventListener("mouseout", function() {
                var text = this.querySelector('.expand-text');
                text.style.fontSize = '0px';
            });

            expandButton.onclick = (function(button, stations, icon, text) {
                return function() {
                    var expanded = button.getAttribute("data-expanded") === "true";
                    if (expanded) {
                        for (var j = 12; j < stations.length; j++) {
                            stations[j].style.display = "none";
                        }
                        button.setAttribute("data-expanded", "false");
                        icon.textContent = "expand_more";
                        text.textContent = "Još stanica";
                    } else {
                        for (var j = 12; j < stations.length; j++) {
                            stations[j].style.display = "flex";
                        }
                        button.setAttribute("data-expanded", "true");
                        icon.textContent = "expand_less";
                        text.textContent = "Manje";
                    }
                };
            })(expandButton, stations, iconSpan, textSpan);

            categories[i].appendChild(expandButton);
            categories[i].classList.add("no-radius");
        }
    }

    // Ensure all stations have click handlers
    var allRadios = document.querySelectorAll(".radio:not([data-name])");
    for (var i = 0; i < allRadios.length; i++) {
        allRadios[i].onclick = function() {
            changeStation(this.dataset.name, this.dataset.link);
        };
    }
}

// Event Listeners
var searchInput = document.getElementById("stationSearch");
var clearSearchIcon = document.getElementById("clearSearch");

searchInput.addEventListener("input", function() {
    if (searchInput.value.trim() !== "") {
        clearSearchIcon.style.display = "block";
    } else {
        clearSearchIcon.style.display = "none";
    }
    filterStations();
});

clearSearchIcon.addEventListener("click", function() {
    searchInput.value = "";
    clearSearchIcon.style.display = "none";
    searchInput.focus();
    filterStations();
});

var debouncedFilterStations = debounce(filterStations, 300);
document.getElementById("stationSearch").addEventListener("input", debouncedFilterStations);