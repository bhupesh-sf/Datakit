export const validateAIInput = (
  prompt: string,
  tableName: string | undefined,
  activeProvider: string | undefined,
  activeModel: string | null,
  multiTableContexts?: Array<{
    tableName: string;
    isSelected: boolean;
  }>,
  hasRegisteredTables?: boolean
): string | null => {
  // Only validate when user starts typing
  if (!prompt.trim()) {
    return null;
  }

  // Check if data is available - always require explicit table selection
  if (hasRegisteredTables) {
    // When there are registered tables, require explicit selection
    if (!multiTableContexts || multiTableContexts.length === 0) {
      return "No tables selected for AI context";
    }
    const selectedTables = multiTableContexts.filter(ctx => ctx.isSelected);
    if (selectedTables.length === 0) {
      return "No tables selected for AI context";
    }
  } else if (!tableName) {
    return "No file or table loaded";
  }

  // Check if model is selected
  if (!activeProvider || !activeModel) {
    return "model not selected";
  }

  return null;
};