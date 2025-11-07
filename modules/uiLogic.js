export function shouldShowToolbar(route) {
  return route === '#/' || route === '' || route === null || typeof route === 'undefined';
}

export function shouldShowTokenEstimate(mode) {
  return mode === 'text';
}
