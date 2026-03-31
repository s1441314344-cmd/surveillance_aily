export function parseStrategyResponseSchema(rawText: string, resultFormat: string) {
  let responseSchema: Record<string, unknown> = {};

  if (rawText.trim()) {
    try {
      responseSchema = JSON.parse(rawText);
    } catch {
      return {
        responseSchema: null,
        errorMessage: 'Schema 配置不是合法 JSON',
      };
    }
  }

  if (resultFormat === 'json_schema' && Object.keys(responseSchema).length === 0) {
    return {
      responseSchema: null,
      errorMessage: 'JSON Schema 模式下，Schema 不能为空',
    };
  }

  return {
    responseSchema,
    errorMessage: null,
  };
}

export function parseStrategyValidationSchema(rawText: string) {
  try {
    return {
      schema: JSON.parse(rawText),
      errorMessage: null,
    };
  } catch {
    return {
      schema: null,
      errorMessage: 'JSON Schema 不是合法 JSON',
    };
  }
}
