// Mock global ResizeObserver for jsdom environment
class ResizeObserver {
  constructor(callback) {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

window.ResizeObserver = ResizeObserver;

global.ResizeObserver = ResizeObserver;
