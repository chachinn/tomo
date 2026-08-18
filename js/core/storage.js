const PREFIX = 'tomo.v1.';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const store = Object.freeze({
  getHistory: () => read('rollHistory', []),
  setHistory: value => write('rollHistory', value),
  getMaybeLater: () => read('maybeLater', []),
  setMaybeLater: value => write('maybeLater', value),
  getNotTonight: () => read('notTonight', []),
  setNotTonight: value => write('notTonight', value),
  clearNotTonight: () => write('notTonight', []),
  getPreference: (key, fallback = null) => read(`pref.${key}`, fallback),
  setPreference: (key, value) => write(`pref.${key}`, value)
});
