const SETTINGS_KEY = 'deepseek/settings'

const DEFAULT_SETTINGS = Object.freeze({
  rememberChatWindowBounds: true
})

function normalizeSettings(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    rememberChatWindowBounds: settings.rememberChatWindowBounds !== false
  }
}

export function getPluginSettings() {
  try {
    return normalizeSettings(utools.dbStorage.getItem(SETTINGS_KEY) || {})
  } catch (error) {
    return { ...DEFAULT_SETTINGS }
  }
}

export function updatePluginSettings(patch) {
  const nextSettings = normalizeSettings({
    ...getPluginSettings(),
    ...patch
  })

  try {
    utools.dbStorage.setItem(SETTINGS_KEY, nextSettings)
  } catch (error) {
    // Ignore storage failures so settings do not block the plugin.
  }

  return nextSettings
}

