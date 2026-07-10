import { GlobalRegistrator } from "@happy-dom/global-registrator"

// `bun test` runs every suite in one process, so happy-dom's globals leak into
// the pure-logic suites. Its stream implementations are incompatible with
// react-email's `render` (pipeTo rejects happy-dom's WritableStream), so keep
// the native stream constructors after registering the DOM.
const nativeStreams = {
  ReadableStream: globalThis.ReadableStream,
  WritableStream: globalThis.WritableStream,
  TransformStream: globalThis.TransformStream,
}

GlobalRegistrator.register()

Object.assign(globalThis, nativeStreams)

// happy-dom ships no IntersectionObserver. Register a controllable stub whose
// observed elements can be flipped intersecting on demand via `fireIntersect`.
interface StubObserver {
  callback: IntersectionObserverCallback
  elements: Set<Element>
}

const observers = new Set<StubObserver>()

class MockIntersectionObserver {
  private stub: StubObserver

  constructor(callback: IntersectionObserverCallback) {
    this.stub = { callback, elements: new Set() }
    observers.add(this.stub)
  }

  observe(element: Element) {
    this.stub.elements.add(element)
  }

  unobserve(element: Element) {
    this.stub.elements.delete(element)
  }

  disconnect() {
    this.stub.elements.clear()
    observers.delete(this.stub)
  }

  takeRecords() {
    return []
  }
}

globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

/** Fire an intersection callback for every currently-observed element. */
export function fireIntersect(isIntersecting: boolean) {
  for (const { callback, elements } of observers) {
    const entries = [...elements].map(
      target => ({ isIntersecting, target }) as IntersectionObserverEntry,
    )
    if (entries.length) callback(entries, {} as IntersectionObserver)
  }
}
