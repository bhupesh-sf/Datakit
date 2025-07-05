export class AIFixture {
  static createSimpleMessages() {
    return [
      { role: 'user', content: 'What is 2+2?' }
    ];
  }

  static createConversationMessages() {
    return [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' }
    ];
  }

  static createSystemMessages() {
    return [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'What is 2+2?' }
    ];
  }

  static createLongMessages() {
    return [
      { role: 'user', content: 'Tell me a very long story about artificial intelligence and how it helps humanity achieve great things in science, technology, and daily life.' }
    ];
  }

  static createBasicAIRequest(overrides: any = {}) {
    return {
      model: 'datakit-fast',
      messages: this.createSimpleMessages(),
      max_tokens: 100,
      temperature: 0.7,
      ...overrides,
    };
  }

  static createStreamingRequest(overrides: any = {}) {
    return {
      ...this.createBasicAIRequest(),
      stream: true,
      ...overrides,
    };
  }

  static createExpensiveRequest(overrides: any = {}) {
    return {
      model: 'datakit-smart',
      messages: this.createLongMessages(),
      max_tokens: 1000,
      ...overrides,
    };
  }

  // Calculate expected credits for test scenarios
  static calculateExpectedCredits(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = {
      'datakit-fast': { input: 0.25, output: 1.25 }, // Based on Claude Haiku
      'datakit-smart': { input: 3, output: 15 }, // Based on Claude Sonnet
    };

    const modelPricing = pricing[model] || { input: 1, output: 5 }; // default
    return (inputTokens / 1000) * modelPricing.input + (outputTokens / 1000) * modelPricing.output;
  }

  // Estimate tokens from message content (rough approximation)
  static estimateTokens(messages: any[]): number {
    return Math.ceil(JSON.stringify(messages).length / 4);
  }
}