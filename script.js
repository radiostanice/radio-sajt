document.addEventListener("DOMContentLoaded", function() {
    loadPreferences();
    loadRecentlyPlayed();
    setupDropdown();
});

function changeStation(name, link) {
    var audioCtrl = document.getElementById('audioctrl');
    var naslov = document.getElementById('naslov');
    
    audioCtrl.pause();
    audioCtrl.src = link;
    audioCtrl.load();
    audioCtrl.play();
    
    localStorage.setItem('lastStation', JSON.stringify({ name: name, link: link }));
    updateRecentlyPlayed(name, link);
    updateSelectedStation(name);
}

function updateSelectedStation(name) {
    var radios = document.querySelectorAll('.radio');
    Array.prototype.forEach.call(radios, function(el) {
        el.classList.remove('selected');
        if (el.textContent.trim() === name) {
            el.classList.add('selected');
        }
    });
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
    recentlyPlayed = recentlyPlayed.filter(function(station) {
        return station.link !== link;
    });
    recentlyPlayed.unshift({ name: name, link: link });
    
    if (recentlyPlayed.length > 11) recentlyPlayed.pop();
    
    localStorage.setItem('recentlyPlayed', JSON.stringify(recentlyPlayed));
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
        document.getElementById('audioctrl').src = savedStation.link;
        document.getElementById('naslov').textContent = savedStation.name;
        updateSelectedStation(savedStation.name);
    }
}

function loadRecentlyPlayed() {
    var container = document.getElementById('recentlyPlayedContainer');
    var recentlyPlayed = safeParseJSON('recentlyPlayed', []);
    
    var predefinedStations = [
        { name: 'RADIO S1', link: 'https://stream.radios.rs:9000/;*.mp3' },
        { name: 'PLAY RADIO', link: 'https://stream.playradio.rs:8443/play.mp3' },
        { name: 'HIT MUSIC FM', link: 'https://streaming.hitfm.rs/hit.mp3' }
    ];
    
    var filteredRecentlyPlayed = recentlyPlayed.filter(function(station) {
        return !predefinedStations.some(function(pre) { return pre.link === station.link; });
    });
    
    container.innerHTML = predefinedStations.concat(filteredRecentlyPlayed).map(function(station) {
        return '<div class="radio" onclick="changeStation(\'' + station.name + '\', \'' + station.link + '\')">' + station.name + '</div>';
    }).join('');
    
    var savedStation = safeParseJSON('lastStation', {});
    if (savedStation.name) {
        updateSelectedStation(savedStation.name);
    }
}

function filterStations() {
    var query = document.getElementById('stationSearch').value.toLowerCase();
    var categories = document.querySelectorAll('.category-container');
    
    Array.prototype.forEach.call(categories, function(category) {
        var categoryHasVisibleStation = false;
        
        var stations = category.querySelectorAll('.radio');
        Array.prototype.forEach.call(stations, function(station) {
            var stationName = station.textContent.toLowerCase();
            var isVisible = stationName.indexOf(query) !== -1;
            station.style.display = isVisible ? 'block' : 'none';
            if (isVisible) categoryHasVisibleStation = true;
        });
        
        var categoryTitle = category.previousElementSibling;
        if (categoryTitle && categoryTitle.classList.contains('category')) {
            categoryTitle.style.display = categoryHasVisibleStation ? 'block' : 'none';
        }
        category.style.display = categoryHasVisibleStation ? 'flex' : 'none';
    });
}

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

const audio = document.getElementById("audioctrl");
const playPauseBtn = document.getElementById("playPauseBtn");
const volumeSlider = document.getElementById("volumeSlider");

playPauseBtn.addEventListener("click", () => {
    if (audio.paused) {
        audio.play();
        playPauseBtn.innerHTML = '<span class="material-icons">pause</span>';
    } else {
        audio.pause();
        playPauseBtn.innerHTML = '<span class="material-icons">play_arrow</span>';
    }
});

volumeSlider.addEventListener("input", () => {
    audio.volume = volumeSlider.value;
});

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