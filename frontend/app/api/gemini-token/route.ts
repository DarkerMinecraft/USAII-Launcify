import { NextResponse } from 'next/server';

export const POST = async (): Promise<NextResponse> => {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  return NextResponse.json({
    apiKey,
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
  });
}
