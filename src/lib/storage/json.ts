export function safeJsonStringify(value: unknown) {
  if (value === undefined) {
    return "null";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "null";
  }
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
