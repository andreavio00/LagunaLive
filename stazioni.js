const NETATMO_URL =
  "https://netatmo-worker.andrea-vio.workers.dev/netatmo/selected?includeOptional=1";
const WEATHERCLOUD_URL =
  "https://weathercloude-worker.andrea-vio.workers.dev/weathercloud/selected";
const WUNDERGROUND_URL =
  "https://weathercloude-worker.andrea-vio.workers.dev/wunderground/selected";

const VIEW_STORAGE_KEY = "lagunalive-amateur-show-all-v1";
const GROUP_STORAGE_KEY = "lagunalive-amateur-expanded-groups-v1";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

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

const ROLE_LABELS = {
  principale: "Principale",
  supporto: "Supporto",
  sperimentale: "Sperimentale",
  sentinella: "Sentinella"
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

  if (!Array.isArray(payload)) {
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

  const results = await Promise.allSettled([
    fetchStationList(NETATMO_URL),
    fetchStationList(WEATHERCLOUD_URL),
    fetchStationList(WUNDERGROUND_URL)
  ]);

  const sourceNames = ["Netatmo", "Weathercloud", "Weather Underground"];
  const loaded = [];
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      loaded.push(...result.value);
    } else {
      errors.push(`${sourceNames[index]}: ${result.reason.message}`);
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

  return {
    ...station,
    source,
    key: keyOf(source, station.id),
    networkOrder: numberOrNull(station.networkOrder) ?? 999,
    ageMinutes: numberOrNull(station.ageMinutes),
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

    if (fallbackStation && isUnavailable(primaryStation)) {
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
        ? `Mostra anche ${escapeHtml(normallyHidden[0].displayName || normallyHidden[0].name)}`
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
  const detailsId = `details-${String(station.networkOrder).replace(/[^0-9]/g, "")}`;
  const qualityNote = QUALITY_NOTES[station.key];
  const isAutoShown = state.autoVisible.has(station.key) &&
    !DEFAULT_VISIBLE_KEYS.has(station.key);

  const alert = station.error
    ? `<div class="station-alert error">${escapeHtml(station.error)}</div>`
    : station.stale
      ? '<div class="station-alert">Dato non recente: confrontare con un’altra stazione della zona.</div>'
      : station.networkRole === "sperimentale" && qualityNote
        ? `<div class="station-alert">${escapeHtml(qualityNote)}</div>`
        : "";

  return `
    <article class="station-card role-${escapeHtml(roleClass)} ${station.error ? "station-error" : ""}">
      <div class="station-head">
        <div class="station-title">
          <h3>${escapeHtml(station.displayName || station.name || station.id)}</h3>
          <div class="station-sector">${escapeHtml(station.sector || station.location || "")}</div>
        </div>
        <div class="station-badges">
          <span class="badge badge-source-${escapeHtml(sourceMeta.className)}">${escapeHtml(sourceMeta.label)}</span>
          <span class="badge badge-role">${escapeHtml(role)}</span>
        </div>
      </div>

      <div class="freshness">
        <i class="fresh-dot ${freshness.className}"></i>
        <span>${escapeHtml(freshness.label)}</span>
        ${isAutoShown ? '<span class="auto-shown">supporto automatico</span>' : ""}
      </div>

      <div class="metric-grid">
        ${metricCell("Temperatura", formatTemperature(station.temp), "metric-temperature")}
        ${metricCell("Umidità", formatUnit(station.humidity, "%", 0))}
        ${metricCell("Pioggia ora", formatUnit(station.rainRate, "mm/h", 2))}
        ${metricCell("Pioggia 24 h", formatUnit(station.rainAccum, "mm", 2))}
      </div>

      ${alert}

      <button class="details-toggle" type="button" data-details-toggle="${detailsId}" aria-expanded="false">
        Mostra dettagli
      </button>
      <div class="station-details" id="${detailsId}" hidden>
        ${renderDetails(station)}
        ${qualityNote && station.networkRole !== "sperimentale"
          ? `<p class="quality-note">${escapeHtml(qualityNote)}</p>`
          : ""}
        ${station.mapUrl
          ? `<a class="source-link" href="${safeUrl(station.mapUrl)}" target="_blank" rel="noopener">Apri la pagina originale ↗</a>`
          : ""}
      </div>
    </article>
  `;
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

function metricCell(label, value, extraClass = "") {
  const empty = value === null;
  return `
    <div class="metric ${extraClass} ${empty ? "metric-empty" : ""}">
      <span class="metric-label">${escapeHtml(label)}</span>
      <span class="metric-value">${escapeHtml(value ?? "—")}</span>
    </div>
  `;
}

function freshnessInfo(station) {
  if (station.error) {
    return { className: "old", label: "non disponibile" };
  }

  const age = numberOrNull(station.ageMinutes);

  if (age === null) {
    return { className: "unknown", label: "ora non disponibile" };
  }

  if (station.stale || age > 90) {
    return { className: "old", label: `aggiornata ${age} min fa` };
  }

  if (age <= 30) {
    return {
      className: "fresh",
      label: age <= 1 ? "aggiornata adesso" : `aggiornata ${age} min fa`
    };
  }

  return { className: "aging", label: `aggiornata ${age} min fa` };
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

  sourceWarning.textContent =
    `Una fonte non è disponibile; la pagina mostra gli altri dati. ${errors.join(" · ")}`;
  sourceWarning.classList.add("visible");
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
    detailsButton.textContent = opening ? "Nascondi dettagli" : "Mostra dettagli";
  }
});

loadStations();
setInterval(loadStations, REFRESH_INTERVAL_MS);
