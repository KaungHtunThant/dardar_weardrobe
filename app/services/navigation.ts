/** True when the current entry was reached from inside the app, so router.back() stays in the app. */
export function canGoBack(): boolean {
  return typeof window !== 'undefined' && Boolean(window.history.state?.back)
}
