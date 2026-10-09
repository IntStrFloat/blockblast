typeof __r === 'function'
  ? Array.from(__r.getModules()).filter(([, m]) => /features[\\/]game[\\/]store/.test(m.verboseName ?? '')).map(([id, m]) => ({ id, name: m.verboseName }))
  : 'Metro module registry unavailable';
