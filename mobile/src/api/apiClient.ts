import { mobileEnv } from "../config/env";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

type ApiRequestOptions = RequestInit & {
  accessToken?: string;
};

export class ApiRequestError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { accessToken, headers: providedHeaders, ...requestOptions } = options;
  const headers = new Headers(providedHeaders);

  headers.set("Accept", "application/json");

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;

  try {
    response = await fetch(`${mobileEnv.apiBaseUrl}${path}`, {
      ...requestOptions,
      cache: requestOptions.cache ?? "no-store",
      headers,
    });
  } catch {
    throw new ApiRequestError(
      0,
      "NETWORK_REQUEST_FAILED",
      "EcoTrack could not reach the API. Check the phone network and API address.",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => null)) as
    | T
    | ApiErrorBody
    | null;

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;

    throw new ApiRequestError(
      response.status,
      errorBody?.error?.code ?? "API_REQUEST_FAILED",
      errorBody?.error?.message ?? "The API request failed.",
      errorBody?.error?.details,
    );
  }

  if (body === null) {
    throw new ApiRequestError(
      response.status,
      "INVALID_API_RESPONSE",
      "The API returned an invalid response.",
    );
  }

  return body as T;
}
