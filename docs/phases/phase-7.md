# Phase 7: The user's city and the weather

**Status:** Done (commit `dfd4d6d`)

The user asked for three things:
- on initial setup, add the user's current location for better fashion advice;
- let the location be changed in the settings;
- use a weather API for today's recommendation and for *Generate & rate* in the Studio.

Decisions made while building it (the user can revisit them):
- **Weather: Open-Meteo.** It is free, needs no API key or account, and covers the whole world. Its free tier is for **non-commercial use**, the same limit the SegFormer licence already puts on the app (Phase 6).
- **City search: Open-Meteo geocoding** (GeoNames data, biggest places first, regions shown to tell the many Londons apart).
- **"Current location": an IP-based guess (GeoJS, free, no key).** Electron's `navigator.geolocation` needs a Google API key and is unreliable on Windows and Linux. A city-level guess is all the weather needs. It is only a **suggestion**: the user confirms it or searches. It is asked for only when the welcome shows or the user taps *Use my location*.
- **Privacy:** only the city's coordinates go to Open-Meteo. The guess sends nothing but the request itself (the public IP is how it works).

## Model and contracts
- `shared/models/weather.ts`:
  - `Place { name, region, country, latitude, longitude, timezone }`.
  - `DayWeather { date, place, condition, summary, tempMin/Max, feelsLikeMin/Max, precipitationChance, windMax }` in °C and km/h. `condition` is one of clear, partly cloudy, cloudy, fog, drizzle, rain, snow or storm.
- `Settings.location: Place | null` (default null), `StyleMatch.weather?` (the forecast the look was styled and rated for), and `StyleRequest.dressForWeather` (default true).
- `shared/utils/weather.ts`:
  - `placeLabel`.
  - `feelOf` (cold ≤ 8°, cool ≤ 15°, mild ≤ 21°, warm ≤ 27°, hot, from the feels-like high).
  - `isWet`.
  - `seasonsForWeather`.
  - `weatherLine` ("Light rain · 8–14°") and `weatherBrief`, the stylist's sentence.
  - `weatherIcon`.
- **Contracts:** `WeatherProvider.forecast(place, date)` (null outside the forecast window); `PlaceDirectory.search(query)` and `PlaceLocator.locate()` in `PlaceFinder.ts`.
- **Implementations:** the contract suite is `tests/contracts/weather.contract.ts`, and all of these pass it:
  - `server/weather/OpenMeteoWeather`. It maps WMO codes, asks for the one day in the place's time zone, and turns Open-Meteo's "out of allowed range" 400 into null.
  - `OpenMeteoPlaceDirectory` and `GeoJsPlaceLocator`. All three share `getJson()`, which has a 5 s timeout and honours the caller's signal.
  - `CachedWeatherProvider` (a decorator). It keeps forecasts for 30 min and failures for 2 min, so an offline computer isn't made to wait on every page. Callers asking at once share one request, and one caller cancelling doesn't cancel it for the others.
  - `shared/weather/DemoWeather.ts`: offline, deterministic stand-ins (13 cities; this computer "is" in Paris). The prototype gateway, the tests and e2e use them.
- **Fixtures:** `tests/fixtures/weather/` holds a recorded Open-Meteo forecast and search. The GeoJS answer is **sanitized**: Paris with a documentation IP, not the developer's.

## Server
- **`WeatherService`** (`server/services/`):
  - `forDay(date)` and `today()` give the forecast for the city in the settings. They return **null without a city or when the forecast fails**: the weather improves looks, it never stops them. Only cancelling throws.
  - `searchPlaces()` raises the new `UnavailableError` (HTTP 503) with a friendly message when the search is unreachable.
  - `locate()` returns null on failure.
- **Today's recommendation** (`TodayService`):
  - Passes the forecast to the stylist and keeps it on the look.
  - Outerwear is added on cold, cool or wet days instead of by the calendar.
  - Without a forecast, `seasonOf(date, latitude)` now turns the seasons around south of the equator.
  - **When the user sets or changes their city**, today's pick is styled again for the new weather, and the old pick is deleted (one per day). A pick the user favourited is kept, and nothing is restyled while no forecast is available.
- **Studio** (`StylingService`): with `dressForWeather`, today's forecast goes to the stylist and onto the saved look.
- **Claude:**
  - The style message gains *"Dress for today's weather in London, United Kingdom: light rain, 8–14 °C (feels like 6–12 °C), 80% chance of rain, wind up to 25 km/h."* The payload gains `weather: { place, forecast }`.
  - The persona (`STYLIST_AGENT_PROMPT`) has a weather rule: dress for it, judge against it, and fail a look that ignores it. `STYLIST_AGENT_VERSION` is now 2, so existing installs refresh their agent file on the next start.
- **Offline rules** (`RuleBasedStyleAdvisor`):
  - With a forecast, pieces for the wrong season lose points.
  - The rating calls out "No coat on a 6° light rain day" (and suggests the best coat), and "far too heavy" or "far too light" pieces (with a swap).
  - It praises a look that suits the day.
- **Persistence:** migration 3 adds `style_matches.weather` (JSON).
- **API:** `GET /api/weather?date=` → `{ weather }`, `GET /api/places?q=` → `Place[]`, `GET /api/places/here` → `{ place }`. The location itself is saved through `PUT /api/settings`.
- **Wiring:** the container option `weather: 'open-meteo' | 'demo'` defaults to `demo`, so tests never touch the network. `runtimeConfig.weather` is `open-meteo` (`NUXT_WEATHER=demo` for e2e, set in `playwright.config.ts`).

## A bug found on the way
`SettingsUpdateSchema` was `SettingsSchema.partial()`. In zod 4, `.partial()` still fills in each field's **default**, so any partial update reset the other choices. For example, dismissing the welcome (`{ welcomed: true }`) quietly set the model back to Opus and the effort to medium. The update schema now has the same fields without defaults. A regression test covers it in `tests/server/settings.test.ts` and in the gateway contract.

## Client
- **Gateway:** `WeatherGateway` (`getWeather`, `searchPlaces`, `locatePlace`), implemented by the HTTP and mock gateways. Both pass the gateway contract (the city is kept in the settings and has weather; looks are styled for it unless asked not to).
- **`weather` store:** loads the day's forecast once per date, stays quiet when there is none, and `forget()`s after the city changes.
- **`LocationPicker`** (`app/components/location/Picker.vue` + service):
  - Search as you type (debounced 300 ms, and only the newest search shows).
  - Region and country next to each city.
  - *Use my location*.
  - Messages when nothing matches or the search is unreachable.
- **First launch:**
  - The "Meet Dardar" welcome asks *Where do you live?*. It shows "Finding your city…", then the guess ("Paris, France · Not here?"), or the search when it can't tell.
  - *Lovely* saves `welcomed` and the city together, and asks for today's look again, so it is restyled for the weather.
  - Skipping is fine: with no city, *Lovely* saves only the welcome.
- **Settings → Your city:** shows the city and its region, with *Change* (the picker) and *Remove*. A pick **saves at once**, separately from *Save settings*, and the page says so.
- **Home:** the hero shows the weather the look was styled for (an icon plus "Overcast · 5–13° in London, United Kingdom"). Without a city, a quiet line links to Settings.
- **Studio:**
  - A *Dress for today's weather* switch above the vibe prompt shows the forecast; it is on by default. Without a city, an *Add your city* link shows instead.
  - The verdict says what it was rated for ("Rated for light rain · 8–14° in London, United Kingdom").
- The weather icons are chosen in code, so they are listed in `icon.clientBundle.icons` (the scan only reads templates).

## Tests
- **Unit:** the models, the weather utils, and the updated StyleRequest default.
- **Contracts:**
  - The weather, place and locator suites, against the demo, Open-Meteo, GeoJS and cached implementations. Those run on a fake `fetch` that replays the fixtures and refuses out-of-range days like the real API.
  - The cache's sharing, expiry, failure memory and cancelling.
  - The style match repository round-trips `weather`.
  - The gateway contract's new cases.
- **Server:**
  - `WeatherService`.
  - `seasonOf` in the south.
  - Today: dresses for the forecast, outerwear by weather, restyles after a move but keeps a favourite.
  - The Studio: the weather by default, not when turned off or without a city.
  - The style message and payload, the offline advisor's weather rules, the settings (location saved and removed, partial updates), and the API (places, here, weather, 503, a styled look carrying the weather).
- **Nuxt:**
  - The store, the picker service, and the welcome flow (guess, change, can't tell then skip, today asked again).
  - The hero weather and the city nudge, the Settings city (change, remove), and the Studio switch and verdict line.
  - Render tests for all three pages.
- **e2e** (`tests/e2e/weather.spec.ts`):
  - The welcome suggests Paris, and today shows Paris's weather.
  - Pick London in the welcome, change to Tokyo in Settings: Home is restyled for Tokyo, the Studio dresses for Tokyo, and the switch turns it off.
  - Removing the city brings back the Studio's *Add your city*.
- **Live** (`RUN_LIVE=1`, `tests/server/weather.live.test.ts`): Open-Meteo finds London and forecasts today; GeoJS guesses a place.

## Verification
- `npm test`: 591 passed (13 opt-in skipped); lint and typecheck clean.
- `npm run test:e2e`: 26 passed.
- `RUN_LIVE=1` weather test: passed against the real Open-Meteo and GeoJS.
- Screenshots of the welcome, search, Home, Settings and Studio (e2e server, demo weather) checked by eye. That led to two fixes: the city field became a plain text input (the native search "×" was blue), and the verdict line uses the forecast's icon.
- Not run: the live Claude tests (they cost money; the prompt change is covered by the prompt tests), and the packaged smoke test (no installer was built in this phase).

## Known limits
- Temperatures are in °C only.
- The IP guess can be off (VPNs, mobile networks), which is why it is only a suggestion.
- Open-Meteo's free tier is non-commercial, like SegFormer's licence. Selling the app means a paid plan or another `WeatherProvider`, which is one new class.
- Today's pick keeps the forecast it was styled with. It is not restyled when the forecast changes during the day, only when the city does.
- The Studio's AI fill doesn't switch on *Outerwear* by itself on a cold day. Instead the verdict calls out the missing coat and offers it as a fix.

## Fix after the phase: the upload tray covered *Add item*
The upload tray (in the layout) and the wardrobe's floating *Add item* button (on the page) were both fixed to the bottom-right corner, and the tray sat on top, so while photos were being prepared the button couldn't be clicked. The tray now uses the `.upload-dock` utility (`main.css`): it sits in the corner, or **stacks above any page's floating button** (`.fab`, matched with `:root:has(.fab)`). That is pure CSS, so no view gains logic. e2e: *the upload tray never covers the Add item button* checks that neither the pill nor its open panel overlaps the button and that the button still opens the dialog.
