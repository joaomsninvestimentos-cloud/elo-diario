import 'fake-indexeddb/auto';

// jsdom não implementa canvas; os testes de interface não precisam do desenho real
const stubContext = new Proxy(
  {},
  {
    get: (_target, prop) => {
      if (prop === 'canvas') return { width: 800, height: 1200 };
      if (prop === 'getImageData') {
        return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      }
      if (prop === 'measureText') return () => ({ width: 0 });
      return () => undefined;
    },
    set: () => true,
  },
);

HTMLCanvasElement.prototype.getContext = (() => stubContext) as never;
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
}
window.scrollTo = (() => undefined) as never;
