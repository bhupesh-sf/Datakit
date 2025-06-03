const analyzeTxtFile = async (
  file: File
): Promise<{
  format: "delimited_direct" | "single_column";
  separator?: string;
  hasHeader?: boolean;
  preview: string[];
}> => {
  const text = await file.text();
  const lines = text.split("\n").slice(0, 10); // Analyze first 10 lines

  // Check for common delimiters (all treated equally now)
  const delimiters = ["\t", "|", ";", ",", " "];
  let bestDelimiter = null;
  let maxColumns = 0;

  for (const delimiter of delimiters) {
    const columns = lines[0]?.split(delimiter).length || 0;
    if (columns > maxColumns && columns > 1) {
      maxColumns = columns;
      bestDelimiter = delimiter;
    }
  }

  // Determine format
  if (bestDelimiter && maxColumns > 1) {
    // Check if it's consistently delimited
    const consistent = lines
      .slice(0, 5)
      .every(
        (line) =>
          line.split(bestDelimiter).length === maxColumns || line.trim() === ""
      );

    if (consistent) {
      // ANY consistent delimiter gets direct import treatment
      return {
        format: "delimited_direct",
        separator: bestDelimiter,
        hasHeader: true,
        preview: lines,
      };
    }
  }

  // Default to single column if no clear delimiter pattern
  return {
    format: "single_column",
    preview: lines,
  };
};

export { analyzeTxtFile };
