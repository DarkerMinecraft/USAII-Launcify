import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';

// Minimal interface for the Live API session object returned by the SDK
interface LiveSession {
  close(): void;
  sendRealtimeInput(input: {
    audio?: { data: string; mimeType: string };
    video?: { data: string; mimeType: string };
    audioStreamEnd?: boolean;
  }): void;
  sendClientContent(content: {
    turns: Array<{ role: string; parts: Array<{ text: string }> }>;
  }): void;
}

// Use the SDK's own message type for the onmessage callback
type GeminiLiveMessage = LiveServerMessage;

interface SessionConfig {
  responseModalities: Modality[];
  systemInstruction: string;
  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: string } } };
  inputAudioTranscription: Record<string, never>;
  outputAudioTranscription: Record<string, never>;
  contextWindowCompression: { slidingWindow: Record<string, never> };
  sessionResumption: { handle: string } | Record<string, never>;
}

export interface LiveClientConfig {
  apiKey: string;
  model: string;
  onMessage?: (role: 'user' | 'assistant', content: string) => void;
  onReconnect?: () => void;
}

export type SessionState = 'connecting' | 'connected' | 'listening' | 'speaking' | 'error' | 'reconnecting';

export class GeminiLiveClient {
  private session: LiveSession | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private onStateChange: (state: SessionState) => void;
  private onTranscript: (text: string, isFinal: boolean) => void;
  private config: LiveClientConfig;
  private audioQueue: Float32Array[] = [];
  private isPlaying = false;
  private isMuted = false;

  // Screen sharing state
  private screenVideoElement: HTMLVideoElement | null = null;
  private screenCanvas: HTMLCanvasElement | null = null;
  private screenCtx: CanvasRenderingContext2D | null = null;
  private screenFrameInterval: number | null = null;
  private screenStream: MediaStream | null = null;
  private isScreenSharing = false;

  // Camera sharing state (separate from screen so both can run simultaneously)
  private cameraVideoElement: HTMLVideoElement | null = null;
  private cameraCanvas: HTMLCanvasElement | null = null;
  private cameraCtx: CanvasRenderingContext2D | null = null;
  private cameraFrameInterval: number | null = null;
  private cameraStream: MediaStream | null = null;
  private isCameraSharing = false;

  // Transcript for live display
  private messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }> = [];

  // Buffer for the AI's spoken output transcription (accumulates until finished=true)
  private outputTranscriptBuffer = '';

  // Playback speed control
  private playbackRate: number = 1.0;

  // Session resumption state
  private resumptionToken: string | null = null;
  private intentionalDisconnect = false;
  private isReconnecting = false;
  private reconnectAttempts = 0;
  private totalReconnectAttempts = 0; // never resets — hard cap against infinite loops
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly MAX_TOTAL_RECONNECT_ATTEMPTS = 8;
  private reconnectTimeoutId: number | null = null;
  private aiClient: GoogleGenAI | null = null;
  private savedSessionConfig: SessionConfig | null = null;

  constructor(
    config: LiveClientConfig,
    handlers: {
      onStateChange: (state: SessionState) => void;
      onTranscript: (text: string, isFinal: boolean) => void;
    }
  ) {
    this.config = config;
    this.onStateChange = handlers.onStateChange;
    this.onTranscript = handlers.onTranscript;
  }

  async connect(): Promise<void> {
    // If disconnect() was called before this invocation (or during a previous
    // reconnect cycle), don't open a new connection at all.
    if (this.intentionalDisconnect) return;

    if (this.session) {
      throw new Error('Already connected');
    }

    this.onStateChange(this.isReconnecting ? 'reconnecting' : 'connecting');

    try {
      if (!this.aiClient) {
        this.aiClient = new GoogleGenAI({ apiKey: this.config.apiKey });
      }

      if (!this.savedSessionConfig) {
        const systemInstruction = `You are an expert pitch coach helping students and founders practice and improve their pitches.

YOUR ROLE:
- Observe the presenter via camera to coach on delivery: eye contact, body language, gestures, energy, and confidence
- Listen carefully for clarity, pacing, filler words (um, uh, like, you know), and vocal variety
- When slides are shared via screen share, evaluate visual design, messaging clarity, and how well each slide supports the pitch
- Provide concise, actionable coaching feedback after each practice run

COACHING STYLE:
- Be direct but encouraging — never harsh or dismissive
- Structure post-pitch feedback as exactly 3 short bullet points spoken naturally: one strength, one key improvement, one specific next-step action. Example: "First, your energy and eye contact were great — very engaging. Second, the value proposition was unclear — I couldn't tell who this is for. Third, try opening with the problem before the solution, and let's run it again."
- Keep total spoken feedback under 45 seconds
- Use specific, concrete observations: "Your eye contact dropped on the market size slide" or "You said 'um' four times in the opening"
- Never ask a follow-up question in the same breath as feedback — give feedback first, then ask one focused question after

SESSION FLOW:
1. When the session opens (you will receive a "(session started)" signal), greet the user warmly in 1-2 sentences, then ask: "Do you have a pitch ready to practice, or would you like me to give you a scenario or topic to work with?" — nothing else, wait for their answer.
2. If they have a pitch ready: ask who the audience is (investors, judges, customers) and roughly how long it should be, then invite them to begin whenever they're ready.
3. If they want a scenario: offer 2-3 brief options (e.g. a SaaS startup pitch to VCs, a product demo to enterprise buyers, an idea pitch to a school competition panel) and let them pick one. Then set the scene and invite them to pitch.
4. Once they start their pitch, listen without interrupting.
5. After the pitch ends, give structured feedback: Delivery first, then Content Clarity, then Slide Effectiveness if slides were shared.
6. Encourage a second run with a specific focus: "Let's try again — this time focus on [the one improvement]"
7. Repeat iterations — great pitches are built through reps.

WHAT TO WATCH FOR:
- Delivery: pace, volume, eye contact, posture, hand gestures, nervous habits, energy level
- Content: clear problem statement, compelling solution, evidence or traction, strong ask or call to action
- Slides: one idea per slide, minimal text, clear data visualization, visual hierarchy

CAMERA AND SLIDES:
- If you can see the camera feed, actively comment on visible delivery cues
- If slides are shared, analyze them as part of the coaching
- If camera is not enabled, gently remind them: "I can give better delivery feedback if you turn on your camera"
- Never claim to see something you cannot see`;

        this.savedSessionConfig = {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          contextWindowCompression: { slidingWindow: {} },
          sessionResumption: this.resumptionToken
            ? { handle: this.resumptionToken }
            : {},
        };
      } else {
        this.savedSessionConfig.sessionResumption = this.resumptionToken
          ? { handle: this.resumptionToken }
          : {};
      }

      this.session = await this.aiClient.live.connect({
        model: this.config.model,
        config: this.savedSessionConfig,
        callbacks: {
          onopen: () => {
            console.log('✅ Live API connection opened');
            if (this.intentionalDisconnect) {
              // disconnect() ran while the handshake was in-flight — close immediately.
              this.session?.close();
              this.session = null;
              return;
            }
            if (this.isReconnecting) {
              console.log('🔄 Session resumed successfully');
              this.isReconnecting = false;
              // Do NOT reset reconnectAttempts here — that's what caused the infinite loop.
              this.onStateChange('listening');
              if (this.config.onReconnect) this.config.onReconnect();
            } else {
              this.onStateChange('connected');
            }
          },
          onmessage: (message: GeminiLiveMessage) => this.handleMessage(message),
          onerror: (error: ErrorEvent) => {
            console.error('❌ Live API error:', error);
            if (!this.intentionalDisconnect) {
              this.scheduleReconnect();
            } else {
              this.onStateChange('error');
            }
          },
          onclose: (event: CloseEvent) => {
            console.log(`🔌 Close: code=${event.code} reason="${event.reason}" clean=${event.wasClean}`);
            if (this.intentionalDisconnect) {
              this.cleanup();
            } else if (!this.isReconnecting) {
              console.warn('⚠️ Unexpected disconnect, attempting to resume session...');
              this.scheduleReconnect();
            }
          },
        },
      });

      // If disconnect() was called while the await above was in-flight, the
      // onopen guard already closed the session. Nothing more to do.
      if (this.intentionalDisconnect) return;

      console.log('✅ Connected to Gemini Live API');
    } catch (error) {
      console.error('❌ Failed to connect to Live API:', error);
      if (this.isReconnecting) {
        this.scheduleReconnect();
      } else {
        this.onStateChange('error');
        throw error;
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalDisconnect) return;
    // Prevent double-scheduling if onclose fires while a reconnect is already queued.
    if (this.reconnectTimeoutId !== null) return;

    this.totalReconnectAttempts++;
    this.reconnectAttempts++;

    if (
      this.reconnectAttempts > this.MAX_RECONNECT_ATTEMPTS ||
      this.totalReconnectAttempts > this.MAX_TOTAL_RECONNECT_ATTEMPTS
    ) {
      console.error(
        `❌ Max reconnect attempts reached (session=${this.reconnectAttempts}, total=${this.totalReconnectAttempts}), giving up`
      );
      this.cleanup();
      this.onStateChange('error');
      return;
    }

    this.session = null;
    this.isReconnecting = true;
    this.onStateChange('reconnecting');

    const delay = Math.pow(2, this.reconnectAttempts - 1) * 1000;
    console.log(
      `🔄 Reconnect attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} (total=${this.totalReconnectAttempts}) in ${delay}ms`
    );

    this.reconnectTimeoutId = window.setTimeout(async () => {
      this.reconnectTimeoutId = null;
      try {
        await this.connect();
      } catch {
        // connect() already calls scheduleReconnect() on failure
      }
    }, delay);
  }

  private handleMessage(message: GeminiLiveMessage): void {
    if (message.sessionResumptionUpdate?.newHandle) {
      this.resumptionToken = message.sessionResumptionUpdate.newHandle;
      console.log('🔑 Resumption token updated');
    }

    if (message.goAway) {
      const timeLeft = message.goAway?.timeLeft ?? '?';
      console.warn(`⚠️ GoAway received — server closing in ~${timeLeft}s, will auto-resume`);
    }

    if (message.serverContent?.modelTurn?.parts) {
      this.onStateChange('speaking');

      for (const part of message.serverContent.modelTurn.parts) {
        if (part.text) {
          const text = part.text.trim();

          const internalPatterns = [
            '**Confirming',
            'Confirming Screen',
            'I have confirmed',
            'I have transitioned',
            'taken a deep breath',
            '**System:',
            '**Internal:',
            '<thought>',
          ];

          const isInternalMessage = internalPatterns.some(pattern =>
            text.includes(pattern) || text.startsWith('**')
          );

          if (!isInternalMessage && text.length > 0) {
            this.onTranscript(text, true);

            if (this.config.onMessage) {
              this.config.onMessage('assistant', text);
            }
            this.messages.push({ role: 'assistant', content: text, timestamp: Date.now() });
          }
        }
      }
    }

    // Capture user speech transcription
    if (message.serverContent?.inputTranscription?.text) {
      const transcript = message.serverContent.inputTranscription.text.trim();
      if (transcript.length > 0) {
        this.addUserMessage(transcript);
      }
    }

    // Accumulate AI speech transcription across all chunks for this turn.
    // The API sends incremental word chunks — we append them all and only emit
    // once the full turn completes (turnComplete below), NOT on the sentence-level
    // `finished` flag which would produce partial-sentence notes.
    if (message.serverContent?.outputTranscription?.text) {
      this.outputTranscriptBuffer += message.serverContent.outputTranscription.text;
    }

    // Decode and play audio
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          try {
            const audioBytes = this.base64ToUint8Array(part.inlineData.data);
            const int16Array = new Int16Array(audioBytes.buffer, audioBytes.byteOffset, audioBytes.byteLength / 2);
            const float32Array = new Float32Array(int16Array.length);
            for (let i = 0; i < int16Array.length; i++) {
              const sample = int16Array[i] ?? 0;
              float32Array[i] = sample / 32768.0;
            }
            this.audioQueue.push(float32Array);
            this.playAudioQueue();
          } catch (error) {
            console.error('❌ Error decoding audio:', error);
          }
        }
      }
    }

    if (message.serverContent?.turnComplete) {
      const fullText = this.outputTranscriptBuffer.trim();
      this.outputTranscriptBuffer = '';
      if (fullText) {
        this.messages.push({ role: 'assistant', content: fullText, timestamp: Date.now() });
        if (this.config.onMessage) this.config.onMessage('assistant', fullText);
        // Only surface to the UI notes panel when this looks like genuine coaching
        // feedback rather than a short greeting, question, or acknowledgment.
        if (this.isGenuineFeedback(fullText)) {
          this.onTranscript(fullText, true);
        }
      }
      this.onStateChange('listening');
    }

    if (message.serverContent?.interrupted) {
      this.outputTranscriptBuffer = '';
      this.audioQueue = [];
      this.isPlaying = false;
    }
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private resampleAudioData(input: Float32Array, speed: number): Float32Array {
    if (speed === 1.0) return input;

    const outputLength = Math.max(1, Math.round(input.length / speed));
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcPos = i * speed;
      const srcIndex = Math.floor(srcPos);
      const fraction = srcPos - srcIndex;
      const s0 = srcIndex < input.length ? input[srcIndex]! : 0;
      const s1 = (srcIndex + 1) < input.length ? input[srcIndex + 1]! : 0;
      output[i] = s0 + fraction * (s1 - s0);
    }

    return output;
  }

  private playAudioQueue(): void {
    if (this.isPlaying || this.audioQueue.length === 0 || !this.audioContext) return;

    this.isPlaying = true;

    const playNextChunk = () => {
      if (this.audioQueue.length === 0) {
        this.isPlaying = false;
        return;
      }
      if (!this.audioContext) {
        this.isPlaying = false;
        return;
      }

      const rawData = this.audioQueue.shift()!;
      const audioData = this.resampleAudioData(rawData, this.playbackRate);

      const source = this.audioContext.createBufferSource();
      const buffer = this.audioContext.createBuffer(1, audioData.length, 24000);
      buffer.getChannelData(0).set(audioData);
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.onended = playNextChunk;
      source.start();
    };

    playNextChunk();
  }

  async startAudioCapture(): Promise<void> {
    console.log('🟢 startAudioCapture called');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser.');
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.audioContext = new AudioContext({ sampleRate: 16000 });
      await this.audioContext.resume();

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      const bufferSize = 2048;
      this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      const SILENCE_THRESHOLD = 0.01;
      const SILENCE_CHUNKS_THRESHOLD = 30;
      let consecutiveSilentChunks = 0;
      let hasSpoken = false;

      this.processor.onaudioprocess = (event) => {
        const audioData = event.inputBuffer.getChannelData(0);
        if (!audioData?.length) return;

        if (this.session && !this.isMuted) {
          const rms = Math.sqrt(
            audioData.reduce((sum, s) => sum + s * s, 0) / audioData.length
          );

          this.sendAudioChunk(audioData);

          if (rms > SILENCE_THRESHOLD) {
            hasSpoken = true;
            consecutiveSilentChunks = 0;
          } else if (hasSpoken) {
            consecutiveSilentChunks++;
          }

          if (hasSpoken && consecutiveSilentChunks >= SILENCE_CHUNKS_THRESHOLD) {
            this.sendAudioStreamEnd();
            hasSpoken = false;
            consecutiveSilentChunks = 0;
          }
        } else if (this.isMuted) {
          // Reset silence tracking while muted
          hasSpoken = false;
          consecutiveSilentChunks = 0;
        }
      };

      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0;
      source.connect(this.processor);
      this.processor.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Send a neutral session-start signal so the model opens the conversation.
      // Keep it brief and clearly non-speech so it doesn't get interpreted as
      // the user starting their pitch.
      if (this.session) {
        this.sendText('(session started)');
      }

      this.onStateChange('listening');
    } catch (error) {
      console.error('❌ Failed to capture audio:', error);
      this.onStateChange('error');
      throw error;
    }
  }

  private sendAudioStreamEnd(): void {
    if (!this.session) return;
    try {
      this.session.sendRealtimeInput({ audioStreamEnd: true });
    } catch (error) {
      console.error('❌ Error sending audioStreamEnd:', error);
    }
  }

  private sendAudioChunk(audioData: Float32Array) {
    if (!this.session) return;

    const pcmData = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      const sample = audioData[i] ?? 0;
      pcmData[i] = Math.max(-32768, Math.min(32767, sample * 32768));
    }

    const uint8Array = new Uint8Array(pcmData.buffer);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]!);
    }
    const base64Data = btoa(binaryString);

    try {
      this.session.sendRealtimeInput({
        audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' },
      });
    } catch (error) {
      console.error('❌ Error sending audio:', error);
    }
  }

  stopAudioCapture(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isPlaying = false;
    this.audioQueue = [];
  }

  async startScreenShare(): Promise<MediaStream> {
    try {
      console.log('🖥️ Starting screen share...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } },
      });

      this.screenStream = stream;
      this.isScreenSharing = true;

      this.screenVideoElement = document.createElement('video');
      this.screenVideoElement.srcObject = stream;
      this.screenVideoElement.autoplay = true;
      this.screenVideoElement.playsInline = true;
      this.screenVideoElement.muted = true;
      this.screenVideoElement.style.display = 'none';
      document.body.appendChild(this.screenVideoElement);

      await new Promise<void>((resolve, reject) => {
        const video = this.screenVideoElement!;
        video.onloadedmetadata = () => {
          video.play().then(resolve).catch(reject);
        };
        video.onerror = (err) => reject(err);
        setTimeout(() => { if (video.readyState < 2) reject(new Error('Screen video failed to load')); }, 5000);
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      this.screenCanvas = document.createElement('canvas');
      this.screenCanvas.width = 1280;
      this.screenCanvas.height = 720;
      this.screenCtx = this.screenCanvas.getContext('2d', { alpha: false });
      if (!this.screenCtx) throw new Error('Failed to get canvas context');

      const captureFrame = () => {
        const session = this.session;
        if (!this.isScreenSharing || !this.screenVideoElement || !this.screenCanvas || !this.screenCtx || !session) return;
        if (this.screenVideoElement.readyState < 2 || this.screenVideoElement.videoWidth === 0) return;

        try {
          this.screenCtx.drawImage(this.screenVideoElement, 0, 0, this.screenCanvas.width, this.screenCanvas.height);
          this.screenCanvas.toBlob((blob) => {
            if (blob && this.isScreenSharing) {
              const reader = new FileReader();
              reader.onload = () => {
                const base64Data = (reader.result as string).split(',')[1];
                try {
                  session.sendRealtimeInput({ video: { data: base64Data, mimeType: 'image/jpeg' } });
                } catch (error) {
                  console.error('❌ Error sending screen frame:', error);
                }
              };
              reader.readAsDataURL(blob);
            }
          }, 'image/jpeg', 0.7);
        } catch (error) {
          console.error('❌ Error capturing screen frame:', error);
        }
      };

      this.screenFrameInterval = window.setInterval(captureFrame, 500); // 2 FPS

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.log('🖥️ Screen share ended by user');
          this.stopScreenShare();
        };
      }

      console.log('✅ Screen share started');
      return stream;
    } catch (error) {
      console.error('❌ Failed to start screen share:', error);
      this.isScreenSharing = false;
      this.screenStream = null;
      throw error;
    }
  }

  stopScreenShare(): void {
    console.log('🛑 Stopping screen share...');
    this.isScreenSharing = false;

    if (this.screenFrameInterval) {
      clearInterval(this.screenFrameInterval);
      this.screenFrameInterval = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }

    if (this.screenVideoElement?.parentNode) {
      this.screenVideoElement.parentNode.removeChild(this.screenVideoElement);
      this.screenVideoElement = null;
    }

    this.screenCanvas = null;
    this.screenCtx = null;
  }

  async startCameraShare(facingMode: 'environment' | 'user' = 'user'): Promise<MediaStream> {
    try {
      console.log('📷 Starting camera share, facing:', facingMode);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      this.cameraStream = stream;
      this.isCameraSharing = true;

      this.cameraVideoElement = document.createElement('video');
      this.cameraVideoElement.srcObject = stream;
      this.cameraVideoElement.autoplay = true;
      this.cameraVideoElement.playsInline = true;
      this.cameraVideoElement.muted = true;
      this.cameraVideoElement.style.display = 'none';
      document.body.appendChild(this.cameraVideoElement);

      await new Promise<void>((resolve, reject) => {
        const video = this.cameraVideoElement!;
        video.onloadedmetadata = () => {
          video.play().then(resolve).catch(reject);
        };
        video.onerror = (err) => reject(err);
        setTimeout(() => { if (video.readyState < 2) reject(new Error('Camera video failed to load')); }, 5000);
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      this.cameraCanvas = document.createElement('canvas');
      this.cameraCanvas.width = 1280;
      this.cameraCanvas.height = 720;
      this.cameraCtx = this.cameraCanvas.getContext('2d', { alpha: false });
      if (!this.cameraCtx) throw new Error('Failed to get canvas context');

      const captureFrame = () => {
        const session = this.session;
        if (!this.isCameraSharing || !this.cameraVideoElement || !this.cameraCanvas || !this.cameraCtx || !session) return;
        if (this.cameraVideoElement.readyState < 2 || this.cameraVideoElement.videoWidth === 0) return;

        try {
          this.cameraCtx.drawImage(this.cameraVideoElement, 0, 0, this.cameraCanvas.width, this.cameraCanvas.height);
          this.cameraCanvas.toBlob((blob) => {
            if (blob && this.isCameraSharing) {
              const reader = new FileReader();
              reader.onload = () => {
                const base64Data = (reader.result as string).split(',')[1];
                try {
                  session.sendRealtimeInput({ video: { data: base64Data, mimeType: 'image/jpeg' } });
                } catch (error) {
                  console.error('❌ Error sending camera frame:', error);
                }
              };
              reader.readAsDataURL(blob);
            }
          }, 'image/jpeg', 0.7);
        } catch (error) {
          console.error('❌ Error capturing camera frame:', error);
        }
      };

      this.cameraFrameInterval = window.setInterval(captureFrame, 500); // 2 FPS

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.log('📷 Camera track ended');
          this.stopCameraShare();
        };
      }

      console.log('✅ Camera share started');
      return stream;
    } catch (error) {
      console.error('❌ Failed to start camera share:', error);
      this.isCameraSharing = false;
      this.cameraStream = null;
      throw error;
    }
  }

  stopCameraShare(): void {
    console.log('🛑 Stopping camera share...');
    this.isCameraSharing = false;

    if (this.cameraFrameInterval) {
      clearInterval(this.cameraFrameInterval);
      this.cameraFrameInterval = null;
    }

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }

    if (this.cameraVideoElement?.parentNode) {
      this.cameraVideoElement.parentNode.removeChild(this.cameraVideoElement);
      this.cameraVideoElement = null;
    }

    this.cameraCanvas = null;
    this.cameraCtx = null;
  }

  // Returns true only for substantive coaching feedback — filters out greetings,
  // single questions, and short acknowledgments so they don't pollute the notes panel.
  private isGenuineFeedback(text: string): boolean {
    if (text.length < 120) return false;
    const sentenceCount = (text.match(/[.!?]+/g) ?? []).length;
    return sentenceCount >= 2;
  }

  sendText(text: string): void {
    if (!this.session) {
      console.warn('⚠️ Session not connected, cannot send text');
      return;
    }
    this.session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text }] }],
    });
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  disconnect(): void {
    console.log('🔌 Disconnecting from Live API...');
    this.intentionalDisconnect = true;

    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.session) {
      this.session.close();
      this.session = null;
    }

    this.cleanup();
  }

  private cleanup(): void {
    this.stopAudioCapture();
    this.stopScreenShare();
    this.stopCameraShare();
    this.audioQueue = [];
    this.isPlaying = false;
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.5, Math.min(2.0, rate));
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content, timestamp: Date.now() });
    if (this.config.onMessage) {
      this.config.onMessage('user', content);
    }
  }

  getMessages(): Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }> {
    return [...this.messages];
  }
}
