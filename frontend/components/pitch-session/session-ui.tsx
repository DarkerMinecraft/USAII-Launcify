'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, Loader2, MessageSquare, Maximize2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GeminiLiveClient, type SessionState } from '@/lib/gemini-live-client';

let _activeClient: GeminiLiveClient | null = null;

const CAM_SIZES = {
  sm: { w: 160, h: 108 },
  md: { w: 256, h: 171 },
  lg: { w: 384, h: 256 },
} as const;
type CamSize = keyof typeof CAM_SIZES;
const CAM_SIZE_ORDER: CamSize[] = ['sm', 'md', 'lg'];

interface FeedbackEntry {
  id: string;
  text: string;
  timestamp: number;
  round: number;
}

const formatTimestamp = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const SessionUi = () => {
  const [sessionState, setSessionState] = useState<SessionState>('connecting');
  const [isMuted, setIsMuted]           = useState(false);
  const [isCameraOn, setIsCameraOn]     = useState(false);
  const [isScreenShared, setIsScreenShared] = useState(false);
  const [needsStart, setNeedsStart]     = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const [camSize, setCamSize]           = useState<CamSize>('sm');
  const [camPos, setCamPos]             = useState<{ x: number; y: number } | null>(null);
  const [isDraggingCam, setIsDraggingCam] = useState(false);
  const camDragState = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);

  const [feedbackLog, setFeedbackLog]   = useState<FeedbackEntry[]>([]);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const feedbackRoundRef = useRef(0);
  const feedbackPanelRef = useRef<HTMLDivElement>(null);

  const liveClientRef   = useRef<GeminiLiveClient | null>(null);
  const cameraVideoRef  = useRef<HTMLVideoElement>(null);
  const screenVideoRef  = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (cameraStream && cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    if (screenStream && screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  useEffect(() => {
    if (!screenStream) return;
    const track = screenStream.getVideoTracks()[0];
    if (!track) return;
    const handleEnded = () => { setIsScreenShared(false); setScreenStream(null); };
    track.addEventListener('ended', handleEnded);
    return () => track.removeEventListener('ended', handleEnded);
  }, [screenStream]);

  const initCamPos = (size: CamSize = camSize) => {
    if (camPos) return;
    const { w, h } = CAM_SIZES[size];
    setCamPos({ x: window.innerWidth - w - 16, y: window.innerHeight - h - 80 });
  };

  useEffect(() => {
    let cancelled = false;

    if (_activeClient) {
      _activeClient.disconnect();
      _activeClient = null;
    }

    const init = async () => {
      try {
        const res = await fetch('/api/gemini-token', { method: 'POST' });
        if (!res.ok) throw new Error('Failed to get API token');
        const { apiKey, model } = await res.json();
        if (cancelled) return;

        const client = new GeminiLiveClient(
          { apiKey, model },
          {
            onStateChange: (state) => {
              if (cancelled) return;
              setSessionState(state);
              if (state === 'error') setError('Connection lost. Please reload and try again.');
            },
            onTranscript: (text, isFinal) => {
              if (cancelled || !isFinal || !text.trim()) return;
              feedbackRoundRef.current += 1;
              const entry: FeedbackEntry = {
                id: `${Date.now()}-${Math.random()}`,
                text,
                timestamp: Date.now(),
                round: feedbackRoundRef.current,
              };
              setFeedbackLog(prev => [entry, ...prev]);
              setIsFeedbackOpen(true);
            },
          }
        );

        if (cancelled) { client.disconnect(); return; }

        _activeClient = client;
        liveClientRef.current = client;
        await client.connect();
      } catch (err) {
        console.error('Init error:', err);
        if (!cancelled) setError('Failed to connect. Please check your connection.');
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (_activeClient && _activeClient === liveClientRef.current) {
        _activeClient.disconnect();
        _activeClient = null;
      }
      liveClientRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleUnload = () => { _activeClient?.disconnect(); };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const handleCamMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !camPos) return;
    e.preventDefault();
    camDragState.current = { mouseX: e.clientX, mouseY: e.clientY, posX: camPos.x, posY: camPos.y };
    setIsDraggingCam(true);

    const onMove = (ev: MouseEvent) => {
      if (!camDragState.current) return;
      const { w, h } = CAM_SIZES[camSize];
      const x = Math.max(0, Math.min(window.innerWidth  - w, camDragState.current.posX + ev.clientX - camDragState.current.mouseX));
      const y = Math.max(0, Math.min(window.innerHeight - h, camDragState.current.posY + ev.clientY - camDragState.current.mouseY));
      setCamPos({ x, y });
    };
    const onUp = () => {
      camDragState.current = null;
      setIsDraggingCam(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const cycleCamSize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCamSize(prev => {
      const idx = CAM_SIZE_ORDER.indexOf(prev);
      const next = CAM_SIZE_ORDER[(idx + 1) % CAM_SIZE_ORDER.length]!;
      setCamPos(pos => {
        if (!pos) return pos;
        const { w, h } = CAM_SIZES[next];
        return {
          x: Math.max(0, Math.min(window.innerWidth  - w, pos.x)),
          y: Math.max(0, Math.min(window.innerHeight - h, pos.y)),
        };
      });
      return next;
    });
  };

  const handleStart = async () => {
    const client = liveClientRef.current;
    if (!client) return;
    try {
      await client.startAudioCapture();
      try {
        const stream = await client.startCameraShare('user');
        setCameraStream(stream);
        setIsCameraOn(true);
        initCamPos();
      } catch { console.warn('Camera not available, continuing without it'); }
      setNeedsStart(false);
    } catch (err) {
      console.error('Failed to start session:', err);
      setError('Could not access microphone. Please allow microphone permission and try again.');
    }
  };

  const handleToggleMute = () => {
    const client = liveClientRef.current;
    if (!client) return;
    const next = !isMuted;
    client.setMuted(next);
    setIsMuted(next);
  };

  const handleToggleCamera = async () => {
    const client = liveClientRef.current;
    if (!client) return;
    if (isCameraOn) {
      client.stopCameraShare();
      setCameraStream(null);
      setIsCameraOn(false);
      setCamPos(null);
    } else {
      try {
        const stream = await client.startCameraShare('user');
        setCameraStream(stream);
        setIsCameraOn(true);
        initCamPos();
      } catch (err) { console.error('Camera error:', err); }
    }
  };

  const handleToggleScreenShare = async () => {
    const client = liveClientRef.current;
    if (!client) return;
    if (isScreenShared) {
      client.stopScreenShare();
      setIsScreenShared(false);
      setScreenStream(null);
    } else {
      if (!navigator.mediaDevices?.getDisplayMedia) return;
      try {
        const stream = await client.startScreenShare();
        setScreenStream(stream);
        setIsScreenShared(true);
      } catch (err) {
        console.error('Screen share error:', err);
        setIsScreenShared(false);
        setScreenStream(null);
      }
    }
  };

  const handleEnd = () => {
    liveClientRef.current?.disconnect();
    window.location.href = '/';
  };

  const statusConfig: Record<SessionState, { color: string; label: string }> = {
    connecting:   { color: 'bg-yellow-400', label: 'Connecting…'   },
    connected:    { color: 'bg-green-400',  label: 'Connected'      },
    listening:    { color: 'bg-green-400',  label: 'Listening'      },
    speaking:     { color: 'bg-blue-400',   label: 'AI Speaking'    },
    error:        { color: 'bg-red-500',    label: 'Error'          },
    reconnecting: { color: 'bg-yellow-400', label: 'Reconnecting…' },
  };
  const { color: statusColor, label: statusLabel } = statusConfig[sessionState];

  if (error) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-zinc-950 text-white gap-4 px-6">
        <p className="text-red-400 text-center max-w-sm">{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="bg-zinc-800 border-white/30 text-white hover:bg-zinc-700">
          Reload
        </Button>
      </div>
    );
  }

  const { w: camW, h: camH } = CAM_SIZES[camSize];

  return (
    <div className="h-dvh flex flex-col bg-zinc-950 text-white overflow-hidden">

      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
        <span className="font-semibold text-base tracking-tight">USAII Pitch Coach</span>
        <div className="flex items-center gap-2">
          {sessionState === 'connecting' || sessionState === 'reconnecting'
            ? <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
            : <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
          }
          <span className="text-sm text-white/60">{statusLabel}</span>
        </div>
      </header>

      <main className="flex-1 relative flex flex-col items-center justify-center p-6 overflow-hidden">
        {!isScreenShared && !needsStart && (
          <div className="flex items-center gap-2 text-white/30">
            {sessionState === 'speaking' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-sm">AI coaching…</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm">Listening…</span>
              </>
            )}
          </div>
        )}

        {needsStart && (sessionState === 'connected' || sessionState === 'listening') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm gap-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">Ready to practice?</h2>
              <p className="text-white/50 text-sm max-w-xs">
                Your mic and camera will turn on. The AI coach will listen, watch your delivery, and give feedback.
              </p>
            </div>
            <Button onClick={handleStart} size="lg" className="bg-white text-zinc-950 hover:bg-white/90 font-semibold px-8 py-3 h-auto rounded-full">
              Start Your Pitch
            </Button>
          </div>
        )}

        {isScreenShared && (
          <div className="absolute inset-4 rounded-xl overflow-hidden border border-white/20 shadow-2xl bg-zinc-900">
            <video ref={screenVideoRef} autoPlay playsInline muted className="w-full h-full object-contain bg-zinc-900" />
            <div className="absolute top-2 left-3 text-[10px] text-white/50 font-medium bg-zinc-950/70 px-2 py-0.5 rounded-full">
              Your screen
            </div>
          </div>
        )}
      </main>

      <footer className="flex items-center justify-center gap-3 px-6 py-4 border-t border-white/10 shrink-0">
        <Button onClick={handleToggleMute} variant="outline" size="icon" disabled={needsStart}
          className={`rounded-full w-12 h-12 ${isMuted ? 'bg-red-500/30 border-red-400/70 text-red-300 hover:bg-red-500/40' : 'bg-zinc-800 border-white/30 text-white hover:bg-zinc-700 hover:border-white/50'}`}
          title={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        <Button onClick={handleToggleCamera} variant="outline" size="icon" disabled={needsStart}
          className={`rounded-full w-12 h-12 ${isCameraOn ? 'bg-zinc-800 border-white/30 text-white hover:bg-zinc-700 hover:border-white/50' : 'bg-zinc-800 border-white/30 text-white/50 hover:bg-zinc-700 hover:text-white hover:border-white/50'}`}
          title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}>
          {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>

        <Button onClick={handleToggleScreenShare} variant="outline" size="icon" disabled={needsStart}
          className={`rounded-full w-12 h-12 ${isScreenShared ? 'bg-blue-500/30 border-blue-400/70 text-blue-300 hover:bg-blue-500/40' : 'bg-zinc-800 border-white/30 text-white hover:bg-zinc-700 hover:border-white/50'}`}
          title={isScreenShared ? 'Stop sharing slides' : 'Share slides'}>
          {isScreenShared ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </Button>

        <Button onClick={() => setIsFeedbackOpen(v => !v)} variant="outline" size="icon"
          className={`rounded-full w-12 h-12 relative ${isFeedbackOpen ? 'bg-violet-500/30 border-violet-400/70 text-violet-300 hover:bg-violet-500/40' : 'bg-zinc-800 border-white/30 text-white hover:bg-zinc-700 hover:border-white/50'}`}
          title="Coaching notes">
          <MessageSquare className="w-5 h-5" />
          {feedbackLog.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
              {feedbackLog.length > 9 ? '9+' : feedbackLog.length}
            </span>
          )}
        </Button>

        <div className="w-px h-8 bg-white/20" />

        <Button onClick={handleEnd} variant="outline" size="icon"
          className="rounded-full w-12 h-12 bg-red-500/30 border-red-400/70 text-red-300 hover:bg-red-500/40 hover:border-red-400"
          title="End session">
          <PhoneOff className="w-5 h-5" />
        </Button>
      </footer>

      {isCameraOn && camPos && (
        <div
          onMouseDown={handleCamMouseDown}
          style={{ position: 'fixed', left: camPos.x, top: camPos.y, width: camW, height: camH, cursor: isDraggingCam ? 'grabbing' : 'grab', userSelect: 'none', zIndex: 50 }}
          className="rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-zinc-900 group"
        >
          <video ref={cameraVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors">
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={cycleCamSize}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-zinc-950/70 text-white/70 hover:text-white hover:bg-zinc-950/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title={`Size: ${camSize} → click to enlarge`}
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] text-white/60 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              drag to move · click <Maximize2 className="w-2.5 h-2.5 inline" /> to resize
            </div>
          </div>
        </div>
      )}

      {isFeedbackOpen && (
        <div ref={feedbackPanelRef} className="fixed right-0 top-0 h-full w-80 bg-zinc-900 border-l border-white/10 flex flex-col z-40 shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-violet-400" />
              <span className="font-semibold text-sm">Coaching Notes</span>
              {feedbackLog.length > 0 && (
                <span className="text-xs text-white/40">{feedbackLog.length} note{feedbackLog.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            <button onClick={() => setIsFeedbackOpen(false)} className="w-6 h-6 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {feedbackLog.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <MessageSquare className="w-8 h-8 text-white/20 mx-auto" />
                <p className="text-white/40 text-sm">Start your pitch — coaching feedback will appear here after each round.</p>
              </div>
            ) : (
              feedbackLog.map(entry => (
                <div key={entry.id} className="rounded-xl bg-white/5 border border-white/8 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider">Note {entry.round}</span>
                    <span className="text-[10px] text-white/30">{formatTimestamp(entry.timestamp)}</span>
                  </div>
                  <p className="text-sm text-white/90 leading-relaxed">{entry.text}</p>
                </div>
              ))
            )}
          </div>

          {feedbackLog.length > 0 && (
            <div className="px-4 py-3 border-t border-white/10 shrink-0">
              <button
                onClick={() => { setFeedbackLog([]); feedbackRoundRef.current = 0; }}
                className="w-full text-xs text-white/30 hover:text-white/60 transition-colors py-1"
              >
                Clear notes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
