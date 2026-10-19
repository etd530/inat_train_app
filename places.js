// Place search shared by the start page (suggestions) and the training page (resolving a typed name)

// iNaturalist's admin_level for its standard places; community-made places have none
const PLACE_TYPE_LABELS = {
    '-10': 'Continent',
    '0': 'Country',
    '10': 'State / region',
    '20': 'County / district',
    '30': 'Town'
};

function placeTypeLabel(place) {
    if (place.admin_level === null || place.admin_level === undefined) return 'Community-made place';
    return PLACE_TYPE_LABELS[place.admin_level] || 'Official place';
}

function normalizePlaceName(name) {
    return (name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Search places by name, best matches first. Combines iNaturalist's general search, which also
// matches alternative names (e.g. "Catalonia" finds "Catalunya"), with the place autocomplete,
// which finds some official places the general search misses (e.g. "Cataluña"). Exact name
// matches rank first, then official places, then the rest in the order the API returned them.
async function searchPlaces(query, limit = 8) {
    const q = encodeURIComponent(query);
    const getJSON = url => fetch(url).then(response => {
        if (!response.ok) throw new Error(`iNaturalist API returned HTTP ${response.status}`);
        return response.json();
    });
    const [search, autocomplete] = await Promise.allSettled([
        getJSON(`https://api.inaturalist.org/v1/search?q=${q}&sources=places&per_page=10`),
        getJSON(`https://api.inaturalist.org/v1/places/autocomplete?q=${q}&per_page=10`)
    ]);
    if (search.status === 'rejected' && autocomplete.status === 'rejected') throw search.reason;

    const places = [];
    const seen = new Set();
    const add = place => {
        if (place && !seen.has(place.id)) {
            seen.add(place.id);
            places.push(place);
        }
    };
    if (search.status === 'fulfilled') (search.value.results || []).forEach(result => add(result.record));
    if (autocomplete.status === 'fulfilled') (autocomplete.value.results || []).forEach(add);

    const wanted = normalizePlaceName(query);
    const rank = place => {
        const nameMatches = [place.name, (place.display_name || '').split(',')[0]]
            .some(name => normalizePlaceName(name) === wanted);
        const official = place.admin_level !== null && place.admin_level !== undefined;
        return (nameMatches ? 0 : 2) + (official ? 0 : 1);
    };
    return places
        .map((place, index) => ({ place, index }))
        .sort((a, b) => rank(a.place) - rank(b.place) || a.index - b.index)
        .map(entry => entry.place)
        .slice(0, limit);
}
