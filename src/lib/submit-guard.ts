export function createSingleFlight() {
  let pending = false;
  return {
    start() {
      if (pending) return false;
      pending = true;
      return true;
    },
    finish() {
      pending = false;
    },
  };
}
