# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fab-stacking.spec.ts >> FAB stacking — MyCrimAI case-law page fixture (375 × 812) >> rate-limit banner (bottom-24 centered) does not overlap the FAB
- Location: e2e/fab-stacking.spec.ts:449:3

# Error details

```
Error: browserType.launch: Target page, context or browser has been closed
Browser logs:

<launching> /nix/store/71577rskzyhch3axhdqx7faygc2xyn4v-playwright-browsers-1.55.0-with-cjk/chromium-1187/chrome-linux/chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-qzTC5i --remote-debugging-pipe --no-startup-window
<launched> pid=18740
[pid=18740][err] [18740:18755:0818/070532.024788:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=18740][err] [18740:18759:0818/070532.027510:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=18740][err] [18740:18759:0818/070532.027591:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=18740][err] [18740:18755:0818/070532.031273:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=18740][err] [18740:18755:0818/070532.064169:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=18740][err] [18740:18780:0818/070532.070581:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18740][err] [18773:18773:0818/070532.070820:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18740][err] [0818/070532.072588:ERROR:third_party/crashpad/crashpad/snapshot/linux/debug_rendezvous.cc:122] unexpected version 2
[pid=18740][err] [0818/070532.073241:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq: No such file or directory (2)
[pid=18740][err] [0818/070532.073389:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq: No such file or directory (2)
[pid=18740][err] [18740:18740:0818/070532.079310:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
Call log:
  - <launching> /nix/store/71577rskzyhch3axhdqx7faygc2xyn4v-playwright-browsers-1.55.0-with-cjk/chromium-1187/chrome-linux/chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-qzTC5i --remote-debugging-pipe --no-startup-window
  - <launched> pid=18740
  - [pid=18740][err] [18740:18755:0818/070532.024788:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
  - [pid=18740][err] [18740:18759:0818/070532.027510:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
  - [pid=18740][err] [18740:18759:0818/070532.027591:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
  - [pid=18740][err] [18740:18755:0818/070532.031273:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18740][err] [18740:18755:0818/070532.064169:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18740][err] [18740:18780:0818/070532.070581:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18740][err] [18773:18773:0818/070532.070820:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18740][err] [0818/070532.072588:ERROR:third_party/crashpad/crashpad/snapshot/linux/debug_rendezvous.cc:122] unexpected version 2
  - [pid=18740][err] [0818/070532.073241:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq: No such file or directory (2)
  - [pid=18740][err] [0818/070532.073389:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq: No such file or directory (2)
  - [pid=18740][err] [18740:18740:0818/070532.079310:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18740] <gracefully close start>
  - [pid=18740] <kill>
  - [pid=18740] <will force kill>
  - [pid=18740][err] [18772:18772:0818/070532.079507:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18740][err] [18740:18740:0818/070532.080189:ERROR:dbus/object_proxy.cc:573] Failed to call method: org.freedesktop.DBus.NameHasOwner: object_path= /org/freedesktop/DBus: unknown error type:
  - [pid=18740][err] [0818/070532.080675:ERROR:third_party/crashpad/crashpad/snapshot/linux/debug_rendezvous.cc:122] unexpected version 2
  - [pid=18740][err] [0818/070532.080913:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq: No such file or directory (2)
  - [pid=18740][err] [0818/070532.080923:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq: No such file or directory (2)
  - [pid=18740][err] [18740:18755:0818/070532.082376:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18740][err] [18740:18755:0818/070532.082395:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18740][err] [18740:18755:0818/070532.082495:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18740][err] [18740:18755:0818/070532.082504:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18740][err] [18740:18755:0818/070532.082509:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18740] <process did exit: exitCode=null, signal=SIGKILL>
  - [pid=18740] starting temporary directories cleanup
  - [pid=18740] finished temporary directories cleanup
  - [pid=18740] <gracefully close end>

```