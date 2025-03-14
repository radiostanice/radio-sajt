        function changeStation(name, link) {
            var audioCtrl = document.getElementById('audioctrl');
            var naslov = document.getElementById('naslov');

			audioCtrl.pause();
            audioCtrl.src = link;
            audioCtrl.load();
            audioCtrl.play();
			
            document.querySelectorAll('.radio').forEach(el => el.classList.remove('selected'));
            event.currentTarget.classList.add('selected');
			naslov.textContent = name;

            localStorage.setItem('lastStation', JSON.stringify({ name, link }));
			
			updateRecentlyPlayed(name, link);
        }
		
		function setTheme(mode) {
			document.body.classList.remove('dark-mode', 'light-mode');
			document.body.classList.add(mode + '-mode');
			
			const accentColor = mode === 'dark' ? 'var(--accent-light)' : 'var(--accent-dark)';
			
			document.documentElement.style.setProperty('--accent-color', `var(${accentColor})`);
			
			localStorage.setItem('theme', mode);
			
			document.querySelector('.theme-icon').textContent = mode === 'dark' ? 'dark_mode' : 'light_mode';
		}
		
function changeColor(color) {
    let darkColor, lightColor;

    switch (color) {
        case 'green':
            darkColor = 'var(--green-dark)';
            lightColor = 'var(--green-light)';
            break;
        case 'blue':
            darkColor = 'var(--blue-dark)';
            lightColor = 'var(--blue-light)';
            break;
        case 'yellow':
            darkColor = 'var(--yellow-dark)';
            lightColor = 'var(--yellow-light)';
            break;
        case 'red':
            darkColor = 'var(--red-dark)';
            lightColor = 'var(--red-light)';
            break;
        default:
            darkColor = 'var(--green-dark)';
            lightColor = 'var(--green-light)';
    }

    document.documentElement.style.setProperty('--accent-dark', darkColor);
    document.documentElement.style.setProperty('--accent-light', lightColor);

    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    const accent = currentTheme === 'dark' ? lightColor : darkColor;
    document.documentElement.style.setProperty('--accent-color', accent);

    localStorage.setItem('accentColor', color);
}

document.addEventListener("DOMContentLoaded", function () {
	const dropdownToggle = document.querySelector(".dropdown-toggle");
	const dropdownMenu = document.querySelector(".dropdown-menu");
	
	dropdownToggle.addEventListener("click", function (event) {
		event.stopPropagation();
		dropdownMenu.classList.toggle("show");
	});
	
	document.addEventListener("click", function (event) {
		if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
			dropdownMenu.classList.remove("show");
		}
	});
});

function updateRecentlyPlayed(name, link) {
    let recentlyPlayed = JSON.parse(localStorage.getItem('recentlyPlayed')) || [];

    recentlyPlayed = recentlyPlayed.filter(station => station.link !== link);

    recentlyPlayed.unshift({ name, link });

    if (recentlyPlayed.length > 11) {
        recentlyPlayed.pop();
    }

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
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const savedColor = localStorage.getItem('accentColor') || 'green';
    const savedStation = safeParseJSON('lastStation', {});

    setTheme(savedTheme);
    changeColor(savedColor);

    if (savedStation.name && savedStation.link) {
        document.getElementById('audioctrl').src = savedStation.link;
        document.getElementById('naslov').textContent = savedStation.name;

        document.querySelectorAll('.radio').forEach(el => {
            if (el.textContent === savedStation.name) el.classList.add('selected');
        });
    }
}

function loadRecentlyPlayed() {
    let recentlyPlayed = safeParseJSON('recentlyPlayed', []);
    let container = document.getElementById('recentlyPlayedContainer');

    const predefinedStations = [
        { name: 'RADIO S1', link: 'https://stream.radios.rs:9000/;*.mp3' },
        { name: 'PLAY RADIO', link: 'https://stream.playradio.rs:8443/play.mp3' },
        { name: 'HIT MUSIC FM', link: 'https://streaming.hitfm.rs/hit.mp3' }
    ];

    let filteredRecentlyPlayed = recentlyPlayed.filter(
        station => !predefinedStations.some(pre => pre.link === station.link)
    );

    container.innerHTML = predefinedStations.concat(filteredRecentlyPlayed)
        .map(station => `<div class="radio" onclick="changeStation('${station.name}', '${station.link}')">${station.name}</div>`)
        .join('');
}
		
function filterStations() {
    const query = document.getElementById('stationSearch').value.toLowerCase();

    document.querySelectorAll('.category-container').forEach(category => {
        let categoryHasVisibleStation = false;

        category.querySelectorAll('.radio').forEach(station => {
            const stationName = station.textContent.toLowerCase();
            if (stationName.includes(query)) {
                station.style.display = 'block';
                categoryHasVisibleStation = true;
            } else {
                station.style.display = 'none';
            }
        });

        const categoryTitle = category.previousElementSibling;
        if (categoryHasVisibleStation) {
            category.style.display = 'flex';
            if (categoryTitle && categoryTitle.classList.contains('category')) {
                categoryTitle.style.display = 'block';
            }
        } else {
            category.style.display = 'none';
            if (categoryTitle && categoryTitle.classList.contains('category')) {
                categoryTitle.style.display = 'none';
            }
        }
    });
}

document.getElementById('audioctrl').addEventListener('error', function() {
	alert("Trenutno nije moguce pustiti ovu radio stanicu.");
});

document.addEventListener("DOMContentLoaded", loadPreferences);
document.addEventListener('DOMContentLoaded', loadRecentlyPlayed);

document.addEventListener('DOMContentLoaded', function () {
    let selectedStationName = localStorage.getItem('selectedStation');

    function applySelection() {
        document.querySelectorAll('.radio').forEach(el => {
            el.classList.remove('selected');
            if (el.textContent.trim() === selectedStationName) {
                el.classList.add('selected');
            }
        });
    }

    document.body.addEventListener('click', function (event) {
        let clickedStation = event.target.closest('.radio');
        if (!clickedStation) return;

        selectedStationName = clickedStation.textContent.trim();
        localStorage.setItem('selectedStation', selectedStationName);

        applySelection();
    });

    const observer = new MutationObserver(applySelection);
    const stationContainer = document.querySelector('.category-container'); 
    if (stationContainer) {
        observer.observe(stationContainer, { childList: true, subtree: true });
    }

    applySelection();
});

function debounce(func, delay) {
	let timeout;
	return function (...args) {
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(this, args), delay);
	};
}

const debouncedFilterStations = debounce(filterStations, 300);
document.getElementById('stationSearch').addEventListener('input', debouncedFilterStations);