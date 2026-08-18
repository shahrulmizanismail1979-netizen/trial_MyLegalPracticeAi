# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fab-stacking.spec.ts >> FAB stacking — violation detector self-test (375 × 812) >> detector catches a bottom-6 element that violates the clearance rule
- Location: e2e/fab-stacking.spec.ts:234:3

# Error details

```
Error: browserType.launch: Target page, context or browser has been closed
Browser logs:

<launching> /nix/store/71577rskzyhch3axhdqx7faygc2xyn4v-playwright-browsers-1.55.0-with-cjk/chromium-1187/chrome-linux/chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-dUkWgA --remote-debugging-pipe --no-startup-window
<launched> pid=18453
[pid=18453][err] [18453:18469:0818/070528.624700:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=18453][err] [18453:18472:0818/070528.626277:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=18453][err] [18453:18472:0818/070528.626359:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
[pid=18453][err] [18453:18469:0818/070528.629810:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=18453][err] [18453:18469:0818/070528.761594:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
[pid=18453][err] [18453:18494:0818/070528.768502:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18453][err] [18486:18492:0818/070528.769794:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18453][err] [18453:18453:0818/070528.771154:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18453][err] [18453:18453:0818/070528.771260:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18453][err] [18453:18470:0818/070528.771623:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18453][err] [18453:18466:0818/070528.772222:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18453][err] [18453:18478:0818/070528.773350:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18453][err] [18453:18453:0818/070528.783445:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
Call log:
  - <launching> /nix/store/71577rskzyhch3axhdqx7faygc2xyn4v-playwright-browsers-1.55.0-with-cjk/chromium-1187/chrome-linux/chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-dUkWgA --remote-debugging-pipe --no-startup-window
  - <launched> pid=18453
  - [pid=18453][err] [18453:18469:0818/070528.624700:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
  - [pid=18453][err] [18453:18472:0818/070528.626277:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
  - [pid=18453][err] [18453:18472:0818/070528.626359:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory
  - [pid=18453][err] [18453:18469:0818/070528.629810:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18453][err] [18453:18469:0818/070528.761594:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18453][err] [18453:18494:0818/070528.768502:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18453][err] [18486:18492:0818/070528.769794:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18453][err] [18453:18453:0818/070528.771154:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18453][err] [18453:18453:0818/070528.771260:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18453][err] [18453:18470:0818/070528.771623:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18453][err] [18453:18466:0818/070528.772222:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18453][err] [18453:18478:0818/070528.773350:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18453][err] [18453:18453:0818/070528.783445:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18453] <gracefully close start>
  - [pid=18453] <kill>
  - [pid=18453] <will force kill>
  - [pid=18453][err] [18453:18453:0818/070528.784382:ERROR:dbus/object_proxy.cc:573] Failed to call method: org.freedesktop.DBus.NameHasOwner: object_path= /org/freedesktop/DBus: unknown error type:
  - [pid=18453][err] [18453:18469:0818/070528.784639:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18453][err] [18453:18469:0818/070528.784701:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18453][err] [18453:18469:0818/070528.784712:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18453][err] [18453:18469:0818/070528.784717:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18453][err] [18453:18469:0818/070528.784754:ERROR:dbus/bus.cc:408] Failed to connect to the bus: Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")
  - [pid=18453] <process did exit: exitCode=null, signal=SIGKILL>
  - [pid=18453] starting temporary directories cleanup
  - [pid=18453] finished temporary directories cleanup
  - [pid=18453] <gracefully close end>

```