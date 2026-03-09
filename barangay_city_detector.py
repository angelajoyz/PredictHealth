"""
BARANGAY CITY DETECTOR
======================
Auto-detects the city/municipality from barangay names.
Uses a built-in Philippine barangay database first (fast, offline),
then falls back to geocoding API if not found.
"""

import re

# ─────────────────────────────────────────────────────────────
# BUILT-IN PH BARANGAY → CITY/MUNICIPALITY MAP
# Common cities — expand as needed
# Format: 'barangay_name_lowercase': 'City/Municipality'
# ─────────────────────────────────────────────────────────────
PH_BARANGAY_CITY_MAP = {
    # ── Dagupan City, Pangasinan ──
    'bonuan binloc': 'Dagupan',
    'bonuan boquig': 'Dagupan',
    'bonuan gueset': 'Dagupan',
    'calmay': 'Dagupan',
    'carael': 'Dagupan',
    'caranglaan': 'Dagupan',
    'herrero': 'Dagupan',
    'lasip chico': 'Dagupan',
    'lasip grande': 'Dagupan',
    'lucao': 'Dagupan',
    'malued': 'Dagupan',
    'mangin': 'Dagupan',
    'mayombo': 'Dagupan',
    'pantal': 'Dagupan',
    'poblacion oeste': 'Dagupan',
    'pogo chico': 'Dagupan',
    'pogo grande': 'Dagupan',
    'pugaro suit': 'Dagupan',
    'salapingao': 'Dagupan',
    'salisay': 'Dagupan',
    'tambac': 'Dagupan',
    'tebeng': 'Dagupan',
    'lomboy': 'Dagupan',

    # ── Quezon City ──
    'bagong pag-asa': 'Quezon City',
    'batasan hills': 'Quezon City',
    'commonwealth': 'Quezon City',
    'payatas': 'Quezon City',
    'tandang sora': 'Quezon City',
    'novaliches': 'Quezon City',
    'culiat': 'Quezon City',
    'bagbag': 'Quezon City',
    'san agustin': 'Quezon City',

    # ── Manila ──
    'binondo': 'Manila',
    'ermita': 'Manila',
    'intramuros': 'Manila',
    'malate': 'Manila',
    'paco': 'Manila',
    'pandacan': 'Manila',
    'port area': 'Manila',
    'quiapo': 'Manila',
    'sampaloc': 'Manila',
    'san andres': 'Manila',
    'san miguel': 'Manila',
    'san nicolas': 'Manila',
    'santa ana': 'Manila',
    'santa cruz': 'Manila',
    'santa mesa': 'Manila',
    'tondo': 'Manila',

    # ── Cebu City ──
    'adlaon': 'Cebu City',
    'agsungot': 'Cebu City',
    'apas': 'Cebu City',
    'bacayan': 'Cebu City',
    'banilad': 'Cebu City',
    'basak pardo': 'Cebu City',
    'basak san nicolas': 'Cebu City',
    'bonbon': 'Cebu City',
    'budla-an': 'Cebu City',
    'buhisan': 'Cebu City',
    'bulacao': 'Cebu City',
    'buot-taup': 'Cebu City',
    'busay': 'Cebu City',
    'calamba': 'Cebu City',
    'cambinocot': 'Cebu City',
    'capitol site': 'Cebu City',
    'carreta': 'Cebu City',
    'cogon ramos': 'Cebu City',
    'cogon pardo': 'Cebu City',
    'day-as': 'Cebu City',
    'duljo fatima': 'Cebu City',
    'ermita cebu': 'Cebu City',
    'guadalupe': 'Cebu City',
    'guba': 'Cebu City',
    'hippodromo': 'Cebu City',
    'inayawan': 'Cebu City',
    'kalubihan': 'Cebu City',
    'kalunasan': 'Cebu City',
    'kamagayan': 'Cebu City',
    'kasambagan': 'Cebu City',
    'kinasang-an': 'Cebu City',
    'labangon': 'Cebu City',
    'lahug': 'Cebu City',
    'lorega': 'Cebu City',
    'lusaran': 'Cebu City',
    'luz': 'Cebu City',
    'mabini': 'Cebu City',
    'mabolo': 'Cebu City',
    'malubog': 'Cebu City',
    'mambaling': 'Cebu City',
    'pahina central': 'Cebu City',
    'pahina san nicolas': 'Cebu City',
    'pamutan': 'Cebu City',
    'pardo': 'Cebu City',
    'pari-an': 'Cebu City',
    'paril': 'Cebu City',
    'pasil': 'Cebu City',
    'pit-os': 'Cebu City',
    'poblacion norte': 'Cebu City',
    'poblacion south': 'Cebu City',
    'pulangbato': 'Cebu City',
    'pung-ol sibugay': 'Cebu City',
    'punta princesa': 'Cebu City',
    'quiot pardo': 'Cebu City',
    'sambag i': 'Cebu City',
    'sambag ii': 'Cebu City',
    'san antonio': 'Cebu City',
    'san jose': 'Cebu City',
    'san roque': 'Cebu City',
    'santa cruz cebu': 'Cebu City',
    'sapangdaku': 'Cebu City',
    'sawang calero': 'Cebu City',
    'sinsin': 'Cebu City',
    'sirao': 'Cebu City',
    'suba': 'Cebu City',
    'sudlon i': 'Cebu City',
    'sudlon ii': 'Cebu City',
    'talamban': 'Cebu City',
    'taptap': 'Cebu City',
    'tejero': 'Cebu City',
    'tinago': 'Cebu City',
    'to-ong': 'Cebu City',
    'zapatera': 'Cebu City',

    # ── Davao City ──
    'agdao': 'Davao City',
    'angliongto sr': 'Davao City',
    'baracatan': 'Davao City',
    'bago aplaya': 'Davao City',
    'bago gallera': 'Davao City',
    'bago oshiro': 'Davao City',
    'bangkas heights': 'Davao City',
    'bantol': 'Davao City',
    'barangay 1-a': 'Davao City',
    'bucana': 'Davao City',
    'buhangin': 'Davao City',
    'bunawan': 'Davao City',
    'cabantian': 'Davao City',
    'cadalian': 'Davao City',
    'calinan': 'Davao City',
    'communal': 'Davao City',
    'daliao': 'Davao City',
    'dumoy': 'Davao City',
    'Eden': 'Davao City',
    'indangan': 'Davao City',
    'lacson': 'Davao City',
    'lamanan': 'Davao City',
    'langub': 'Davao City',
    'lasang': 'Davao City',
    'lizada': 'Davao City',
    'lubogan': 'Davao City',
    'maa': 'Davao City',
    'maguindanao': 'Davao City',
    'mahayag': 'Davao City',
    'malagos': 'Davao City',
    'marapangi': 'Davao City',
    'marilog': 'Davao City',
    'matina aplaya': 'Davao City',
    'matina crossing': 'Davao City',
    'matina pangi': 'Davao City',
    'mintal': 'Davao City',
    'mudiang': 'Davao City',
    'mulig': 'Davao City',
    'pampanga': 'Davao City',
    'panacan': 'Davao City',
    'paquibato': 'Davao City',
    'riverside': 'Davao City',
    'santo nino': 'Davao City',
    'sasa': 'Davao City',
    'sirib': 'Davao City',
    'sirawan': 'Davao City',
    'suawan': 'Davao City',
    'subasta': 'Davao City',
    'tacunan': 'Davao City',
    'talomo': 'Davao City',
    'tamugan': 'Davao City',
    'tapak': 'Davao City',
    'tawan-tawan': 'Davao City',
    'tibulo': 'Davao City',
    'tibungco': 'Davao City',
    'tigatto': 'Davao City',
    'toril': 'Davao City',
    'tugbok': 'Davao City',
    'tunggol': 'Davao City',
    'ubalde': 'Davao City',
    'ulas': 'Davao City',
    'waan': 'Davao City',
    'wangan': 'Davao City',

    # ── Zamboanga City ──
    'ayala': 'Zamboanga City',
    'baliwasan': 'Zamboanga City',
    'barangay canelar': 'Zamboanga City',
    'barangay guiwan': 'Zamboanga City',
    'camino nuevo': 'Zamboanga City',
    'divisoria': 'Zamboanga City',
    'kasanyangan': 'Zamboanga City',
    'limpapa': 'Zamboanga City',
    'maasin': 'Zamboanga City',
    'putik': 'Zamboanga City',
    'recodo': 'Zamboanga City',
    'rio hondo': 'Zamboanga City',
    'sta barbara': 'Zamboanga City',
    'talon-talon': 'Zamboanga City',
    'tetuan': 'Zamboanga City',
    'tumaga': 'Zamboanga City',
    'victoria': 'Zamboanga City',

    # ── Cagayan de Oro ──
    'agusan': 'Cagayan de Oro',
    'balulang': 'Cagayan de Oro',
    'barangay 1': 'Cagayan de Oro',
    'bayabas': 'Cagayan de Oro',
    'bonbon cdo': 'Cagayan de Oro',
    'bulua': 'Cagayan de Oro',
    'camaman-an': 'Cagayan de Oro',
    'consolacion': 'Cagayan de Oro',
    'corrales': 'Cagayan de Oro',
    'eastern cogon': 'Cagayan de Oro',
    'gusa': 'Cagayan de Oro',
    'iponan': 'Cagayan de Oro',
    'kaantogan': 'Cagayan de Oro',
    'kauswagan': 'Cagayan de Oro',
    'lapasan': 'Cagayan de Oro',
    'lumbia': 'Cagayan de Oro',
    'macabalan': 'Cagayan de Oro',
    'macasandig': 'Cagayan de Oro',
    'mambuaya': 'Cagayan de Oro',
    'nazareth': 'Cagayan de Oro',
    'pagalungan': 'Cagayan de Oro',
    'pagatpatan': 'Cagayan de Oro',
    'patag': 'Cagayan de Oro',
    'puerto': 'Cagayan de Oro',
    'puntod': 'Cagayan de Oro',
    'san simon': 'Cagayan de Oro',
    'socorro': 'Cagayan de Oro',
    'tablon': 'Cagayan de Oro',
    'taglimao': 'Cagayan de Oro',
    'tignapoloan': 'Cagayan de Oro',
    'tumpagon': 'Cagayan de Oro',
    'upper balulang': 'Cagayan de Oro',
    'west city': 'Cagayan de Oro',
    'western cogon': 'Cagayan de Oro',
    'wharf': 'Cagayan de Oro',

    # ── Iloilo City ──
    'arevalo': 'Iloilo City',
    'bo. obrero': 'Iloilo City',
    'buntatala': 'Iloilo City',
    'city proper': 'Iloilo City',
    'jaro': 'Iloilo City',
    'la paz': 'Iloilo City',
    'lapuz': 'Iloilo City',
    'mandurriao': 'Iloilo City',
    'molo': 'Iloilo City',

    # ── Bacolod City ──
    'bata': 'Bacolod City',
    'estefania': 'Bacolod City',
    'felisa': 'Bacolod City',
    'granada': 'Bacolod City',
    'handumanan': 'Bacolod City',
    'mandalagan': 'Bacolod City',
    'mansilingan': 'Bacolod City',
    'pahanocoy': 'Bacolod City',
    'singcang-airport': 'Bacolod City',
    'sum-ag': 'Bacolod City',
    'taculing': 'Bacolod City',
    'tangub': 'Bacolod City',
    'villamonte': 'Bacolod City',
    'vista alegre': 'Bacolod City',

    # ── General Santos City ──
    'apopong': 'General Santos City',
    'baluan': 'General Santos City',
    'bula': 'General Santos City',
    'calumpang': 'General Santos City',
    'city heights': 'General Santos City',
    'conel': 'General Santos City',
    'dadiangas east': 'General Santos City',
    'dadiangas north': 'General Santos City',
    'dadiangas south': 'General Santos City',
    'dadiangas west': 'General Santos City',
    'fatima gensan': 'General Santos City',
    'katangawan': 'General Santos City',
    'labangal': 'General Santos City',
    'lagao': 'General Santos City',
    'ligaya': 'General Santos City',
    'mabuhay': 'General Santos City',
    'olympog': 'General Santos City',
    'san isidro': 'General Santos City',
    'sinawal': 'General Santos City',
    'tambler': 'General Santos City',
    'tinagacan': 'General Santos City',
    'upper tambler': 'General Santos City',

    # ── Pasig City ──
    'bagong ilog': 'Pasig City',
    'bagong katipunan': 'Pasig City',
    'bambang': 'Pasig City',
    'buting': 'Pasig City',
    'caniogan': 'Pasig City',
    'dela paz': 'Pasig City',
    'kalawaan': 'Pasig City',
    'kapitolyo': 'Pasig City',
    'malinao': 'Pasig City',
    'manggahan': 'Pasig City',
    'maybunga': 'Pasig City',
    'oranbo': 'Pasig City',
    'palatiw': 'Pasig City',
    'pinagbuhatan': 'Pasig City',
    'pineda': 'Pasig City',
    'rosario pasig': 'Pasig City',
    'sagad': 'Pasig City',
    'san antonio pasig': 'Pasig City',
    'san joaquin': 'Pasig City',
    'san nicolas pasig': 'Pasig City',
    'santolan': 'Pasig City',
    'sumilang': 'Pasig City',
    'ugong': 'Pasig City',

    # ── Taguig City ──
    'bagumbayan': 'Taguig City',
    'bambang taguig': 'Taguig City',
    'calzada': 'Taguig City',
    'central bicutan': 'Taguig City',
    'central signal village': 'Taguig City',
    'fort bonifacio': 'Taguig City',
    'hagonoy': 'Taguig City',
    'ibayo tipas': 'Taguig City',
    'katuparan': 'Taguig City',
    'ligid tipas': 'Taguig City',
    'lower bicutan': 'Taguig City',
    'maharlika village': 'Taguig City',
    'napindan': 'Taguig City',
    'new lower bicutan': 'Taguig City',
    'north daang hari': 'Taguig City',
    'north signal village': 'Taguig City',
    'palingon': 'Taguig City',
    'pinagsama': 'Taguig City',
    'san martin de porres': 'Taguig City',
    'scgc bgc': 'Taguig City',
    'south daang hari': 'Taguig City',
    'south signal village': 'Taguig City',
    'tuktukan': 'Taguig City',
    'upper bicutan': 'Taguig City',
    'ususan': 'Taguig City',
    'wawa taguig': 'Taguig City',
    'western bicutan': 'Taguig City',

    # ── San Fernando, Pampanga ──
    'alasas': 'San Fernando',
    'bulaon': 'San Fernando',
    'calulut': 'San Fernando',
    'dela paz norte': 'San Fernando',
    'dela paz sur': 'San Fernando',
    'dolores': 'San Fernando',
    'juliana': 'San Fernando',
    'lara': 'San Fernando',
    'lourdes': 'San Fernando',
    'magliman': 'San Fernando',
    'maimpis': 'San Fernando',
    'malino': 'San Fernando',
    'malpitic': 'San Fernando',
    'mamatitang': 'San Fernando',
    'mandili': 'San Fernando',
    'mapaniqui': 'San Fernando',
    'panipuan': 'San Fernando',
    'pulung bulu': 'San Fernando',
    'pulung cacutud': 'San Fernando',
    'pulung maragul': 'San Fernando',
    'quebiawan': 'San Fernando',
    'saguin': 'San Fernando',
    'san agustin sf': 'San Fernando',
    'san felipe sf': 'San Fernando',
    'san isidro sf': 'San Fernando',
    'san jose sf': 'San Fernando',
    'san pedro sf': 'San Fernando',
    'santa lucia sf': 'San Fernando',
    'santa teresita': 'San Fernando',
    'santo nino sf': 'San Fernando',
    'sindalan': 'San Fernando',
    'telabastagan': 'San Fernando',
}


def normalize_barangay(name: str) -> str:
    """Lowercase, strip common prefixes, remove punctuation for matching."""
    s = str(name).lower().strip()
    # Remove common prefixes
    for prefix in ['barangay ', 'brgy. ', 'brgy ', 'bgy. ', 'bgy ']:
        if s.startswith(prefix):
            s = s[len(prefix):]
    s = re.sub(r'[^a-z0-9\s\-]', '', s).strip()
    return s


def detect_city_from_barangays(barangay_list: list) -> str:
    """
    Given a list of barangay names, return the most likely city/municipality.

    Steps:
      1. Try exact match in built-in map
      2. Try partial/fuzzy match in built-in map
      3. Fall back to geocoding API (Nominatim)
      4. Return '' if nothing found
    """
    if not barangay_list:
        return ''

    city_votes: dict = {}

    for raw_name in barangay_list:
        norm = normalize_barangay(raw_name)
        if not norm:
            continue

        # ── Step 1: Exact match ──
        if norm in PH_BARANGAY_CITY_MAP:
            city = PH_BARANGAY_CITY_MAP[norm]
            city_votes[city] = city_votes.get(city, 0) + 2  # weight 2 for exact
            continue

        # ── Step 2: Partial match (barangay name contains or is contained in key) ──
        for key, city in PH_BARANGAY_CITY_MAP.items():
            if norm in key or key in norm:
                city_votes[city] = city_votes.get(city, 0) + 1
                break

    # ── Step 3: Geocoding fallback (only if no votes yet) ──
    if not city_votes:
        geocoded = _geocode_barangays(barangay_list[:5])  # try first 5
        if geocoded:
            return geocoded

    if not city_votes:
        return ''

    # Return city with most votes
    best_city = max(city_votes, key=city_votes.get)
    print(f"   🏙️  City detected from barangays: '{best_city}' "
          f"(votes: {city_votes})")
    return best_city


def _geocode_barangays(barangay_list: list) -> str:
    """
    Use Nominatim (OpenStreetMap) to geocode barangay names → city.
    Free, no API key needed. Rate-limited to 1 req/sec.
    """
    import time
    try:
        import requests
    except ImportError:
        return ''

    city_votes = {}
    headers = {'User-Agent': 'PredictHealth/1.0'}

    for brgy in barangay_list:
        query = f"{brgy}, Philippines"
        try:
            resp = requests.get(
                'https://nominatim.openstreetmap.org/search',
                params={'q': query, 'format': 'json', 'limit': 1,
                        'countrycodes': 'ph'},
                headers=headers,
                timeout=5
            )
            results = resp.json()
            if results:
                display = results[0].get('display_name', '')
                # display_name format: "Barangay X, City Y, Province Z, Philippines"
                parts = [p.strip() for p in display.split(',')]
                # City is usually parts[1] or [2]
                for part in parts[1:4]:
                    part_clean = part.strip()
                    # Skip province/region/country names
                    if part_clean.lower() in ('philippines', 'ph') or len(part_clean) < 3:
                        continue
                    # Remove "City of" prefix
                    part_clean = re.sub(r'^city of\s+', '', part_clean, flags=re.IGNORECASE)
                    city_votes[part_clean] = city_votes.get(part_clean, 0) + 1
                    break
            time.sleep(1)  # Nominatim rate limit
        except Exception as e:
            print(f"   ⚠️  Geocode failed for '{brgy}': {e}")
            continue

    if city_votes:
        best = max(city_votes, key=city_votes.get)
        print(f"   🌐 City detected via geocoding: '{best}'")
        return best

    return ''