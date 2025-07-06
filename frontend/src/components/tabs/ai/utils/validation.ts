export const validateAIInput = (
  prompt: string,
  tableName: string | null,
  activeProvider: string | undefined,
  activeModel: string | null
): string | null => {
  // Only validate when user starts typing
  if (!prompt.trim()) {
    return null;
  }

  // Check if data is available
  if (!tableName) {
    return "No file or table loaded";
  }

  // Check if model is selected
  if (!activeProvider || !activeModel) {
    return "model not selected";
  }

  return null;
};