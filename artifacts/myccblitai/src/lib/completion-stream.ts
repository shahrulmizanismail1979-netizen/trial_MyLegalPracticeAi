export type CompletionStreamResult = {
  content: string;
  completed: true;
};

type CompletionEvent = {
  content?: unknown;
  done?: unknown;
  error?: unknown;
};

/**
 * Consume the CCB AI endpoints' SSE contract. Both endpoints explicitly emit
 * `{done:true}` after all content, so output is not final/exportable until that
 * event arrives. Chunk boundaries are deliberately ignored.
 */
export async function consumeCompletionStream(
  response: Response,
  onContent: (content: string) => void,
): Promise<CompletionStreamResult> {
  if (!response.body) throw new Error("The AI returned no response body.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let completed = false;

  const consumeLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const raw = line.slice(5).trimStart();
    if (!raw || raw === "[DONE]") return;

    let event: CompletionEvent;
    try {
      event = JSON.parse(raw) as CompletionEvent;
    } catch {
      throw new Error("The AI returned a malformed stream event.");
    }

    if (typeof event.error === "string" && event.error.trim()) {
      throw new Error(event.error);
    }
    if (typeof event.content === "string" && event.content) {
      content += event.content;
      onContent(content);
    }
    if (event.done === true) completed = true;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) consumeLine(line);
  }

  buffer += decoder.decode();
  if (buffer.trim()) consumeLine(buffer);

  if (!completed) {
    throw new Error("The AI response ended before completion. Please generate it again.");
  }
  if (!content.trim()) {
    throw new Error("The AI completed without producing any content.");
  }
  return { content, completed: true };
}