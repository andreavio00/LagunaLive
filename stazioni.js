const NETATMO_URL =
  "https://netatmo-worker.andrea-vio.workers.dev/netatmo/selected?includeOptional=1";
const WEATHERCLOUD_URL =
  "https://weathercloude-worker.andrea-vio.workers.dev/weathercloud/selected";
const WUNDERGROUND_URL =
  "https://weathercloude-worker.andrea-vio.workers.dev/wunderground/selected";

const VIEW_STORAGE_KEY = "lagunalive-amateur-show-all-v1";
const GROUP_STORAGE_KEY = "lagunalive-amateur-expanded-groups-v1";
const SOURCE_CACHE_PREFIX = "lagunalive-amateur-source-cache-v1-";
const SOURCE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const SOURCES = [
  { id: "netatmo", label: "Netatmo", url: NETATMO_URL },
  { id: "weathercloud", label: "Weathercloud", url: WEATHERCLOUD_URL },
  { id: "wunderground", label: "Weather Underground", url: WUNDERGROUND_URL }
];

const keyOf = (source, id) => `${source}|${id}`;

const DEFAULT_VISIBLE_KEYS = new Set([
  keyOf("wunderground", "IVENIC160"),
  keyOf("weathercloud", "2414314087"),
  keyOf("weathercloud", "2591958863"),
  keyOf("weathercloud", "2361312782"),
  keyOf("netatmo", "70:ee:50:af:5a:52"),
  keyOf("netatmo", "70:ee:50:af:3d:96"),
  keyOf("netatmo", "70:ee:50:bf:7e:5a"),
  keyOf("netatmo", "70:ee:50:2b:02:64"),
  keyOf("weathercloud", "9454656179"),
  keyOf("weathercloud", "8414577935"),
  keyOf("netatmo", "70:ee:50:c3:8f:28"),
  keyOf("netatmo", "70:ee:50:b4:e8:0a")
]);

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
      keyOf("netatmo", "70:ee:50:af:3d:96"),
      keyOf("netatmo", "70:ee:50:bf:7e:5a"),
      keyOf("netatmo", "70:ee:50:2b:02:64"),
      keyOf("netatmo", "70:ee:50:c3:8f:28")
    ]
  },
  {
    id: "laguna",
    title: "Laguna e litorale",
    shortTitle: "Laguna",
    areaClass: "area-lagoon",
    keys: [
      keyOf("netatmo", "70:ee:50:af:5a:52"),
      keyOf("netatmo", "70:ee:50:2a:dd:e8"),
      keyOf("weathercloud", "9454656179"),
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

const AUTO_FALLBACKS = [
  {
    primary: keyOf("weathercloud", "2591958863"),
    fallback: keyOf("netatmo", "70:ee:50:af:81:0c")
  },
  {
    primary: keyOf("netatmo", "70:ee:50:af:5a:52"),
    fallback: keyOf("netatmo", "70:ee:50:2a:dd:e8")
  },
  {
    primary: keyOf("weathercloud", "9454656179"),
    fallback: keyOf("weathercloud", "8414577935")
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
  [keyOf("weathercloud", "2414314087")]: "Staz. meteo",
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
  [keyOf("netatmo", "70:ee:50:bf:7e:5a")]: "Fabbri",
  [keyOf("netatmo", "70:ee:50:2b:02:64")]: "Le Pute",
  [keyOf("netatmo", "70:ee:50:c3:8f:28")]: "Ruga Bela",
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
  showAll: localStorage.getItem(VIEW_STORAGE_KEY) === "1",
  expandedGroups: readExpandedGroups(),
  autoVisible: new Set(),
  sourceErrors: [],
  loadedAt: null
};

const stationGroups = document.getElementById("stationGroups");
const zoneNav = document.getElementById("zoneNav");
const overviewCount = document.getElementById("overviewCount");
const overviewTime = document.getElementById("overviewTime");
const toggleAllButton = document.getElementById("toggleAllButton");
const refreshButton = document.getElementById("refreshButton");
const sourceWarning = document.getElementById("sourceWarning");

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
      const reason = result.reason?.message || "errore sconosciuto";

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
  computeAutomaticFallbacks();
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

function computeAutomaticFallbacks() {
  state.autoVisible = new Set();
  const stationsByKey = new Map(
    state.stations.map((station) => [station.key, station])
  );

  AUTO_FALLBACKS.forEach(({ primary, fallback }) => {
    const primaryStation = stationsByKey.get(primary);
    const fallbackStation = stationsByKey.get(fallback);

    if (
      fallbackStation &&
      !isUnavailable(fallbackStation) &&
      isUnavailable(primaryStation)
    ) {
      state.autoVisible.add(fallback);
    }
  });
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

  const visibleCount = countVisibleStations();
  const total = state.stations.length;
  const staleCount = state.stations.filter(isUnavailable).length;

  const viewLabel = state.showAll
    ? "Vista completa"
    : visibleCount === DEFAULT_VISIBLE_KEYS.size
      ? "Vista essenziale"
      : "Vista personalizzata";

  overviewCount.textContent =
    `${viewLabel} · ${visibleCount} di ${total} stazioni` +
    (staleCount ? ` · ${staleCount} non aggiornate` : "");

  overviewTime.textContent = state.loadedAt
    ? `Ultimo controllo alle ${formatClock(state.loadedAt)}`
    : "";

  toggleAllButton.textContent = state.showAll
    ? "Vista essenziale"
    : `Mostra tutte (${total})`;
  toggleAllButton.setAttribute("aria-pressed", String(state.showAll));

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

  const expanded = state.showAll || state.expandedGroups.has(group.id);
  const visibleStations = groupStations.filter(
    (station) =>
      expanded ||
      DEFAULT_VISIBLE_KEYS.has(station.key) ||
      state.autoVisible.has(station.key)
  );
  const normallyHidden = groupStations.filter(
    (station) =>
      !DEFAULT_VISIBLE_KEYS.has(station.key) &&
      !state.autoVisible.has(station.key)
  );
  const hiddenCount = groupStations.length - visibleStations.length;

  let toggle = "";

  if (!state.showAll && normallyHidden.length) {
    const action = state.expandedGroups.has(group.id)
      ? "Nascondi stazioni aggiuntive"
      : hiddenCount === 1
        ? `Mostra anche ${escapeHtml(stationShortName(normallyHidden[0]))}`
        : `Mostra altre ${hiddenCount} stazioni`;

    toggle =
      `<button class="group-toggle" type="button" data-group-toggle="${escapeHtml(group.id)}">${action}</button>`;
  }

  return `
    <section class="station-group ${escapeHtml(group.areaClass)}" id="group-${escapeHtml(group.id)}">
      <div class="group-header">
        <h2>${escapeHtml(group.title)}</h2>
        <span class="group-count">${visibleStations.length} di ${groupStations.length}</span>
      </div>
      <div class="station-grid">
        ${visibleStations.map(renderStationCard).join("")}
      </div>
      ${visibleStations.length > 2
        ? '<div class="station-swipe-hint" aria-hidden="true">Scorri per le altre stazioni →</div>'
        : ""}
      ${toggle}
    </section>
  `;
}

function renderStationCard(station) {
  const role = ROLE_LABELS[station.networkRole] || "Stazione";
  const roleClass = ROLE_LABELS[station.networkRole]
    ? station.networkRole
    : "supporto";
  const sourceMeta = {
    netatmo: { label: "Netatmo", className: "netatmo" },
    weathercloud: { label: "Weathercloud", className: "weathercloud" },
    wunderground: { label: "W. Underground", className: "wunderground" }
  }[station.source] || { label: station.source || "Fonte", className: "other" };
  const freshness = freshnessInfo(station);
  const fullName = station.displayName || station.name || station.id;
  const shortName = stationShortName(station);
  const detailsId = `details-${station.key.replace(/[^a-z0-9]+/gi, "-")}`;
  const qualityNote = QUALITY_NOTES[station.key];
  const isAutoShown = state.autoVisible.has(station.key) &&
    !DEFAULT_VISIBLE_KEYS.has(station.key);

  const alert = station.sourcePlaceholder || station.sourceFallback
    ? ""
    : station.error
      ? `<div class="station-alert error">${escapeHtml(station.error)}</div>`
      : station.stale
        ? '<div class="station-alert">Dato non recente: confrontare con un’altra stazione della zona.</div>'
        : "";

  return `
    <article class="station-card role-${escapeHtml(roleClass)} ${station.error ? "station-error" : ""}" aria-label="${escapeHtml(fullName)}">
      <div class="station-head">
        <h3 title="${escapeHtml(fullName)}">${escapeHtml(shortName)}</h3>
        <span class="badge badge-source-${escapeHtml(sourceMeta.className)}">${escapeHtml(sourceMeta.label)}</span>
      </div>

      <div class="primary-readings">
        <span class="primary-temperature">${escapeHtml(formatCompactTemperature(station.temp))}</span>
        <span class="primary-humidity">💧 ${escapeHtml(formatCompactHumidity(station.humidity))}</span>
      </div>

      <div class="station-meta">
        <span class="freshness"><i class="fresh-dot ${freshness.className}"></i>${escapeHtml(freshness.label)}</span>
        <span class="station-role">${isAutoShown ? "Supporto auto" : escapeHtml(role)}</span>
      </div>

      ${alert}

      <button class="details-toggle" type="button" data-details-toggle="${detailsId}" aria-expanded="false">
        Dettagli
      </button>
      <div class="station-details" id="${detailsId}" hidden>
        ${renderDetails(station)}
        ${qualityNote
          ? `<p class="quality-note">${escapeHtml(qualityNote)}</p>`
          : ""}
        ${station.mapUrl
          ? `<a class="source-link" href="${safeUrl(station.mapUrl)}" target="_blank" rel="noopener">Apri la pagina originale ↗</a>`
          : ""}
      </div>
    </article>
  `;
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

function renderDetails(station) {
  const rows = [
    ["Umidità", formatUnit(station.humidity, "%", 0)],
    ["Punto di rugiada", formatTemperature(station.dewPoint)],
    ["Pressione", formatUnit(station.pressure, "hPa", 1)],
    ["Intensità pioggia", formatUnit(station.rainRate, "mm/h", 2)],
    ["Pioggia ultima ora", formatUnit(station.rain60min, "mm", 2)],
    ["Vento", formatUnit(station.windKmh, "km/h", 1)],
    ["Raffica", formatUnit(station.gustKmh, "km/h", 1)],
    ["Direzione vento", formatWindDirection(station.windDir)],
    ["Quota", formatUnit(station.altitude, "m", 0)],
    ["Ultimo dato", formatDateTime(station.updatedAt)],
    ["Coordinate", formatCoordinates(station.lat, station.lon)]
  ].filter(([, value]) => value !== null);

  if (!rows.length) {
    return '<div class="detail-row"><span>Dati aggiuntivi</span><strong>n.d.</strong></div>';
  }

  return rows
    .map(
      ([label, value]) =>
        `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
    )
    .join("");
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

function countVisibleStations() {
  return state.stations.filter((station) => {
    const group = GROUPS.find((item) => item.keys.includes(station.key));
    return state.showAll ||
      DEFAULT_VISIBLE_KEYS.has(station.key) ||
      state.autoVisible.has(station.key) ||
      (group && state.expandedGroups.has(group.id));
  }).length;
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

function readExpandedGroups() {
  try {
    const value = JSON.parse(localStorage.getItem(GROUP_STORAGE_KEY) || "[]");
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

function saveExpandedGroups() {
  localStorage.setItem(
    GROUP_STORAGE_KEY,
    JSON.stringify([...state.expandedGroups])
  );
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

toggleAllButton.addEventListener("click", () => {
  state.showAll = !state.showAll;
  localStorage.setItem(VIEW_STORAGE_KEY, state.showAll ? "1" : "0");
  renderPage();
});

refreshButton.addEventListener("click", () => {
  loadStations({ manual: true });
});

stationGroups.addEventListener("click", (event) => {
  const groupButton = event.target.closest("[data-group-toggle]");

  if (groupButton) {
    const groupId = groupButton.dataset.groupToggle;

    if (state.expandedGroups.has(groupId)) {
      state.expandedGroups.delete(groupId);
    } else {
      state.expandedGroups.add(groupId);
    }

    saveExpandedGroups();
    renderPage();
    document.getElementById(`group-${groupId}`)?.scrollIntoView({ block: "start" });
    return;
  }

  const detailsButton = event.target.closest("[data-details-toggle]");

  if (detailsButton) {
    const details = document.getElementById(detailsButton.dataset.detailsToggle);
    if (!details) return;

    const opening = details.hidden;
    details.hidden = !opening;
    detailsButton.setAttribute("aria-expanded", String(opening));
    detailsButton.textContent = opening ? "Chiudi" : "Dettagli";
  }
});

loadStations();
setInterval(loadStations, REFRESH_INTERVAL_MS);
