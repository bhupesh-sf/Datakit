/**
 * Smart parsing utilities for AI responses without hardcoded strings
 */

export interface ParsedResponse {
  insight?: string;
  summary?: string;
  expectedResults?: string;
  chartSuggestion?: string;
  status?: string;
  statusSequence: StatusUpdate[];
  sqlQuery?: string;
  pythonCode?: string;
  content: string;
  progress: number;
}

export interface StatusUpdate {
  text: string;
  timestamp: number;
  phase: 'initial' | 'processing' | 'finalizing' | 'complete';
}

/**
 * Smart status phase detection based on context and position
 */
function detectStatusPhase(
  statusText: string, 
  position: number, 
  totalStatuses: number
): 'initial' | 'processing' | 'finalizing' | 'complete' {
  const relativePosition = position / Math.max(totalStatuses - 1, 1);
  
  // Use relative position in the sequence
  if (relativePosition === 0) return 'initial';
  if (relativePosition === 1) return 'complete';
  if (relativePosition > 0.7) return 'finalizing';
  return 'processing';
}

/**
 * Extract all status updates from response
 */
export function extractStatusSequence(response: string): StatusUpdate[] {
  const statusPattern = /\*\*STATUS:\*\*\s*([^\n]+)/g;
  const matches = Array.from(response.matchAll(statusPattern));
  
  return matches.map((match, index) => ({
    text: match[1].trim(),
    timestamp: Date.now() + index * 100, // Simulated timing
    phase: detectStatusPhase(match[1], index, matches.length)
  }));
}

/**
 * Smart progress calculation based on response structure
 */
export function calculateSmartProgress(response: string): number {
  // Check for code blocks as completion indicator
  const hasSQL = response.includes('```sql');
  const hasPython = response.includes('```python');
  const hasCodeBlock = hasSQL || hasPython;
  
  // Count status updates
  const statusCount = (response.match(/\*\*STATUS:\*\*/g) || []).length;
  
  // Calculate based on content markers
  if (hasCodeBlock) return 100;
  if (statusCount >= 3) return 75;
  if (statusCount >= 2) return 50;
  if (statusCount >= 1) return 25;
  
  // Fallback: estimate by response length
  const responseLength = response.length;
  if (responseLength > 1000) return 60;
  if (responseLength > 500) return 40;
  if (responseLength > 100) return 20;
  
  return 10;
}

/**
 * Extract structured data using flexible patterns
 */
export function extractStructuredData(response: string): Map<string, string> {
  const data = new Map<string, string>();
  
  // Generic pattern for **KEY:** value extraction
  const pattern = /\*\*([A-Z_]+):\*\*\s*([^\n]+)/g;
  let match;
  
  while ((match = pattern.exec(response)) !== null) {
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    data.set(key, value);
  }
  
  return data;
}

/**
 * Parse complete AI response with smart detection
 */
export function parseAIResponse(response: string): ParsedResponse {
  const structuredData = extractStructuredData(response);
  const statusSequence = extractStatusSequence(response);
  
  const result: ParsedResponse = {
    content: response,
    insight: structuredData.get('insight') || structuredData.get('insight_title'),
    summary: structuredData.get('summary') || structuredData.get('query_description'),
    expectedResults: structuredData.get('expected_results'),
    chartSuggestion: structuredData.get('chart_suggestion'),
    status: statusSequence.length > 0 ? statusSequence[statusSequence.length - 1].text : undefined,
    statusSequence,
    progress: calculateSmartProgress(response)
  };

  // Extract code blocks with language detection
  const codeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;
  let codeMatch;
  
  while ((codeMatch = codeBlockPattern.exec(response)) !== null) {
    const language = codeMatch[1]?.toLowerCase();
    const code = codeMatch[2].trim();
    
    if (language === 'sql' || (!language && code.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE)/i))) {
      result.sqlQuery = code;
    } else if (language === 'python' || (!language && code.match(/^(import |from |def |class |print)/))) {
      result.pythonCode = code;
    }
  }

  return result;
}

/**
 * Get current streaming status with context awareness
 */
export function getCurrentStreamingStatus(response: string): {
  status: string;
  progress: number;
  phase: 'initial' | 'processing' | 'finalizing' | 'complete';
} {
  const statusSequence = extractStatusSequence(response);
  const progress = calculateSmartProgress(response);
  
  if (statusSequence.length === 0) {
    return {
      status: 'Processing your request',
      progress,
      phase: 'initial'
    };
  }
  
  const currentStatus = statusSequence[statusSequence.length - 1];
  
  return {
    status: currentStatus.text,
    progress,
    phase: currentStatus.phase
  };
}

/**
 * Detect query intent from user prompt
 */
export function detectQueryIntent(prompt: string): {
  type: 'exploration' | 'aggregation' | 'visualization' | 'transformation' | 'general';
  confidence: number;
} {
  const lowered = prompt.toLowerCase();
  
  // Pattern-based intent detection
  const patterns = {
    exploration: /\b(show|display|list|find|what|which|where)\b/,
    aggregation: /\b(count|sum|average|mean|median|group|total|max|min)\b/,
    visualization: /\b(chart|graph|plot|visuali[sz]e|diagram|distribution)\b/,
    transformation: /\b(transform|convert|clean|format|rename|modify)\b/
  };
  
  let bestMatch = { type: 'general' as const, confidence: 0 };
  
  for (const [type, pattern] of Object.entries(patterns)) {
    const matches = prompt.match(pattern);
    if (matches) {
      const confidence = matches.length / (prompt.split(/\s+/).length / 10);
      if (confidence > bestMatch.confidence) {
        bestMatch = { 
          type: type as any, 
          confidence: Math.min(confidence, 1) 
        };
      }
    }
  }
  
  return bestMatch.confidence > 0 ? bestMatch : { type: 'general', confidence: 0.5 };
}