import * as Localization from 'expo-localization';

// Gerätesprache Deutsch -> Deutsch; alle anderen -> Englisch.
// iOS-seitig wird bei App-Sprachänderung in den Einstellungen die gewählte Sprache als erste geliefert.
const locales = Localization.getLocales();
const primaryLanguage = locales[0]?.languageCode || 'en';
export const locale = primaryLanguage === 'de' ? 'de' : 'en';

const translations = {
  de: {
    // Auth
    welcome: 'Willkommen',
    signUp: 'Registrieren',
    signIn: 'Anmelden',
    authDescription: 'Melde dich mit deinem bestehenden Yoriax Account an. Die native App nutzt dieselbe Supabase-Session wie unsere Plattformdaten.',
    email: 'E-Mail',
    password: 'Passwort',
    passwordPlaceholder: 'Mindestens 6 Zeichen',
    continueWithGoogle: 'Mit Google fortfahren',
    or: 'oder',
    securityCheckComplete: 'Sicherheitsprüfung abgeschlossen.',
    securityCheckPending: 'Bitte bestätige die Sicherheitsprüfung, bevor du dich einloggst.',
    noAccount: 'Noch keinen Account? Registrieren',
    hasAccount: 'Schon einen Account? Einloggen',
    verifySecurity: 'Sicherheitsprüfung bestätigen',
    createAccount: 'Account erstellen',
    login: 'Einloggen',
    
    // Home
    favorites: 'Lieblingssongs',
    favoritesSub: 'Deine gespeicherten Tracks',
    charts: 'Charts',
    chartsSub: 'Viral, Daily, Creators',
    artists: 'Künstler',
    artistsSub: 'Neue Creator entdecken',
    playlists: 'Playlists',
    playlistsSub: 'Community & kuratiert',
    preparingHome: 'Startseite wird vorbereitet',
    preparingHomeSub: 'Deine YORIAX-Auswahl ist gleich bereit.',
    loadHomeError: 'Home konnte nicht geladen werden.',
    trendingToday: 'Trending heute',
    selectedForYou: 'Für dich ausgewählt',
    newOnYoriax: 'Neu auf YORIAX',
    streams: 'Streams',
    
    // Player
    noActiveSong: 'Kein Song aktiv',
    duration: 'Dauer',
    share: 'Teilen',
    cancel: 'Abbrechen',
    options: 'Optionen',
    songDetails: 'Song-Details',
    sleeptimer: 'Sleeptimer',
    addToFavorites: 'Zu Lieblingssongs hinzufügen',
    changeSaveLocations: 'Speicherorte ändern',
    addedToFavorites: 'In Lieblingssongs gespeichert',
    removedFromFavorites: 'Aus Lieblingssongs entfernt',
    addedToFavoritesToast: 'Hinzugefügt zu: Lieblingssongs.',
    change: 'Ändern',
    minutes5: '5 Minuten',
    minutes10: '10 Minuten',
    minutes15: '15 Minuten',
    minutes30: '30 Minuten',
    deleteTimer: 'Timer löschen',
    sleepTimerActive: 'Sleeptimer aktiv',
    sleepTimerActiveSub: 'Die Wiedergabe stoppt in {minutes} Minuten.',
    repeatOne: 'Aktuellen Song wiederholen',
    repeatAll: 'Playlist wiederholen',
    repeatOff: 'Wiederholung aus',
    shareMessage: 'Höre {title} auf YORIAX: https://www.yoriax.com/song/{id}',
  },
  en: {
    // Auth
    welcome: 'Welcome',
    signUp: 'Sign Up',
    signIn: 'Sign In',
    authDescription: 'Sign in with your existing Yoriax account. The native app uses the same Supabase session as our website.',
    email: 'Email',
    password: 'Password',
    passwordPlaceholder: 'At least 6 characters',
    continueWithGoogle: 'Continue with Google',
    or: 'or',
    securityCheckComplete: 'Security check completed.',
    securityCheckPending: 'Please complete the security check before signing in.',
    noAccount: "Don't have an account? Sign Up",
    hasAccount: 'Already have an account? Log In',
    verifySecurity: 'Confirm security check',
    createAccount: 'Create Account',
    login: 'Log In',
    
    // Home
    favorites: 'Favorites',
    favoritesSub: 'Your saved tracks',
    charts: 'Charts',
    chartsSub: 'Viral, Daily, Creators',
    artists: 'Artists',
    artistsSub: 'Discover new creators',
    playlists: 'Playlists',
    playlistsSub: 'Community & curated',
    preparingHome: 'Preparing Home Screen',
    preparingHomeSub: 'Your YORIAX selection will be ready shortly.',
    loadHomeError: 'Could not load Home Screen.',
    trendingToday: 'Trending Today',
    selectedForYou: 'Selected for You',
    newOnYoriax: 'New on YORIAX',
    streams: 'Streams',
    
    // Player
    noActiveSong: 'No active song',
    duration: 'Duration',
    share: 'Share',
    cancel: 'Cancel',
    options: 'Options',
    songDetails: 'Song Details',
    sleeptimer: 'Sleep Timer',
    addToFavorites: 'Add to favorites',
    changeSaveLocations: 'Change save locations',
    addedToFavorites: 'Saved to favorites',
    removedFromFavorites: 'Removed from favorites',
    addedToFavoritesToast: 'Added to: Favorites.',
    change: 'Change',
    minutes5: '5 Minutes',
    minutes10: '10 Minutes',
    minutes15: '15 Minutes',
    minutes30: '30 Minutes',
    deleteTimer: 'Delete Timer',
    sleepTimerActive: 'Sleep Timer Active',
    sleepTimerActiveSub: 'Playback will stop in {minutes} minutes.',
    repeatOne: 'Repeat current song',
    repeatAll: 'Repeat playlist',
    repeatOff: 'Repeat off',
    shareMessage: 'Listen to {title} on YORIAX: https://www.yoriax.com/song/{id}',
  }
};

export function t(key: keyof typeof translations['de']): string {
  return translations[locale][key] || translations['en'][key] || key;
}
