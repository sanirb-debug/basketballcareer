/**
 * Installs a spec-compliant IndexedDB implementation onto the Node globals so
 * the verification scripts exercise the real `idb` save path headlessly,
 * rather than mocking persistence and proving nothing.
 */
import 'fake-indexeddb/auto';
