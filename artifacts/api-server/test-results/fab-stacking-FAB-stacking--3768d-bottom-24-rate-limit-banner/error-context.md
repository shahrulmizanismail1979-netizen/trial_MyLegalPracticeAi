# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fab-stacking.spec.ts >> FAB stacking — conforming layout (375 × 812) >> Amani FAB does not intersect a centered bottom-24 rate-limit banner
- Location: e2e/fab-stacking.spec.ts:184:3

# Error details

```
Error: browserType.launch: Target page, context or browser has been closed
Browser logs:

<launching> /nix/store/71577rskzyhch3axhdqx7faygc2xyn4v-playwright-browsers-1.55.0-with-cjk/chromium-1187/chrome-linux/chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-VHnb3O --remote-debugging-pipe --no-startup-window
<launched> pid=18422
[pid=18422][err] [18422:18422:0818/070527.909692:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18422][err] [18422:18422:0818/070527.909973:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18422][err] [18422:18422:0818/070527.910002:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18422][err] [18422:18422:0818/070527.910084:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18422][err] [18422:18422:0818/070527.910166:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
[pid=18422][err] [18422:18422:0818/070527.910214:FATAL:content/browser/scheduler/browser_task_executor.cc:299] Failed to start BrowserThread:IO
[pid=18422][err] [0818/070527.911552:ERROR:third_party/crashpad/crashpad/snapshot/linux/debug_rendezvous.cc:122] unexpected version 2
[pid=18422][err] [0818/070527.912288:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq: No such file or directory (2)
[pid=18422][err] [0818/070527.912320:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq: No such file or directory (2)
Call log:
  - <launching> /nix/store/71577rskzyhch3axhdqx7faygc2xyn4v-playwright-browsers-1.55.0-with-cjk/chromium-1187/chrome-linux/chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-VHnb3O --remote-debugging-pipe --no-startup-window
  - <launched> pid=18422
  - [pid=18422][err] [18422:18422:0818/070527.909692:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18422][err] [18422:18422:0818/070527.909973:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18422][err] [18422:18422:0818/070527.910002:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18422][err] [18422:18422:0818/070527.910084:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18422][err] [18422:18422:0818/070527.910166:ERROR:base/threading/platform_thread_posix.cc:158] pthread_create: Resource temporarily unavailable (11)
  - [pid=18422][err] [18422:18422:0818/070527.910214:FATAL:content/browser/scheduler/browser_task_executor.cc:299] Failed to start BrowserThread:IO
  - [pid=18422][err] [0818/070527.911552:ERROR:third_party/crashpad/crashpad/snapshot/linux/debug_rendezvous.cc:122] unexpected version 2
  - [pid=18422][err] [0818/070527.912288:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq: No such file or directory (2)
  - [pid=18422][err] [0818/070527.912320:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:145] open /sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq: No such file or directory (2)
  - [pid=18422] <gracefully close start>
  - [pid=18422] <kill>
  - [pid=18422] <will force kill>
  - [pid=18422] <process did exit: exitCode=null, signal=SIGABRT>
  - [pid=18422] starting temporary directories cleanup
  - [pid=18422] finished temporary directories cleanup
  - [pid=18422] <gracefully close end>

```