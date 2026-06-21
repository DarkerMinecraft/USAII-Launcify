'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, Loader2, MessageSquare, Maximize2, X,
  ShieldCheck, MicIcon, VideoIcon, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GeminiLiveClient, type SessionState } from '@/lib/gemini-live-client';
import { getGeminiToken } from '@/actions/gemini';

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

type PermissionPhase = 'checking' | 'prompt' | 'requesting' | 'granted' | 'denied-mic' | 'no-device' | 'unsupported';

const formatTimestamp = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const SessionUi = () => {
  const [sessionState, setSessionState] = useState<SessionState>('connecting');
  const [isMuted, setIsMuted]           = useState(false);
  const [isCameraOn, setIsCameraOn]     = useState(false);
  const [isScreenShared, setIsScreenShared] = useState(false);
  const [needsStart, setNeedsStart]     = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [permissionPhase, setPermissionPhase] = useState<PermissionPhase>('checking');
  const [cameraGranted, setCameraGranted] = useState(false);

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

  // Check permission state on mount
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionPhase('unsupported');
      return;
    }

    if (!navigator.permissions?.query) {
      // Permissions API not available — go straight to prompt
      setPermissionPhase('prompt');
      return;
    }

    navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
      if (result.state === 'granted') {
        setPermissionPhase('granted');
        // Also check camera
        navigator.permissions.query({ name: 'camera' as PermissionName }).then((camResult) => {
          setCameraGranted(camResult.state === 'granted');
        }).catch(() => {});
      } else if (result.state === 'denied') {
        setPermissionPhase('denied-mic');
      } else {
        // 'prompt' — hasn't been asked yet
        setPermissionPhase('prompt');
      }

      // Watch for permission changes
      result.onchange = () => {
        if (result.state === 'granted') setPermissionPhase('granted');
        else if (result.state === 'denied') setPermissionPhase('denied-mic');
      };
    }).catch(() => {
      setPermissionPhase('prompt');
    });
  }, []);

  // Connect to Gemini once permissions are settled (not denied/unsupported)
  useEffect(() => {
    if (permissionPhase === 'checking' || permissionPhase === 'denied-mic' || permissionPhase === 'unsupported') return;

    let cancelled = false;

    if (_activeClient) {
      _activeClient.disconnect();
      _activeClient = null;
    }

    const init = async () => {
      try {
        const { apiKey, model } = await getGeminiToken();
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
  }, [permissionPhase]);

  useEffect(() => {
    const handleUnload = () => { _activeClient?.disconnect(); };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const initCamPos = (size: CamSize = camSize) => {
    if (camPos) return;
    const { w, h } = CAM_SIZES[size];
    setCamPos({ x: window.innerWidth - w - 16, y: window.innerHeight - h - 80 });
  };

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

  // Request mic + camera permissions, called from the "Grant Access" button
  const handleGrantPermissions = async () => {
    setPermissionPhase('requesting');
    try {
      // Request mic (required) + camera (optional) together so the browser shows one combined prompt
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(t => t.stop());
      setCameraGranted(true);
      setPermissionPhase('granted');
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          // Camera may have been denied but mic could still be ok — try mic alone
          try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStream.getTracks().forEach(t => t.stop());
            setCameraGranted(false);
            setPermissionPhase('granted');
          } catch (micErr) {
            if (micErr instanceof DOMException && (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError')) {
              setPermissionPhase('denied-mic');
            } else if (micErr instanceof DOMException && micErr.name === 'NotFoundError') {
              setPermissionPhase('no-device');
            } else {
              setPermissionPhase('prompt');
              setError('Could not access your microphone. Please try again.');
            }
          }
        } else if (err.name === 'NotFoundError') {
          setPermissionPhase('no-device');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setPermissionPhase('prompt');
          setError('Your microphone is in use by another application. Close it and try again.');
        } else {
          setPermissionPhase('prompt');
          setError(`Could not access media devices: ${err.message}`);
        }
      } else {
        setPermissionPhase('prompt');
      }
    }
  };

  const handleStart = async () => {
    const client = liveClientRef.current;
    if (!client) return;
    try {
      await client.startAudioCapture();
      if (cameraGranted) {
        try {
          const stream = await client.startCameraShare('user');
          setCameraStream(stream);
          setIsCameraOn(true);
          initCamPos();
        } catch { /* camera optional */ }
      }
      setNeedsStart(false);
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionPhase('denied-mic');
        } else if (err.name === 'NotFoundError') {
          setPermissionPhase('no-device');
        } else if (err.name === 'NotReadableError') {
          setError('Your microphone is being used by another app. Close it and reload.');
        } else {
          setError(`Microphone error: ${err.message}`);
        }
      } else {
        setError('Could not start the session. Please reload and try again.');
      }
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
    window.location.href = '/dashboard';
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

  // ── Full-screen overlay states ──────────────────────────────────────────────

  if (permissionPhase === 'unsupported') {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-zinc-950 text-white gap-4 px-6 text-center">
        <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto" />
        <p className="text-white/80 max-w-sm">
          Your browser doesn&apos;t support microphone access. Please use Chrome, Edge, or Safari and make sure you&apos;re on a secure (HTTPS) connection.
        </p>
      </div>
    );
  }

  if (permissionPhase === 'denied-mic') {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-zinc-950 text-white gap-5 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-400/40 flex items-center justify-center">
          <MicOff className="w-6 h-6 text-red-400" />
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-lg">Microphone access blocked</p>
          <p className="text-white/50 text-sm max-w-xs">
            Click the lock icon in your browser&apos;s address bar, set <strong>Microphone</strong> to <strong>Allow</strong>, then reload the page.
          </p>
        </div>
        <Button onClick={() => window.location.reload()} variant="outline" className="bg-zinc-800 border-white/30 text-white hover:bg-zinc-700">
          Reload after allowing
        </Button>
      </div>
    );
  }

  if (permissionPhase === 'no-device') {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-zinc-950 text-white gap-5 px-6 text-center">
        <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto" />
        <div className="space-y-2">
          <p className="font-semibold text-lg">No microphone found</p>
          <p className="text-white/50 text-sm max-w-xs">
            Connect a microphone or headset, then reload.
          </p>
        </div>
        <Button onClick={() => window.location.reload()} variant="outline" className="bg-zinc-800 border-white/30 text-white hover:bg-zinc-700">
          Reload
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center bg-zinc-950 text-white gap-4 px-6 text-center">
        <AlertTriangle className="w-7 h-7 text-red-400 mx-auto" />
        <p className="text-red-400 max-w-sm">{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="bg-zinc-800 border-white/30 text-white hover:bg-zinc-700">
          Reload
        </Button>
      </div>
    );
  }

  // ── Main session UI ─────────────────────────────────────────────────────────

  const { w: camW, h: camH } = CAM_SIZES[camSize];

  return (
    <div className="h-dvh flex flex-col bg-zinc-950 text-white overflow-hidden">

      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
        <span className="font-semibold text-base tracking-tight">Launchify Pitch Session</span>
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

        {/* Permissions prompt overlay */}
        {permissionPhase === 'prompt' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm gap-6 px-6">
            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/20 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white/70" />
            </div>
            <div className="text-center space-y-2 max-w-xs">
              <h2 className="text-xl font-semibold">Allow access</h2>
              <p className="text-white/50 text-sm">
                Pitch Session needs your microphone to listen and optionally your camera for delivery coaching.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[220px]">
              <div className="flex items-center gap-3 text-sm text-white/60">
                <MicIcon className="w-4 h-4 shrink-0 text-white/40" />
                <span>Microphone <span className="text-white/30">(required)</span></span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/60">
                <VideoIcon className="w-4 h-4 shrink-0 text-white/40" />
                <span>Camera <span className="text-white/30">(optional)</span></span>
              </div>
            </div>
            <Button
              onClick={handleGrantPermissions}
              size="lg"
              className="bg-white text-zinc-950 hover:bg-white/90 font-semibold px-8 py-3 h-auto rounded-full"
            >
              Grant Access
            </Button>
          </div>
        )}

        {/* Requesting overlay */}
        {permissionPhase === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-white/40" />
            <p className="text-white/50 text-sm">Waiting for permission…</p>
          </div>
        )}

        {/* Start overlay */}
        {permissionPhase === 'granted' && needsStart && (sessionState === 'connected' || sessionState === 'listening') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm gap-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">Ready to practice?</h2>
              <p className="text-white/50 text-sm max-w-xs">
                Your mic {cameraGranted ? 'and camera ' : ''}will turn on. The AI coach will listen{cameraGranted ? ', watch your delivery,' : ''} and give feedback.
              </p>
              {!cameraGranted && (
                <p className="text-white/30 text-xs max-w-xs mt-1">
                  Camera access not granted — delivery coaching will be audio-only.
                </p>
              )}
            </div>
            <Button onClick={handleStart} size="lg" className="bg-white text-zinc-950 hover:bg-white/90 font-semibold px-8 py-3 h-auto rounded-full">
              Start Your Pitch
            </Button>
          </div>
        )}

        {/* Waiting for connection */}
        {permissionPhase === 'granted' && needsStart && sessionState === 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-white/40" />
            <p className="text-white/50 text-sm">Connecting to AI coach…</p>
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
            <Button
              onMouseDown={e => e.stopPropagation()}
              onClick={cycleCamSize}
              variant="ghost"
              size="icon-sm"
              className="absolute top-1.5 right-1.5 rounded-full bg-zinc-950/70 text-white/70 hover:text-white hover:bg-zinc-950/90 opacity-0 group-hover:opacity-100"
              title={`Size: ${camSize} → click to enlarge`}
            >
              <Maximize2 className="w-3 h-3" />
            </Button>
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] text-white/60 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              drag to move
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
            <Button onClick={() => setIsFeedbackOpen(false)} variant="ghost" size="icon-sm" className="rounded-full text-white/40 hover:text-white hover:bg-white/10">
              <X className="w-4 h-4" />
            </Button>
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
              <Button
                onClick={() => { setFeedbackLog([]); feedbackRoundRef.current = 0; }}
                variant="ghost"
                className="w-full text-xs text-white/30 hover:text-white/60 h-auto py-1"
              >
                Clear notes
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
