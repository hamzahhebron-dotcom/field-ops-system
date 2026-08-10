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

// Format a UTC timestamp in the visit's regional time, 12-hour clock with AM/PM
export function formatTimeInRegion(iso, regionKey) {
  if (!iso) return '—'
  const region = REGIONS[regionKey]
  const d = new Date(iso)

  if (!region) {
    // No region set (old visits) — fall back to device time
    return d.toLocaleDateString('en-GB') + ' · ' + d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return d.toLocaleDateString('en-GB', { timeZone: region.timezone }) +
    ' · ' +
    d.toLocaleTimeString('en-US', {
      timeZone: region.timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
}

// Get the display label for a region
export function regionLabel(regionKey) {
  const region = REGIONS[regionKey]
  return region ? region.flag + ' ' + region.label : ''
}
