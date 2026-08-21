import { useState, useRef, useCallback } from 'react';
import { runStage, runDraft, runAnalyze, IracStage, Citation, StreamHandlers, DraftParams, AnalyzeParams } from '@/lib/irac-api';

export function useStreamStage() {
  const [content, setContent] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [groundingWarning, setGroundingWarning] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef<() => void>(undefined);

  const start = useCallback((stage: IracStage, caseId: string, extra?: Record<string, unknown>) => {
    setContent('');
    setCitations([]);
    setDisclaimer('');
    setGroundingWarning(false);
    setError('');
    setIsStreaming(true);

    const handlers: StreamHandlers = {
      onContent: (chunk) => setContent((prev) => prev + chunk),
      onCitations: (cites) => setCitations(cites),
      onDone: (info) => {
        if (info?.disclaimer) setDisclaimer(info.disclaimer);
        setGroundingWarning(Boolean(info?.groundingWarning));
        setIsStreaming(false);
      },
      onError: (msg) => {
        setError(msg);
        setIsStreaming(false);
      }
    };

    const control = runStage(stage, caseId, handlers, extra);
    cancelRef.current = control.cancel;
  }, []);

  const cancel = useCallback(() => {
    if (cancelRef.current) cancelRef.current();
    setIsStreaming(false);
  }, []);

  return { content, citations, disclaimer, groundingWarning, isStreaming, error, start, cancel };
}

export function useStreamDraft() {
  const [content, setContent] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [groundingWarning, setGroundingWarning] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef<() => void>(undefined);

  const start = useCallback((params: DraftParams) => {
    setContent('');
    setCitations([]);
    setDisclaimer('');
    setGroundingWarning(false);
    setError('');
    setIsStreaming(true);

    const handlers: StreamHandlers = {
      onContent: (chunk) => setContent((prev) => prev + chunk),
      onCitations: (cites) => setCitations(cites),
      onDone: (info) => {
        if (info?.disclaimer) setDisclaimer(info.disclaimer);
        setGroundingWarning(Boolean(info?.groundingWarning));
        setIsStreaming(false);
      },
      onError: (msg) => {
        setError(msg);
        setIsStreaming(false);
      }
    };

    const control = runDraft(params, handlers);
    cancelRef.current = control.cancel;
  }, []);

  const cancel = useCallback(() => {
    if (cancelRef.current) cancelRef.current();
    setIsStreaming(false);
  }, []);

  return { content, citations, disclaimer, groundingWarning, isStreaming, error, start, cancel };
}

export function useStreamAnalyze() {
  const [content, setContent] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [groundingWarning, setGroundingWarning] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef<() => void>(undefined);

  const start = useCallback((caseIdOrParams: string | AnalyzeParams, pathway?: string) => {
    setContent('');
    setCitations([]);
    setDisclaimer('');
    setGroundingWarning(false);
    setError('');
    setIsStreaming(true);

    const handlers: StreamHandlers = {
      onContent: (chunk) => setContent((prev) => prev + chunk),
      onCitations: (cites) => setCitations(cites),
      onDone: (info) => {
        if (info?.disclaimer) setDisclaimer(info.disclaimer);
        setGroundingWarning(Boolean(info?.groundingWarning));
        setIsStreaming(false);
      },
      onError: (msg) => {
        setError(msg);
        setIsStreaming(false);
      }
    };

    const control = runAnalyze(caseIdOrParams, handlers, pathway);
    cancelRef.current = control.cancel;
  }, []);

  const cancel = useCallback(() => {
    if (cancelRef.current) cancelRef.current();
    setIsStreaming(false);
  }, []);

  return { content, citations, disclaimer, groundingWarning, isStreaming, error, start, cancel };
}
