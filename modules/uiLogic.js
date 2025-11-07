export function isPricingRoute(route) {
  return route === '#/' || route === '' || route === null || typeof route === 'undefined';
}

export function shouldShowToolbar(route) {
  return isPricingRoute(route);
}

export function shouldShowTokenEstimate(mode) {
  return mode === 'text';
}

export function isCalcRoute(route) {
  return route === '#/calc';
}

