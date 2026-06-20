"use server";

export const getGeminiToken = async (): Promise<{ apiKey: string; model: string }> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is not configured");
  return { apiKey, model: "gemini-2.5-flash-native-audio-preview-12-2025" };
};
