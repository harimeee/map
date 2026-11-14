const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const MIN_GEOCODE_INTERVAL_MS = 1100;

const locations = {
  start: createLocationState("start"),
  end: createLocationState("end"),
};

let geocodeQueue = Promise.resolve();
let lastGeocodeStartedAt = 0;
let routeRequestId = 0;

function createLocationState(name) {
  return {
    name,
    input: document.getElementById(`${name}-input`),
    button: document.querySelector(`[data-search="${name}"]`),
    status: document.getElementById(`${name}-status`),
    results: document.getElementById(`${name}-results`),
    selection: document.getElementById(`${name}-selection`),
    selected: null,
    searchId: 0,
  };
}

function setFieldStatus(location, message, isError = false) {
  location.status.textContent = message;
  location.status.classList.toggle("error", isError);
}

function queueNominatimRequest(url) {
  const request = geocodeQueue.then(async () => {
    const elapsed = Date.now() - lastGeocodeStartedAt;
    if (elapsed < MIN_GEOCODE_INTERVAL_MS) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, MIN_GEOCODE_INTERVAL_MS - elapsed),
      );
    }

    lastGeocodeStartedAt = Date.now();
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("장소 검색에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }

    return response.json();
  });

  geocodeQueue = request.catch(() => {});
  return request;
}

async function searchPlaces(location) {
  const query = location.input.value.trim();
  const searchId = ++location.searchId;

  location.results.replaceChildren();
  location.selected = null;
  location.selection.hidden = true;
  location.selection.textContent = "";
  document.getElementById("distance-card").hidden = true;

  if (!query) {
    setFieldStatus(location, "장소나 주소를 입력해 주세요.", true);
    return;
  }

  location.button.disabled = true;
  setFieldStatus(location, "장소를 검색하고 있어요…");

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
  });

  try {
    const places = await queueNominatimRequest(`${NOMINATIM_URL}?${params}`);
    if (searchId !== location.searchId) return;

    if (!Array.isArray(places) || places.length === 0) {
      setFieldStatus(location, "검색 결과가 없어요. 다른 이름이나 주소로 검색해 보세요.");
      return;
    }

    setFieldStatus(location, "정확한 장소를 선택해 주세요.");
    renderPlaceResults(location, places);
  } catch (error) {
    if (searchId === location.searchId) {
      setFieldStatus(
        location,
        error instanceof Error ? error.message : "장소 검색 중 오류가 발생했어요.",
        true,
      );
    }
  } finally {
    if (searchId === location.searchId) location.button.disabled = false;
  }
}

function renderPlaceResults(location, places) {
  const fragment = document.createDocumentFragment();

  for (const place of places) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "result-option";
    button.textContent = place.display_name;
    button.addEventListener("click", () => selectPlace(location, place));
    fragment.append(button);
  }

  location.results.replaceChildren(fragment);
}

function selectPlace(location, place) {
  const lat = Number(place.lat);
  const lon = Number(place.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    setFieldStatus(location, "이 장소의 좌표를 확인할 수 없어요. 다른 결과를 선택해 주세요.", true);
    return;
  }

  location.selected = {
    lat,
    lon,
    label: place.display_name,
  };
  location.input.value = place.name || place.display_name.split(",")[0];
  location.selection.textContent = place.display_name;
  location.selection.hidden = false;
  location.results.replaceChildren();
  setFieldStatus(location, "");
  updateRoute();
}

function formatDistance(meters) {
  return (meters / 1000).toLocaleString("ko-KR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

async function updateRoute() {
  const notice = document.getElementById("route-notice");
  const distanceCard = document.getElementById("distance-card");
  const requestId = ++routeRequestId;
  const start = locations.start.selected;
  const end = locations.end.selected;

  distanceCard.hidden = true;
  notice.classList.remove("error");

  if (!start || !end) {
    notice.lastElementChild.textContent =
      "출발지와 도착지를 각각 검색한 뒤 결과를 선택해 주세요.";
    return;
  }

  notice.lastElementChild.textContent = "두 장소 사이의 자동차 경로를 계산하고 있어요…";

  try {
    const response = await fetch(
      `${OSRM_URL}/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false&steps=false`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      throw new Error("경로를 계산하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }

    const data = await response.json();
    if (requestId !== routeRequestId) return;

    if (data.code !== "Ok" || !Number.isFinite(data.routes?.[0]?.distance)) {
      throw new Error("두 장소 사이의 자동차 경로를 찾지 못했어요.");
    }

    const distanceMeters = data.routes[0].distance;
    document.getElementById("distance-number").textContent = formatDistance(distanceMeters);
    document.getElementById("distance-caption").textContent =
      `${start.label}에서 ${end.label}까지`;

    const route = `${start.lat},${start.lon};${end.lat},${end.lon}`;
    const mapUrl = new URL("https://www.openstreetmap.org/directions");
    mapUrl.searchParams.set("engine", "fossgis_osrm_car");
    mapUrl.searchParams.set("route", route);
    document.getElementById("map-link").href = mapUrl.toString();

    notice.lastElementChild.textContent = "경로 계산이 완료됐어요.";
    distanceCard.hidden = false;
  } catch (error) {
    if (requestId !== routeRequestId) return;
    notice.classList.add("error");
    notice.lastElementChild.textContent =
      error instanceof Error ? error.message : "경로 계산 중 오류가 발생했어요.";
  }
}

for (const location of Object.values(locations)) {
  location.button.addEventListener("click", () => searchPlaces(location));
  location.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchPlaces(location);
    }
  });
  location.input.addEventListener("input", () => {
    location.searchId += 1;
    location.button.disabled = false;
    location.results.replaceChildren();
    setFieldStatus(location, "");

    if (location.selected) {
      location.selected = null;
      location.selection.hidden = true;
      location.selection.textContent = "";
      location.results.replaceChildren();
      document.getElementById("distance-card").hidden = true;
      updateRoute();
    }
  });
}
