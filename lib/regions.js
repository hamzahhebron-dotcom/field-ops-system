// Regions and their timezones.
// To add a country later: add one line here — everything else updates automatically.
export const REGIONS = {
  palestine: { label: 'Palestine (Gaza / West Bank)', flag: '🇵🇸', timezone: 'Asia/Gaza' },
  lebanon: { label: 'Lebanon', flag: '🇱🇧', timezone: 'Asia/Beirut' },
  jordan: { label: 'Jordan', flag: '🇯🇴', timezone: 'Asia/Amman' },
  syria: { label: 'Syria', flag: '🇸🇾', timezone: 'Asia/Damascus' },
  egypt: { label: 'Egypt', flag: '🇪🇬', timezone: 'Africa/Cairo' },
  iraq: { label: 'Iraq', flag: '🇮🇶', timezone: 'Asia/Baghdad' },
  yemen: { label: 'Yemen', flag: '🇾🇪', timezone: 'Asia/Aden' },
}

// Format a UTC timestamp in the visit's regional time
export function formatTimeInRegion(iso, regionKey) {
  if (!iso) return '—'
  const region = REGIONS[regionKey]
  const d = new Date(iso)

  if (!region) {
    // No region set (old visits) — fall back to device time
    return d.toLocaleDateString() + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return d.toLocaleDateString('en-GB', { timeZone: region.timezone }) +
    ' · ' +
    d.toLocaleTimeString('en-GB', {
      timeZone: region.timezone,
      hour: '2-digit',
      minute: '2-digit',
    })
}

// Get the display label for a region
export function regionLabel(regionKey) {
  const region = REGIONS[regionKey]
  return region ? region.flag + ' ' + region.label : ''
}
