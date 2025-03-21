document.addEventListener("DOMContentLoaded", function() {
    loadPreferences();
    loadRecentlyPlayed();
    setupDropdown();
});

var audio = document.getElementById("audioctrl");
var playPauseBtn = document.getElementById("playPauseBtn");
var volumeIcon = document.getElementById("volumeIcon");
var volumeSlider = document.getElementById("volumeSlider");
var lastVolume = audio.volume || 1;

function changeStation(name, link) {
    audio.pause();
    audio.src = link;
    audio.load();
    audio.play();
    
    document.getElementById('naslov').textContent = name;
    
    localStorage.setItem('lastStation', JSON.stringify({ name: name, link: link }));
    updateRecentlyPlayed(name, link);
    updateSelectedStation(name);
}

function updateSelectedStation(name) {
    var radios = document.querySelectorAll('.radio');
    for (var i = 0; i < radios.length; i++) {
        radios[i].classList.remove('selected');
        if (radios[i].textContent.trim() === name) {
            radios[i].classList.add('selected');
        }
    }
}

function setTheme(mode) {
    document.body.classList.remove('dark-mode', 'light-mode');
    document.body.classList.add(mode + '-mode');

    var accentColor = mode === 'dark' ? 'var(--accent-light)' : 'var(--accent-dark)';
    document.documentElement.style.setProperty('--accent-color', 'var(' + accentColor + ')');

    localStorage.setItem('theme', mode);
    document.querySelector('.theme-icon').textContent = mode === 'dark' ? 'dark_mode' : 'light_mode';
}

function changeColor(color) {
    var colorMap = {
        green: ['--green-dark', '--green-light'],
        blue: ['--blue-dark', '--blue-light'],
        yellow: ['--yellow-dark', '--yellow-light'],
        red: ['--red-dark', '--red-light']
    };
    
    var colors = colorMap[color] || colorMap.green;
    var darkColor = colors[0];
    var lightColor = colors[1];

    document.documentElement.style.setProperty('--accent-dark', 'var(' + darkColor + ')');
    document.documentElement.style.setProperty('--accent-light', 'var(' + lightColor + ')');

    var currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    document.documentElement.style.setProperty('--accent-color', currentTheme === 'dark' ? 'var(' + lightColor + ')' : 'var(' + darkColor + ')');

    localStorage.setItem('accentColor', color);
}

function updateRecentlyPlayed(name, link) {
    var recentlyPlayed = safeParseJSON('recentlyPlayed', []);
    
    var predefinedStations = [
        { name: 'RADIO S1', link: 'https://stream.radios.rs:9000/;*.mp3' },
        { name: 'PLAY RADIO', link: 'https://stream.playradio.rs:8443/play.mp3' },
        { name: 'HIT MUSIC FM', link: 'https://streaming.hitfm.rs/hit.mp3' }
    ];

    var isPredefined = predefinedStations.some(function(predefinedStation) {
        return predefinedStation.link === link;
    });

    recentlyPlayed = recentlyPlayed.filter(function(station) {
        return station.link !== link;
    });

    if (!isPredefined) {
        recentlyPlayed.unshift({ name: name, link: link });
    }

    if (recentlyPlayed.length > 12) {
        recentlyPlayed.pop();
    }

    var combinedStations = predefinedStations.concat(recentlyPlayed);

    combinedStations = combinedStations.filter(function(station, index, self) {
        return index === self.findIndex((t) => t.link === station.link);
    });

    localStorage.setItem('recentlyPlayed', JSON.stringify(combinedStations));

    loadRecentlyPlayed();
}

function safeParseJSON(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (e) {
        return fallback;
    }
}

function loadPreferences() {
    var savedTheme = localStorage.getItem('theme') || 'dark';
    var savedColor = localStorage.getItem('accentColor') || 'green';
    var savedStation = safeParseJSON('lastStation', {});

    setTheme(savedTheme);
    changeColor(savedColor);

    if (savedStation.name && savedStation.link) {
        audio.src = savedStation.link;
        document.getElementById('naslov').textContent = savedStation.name;
        updateSelectedStation(savedStation.name);
    }
}

function loadRecentlyPlayed() {
    var container = document.getElementById('recentlyPlayedContainer');
    
    var predefinedStations = [
        { name: 'RADIO S1', link: 'https://stream.radios.rs:9000/;*.mp3' },
        { name: 'PLAY RADIO', link: 'https://stream.playradio.rs:8443/play.mp3' },
        { name: 'HIT MUSIC FM', link: 'https://streaming.hitfm.rs/hit.mp3' }
    ];
    
    var recentlyPlayed = safeParseJSON('recentlyPlayed', []);
    
    var allStations = predefinedStations.concat(recentlyPlayed);
    allStations = allStations.filter(function(station, index, self) {
        return index === self.findIndex((t) => (
            t.link === station.link
        ));
    });

    var htmlContent = '';
    for (var i = 0; i < allStations.length; i++) {
        htmlContent += '<div class="radio" onclick="changeStation(\'' + allStations[i].name + '\', \'' + allStations[i].link + '\')">' + allStations[i].name + '</div>';
    }
    container.innerHTML = htmlContent;
    
    var savedStation = safeParseJSON('lastStation', {});
    if (savedStation.name) {
        updateSelectedStation(savedStation.name);
    }
}

function filterStations() {
    var query = document.getElementById('stationSearch').value.toLowerCase();
    var categories = document.querySelectorAll('.category-container');
    
    for (var i = 0; i < categories.length; i++) {
        var category = categories[i];
        var categoryHasVisibleStation = false;
        
        var stations = category.querySelectorAll('.radio');
        for (var j = 0; j < stations.length; j++) {
            var station = stations[j];
            var stationName = station.textContent.toLowerCase();
            var isVisible = stationName.indexOf(query) !== -1;
            station.style.display = isVisible ? 'block' : 'none';
            if (isVisible) categoryHasVisibleStation = true;
        }
        
        var categoryTitle = category.previousElementSibling;
        if (categoryTitle && categoryTitle.classList.contains('category')) {
            categoryTitle.style.display = categoryHasVisibleStation ? 'block' : 'none';
        }
        category.style.display = categoryHasVisibleStation ? 'flex' : 'none';
    }
}

var searchInput = document.getElementById('stationSearch');
var clearSearchIcon = document.getElementById('clearSearch');

searchInput.addEventListener('input', function() {
    if (searchInput.value.trim() !== "") {
        clearSearchIcon.style.display = 'block';
    } else {
        clearSearchIcon.style.display = 'none';
    }

    filterStations();
});

clearSearchIcon.addEventListener('click', function() {
    searchInput.value = '';
    clearSearchIcon.style.display = 'none';
    searchInput.focus();
    filterStations();
});

var debouncedFilterStations = debounce(filterStations, 300);
document.getElementById('stationSearch').addEventListener('input', debouncedFilterStations);

function setupDropdown() {
    var dropdownToggle = document.querySelector(".dropdown-toggle");
    var dropdownMenu = document.querySelector(".dropdown-menu");
    
    dropdownToggle.addEventListener("click", function(event) {
        event.stopPropagation();
        dropdownMenu.classList.toggle("show");
    });
    
    document.addEventListener("click", function(event) {
        if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
            dropdownMenu.classList.remove("show");
        }
    });
}

function updatePlayPauseButton() {
    playPauseBtn.innerHTML = '<span class="material-icons">' + (audio.paused ? 'play_arrow' : 'pause') + '</span>';
}

playPauseBtn.addEventListener("click", function() {
    if (audio.paused) {
        audio.play();
    } else {
        audio.pause();
    }
    updatePlayPauseButton();
});

audio.addEventListener("play", updatePlayPauseButton);
audio.addEventListener("pause", updatePlayPauseButton);

volumeSlider.addEventListener("input", function() {
    audio.volume = volumeSlider.value;
	audio.muted = audio.volume == 0;
    if (!audio.muted) {
        lastVolume = audio.volume;
    }
    updateVolumeIcon();
});

volumeIcon.addEventListener("click", function() {
	if (audio.muted) {
        audio.muted = false;
        audio.volume = lastVolume;
        volumeSlider.value = lastVolume;
    } else {
        lastVolume = audio.volume > 0 ? audio.volume : 1;
        audio.muted = true;
        volumeSlider.value = 0;
    }
    updateVolumeIcon();
});

function updateVolumeIcon() {
    if (audio.muted || audio.volume == 0) {
        volumeIcon.innerHTML = "volume_off";
		volumeSlider.value = 0;
    } else if (audio.volume < 0.5) {
        volumeIcon.innerHTML = "volume_down";
		volumeSlider.value = audio.volume;
    } else {
        volumeIcon.innerHTML = "volume_up";
		volumeSlider.value = audio.volume;
    }
}

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
