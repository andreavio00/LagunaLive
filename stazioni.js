const NETATMO_URL =
  "https://netatmo-worker.andrea-vio.workers.dev/netatmo/selected?includeOptional=1";
const WEATHERCLOUD_URL =
  "https://weathercloude-worker.andrea-vio.workers.dev/weathercloud/selected";
const WUNDERGROUND_URL =
  "https://weathercloude-worker.andrea-vio.workers.dev/wunderground/selected";

const SOURCE_CACHE_PREFIX = "lagunalive-amateur-source-cache-v1-";
const SOURCE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// La barra della temperatura percepita riprende il linguaggio visivo di
// PozzaLive. Il range e' leggermente adattato al clima di Venezia: copre
// senza schiacciare la scala sia le giornate fredde sia l'afa estiva.
const COMFORT_MIN = -5;
const COMFORT_MAX = 40;

const SOURCES = [
  { id: "netatmo", label: "Netatmo", url: NETATMO_URL },
  { id: "weathercloud", label: "Weathercloud", url: WEATHERCLOUD_URL },
  { id: "wunderground", label: "Weather Underground", url: WUNDERGROUND_URL }
];

const keyOf = (source, id) => `${source}|${id}`;

const GROUPS = [
  {
    id: "cannaregio",
    title: "Cannaregio",
    shortTitle: "Cannaregio",
    areaClass: "area-cannaregio",
    keys: [
      keyOf("wunderground", "IVENIC160"),
      keyOf("weathercloud", "2414314087"),
      keyOf("netatmo", "70:ee:50:3e:ee:22"),
      keyOf("netatmo", "70:ee:50:a4:41:c6")
    ]
  },
  {
    id: "murano",
    title: "Murano",
    shortTitle: "Murano",
    areaClass: "area-murano",
    keys: [
      keyOf("weathercloud", "2591958863"),
      keyOf("weathercloud", "2361312782"),
      keyOf("netatmo", "70:ee:50:af:81:0c")
    ]
  },
  {
    id: "centro-storico",
    title: "Venezia centro",
    shortTitle: "Venezia centro",
    areaClass: "area-center",
    keys: [
      keyOf("netatmo", "70:ee:50:2b:02:64"),
      keyOf("netatmo", "70:ee:50:c3:8f:28"),
      keyOf("netatmo", "70:ee:50:bf:7e:5a"),
      keyOf("netatmo", "70:ee:50:af:3d:96")
    ]
  },
  {
    id: "laguna",
    title: "Laguna e litorale",
    shortTitle: "Laguna",
    areaClass: "area-lagoon",
    keys: [
      keyOf("netatmo", "70:ee:50:af:5a:52"),
      keyOf("weathercloud", "9454656179"),
      keyOf("netatmo", "70:ee:50:2a:dd:e8"),
      keyOf("weathercloud", "8414577935"),
      keyOf("netatmo", "70:ee:50:b4:e8:0a")
    ]
  },
  {
    id: "sentinella",
    title: "Sentinella terraferma",
    shortTitle: "Sentinella",
    areaClass: "area-sentinel",
    keys: [keyOf("netatmo", "70:ee:50:b5:49:38")]
  }
];

const QUALITY_NOTES = {
  [keyOf("wunderground", "IVENIC160")]:
    "Stazione di Sant’Alvise, presso la palestra dell’ex Ospedale Umberto I: riferimento locale principale per Cannaregio nord-ovest.",
  [keyOf("netatmo", "70:ee:50:a4:41:c6")]:
    "Molto vicina a Santa Caterina e priva di pluviometro: utile soprattutto per confrontare temperatura e umidità a Cannaregio.",
  [keyOf("netatmo", "70:ee:50:c3:8f:28")]:
    "Copre Santa Croce; non dispone di pluviometro né anemometro, ma completa il confronto di temperatura e umidità nel centro storico.",
  [keyOf("weathercloud", "2361312782")]:
    "Stazione di confronto per Murano: verificare la coerenza della pioggia con TcMurano durante gli eventi.",
  [keyOf("netatmo", "70:ee:50:af:81:0c")]:
    "Completa Murano soprattutto per vento e raffica; non dispone del pluviometro.",
  [keyOf("netatmo", "70:ee:50:2a:dd:e8")]:
    "Al momento rende disponibili soltanto temperatura e umidità.",
  [keyOf("netatmo", "70:ee:50:b4:e8:0a")]:
    "Copertura geografica preziosa, ma lo storico recente è discontinuo.",
  [keyOf("weathercloud", "8414577935")]:
    "Secondaria rispetto alla stazione ufficiale del Lido; utile per il dettaglio locale.",
  [keyOf("netatmo", "70:ee:50:b5:49:38")]:
    "Non rappresenta Venezia insulare: serve soltanto come possibile segnale di un fronte in arrivo da ovest o nord-ovest."
};

// Nomi brevi per la vista compatta: il gruppo indica gia' la zona,
// quindi non serve ripeterla su ogni scheda.
const SHORT_NAMES = {
  [keyOf("wunderground", "IVENIC160")]: "S. Alvise",
  [keyOf("weathercloud", "2414314087")]: "F.te Nove",
  [keyOf("netatmo", "70:ee:50:3e:ee:22")]: "S. Caterina",
  [keyOf("netatmo", "70:ee:50:a4:41:c6")]: "Le Vele",
  [keyOf("weathercloud", "2591958863")]: "TcMurano",
  [keyOf("weathercloud", "2361312782")]: "MeteoLazza",
  [keyOf("netatmo", "70:ee:50:af:81:0c")]: "Serenella",
  [keyOf("netatmo", "70:ee:50:af:5a:52")]: "Torcello",
  [keyOf("netatmo", "70:ee:50:2a:dd:e8")]: "Burano",
  [keyOf("weathercloud", "9454656179")]: "Malamocco",
  [keyOf("weathercloud", "8414577935")]: "Lido centro",
  [keyOf("netatmo", "70:ee:50:b4:e8:0a")]: "Pellestrina",
  [keyOf("netatmo", "70:ee:50:af:3d:96")]: "S. Margherita",
  [keyOf("netatmo", "70:ee:50:bf:7e:5a")]: "Calle dei Fabbri",
  [keyOf("netatmo", "70:ee:50:2b:02:64")]: "Campo della Tana",
  [keyOf("netatmo", "70:ee:50:c3:8f:28")]: "Frari",
  [keyOf("netatmo", "70:ee:50:b5:49:38")]: "Rododendri"
};

const ROLE_LABELS = {
  principale: "Principale",
  supporto: "Supporto",
  sperimentale: "Sperimentale",
  sentinella: "Sentinella"
};

// Mantiene ruolo e ordinamento corretti anche quando una fonte è assente
// e la pagina deve costruire temporaneamente una scheda senza valori.
const PLACEHOLDER_METADATA = {
  [keyOf("wunderground", "IVENIC160")]: ["principale", 0.5],
  [keyOf("weathercloud", "2414314087")]: ["principale", 1],
  [keyOf("netatmo", "70:ee:50:3e:ee:22")]: ["supporto", 2],
  [keyOf("netatmo", "70:ee:50:a4:41:c6")]: ["supporto", 2.5],
  [keyOf("weathercloud", "2591958863")]: ["principale", 3],
  [keyOf("weathercloud", "2361312782")]: ["supporto", 4],
  [keyOf("netatmo", "70:ee:50:af:81:0c")]: ["supporto", 5],
  [keyOf("netatmo", "70:ee:50:af:5a:52")]: ["principale", 6],
  [keyOf("netatmo", "70:ee:50:2a:dd:e8")]: ["supporto", 7],
  [keyOf("netatmo", "70:ee:50:b4:e8:0a")]: ["sperimentale", 8],
  [keyOf("weathercloud", "9454656179")]: ["principale", 9],
  [keyOf("weathercloud", "8414577935")]: ["supporto", 10],
  [keyOf("netatmo", "70:ee:50:af:3d:96")]: ["principale", 11],
  [keyOf("netatmo", "70:ee:50:bf:7e:5a")]: ["principale", 12],
  [keyOf("netatmo", "70:ee:50:2b:02:64")]: ["principale", 13],
  [keyOf("netatmo", "70:ee:50:c3:8f:28")]: ["supporto", 13.5],
  [keyOf("netatmo", "70:ee:50:b5:49:38")]: ["sentinella", 15]
};

const state = {
  stations: [],
  sourceErrors: [],
  loadedAt: null
};

const stationGroups = document.getElementById("stationGroups");
const zoneNav = document.getElementById("zoneNav");
const overviewCount = document.getElementById("overviewCount");
const overviewTime = document.getElementById("overviewTime");
const refreshButton = document.getElementById("refreshButton");
const sourceWarning = document.getElementById("sourceWarning");
const stationModalOverlay = document.getElementById("stationModalOverlay");
const stationModal = stationModalOverlay.querySelector(".station-modal");
const stationModalTitle = document.getElementById("stationModalTitle");
const stationModalSubtitle = document.getElementById("stationModalSubtitle");
const stationModalBody = document.getElementById("stationModalBody");
const stationModalClose = document.getElementById("stationModalClose");
let lastModalTrigger = null;

async function fetchStationList(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let response;

  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();

  if (!Array.isArray(payload) || !payload.length) {
    throw new Error("Risposta non valida");
  }

  return payload;
}

async function loadStations({ manual = false } = {}) {
  refreshButton.disabled = true;
  refreshButton.textContent = manual ? "Aggiornamento…" : "↻ Aggiorna";

  if (!state.stations.length) {
    stationGroups.innerHTML =
      '<div class="loading-card">Caricamento delle stazioni…</div>';
  }

  const results = await Promise.allSettled(
    SOURCES.map((source) => fetchStationList(source.url))
  );

  const loaded = [];
  const errors = [];

  results.forEach((result, index) => {
    const source = SOURCES[index];

    if (result.status === "fulfilled") {
      loaded.push(...result.value);
      saveSourceCache(source.id, result.value);

      if (result.value.some((station) => station.sourceFallback)) {
        errors.push(
          `${source.label}: sono mostrati gli ultimi dati validi conservati.`
        );
      }
    } else {
      const savedStations = readSourceCache(source.id);
      const currentStations = state.stations.filter(
        (station) => station.source === source.id && !station.sourcePlaceholder
      );
      const fallbackStations = savedStations.length
        ? savedStations
        : currentStations;
      const reason = friendlyErrorReason(
        result.reason?.message || "errore sconosciuto"
      );

      if (fallbackStations.length) {
        loaded.push(...markSourceFallback(fallbackStations));
        errors.push(
          `${source.label}: ${reason}. Sono mostrati gli ultimi dati salvati.`
        );
      } else {
        loaded.push(...buildSourcePlaceholders(source));
        errors.push(
          `${source.label}: ${reason}. Le schede restano visibili senza valori.`
        );
      }
    }
  });

  if (!loaded.length) {
    stationGroups.innerHTML =
      '<div class="empty-card">Non è stato possibile caricare le stazioni. Riprova tra qualche minuto.</div>';
    overviewCount.textContent = "Dati non disponibili";
    overviewTime.textContent = "";
    showSourceErrors(errors);
    refreshButton.disabled = false;
    refreshButton.textContent = "↻ Riprova";
    return;
  }

  state.stations = loaded
    .map(normalizeStation)
    .sort((a, b) => a.networkOrder - b.networkOrder);
  state.sourceErrors = errors;
  state.loadedAt = new Date();
  renderPage();

  refreshButton.disabled = false;
  refreshButton.textContent = "↻ Aggiorna";
}

function normalizeStation(station) {
  const source = String(station.source || "").toLowerCase();
  const windFactor = source === "weathercloud" ? 3.6 : 1;
  const ageMinutes = calculateAgeMinutes(station);

  return {
    ...station,
    source,
    key: keyOf(source, station.id),
    networkOrder: numberOrNull(station.networkOrder) ?? 999,
    ageMinutes,
    stale: Boolean(station.stale) || (ageMinutes !== null && ageMinutes > 90),
    temp: numberOrNull(station.temp),
    humidity: numberOrNull(station.humidity),
    dewPoint: numberOrNull(station.dewPoint),
    heatIndex: numberOrNull(station.heatIndex),
    windChill: numberOrNull(station.windChill),
    thw: numberOrNull(station.thw),
    pressure: numberOrNull(station.pressure),
    rainRate: numberOrNull(station.rainLive ?? station.rainRate),
    rain60min: numberOrNull(station.rain60min),
    rainAccum: numberOrNull(station.rain24h ?? station.rain),
    windKmh: multiplyOrNull(station.windSpeed, windFactor),
    gustKmh: multiplyOrNull(station.windGust, windFactor),
    windDir: numberOrNull(station.windDir),
    altitude: numberOrNull(station.altitude),
    lat: numberOrNull(station.lat),
    lon: numberOrNull(station.lon)
  };
}

function isUnavailable(station) {
  return !station || Boolean(station.error) || Boolean(station.stale);
}

function renderPage() {
  renderNavigation();

  const renderedGroups = GROUPS
    .map(renderGroup)
    .filter(Boolean)
    .join("");

  stationGroups.innerHTML = renderedGroups ||
    '<div class="empty-card">Nessuna stazione disponibile.</div>';

  const total = state.stations.length;
  const staleCount = state.stations.filter(isUnavailable).length;
  const staleLabel = staleCount === 1
    ? " · 1 non aggiornata"
    : staleCount > 1
      ? ` · ${staleCount} non aggiornate`
      : "";

  overviewCount.textContent =
    `${total} stazioni${staleLabel}`;

  overviewTime.textContent = state.loadedAt
    ? `Ultimo controllo alle ${formatClock(state.loadedAt)}`
    : "";

  showSourceErrors(state.sourceErrors);
}

function renderNavigation() {
  const availableKeys = new Set(state.stations.map((station) => station.key));

  zoneNav.innerHTML = GROUPS
    .filter((group) => group.keys.some((key) => availableKeys.has(key)))
    .map(
      (group) =>
        `<a class="zone-link" href="#group-${escapeHtml(group.id)}">${escapeHtml(group.shortTitle)}</a>`
    )
    .join("");
}

function renderGroup(group) {
  const groupStations = group.keys
    .map((key) => state.stations.find((station) => station.key === key))
    .filter(Boolean);

  if (!groupStations.length) return "";

  return `
    <section class="station-group ${escapeHtml(group.areaClass)}" id="group-${escapeHtml(group.id)}">
      <div class="group-header">
        <h2>${escapeHtml(group.title)}</h2>
        <span class="group-count">${groupStations.length} stazioni</span>
      </div>
      <div class="station-grid">
        ${groupStations.map(renderStationCard).join("")}
      </div>
      ${groupStations.length > 2
        ? '<div class="station-swipe-hint" aria-hidden="true">Scorri per le altre stazioni →</div>'
        : ""}
    </section>
  `;
}

function groupForStation(stationKey) {
  return GROUPS.find((group) => group.keys.includes(stationKey)) || null;
}

function renderStationCard(station) {
  const role = ROLE_LABELS[station.networkRole] || "Stazione";
  const roleClass = ROLE_LABELS[station.networkRole]
    ? station.networkRole
    : "supporto";
  const sourceMeta = sourceInfo(station);
  const freshness = freshnessInfo(station);
  const shortName = stationShortName(station);

  return `
    <article class="station-card role-${escapeHtml(roleClass)} ${station.error ? "station-error" : ""}" aria-label="${escapeHtml(shortName)}">
      <div class="station-head">
        <h3 title="${escapeHtml(shortName)}">${escapeHtml(shortName)}</h3>
        <span class="badge badge-source-${escapeHtml(sourceMeta.className)}">${escapeHtml(sourceMeta.label)}</span>
      </div>

      <div class="primary-readings">
        <span class="primary-temperature">${escapeHtml(formatCompactTemperature(station.temp))}</span>
        <span class="primary-humidity">💧 ${escapeHtml(formatCompactHumidity(station.humidity))}</span>
      </div>

      <div class="station-meta">
        <span class="freshness"><i class="fresh-dot ${freshness.className}"></i>${escapeHtml(freshness.label)}</span>
        <span class="station-role">${escapeHtml(role)}</span>
      </div>

      <button class="details-toggle" type="button" data-station-details="${escapeHtml(station.key)}">
        Dettagli
      </button>
    </article>
  `;
}

function sourceInfo(station) {
  return {
    netatmo: { label: "Netatmo", className: "netatmo" },
    weathercloud: { label: "Weathercloud", className: "weathercloud" },
    wunderground: { label: "W. Underground", className: "wunderground" }
  }[station.source] || { label: station.source || "Fonte", className: "other" };
}

function stationShortName(station) {
  return SHORT_NAMES[station.key] || station.displayName || station.name || station.id;
}

function formatCompactTemperature(value) {
  return value === null ? "—" : `${formatNumber(value, 1)}°`;
}

function formatCompactHumidity(value) {
  return value === null ? "—" : `${formatNumber(value, 0)}%`;
}

function apparentTemperature(station) {
  if (station.thw !== null) return station.thw;
  if (station.temp === null) return null;

  // Quando la centralina fornisce un indice specifico, gli si da'
  // precedenza nel campo in cui e' significativo.
  if (station.temp >= 27 && station.heatIndex !== null) {
    return station.heatIndex;
  }

  if (station.temp <= 10 && station.windChill !== null) {
    return station.windChill;
  }

  // Apparent Temperature di Steadman, in ombra. Se manca il vento si usa
  // l'indice calore semplificato gia' adottato nella home di LagunaLive.
  if (station.humidity !== null && station.windKmh !== null) {
    const vapourPressure =
      (station.humidity / 100) *
      6.105 *
      Math.exp((17.27 * station.temp) / (237.7 + station.temp));

    return station.temp + 0.33 * vapourPressure - 0.70 * (station.windKmh / 3.6) - 4;
  }

  if (station.humidity !== null) {
    return humidityHeatIndex(station.temp, station.humidity);
  }

  return station.temp;
}

// Formula Rothfusz/NWS, uguale a quella della home di LagunaLive. Serve
// soprattutto alle Netatmo senza anemometro: in estate la regressione
// completa evita di sottostimare l'afa rispetto alla formula breve.
function humidityHeatIndex(tempC, humidity) {
  const fahrenheit = tempC * 9 / 5 + 32;

  if (tempC < 27) {
    const simpleFahrenheit =
      0.5 *
      (fahrenheit +
        61 +
        (fahrenheit - 68) * 1.2 +
        humidity * 0.094);
    const simpleCelsius = (simpleFahrenheit - 32) * 5 / 9;

    return humidity < 40
      ? Math.max(simpleCelsius, tempC)
      : simpleCelsius;
  }

  const heatIndexFahrenheit =
    -42.389 +
    2.04901523 * fahrenheit +
    10.14333127 * humidity -
    0.22475541 * fahrenheit * humidity -
    0.00683783 * fahrenheit * fahrenheit -
    0.05481717 * humidity * humidity +
    0.00122874 * fahrenheit * fahrenheit * humidity +
    0.00085282 * fahrenheit * humidity * humidity -
    0.00000199 * fahrenheit * fahrenheit * humidity * humidity;
  const heatIndexCelsius = (heatIndexFahrenheit - 32) * 5 / 9;

  return humidity < 40
    ? Math.max(heatIndexCelsius, tempC)
    : heatIndexCelsius;
}

function temperatureScalePercent(value) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(
    0,
    Math.min(100, ((value - COMFORT_MIN) / (COMFORT_MAX - COMFORT_MIN)) * 100)
  );
}

function mixRgb(first, second, amount) {
  return first.map((channel, index) =>
    Math.round(channel + (second[index] - channel) * amount)
  );
}

function temperatureColour(percent) {
  if (percent === null) return "#9ca6af";

  const cold = [79, 131, 201];
  const comfortable = [90, 166, 106];
  const hot = [207, 90, 68];
  const colour = percent <= 50
    ? mixRgb(cold, comfortable, percent / 50)
    : mixRgb(comfortable, hot, (percent - 50) / 50);

  return `rgb(${colour.join(",")})`;
}

function comfortLabel(value) {
  if (value === null || !Number.isFinite(value)) return "Dato n.d.";
  if (value < 5) return "Freddo";
  if (value < 13) return "Fresco";
  if (value < 22) return "Confortevole";
  if (value < 27) return "Caldo";
  if (value < 32) return "Afoso";
  return "Afa intensa";
}

function renderTemperatureScale(station) {
  const apparent = apparentTemperature(station);
  const percent = temperatureScalePercent(apparent);
  const colour = temperatureColour(percent);
  const markerStyle = percent === null
    ? "display:none"
    : `left:${percent.toFixed(1)}%;border-color:${colour}`;

  return `
    <div class="temperature-scale">
      <div class="temperature-scale-heading">
        <span>Temperatura percepita</span>
        <strong>${apparent === null ? "—" : `${formatNumber(apparent, 1)}°`}</strong>
      </div>
      <div class="temperature-scale-row">
        <div class="temperature-scale-track">
          <i class="temperature-scale-marker" style="${markerStyle}"></i>
        </div>
        <span class="temperature-scale-label" style="color:${colour}">${comfortLabel(apparent)}</span>
      </div>
    </div>
  `;
}

function renderMetric(icon, label, value, wide = false) {
  if (value === null) return "";

  return `
    <div class="station-metric${wide ? " station-metric-wide" : ""}">
      <span class="station-metric-icon" aria-hidden="true">${icon}</span>
      <span class="station-metric-copy">
        <small>${escapeHtml(label)}</small>
        <strong>${escapeHtml(value)}</strong>
      </span>
    </div>
  `;
}

function renderDetails(station) {
  const direction = formatWindDirection(station.windDir);
  const wind = formatUnit(station.windKmh, "km/h", 1);
  const windWithDirection = wind === null
    ? direction
    : direction === null
      ? wind
      : `${wind} · ${direction}`;

  const metrics = [
    renderMetric("🌡️", "Punto di rugiada", formatTemperature(station.dewPoint)),
    renderMetric("⏲️", "Pressione", formatUnit(station.pressure, "hPa", 1)),
    renderMetric("💨", "Vento", windWithDirection),
    renderMetric("🌬️", "Raffica", formatUnit(station.gustKmh, "km/h", 1)),
    renderMetric("🌧️", "Intensità pioggia", formatUnit(station.rainRate, "mm/h", 2)),
    renderMetric("☔", "Pioggia ultima ora", formatUnit(station.rain60min, "mm", 2)),
    renderMetric("🌦️", "Pioggia accumulata", formatUnit(station.rainAccum, "mm", 2)),
    renderMetric("⛰️", "Quota", formatUnit(station.altitude, "m", 0)),
    renderMetric("📍", "Coordinate", formatCoordinates(station.lat, station.lon), true)
  ].filter(Boolean);

  if (!metrics.length) {
    return '<div class="station-metrics-empty">Altri dati non disponibili</div>';
  }

  return metrics.join("");
}

function renderModalFreshness(station) {
  const freshness = freshnessInfo(station);
  const dateTime = formatDateTime(station.updatedAt);
  const text = dateTime === null
    ? "Ora dell’ultimo dato non disponibile"
    : `Ultimo dato: ${dateTime} · ${freshness.label}`;

  return `
    <div class="station-modal-time ${freshness.className}">
      <i class="fresh-dot ${freshness.className}"></i>
      <span>${escapeHtml(text)}</span>
    </div>
  `;
}

function renderStationStatus(station) {
  if (station.error) {
    return `<div class="station-alert error">${escapeHtml(friendlyStationError(station.error))}</div>`;
  }

  if (station.sourceFallback) {
    return '<div class="station-alert">Ultimo dato salvato: la fonte è temporaneamente non disponibile.</div>';
  }

  if (station.stale) {
    return '<div class="station-alert">Dato non recente: confrontare con un’altra stazione della zona.</div>';
  }

  return "";
}

function friendlyErrorReason(value) {
  const message = String(value || "").trim();

  if (/aborted|aborterror/i.test(message)) {
    return "tempo di risposta scaduto";
  }

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "errore di collegamento";
  }

  return message || "errore sconosciuto";
}

function friendlyStationError(value) {
  const reason = friendlyErrorReason(value);

  if (reason === "tempo di risposta scaduto") {
    return "La risposta non è arrivata: la stazione è temporaneamente non disponibile.";
  }

  if (reason === "errore di collegamento") {
    return "Collegamento non riuscito: la stazione è temporaneamente non disponibile.";
  }

  if (/^HTTP \d{3}$/i.test(reason)) {
    return `Dati temporaneamente non disponibili (${reason.toUpperCase()}).`;
  }

  return reason;
}

function openStationModal(stationKey, trigger) {
  const station = state.stations.find((item) => item.key === stationKey);
  if (!station) return;

  const role = ROLE_LABELS[station.networkRole] || "Stazione";
  const source = sourceInfo(station).label;
  const freshness = freshnessInfo(station).label;
  const qualityNote = QUALITY_NOTES[station.key];
  const group = groupForStation(station.key);

  lastModalTrigger = trigger || null;
  stationModal.dataset.area = group?.id || "default";
  stationModalTitle.textContent = stationShortName(station);
  stationModalSubtitle.textContent = `${source} · ${role} · ${freshness}`;
  stationModalBody.innerHTML = `
    ${renderStationStatus(station)}
    <div class="station-modal-primary">
      <span class="station-modal-temperature">${escapeHtml(formatCompactTemperature(station.temp))}</span>
      <span class="station-modal-humidity">💧 ${escapeHtml(formatCompactHumidity(station.humidity))}</span>
    </div>
    ${renderTemperatureScale(station)}
    <div class="station-modal-readings">${renderDetails(station)}</div>
    ${renderModalFreshness(station)}
    ${qualityNote
      ? `<p class="quality-note">${escapeHtml(qualityNote)}</p>`
      : ""}
    ${station.mapUrl
      ? `<a class="source-link" href="${safeUrl(station.mapUrl)}" target="_blank" rel="noopener">Apri la pagina originale ↗</a>`
      : ""}
  `;

  stationModalOverlay.classList.add("open");
  stationModalOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("station-modal-open");
  stationModalClose.focus();
}

function closeStationModal() {
  stationModalOverlay.classList.remove("open");
  stationModalOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("station-modal-open");
  lastModalTrigger?.focus();
  lastModalTrigger = null;
}

function freshnessInfo(station) {
  if (station.error) {
    return { className: "old", label: "non disponibile" };
  }

  const age = numberOrNull(station.ageMinutes);

  if (age === null) {
    return { className: "unknown", label: "ora n.d." };
  }

  if (station.stale || age > 90) {
    return { className: "old", label: `${age} min fa` };
  }

  if (age <= 30) {
    return {
      className: "fresh",
      label: age <= 1 ? "adesso" : `${age} min fa`
    };
  }

  return { className: "aging", label: `${age} min fa` };
}

function showSourceErrors(errors) {
  if (!errors.length) {
    sourceWarning.classList.remove("visible");
    sourceWarning.textContent = "";
    return;
  }

  const subject = errors.length === 1
    ? "Una fonte è temporaneamente non disponibile."
    : "Alcune fonti sono temporaneamente non disponibili.";

  sourceWarning.textContent =
    `${subject} Le altre continuano ad aggiornarsi. ${errors.join(" · ")}`;
  sourceWarning.classList.add("visible");
}

function saveSourceCache(sourceId, stations) {
  try {
    localStorage.setItem(
      `${SOURCE_CACHE_PREFIX}${sourceId}`,
      JSON.stringify({ savedAt: Date.now(), stations })
    );
  } catch {
    // La pagina continua a funzionare anche se lo spazio locale è disattivato.
  }
}

function readSourceCache(sourceId) {
  const storageKey = `${SOURCE_CACHE_PREFIX}${sourceId}`;

  try {
    const cached = JSON.parse(localStorage.getItem(storageKey) || "null");
    const savedAt = numberOrNull(cached?.savedAt);

    if (
      savedAt === null ||
      Date.now() - savedAt > SOURCE_CACHE_MAX_AGE_MS ||
      !Array.isArray(cached?.stations) ||
      !cached.stations.length
    ) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignora: la cache locale può essere bloccata dal browser.
      }
      return [];
    }

    return cached.stations;
  } catch {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignora: la pagina userà le schede segnaposto.
    }
    return [];
  }
}

function markSourceFallback(stations) {
  return stations.map((station) => ({
    ...station,
    sourceFallback: true,
    stale: true
  }));
}

function buildSourcePlaceholders(source) {
  const configuredKeys = [...new Set(GROUPS.flatMap((group) => group.keys))];

  return configuredKeys
    .filter((key) => key.startsWith(`${source.id}|`))
    .map((key, index) => {
      const id = key.slice(key.indexOf("|") + 1);
      const name = SHORT_NAMES[key] || id;
      const [networkRole, networkOrder] = PLACEHOLDER_METADATA[key] || [
        "supporto",
        900 + index
      ];

      return {
        id,
        source: source.id,
        name,
        displayName: name,
        networkRole,
        networkOrder,
        stale: true,
        sourcePlaceholder: true,
        error: `${source.label}: dati temporaneamente non disponibili`
      };
    });
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function calculateAgeMinutes(station) {
  const reportedAge = numberOrNull(station.ageMinutes);
  const updatedAt = numberOrNull(station.updatedAt);

  if (updatedAt === null) return reportedAge;

  const elapsedAge = Math.max(0, Math.floor((Date.now() - updatedAt) / 60000));
  return reportedAge === null ? elapsedAge : Math.max(reportedAge, elapsedAge);
}

function multiplyOrNull(value, factor) {
  const number = numberOrNull(value);
  return number === null ? null : number * factor;
}

function formatTemperature(value) {
  return value === null ? null : `${formatNumber(value, 1)} °C`;
}

function formatUnit(value, unit, decimals) {
  return value === null ? null : `${formatNumber(value, decimals)} ${unit}`;
}

function formatNumber(value, maximumFractionDigits) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits
  }).format(value);
}

function formatClock(date) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatDateTime(epochMs) {
  const numeric = numberOrNull(epochMs);
  if (numeric === null) return null;

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome"
  }).format(new Date(numeric));
}

function formatCoordinates(lat, lon) {
  if (lat === null || lon === null) return null;
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function formatWindDirection(degrees) {
  if (degrees === null) return null;
  const directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return `${directions[index]} · ${Math.round(normalized)}°`;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol)
      ? escapeHtml(url.toString())
      : "#";
  } catch {
    return "#";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

refreshButton.addEventListener("click", () => {
  loadStations({ manual: true });
});

stationGroups.addEventListener("click", (event) => {
  const detailsButton = event.target.closest("[data-station-details]");

  if (detailsButton) {
    openStationModal(detailsButton.dataset.stationDetails, detailsButton);
  }
});

stationModalClose.addEventListener("click", closeStationModal);

stationModalOverlay.addEventListener("click", (event) => {
  if (event.target === stationModalOverlay) closeStationModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && stationModalOverlay.classList.contains("open")) {
    closeStationModal();
  }
});

loadStations();
setInterval(loadStations, REFRESH_INTERVAL_MS);
