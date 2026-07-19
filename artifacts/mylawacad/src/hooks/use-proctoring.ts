import { useEffect, useRef, useState, useCallback } from "react";
import { useSubmitProctorEvent } from "@/lib/api-client";

export type AntiCheatConfig = {
  lockFullscreen: boolean;
  blockCopyPaste: boolean;
  blockRightClick: boolean;
  blockShortcuts: boolean;
  detectDevtools: boolean;
  idleTimeoutSeconds: number;
  maxTabSwitches: number;
  autoFlagThreshold: number;
};

export type ProctorKind =
  | "tab_switch"
  | "window_blur"
  | "copy_attempt"
  | "paste_attempt"
  | "right_click"
  | "shortcut_block"
  | "fullscreen_exit"
  | "fullscreen_enter"
  | "devtools_suspected"
  | "idle"
  | "mouse_leave";

const DEFAULT_SEVERITY: Record<ProctorKind, number> = {
  tab_switch: 15,
  window_blur: 5,
  copy_attempt: 10,
  paste_attempt: 12,
  right_click: 3,
  shortcut_block: 8,
  fullscreen_exit: 20,
  fullscreen_enter: 0,
  devtools_suspected: 25,
  idle: 5,
  mouse_leave: 2,
};

export type ProctorEvent = {
  kind: ProctorKind;
  details: string;
  severity: number;
  at: number;
};

export type ProctorState = {
  trustScore: number;
  events: ProctorEvent[];
  tabSwitches: number;
  inFullscreen: boolean;
  lastEvent: ProctorEvent | null;
};

type Options = {
  sessionId: string;
  config: AntiCheatConfig;
  enabled: boolean;
  onEvent?: (event: ProctorEvent, state: ProctorState) => void;
};

export function useProctoring({ sessionId, config, enabled, onEvent }: Options) {
  const [state, setState] = useState<ProctorState>({
    trustScore: 100,
    events: [],
    tabSwitches: 0,
    inFullscreen: false,
    lastEvent: null,
  });

  const submit = useSubmitProctorEvent();
  const submitRef = useRef(submit);
  submitRef.current = submit;

  const stateRef = useRef(state);
  stateRef.current = state;

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const lastIdleRef = useRef(Date.now());
  const lastDevtoolsAlertRef = useRef(0);
  const mutedRef = useRef(false);

  const log = useCallback(
    (kind: ProctorKind, details: string) => {
      if (!enabled || mutedRef.current) return;
      const severity = DEFAULT_SEVERITY[kind] ?? 5;
      const evt: ProctorEvent = { kind, details, severity, at: Date.now() };
      setState((s) => {
        const next: ProctorState = {
          ...s,
          trustScore: Math.max(0, s.trustScore - severity),
          events: [...s.events, evt].slice(-200),
          tabSwitches:
            kind === "tab_switch" ? s.tabSwitches + 1 : s.tabSwitches,
          inFullscreen:
            kind === "fullscreen_enter"
              ? true
              : kind === "fullscreen_exit"
                ? false
                : s.inFullscreen,
          lastEvent: evt,
        };
        onEventRef.current?.(evt, next);
        return next;
      });
      submitRef.current.mutate({
        id: sessionId,
        data: { kind, details, severity },
      });
    },
    [enabled, sessionId],
  );

  // Tab visibility / window blur
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.hidden) log("tab_switch", "Tab/window hidden");
    };
    const onBlur = () => log("window_blur", "Window lost focus");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, log]);

  // Right-click blocker
  useEffect(() => {
    if (!enabled || !config.blockRightClick) return;
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      log("right_click", "Right-click blocked");
    };
    document.addEventListener("contextmenu", onContext);
    return () => document.removeEventListener("contextmenu", onContext);
  }, [enabled, config.blockRightClick, log]);

  // Copy / paste / cut
  useEffect(() => {
    if (!enabled || !config.blockCopyPaste) return;
    const onCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Allow copy inside the answer textarea/input — candidate may copy their own draft
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      e.preventDefault();
      log("copy_attempt", "Copy blocked outside input");
    };
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text") ?? "";
      log("paste_attempt", `Pasted ${text.length} chars`);
    };
    const onCut = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      e.preventDefault();
      log("copy_attempt", "Cut blocked outside input");
    };
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("cut", onCut);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("cut", onCut);
    };
  }, [enabled, config.blockCopyPaste, log]);

  // Keyboard shortcut blocker (best-effort)
  useEffect(() => {
    if (!enabled || !config.blockShortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const blocked =
        key === "f12" ||
        (ctrl && e.shiftKey && (key === "i" || key === "j" || key === "c")) ||
        (ctrl && (key === "u" || key === "p" || key === "s"));
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        log(
          "shortcut_block",
          `Blocked ${e.ctrlKey ? "Ctrl+" : ""}${e.metaKey ? "Cmd+" : ""}${e.shiftKey ? "Shift+" : ""}${e.key}`,
        );
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [enabled, config.blockShortcuts, log]);

  // Fullscreen tracking
  useEffect(() => {
    if (!enabled || !config.lockFullscreen) return;
    const onFs = () => {
      if (document.fullscreenElement) log("fullscreen_enter", "Fullscreen on");
      else log("fullscreen_exit", "Fullscreen off");
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [enabled, config.lockFullscreen, log]);

  // Devtools heuristic — outer/inner size mismatch + debugger timing
  useEffect(() => {
    if (!enabled || !config.detectDevtools) return;
    const check = () => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      const open = widthDiff > 200 || heightDiff > 200;
      if (open && Date.now() - lastDevtoolsAlertRef.current > 30_000) {
        lastDevtoolsAlertRef.current = Date.now();
        log("devtools_suspected", "Window dimensions suggest devtools");
      }
    };
    const interval = window.setInterval(check, 4000);
    return () => window.clearInterval(interval);
  }, [enabled, config.detectDevtools, log]);

  // Idle detection
  useEffect(() => {
    if (!enabled) return;
    const reset = () => {
      lastIdleRef.current = Date.now();
    };
    const events = ["mousemove", "keydown", "scroll", "click", "touchstart"];
    for (const ev of events) document.addEventListener(ev, reset);
    const timer = window.setInterval(() => {
      const idle = (Date.now() - lastIdleRef.current) / 1000;
      if (idle >= config.idleTimeoutSeconds) {
        lastIdleRef.current = Date.now();
        log("idle", `Idle for ${Math.round(idle)}s`);
      }
    }, 5000);
    return () => {
      for (const ev of events) document.removeEventListener(ev, reset);
      window.clearInterval(timer);
    };
  }, [enabled, config.idleTimeoutSeconds, log]);

  // Mouse leave window
  useEffect(() => {
    if (!enabled) return;
    const onLeave = (e: MouseEvent) => {
      if (
        e.clientY <= 0 ||
        e.clientX <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        log("mouse_leave", "Pointer left viewport");
      }
    };
    document.addEventListener("mouseleave", onLeave);
    return () => document.removeEventListener("mouseleave", onLeave);
  }, [enabled, log]);

  const requestFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) {
        await el.requestFullscreen();
      }
    } catch {
      // ignore — some browsers reject without user gesture
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen)
        await document.exitFullscreen();
    } catch {
      // ignore
    }
  }, []);

  // Permanently silence proctor logging for the rest of the session.
  // Use this just before an intentional finish so leaving fullscreen
  // doesn't get logged as a violation.
  const mute = useCallback(() => {
    mutedRef.current = true;
  }, []);

  return {
    ...state,
    requestFullscreen,
    exitFullscreen,
    mute,
    flagged:
      state.trustScore <= config.autoFlagThreshold ||
      state.tabSwitches > config.maxTabSwitches,
  };
}
