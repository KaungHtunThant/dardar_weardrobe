import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DayWeather, Place } from '#shared/models/weather'
import { useGateway } from '~/gateways/provider'

/** The forecast where the user lives (quietly absent when unknown), and finding their city. */
export const useWeatherStore = defineStore('weather', () => {
  const forecast = ref<DayWeather | null>(null)
  const loaded = ref(false)
  let loadedDate: string | null = null

  /** The forecast for a YYYY-MM-DD date; asked once per date until forget(). */
  async function load(date: string) {
    if (loadedDate === date) return
    loadedDate = date
    try {
      forecast.value = await useGateway().getWeather(date)
    } catch {
      // The weather is a nicety: without it the app works as before.
      forecast.value = null
    } finally {
      loaded.value = true
    }
  }

  /** After the city changes. */
  function forget() {
    forecast.value = null
    loaded.value = false
    loadedDate = null
  }

  function searchPlaces(query: string): Promise<Place[]> {
    return useGateway().searchPlaces(query)
  }

  /** A guess at where the user is; null when it can't tell. */
  async function locate(): Promise<Place | null> {
    try {
      return await useGateway().locatePlace()
    } catch {
      return null
    }
  }

  return { forecast, loaded, load, forget, searchPlaces, locate }
})
