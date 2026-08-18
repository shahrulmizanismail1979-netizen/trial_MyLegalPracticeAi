# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fab-stacking.spec.ts >> FAB stacking — MySyariahAI case-law page fixture (375 × 812) >> Toaster viewport at mobile (fixed top-0) does not overlap the FAB
- Location: e2e/fab-stacking.spec.ts:603:3

# Error details

```
Error: browserType.launch: Target page, context or browser has been closed
Browser logs:

<launching> /nix/store/71577rskzyhch3axhdqx7faygc2xyn4v-playwright-browsers-1.55.0-with-cjk/chromium-1187/chrome-linux/chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-faZsmE --remote-debugging-pipe --no-startup-window
<launched> pid=18939
[pid=18939][err] [18939:18953:0818/070534.346746:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=18939][err] [18939:18958:0818/070534.348723:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=18939][err] [18939:18958:0818/070534.348787:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=18939][err] [18939:18953:0818/070534.352000:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=18939][err] [18939:18953:0818/070534.376702:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=18939][err] [18939:18979:0818/070534.382375:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18939][err] [18974:18974:0818/070534.382367:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18939][err] [0818/070534.387105:ERROR:third_party/crashpad/crashpad/snapshot/linux/debug_rendezvous.cc:122] unexpected version 2
[pid=18939][err] [0818/070534.387367:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq: No such file or directory (2)
[pid=18939][err] [0818/070534.387390:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq: No such file or directory (2)
[pid=18939][err] [18939:18939:0818/070534.388387:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
Call log:
  - <launching> /nix/store/71577rskzyhch3axhdqx7faygc2xyn4v-playwright-browsers-1.55.0-with-cjk/chromium-1187/chrome-linux/chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-faZsmE --remote-debugging-pipe --no-startup-window
  - <launched> pid=18939
  - [pid=18939][err] [18939:18953:0818/070534.346746:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
  - [pid=18939][err] [18939:18958:0818/070534.348723:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
  - [pid=18939][err] [18939:18958:0818/070534.348787:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
  - [pid=18939][err] [18939:18953:0818/070534.352000:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18939][err] [18939:18953:0818/070534.376702:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18939][err] [18939:18979:0818/070534.382375:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18939][err] [18974:18974:0818/070534.382367:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18939][err] [0818/070534.387105:ERROR:third_party/crashpad/crashpad/snapshot/linux/debug_rendezvous.cc:122] unexpected version 2
  - [pid=18939][err] [0818/070534.387367:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq: No such file or directory (2)
  - [pid=18939][err] [0818/070534.387390:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq: No such file or directory (2)
  - [pid=18939][err] [18939:18939:0818/070534.388387:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18939] <gracefully close start>
  - [pid=18939] <kill>
  - [pid=18939] <will force kill>
  - [pid=18939][err] [18939:18939:0818/070534.390364:ERROR:dbus/object_proxy.cc:573] Failed to call method: org.freedesktop.DBus.NameHasOwner: object_path= /org/freedesktop/DBus: unknown error type:
  - [pid=18939][err] [18939:18953:0818/070534.390639:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18939][err] [18939:18953:0818/070534.390658:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18939][err] [18939:18953:0818/070534.390672:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18939][err] [18939:18953:0818/070534.390678:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18939][err] [18939:18953:0818/070534.390682:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18939] <process did exit: exitCode=null, signal=SIGKILL>
  - [pid=18939] starting temporary directories cleanup
  - [pid=18939] finished temporary directories cleanup
  - [pid=18939] <gracefully close end>

```