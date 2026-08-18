# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fab-stacking.spec.ts >> FAB stacking — MySyariahAI case-law page fixture (375 × 812) >> citation-copied toast (bottom-24 right-6) does not overlap the FAB
- Location: e2e/fab-stacking.spec.ts:562:3

# Error details

```
Error: browserType.launch: Target page, context or browser has been closed
Browser logs:

<launching> /nix/store/71577rskzyhch3axhdqx7faygc2xyn4v-playwright-browsers-1.55.0-with-cjk/chromium-1187/chrome-linux/chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-90363l --remote-debugging-pipe --no-startup-window
<launched> pid=18882
[pid=18882][err] [18882:18896:0818/070533.389196:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=18882][err] [18882:18901:0818/070533.391644:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=18882][err] [18882:18901:0818/070533.391700:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=18882][err] [18882:18896:0818/070533.394062:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=18882][err] [18882:18896:0818/070533.419845:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=18882][err] [18917:18917:0818/070533.424986:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18882][err] [0818/070533.426578:ERROR:third_party/crashpad/crashpad/snapshot/linux/debug_rendezvous.cc:122] unexpected version 2
[pid=18882][err] [0818/070533.426895:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq: No such file or directory (2)
[pid=18882][err] [0818/070533.426909:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq: No such file or directory (2)
[pid=18882][err] [18916:18916:0818/070533.437249:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18882][err] [18882:18882:0818/070533.437848:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
Call log:
  - <launching> /nix/store/71577rskzyhch3axhdqx7faygc2xyn4v-playwright-browsers-1.55.0-with-cjk/chromium-1187/chrome-linux/chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-90363l --remote-debugging-pipe --no-startup-window
  - <launched> pid=18882
  - [pid=18882][err] [18882:18896:0818/070533.389196:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
  - [pid=18882][err] [18882:18901:0818/070533.391644:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
  - [pid=18882][err] [18882:18901:0818/070533.391700:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
  - [pid=18882][err] [18882:18896:0818/070533.394062:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18882][err] [18882:18896:0818/070533.419845:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18882][err] [18917:18917:0818/070533.424986:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18882][err] [0818/070533.426578:ERROR:third_party/crashpad/crashpad/snapshot/linux/debug_rendezvous.cc:122] unexpected version 2
  - [pid=18882][err] [0818/070533.426895:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq: No such file or directory (2)
  - [pid=18882][err] [0818/070533.426909:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq: No such file or directory (2)
  - [pid=18882][err] [18916:18916:0818/070533.437249:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18882][err] [18882:18882:0818/070533.437848:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18882] <gracefully close start>
  - [pid=18882] <kill>
  - [pid=18882] <will force kill>
  - [pid=18882][err] [0818/070533.438478:ERROR:third_party/crashpad/crashpad/snapshot/linux/debug_rendezvous.cc:122] unexpected version 2
  - [pid=18882][err] [0818/070533.438679:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq: No such file or directory (2)
  - [pid=18882][err] [0818/070533.438688:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq: No such file or directory (2)
  - [pid=18882][err] [18882:18882:0818/070533.438959:ERROR:dbus/object_proxy.cc:573] Failed to call method: org.freedesktop.DBus.NameHasOwner: object_path= /org/freedesktop/DBus: unknown error type:
  - [pid=18882][err] [18882:18896:0818/070533.439099:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18882][err] [18882:18896:0818/070533.439118:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18882][err] [18882:18896:0818/070533.439128:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18882][err] [18882:18896:0818/070533.439133:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18882][err] [18882:18896:0818/070533.439137:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18882] <process did exit: exitCode=null, signal=SIGKILL>
  - [pid=18882] starting temporary directories cleanup
  - [pid=18882] finished temporary directories cleanup
  - [pid=18882] <gracefully close end>

```