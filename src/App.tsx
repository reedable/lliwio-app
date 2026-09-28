import {
  f7ready,
  App as Framework7,
  Link,
  Toolbar,
  ToolbarPane,
  View,
  Views,
} from "framework7-react";

import store from "./domain/store";
import routes from "./routes";

const App = () => {
  // Framework7 Parameters
  const f7params = {
    name: "lliwio-app", // App name
    /*
     * Read once, at construction. F7 computes app.theme in its constructor and
     * stamps it on <html> with `removeClass('ios md').addClass(app.theme)` — it
     * is never consulted again, so changing this setting only takes effect on a
     * reload. Settings prompts for one.
     *
     * 'auto' is passed straight through and resolved by F7 as
     * `device.ios ? 'ios' : 'md'`.
     */
    theme: store.state.settings.theme,

    // App store
    store: store,

    // App routes
    routes: routes,

    // Register service worker (only on production build)
    serviceWorker:
      process.env.NODE_ENV === "production"
        ? {
            // Must match the Pages subpath: this path also determines the service
            // worker's scope, and a worker at the domain root could not control
            // pages under /lliwio-app/.
            path: "/lliwio-app/service-worker.js",
          }
        : {},
  };

  f7ready(() => {
    // Call F7 APIs here
  });

  return (
    <Framework7 {...f7params}>
      {/* Views/Tabs container */}
      <Views tabs className="safe-areas">
        {/* Tabbar for switching views-tabs */}
        <Toolbar tabbar icons bottom>
          <ToolbarPane>
            <Link
              tabLink="#view-home"
              tabLinkActive
              iconIos="f7:house_fill"
              iconMd="material:home"
              text="Home"
            />
            <Link
              tabLink="#view-settings"
              iconIos="f7:gear"
              iconMd="material:settings"
              text="Settings"
            />
          </ToolbarPane>
        </Toolbar>

        {/* Your main view/tab, should have "view-main" class. It also has "tabActive" prop */}
        <View id="view-home" main tab tabActive url="/" />

        {/* Settings View */}
        <View id="view-settings" name="settings" tab url="/settings/" />
      </Views>
    </Framework7>
  );
};

export default App;
