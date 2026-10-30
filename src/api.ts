// Minimal client for the Responses API (Meta Model API, and OpenAI-compatible providers such as Baseten).

export interface ApiOutputItem {
  type?: string;
  call_id?: string;
  actions?: unknown[];
  pending_safety_checks?: { id: string; code: string; message: string }[];
  content?: { type?: string; text?: string }[];
}

export interface ApiResponse {
  id?: string;
  status?: string;
  output?: ApiOutputItem[];
  output_text?: string;
  incomplete_details?: { reason?: string };
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number | null, readonly body: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** POST <baseUrl>/responses, with one retry on network errors and 5xx. */
export async function postResponses(baseUrl: string, apiKey: string, body: unknown): Promise<ApiResponse> {
  const send = async (): Promise<ApiResponse> => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl.replace(/\/+$/, "")}/responses`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      throw new ApiError(`request failed: ${err instanceof Error ? err.message : String(err)}`, null, "");
    }
    const text = await res.text();
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status, text.slice(0, 2000));
    return JSON.parse(text) as ApiResponse;
  };

  try {
    return await send();
  } catch (err) {
    if (err instanceof ApiError && (err.status === null || err.status >= 500)) return send();
    throw err;
  }
}

/** All output_text from a response, in order. */
export function outputText(response: ApiResponse): string {
  if (typeof response.output_text === "string" && response.output_text) return response.output_text;
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

export const pngDataUrl = (png: Buffer): string => `data:image/png;base64,${png.toString("base64")}`;
