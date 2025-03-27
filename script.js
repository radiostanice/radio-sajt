document.addEventListener("DOMContentLoaded", function() {
    loadPreferences();
    loadRecentlyPlayed();
    setupDropdown();
    setupExpandableCategories();
});

// Global Elements
var audio = document.getElementById("audioctrl"),
    playPauseBtn = document.getElementById("playPauseBtn"),
    volumeIcon = document.getElementById("volumeIcon"),
    volumeSlider = document.getElementById("volumeSlider"),
    lastVolume = audio.volume || 1;

function changeStation(name, link) {
    audio.pause();
    audio.src = link;
    audio.load();

    audio.oncanplay = function () {
        try { audio.play(); } catch (e) { console.error("Audio play failed:", e); }
    };

    var audioTextElement = document.getElementById("audiotext");
    if (audioTextElement) audioTextElement.textContent = name;

    localStorage.setItem("lastStation", JSON.stringify({ name: name, link: link }));
    updateRecentlyPlayed(name, link);
    updateSelectedStation(name);

    var searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.focus();
}

function updateSelectedStation(name) {
    var radios = document.querySelectorAll(".radio");

    for (var i = 0; i < radios.length; i++) {
        radios[i].classList.remove("selected");
    }

    for (var i = 0; i < radios.length; i++) {
        if (radios[i].textContent.trim() === name) {
            radios[i].style.transition = "background-color 0.2s ease";
			radios[i].style.webkitTransition = "background-color 0.2s ease";
			radios[i].style.mozTransition = "background-color 0.2s ease";
			radios[i].style.oTransition = "background-color 0.2s ease";
			radios[i].style.msTransition = "background-color 0.2s ease";
			radios[i].offsetHeight;
            radios[i].classList.add("selected");
        }
    }
}

function setTheme(mode) {
    document.body.classList.add("no-transition");
    var radios = document.querySelectorAll(".radio");
    for (var i = 0; i < radios.length; i++) {
        radios[i].classList.add("no-transition");
    }

    document.body.className = mode + "-mode";

    if (mode === "dark") {
        document.documentElement.style.setProperty("--accent-color", "var(--accent-light)");
    } else {
        document.documentElement.style.setProperty("--accent-color", "var(--accent-dark)");
    }

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

    document.documentElement.style.setProperty("--accent-dark", `var(${colors[0]})`);
    document.documentElement.style.setProperty("--accent-light", `var(${colors[1]})`);
    
    var currentTheme = document.body.classList.contains("dark-mode") ? "dark" : "light";
    document.documentElement.style.setProperty("--accent-color", `var(${colors[currentTheme === "dark" ? 1 : 0]})`);

    localStorage.setItem("accentColor", color);
}

function updateRecentlyPlayed(name, link) {
    var predefinedStations = [
        { name: 'RADIO S1', link: 'https://stream.radios.rs:9000/;*.mp3' },
        { name: 'PLAY RADIO', link: 'https://stream.playradio.rs:8443/play.mp3' },
        { name: 'RADIO HIT FM', link: 'https://streaming.tdiradio.com/hit.mp3' }
    ];

    var recentlyPlayed = safeParseJSON('recentlyPlayed', []);
    
    recentlyPlayed = recentlyPlayed.filter(function(station) {
        return station.link !== link;
    });

    if (!predefinedStations.some(function(station) { return station.link === link; })) {
        recentlyPlayed.unshift({ name: name, link: link });
    }

    recentlyPlayed = recentlyPlayed.slice(0, 8);

    var combinedStations = predefinedStations.concat(recentlyPlayed);
    var uniqueStations = [];

    for (var i = 0; i < combinedStations.length; i++) {
        if (!uniqueStations.some(function(station) { return station.link === combinedStations[i].link; })) {
            uniqueStations.push(combinedStations[i]);
        }
    }

    localStorage.setItem('recentlyPlayed', JSON.stringify(uniqueStations));
    loadRecentlyPlayed();
}

function safeParseJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
}

function setupDropdown() {
    var dropdownToggle = document.querySelector(".dropdown-toggle"),
        dropdownMenu = document.querySelector(".dropdown-menu");

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

// Play/Pause Controls
playPauseBtn.onclick = function() {
    audio[audio.paused ? "play" : "pause"]();
};

audio.onplay = audio.onpause = updatePlayPauseButton;

function updatePlayPauseButton() {
    playPauseBtn.innerHTML = '<span class="material-icons">' + (audio.paused ? 'play_arrow' : 'pause') + '</span>';
}

// Volume Controls
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

// Debounce Function
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
    
    var predefinedStations = [
        { name: "RADIO S1", link: "https://stream.radios.rs:9000/;*.mp3" },
        { name: "PLAY RADIO", link: "https://stream.playradio.rs:8443/play.mp3" },
        { name: "RADIO HIT FM", link: "https://streaming.tdiradio.com/hit.mp3" }
    ];
    
    var recentlyPlayed = safeParseJSON("recentlyPlayed", []);
    var allStations = predefinedStations.concat(recentlyPlayed);
    
    var uniqueStations = [];
    var seenLinks = {};
    
    for (var i = 0; i < allStations.length; i++) {
        if (!seenLinks[allStations[i].link]) {
            uniqueStations.push(allStations[i]);
            seenLinks[allStations[i].link] = true;
        }
    }

    var htmlContent = "";
    for (var i = 0; i < uniqueStations.length; i++) {
        htmlContent += '<div class="radio" onclick="changeStation(\'' + 
                        uniqueStations[i].name.replace(/'/g, "\\'") + 
                        '\', \'' + 
                        uniqueStations[i].link.replace(/'/g, "\\'") + 
                        '\')">' + 
                        uniqueStations[i].name + 
                        '</div>';
    }
    container.innerHTML = htmlContent;

    var savedStation = safeParseJSON("lastStation", {});
    if (savedStation.name) {
        updateSelectedStation(savedStation.name);
    }
}

function filterStations() {
    var query = document.getElementById("stationSearch").value.toLowerCase();
    var categories = document.querySelectorAll(".category-container");
    var recentlyPlayedContainer = document.getElementById("recentlyPlayedContainer");
    var recentlyPlayedTitle = document.querySelector("#recentlyPlayedContainer").previousElementSibling;

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
            var stationName = station.textContent.toLowerCase();
            var isVisible = stationName.indexOf(query) !== -1;
            station.style.display = isVisible ? "block" : "none";
            if (isVisible) categoryHasVisibleStation = true;
        }

        var expandButton = category.querySelector(".expand-button");

        if (query !== "") {
            if (categoryHasVisibleStation) {
                category.style.display = "flex";
                categoryTitle.style.display = "block"; 
            } else {
                category.style.display = "none";
                categoryTitle.style.display = "none";
            }

            if (expandButton) expandButton.style.display = "none";
            category.className = category.className.replace(" no-radius", ""); 
        } else {
            category.style.display = categoryHasVisibleStation ? "flex" : "none";
            categoryTitle.style.display = categoryHasVisibleStation ? "block" : "none";

            if (expandButton && categoryHasVisibleStation && stations.length > 12) {
                expandButton.style.display = "block";
                if (category.className.indexOf("no-radius") === -1) {
                    category.className += " no-radius";
                }
            } else {
                if (expandButton) expandButton.style.display = "none";
                category.className = category.className.replace(" no-radius", "");
            }
        }
    }

    if (recentlyPlayedContainer) {
        var hasStations = recentlyPlayedContainer.getElementsByClassName("radio").length > 0;
        recentlyPlayedContainer.style.display = query !== "" ? "none" : "flex";
        if (recentlyPlayedTitle) {
            recentlyPlayedTitle.style.display = query !== "" || !hasStations ? "none" : "inline-flex";
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
                categoryTitle.style.display = "block";
            }

            var stations = category ? category.getElementsByClassName("radio") : [];
            for (var j = 0; j < stations.length; j++) {
                stations[j].style.display = j < 12 ? "block" : "none";
            }
        }
    }
}

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

            var textSpan = document.createElement("span");
            textSpan.className = "expand-text";
            textSpan.textContent = "Još stanica";

            var iconSpan = document.createElement("span");
            iconSpan.className = "material-icons";
            iconSpan.textContent = "expand_more";

            expandButton.appendChild(textSpan);
            expandButton.appendChild(iconSpan);

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
                            stations[j].style.display = "block";
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
}