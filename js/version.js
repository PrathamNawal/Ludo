// Single source of truth for the build id. Plain script (not a module export) so the service
// worker can importScripts() it and the app can import it. Bump on every release.
self.LUDO_BUILD = '0.3.1';
