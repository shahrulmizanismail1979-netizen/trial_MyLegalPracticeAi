# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fab-stacking.spec.ts >> FAB stacking — conforming layout (375 × 812) >> Amani FAB does not intersect a bottom-24 toast
- Location: e2e/fab-stacking.spec.ts:141:3

# Error details

```
Error: browserType.launch: Target page, context or browser has been closed
Browser logs:

<launching> /nix/store/71577rskzyhch3axhdqx7faygc2xyn4v-playwright-browsers-1.55.0-with-cjk/chromium-1187/chrome-linux/chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-LkwPMU --remote-debugging-pipe --no-startup-window
<launched> pid=18386
[pid=18386][err] [18386:18386:0818/070527.085412:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18386][err] [18386:18386:0818/070527.085786:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18386][err] [18386:18386:0818/070527.085922:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18386][err] [18386:18386:0818/070527.086142:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18386][err] [18386:18386:0818/070527.086157:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18386][err] [18386:18386:0818/070527.086186:FATAL:content/browser/scheduler/browser_task_executor.cc:299] Failed to start BrowserThread:IO
[pid=18386][err] [0818/070527.089415:ERROR:third_party/crashpad/crashpad/snapshot/linux/debug_rendezvous.cc:122] unexpected version 2
[pid=18386][err] [0818/070527.090317:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq: No such file or directory (2)
[pid=18386][err] [0818/070527.090333:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq: No such file or directory (2)
Call log:
  - <launching> /nix/store/71577rskzyhch3axhdqx7faygc2xyn4v-playwright-browsers-1.55.0-with-cjk/chromium-1187/chrome-linux/chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-LkwPMU --remote-debugging-pipe --no-startup-window
  - <launched> pid=18386
  - [pid=18386][err] [18386:18386:0818/070527.085412:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18386][err] [18386:18386:0818/070527.085786:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18386][err] [18386:18386:0818/070527.085922:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18386][err] [18386:18386:0818/070527.086142:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18386][err] [18386:18386:0818/070527.086157:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18386][err] [18386:18386:0818/070527.086186:FATAL:content/browser/scheduler/browser_task_executor.cc:299] Failed to start BrowserThread:IO
  - [pid=18386][err] [0818/070527.089415:ERROR:third_party/crashpad/crashpad/snapshot/linux/debug_rendezvous.cc:122] unexpected version 2
  - [pid=18386][err] [0818/070527.090317:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq: No such file or directory (2)
  - [pid=18386][err] [0818/070527.090333:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq: No such file or directory (2)
  - [pid=18386] <gracefully close start>
  - [pid=18386] <kill>
  - [pid=18386] <will force kill>
  - [pid=18386] <process did exit: exitCode=null, signal=SIGABRT>
  - [pid=18386] starting temporary directories cleanup
  - [pid=18386] finished temporary directories cleanup
  - [pid=18386] <gracefully close end>

```