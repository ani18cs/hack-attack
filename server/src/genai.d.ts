declare module '@google/genai' {
  export class GoogleGenAI {
    constructor(options?: { apiKey?: string });
    models: {
      generateContent(params: any): Promise<{ text?: string }>;
    };
  }

  export const Type: {
    OBJECT: string;
    ARRAY: string;
    STRING: string;
    NUMBER: string;
    BOOLEAN: string;
    INTEGER: string;
  };
}
