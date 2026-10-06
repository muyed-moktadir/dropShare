'use client';
import React, { useRef, useState, useEffect } from 'react';
import { usePeerStore } from '@/stores/usePeerStore';
import { useScreenShareStore } from '@/stores/useScreenShareStore';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useUIStore } from '@/stores/useUIStore';
import { Tv, Radio, StopCircle, Play, Volume2, VolumeX, Maximize2, Minimize2, Camera, Check, Zap, ShieldCheck, Layers, Monitor, Circle, Square, ChevronDown, Sliders, Crown, Hand } from 'lucide-react';
const RESOLUTION_PRESETS = [
    {
        id: '1080p',
        label: '1080p Full HD',
        badge: '1080p',
        desc: '~6 Mbps · Crystal Clear · Best Quality',
        width: 1920,
        height: 1080,
        bitrate: 6000000,
    },
    {
        id: '720p',
        label: '720p HD',
        badge: '720p',
        desc: '~2.5 Mbps · Balanced & Smooth',
        width: 1280,
        height: 720,
        bitrate: 2500000,
    },
    {
        id: '480p',
        label: '480p SD',
        badge: '480p',
        desc: '~1 Mbps · Compact File · Fast Sharing',
        width: 854,
        height: 480,
        bitrate: 1000000,
    },
];
export function ScreenShareViewer() {
    const { peers, activeConnectedPeerId, setActiveConnectedPeerId, hostPeerId, isHost, localDevice } = usePeerStore();
    const { remoteStream, localStream, isBroadcasting, activePresenter, pendingRequest, requestStatus, } = useScreenShareStore();
    const { startScreenShare, stopScreenShare, requestScreenShare, approveScreenShare, declineScreenShare, hostReclaimStage, syncScreenBroadcast, } = useWebRTC();
    const { setActiveTab } = useUIStore();
    const videoRef = useRef(null);
    const localVideoRef = useRef(null);
    const containerRef = useRef(null);
    const [isMuted, setMuted] = useState(true);
    const [isRemotePlaying, setIsRemotePlaying] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isTheaterMode, setTheaterMode] = useState(false);
    const [snapshotTaken, setSnapshotTaken] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [captureAudio, setCaptureAudio] = useState(true);
    // Screen Recording State & Refs
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const recordAnimationRef = useRef(null);
    const recordCanvasRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const recordMenuRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [selectedResolution, setSelectedResolution] = useState('1080p');
    const [selectedFormat, setSelectedFormat] = useState('webm');
    const [showRecordMenu, setShowRecordMenu] = useState(false);
    const [justSavedRecording, setJustSavedRecording] = useState(false);
    const isMp4Supported = typeof MediaRecorder !== 'undefined' &&
        (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2') ||
            MediaRecorder.isTypeSupported('video/mp4'));
    const isDisplayMediaSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);
    const isMobile = typeof navigator !== 'undefined' && /iphone|ipad|android/i.test(navigator.userAgent || '');
    // Auto-resolve connected target peer: active peer -> host peer -> first available peer
    const connectedPeer = peers.find((p) => p.id === activeConnectedPeerId) ||
        (hostPeerId ? peers.find((p) => p.id === hostPeerId) : null) ||
        (peers.length > 0 ? peers[0] : null);
    // Automatically sync activeConnectedPeerId when peers are detected
    useEffect(() => {
        if (!activeConnectedPeerId && connectedPeer) {
            setActiveConnectedPeerId(connectedPeer.id);
        }
    }, [connectedPeer, activeConnectedPeerId, setActiveConnectedPeerId]);
    // Automatically poll room presenter for active screen broadcast while idle
    useEffect(() => {
        if (!remoteStream && !isBroadcasting && peers.length > 0) {
            syncScreenBroadcast();
            const interval = setInterval(() => {
                syncScreenBroadcast();
            }, 3500);
            return () => clearInterval(interval);
        }
    }, [remoteStream, isBroadcasting, peers.length, syncScreenBroadcast]);
    // Format seconds into MM:SS
    const formatTime = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    // Close recording settings popup on outside click
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (recordMenuRef.current && !recordMenuRef.current.contains(e.target)) {
                setShowRecordMenu(false);
            }
        };
        if (showRecordMenu) {
            document.addEventListener('mousedown', handleOutsideClick);
        }
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [showRecordMenu]);
    // Stop recording if the stream ends
    useEffect(() => {
        if (isRecording && !remoteStream && !isBroadcasting) {
            stopRecording();
        }
    }, [remoteStream, isBroadcasting, isRecording]);
    // Cleanup recording on component unmount
    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
            if (recordAnimationRef.current) {
                cancelAnimationFrame(recordAnimationRef.current);
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                try {
                    mediaRecorderRef.current.stop();
                }
                catch { }
            }
        };
    }, []);
    // Attach remote stream to video element with bulletproof autoplay, unmute, & playback recovery
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !remoteStream) {
            setIsRemotePlaying(false);
            return;
        }
        let isDisposed = false;
        // Direct property assignment for HTML5 autoplay permissions
        video.defaultMuted = true;
        video.muted = isMuted;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        if (video.srcObject !== remoteStream) {
            video.srcObject = remoteStream;
        }
        let playInFlight = false;
        const playVideo = async () => {
            if (isDisposed || !video)
                return;
            if (!video.paused && !video.ended && video.readyState >= 2) {
                setIsRemotePlaying(true);
                return;
            }
            if (playInFlight)
                return;
            playInFlight = true;
            try {
                await video.play();
                if (!isDisposed) {
                    setIsRemotePlaying(true);
                }
            }
            catch {
                // Fall back to guaranteed muted autoplay if browser blocks audio
                try {
                    video.muted = true;
                    setMuted(true);
                    await video.play();
                    if (!isDisposed) {
                        setIsRemotePlaying(true);
                    }
                }
                catch {
                    if (!isDisposed) {
                        setIsRemotePlaying(false);
                    }
                }
            }
            finally {
                playInFlight = false;
            }
        };
        // Listen to stream track unmuting (when first RTP packets arrive)
        const tracks = remoteStream.getTracks();
        const handleUnmute = () => {
            playVideo();
        };
        tracks.forEach((track) => {
            track.addEventListener('unmute', handleUnmute);
            if (!track.muted) {
                playVideo();
            }
        });
        const handleLoadedMetadata = () => playVideo();
        const handleLoadedData = () => playVideo();
        const handleCanPlay = () => playVideo();
        const handlePlaying = () => {
            if (!isDisposed)
                setIsRemotePlaying(true);
        };
        const handlePause = () => {
            if (!isDisposed && video.paused)
                setIsRemotePlaying(false);
        };
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('loadeddata', handleLoadedData);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('pause', handlePause);
        // Initial play trigger
        playVideo();
        return () => {
            isDisposed = true;
            tracks.forEach((track) => {
                track.removeEventListener('unmute', handleUnmute);
            });
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('loadeddata', handleLoadedData);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('pause', handlePause);
        };
    }, [remoteStream, isMuted]);
    // Attach local stream for preview when broadcasting
    useEffect(() => {
        const video = localVideoRef.current;
        if (!video || !localStream)
            return;
        if (video.srcObject !== localStream) {
            video.srcObject = localStream;
        }
        video.play().catch((err) => {
            if (err.name !== 'AbortError') {
                console.warn('Autoplay prevented on local monitor preview:', err);
            }
        });
    }, [localStream]);
    const handleStartShare = async () => {
        setIsStarting(true);
        setErrorMessage(null);
        try {
            useScreenShareStore.getState().setCaptureAudio(captureAudio);
            await startScreenShare();
        }
        catch (err) {
            console.error('Failed to initiate screen share:', err);
            const msg = err instanceof Error ? err.message : 'Screen sharing could not be started.';
            setErrorMessage(msg);
        }
        finally {
            setIsStarting(false);
        }
    };
    const handleStopShare = () => {
        if (isRecording) {
            stopRecording();
        }
        stopScreenShare();
    };
    const toggleFullscreen = () => {
        if (!containerRef.current)
            return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
        }
        else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
        }
    };
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);
    const takeSnapshot = () => {
        const activeVideo = remoteStream ? videoRef.current : localVideoRef.current;
        if (!activeVideo)
            return;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = activeVideo.videoWidth || 1920;
            canvas.height = activeVideo.videoHeight || 1080;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(activeVideo, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = `dropsphere-snapshot-${Date.now()}.png`;
                link.href = dataUrl;
                link.click();
                setSnapshotTaken(true);
                setTimeout(() => setSnapshotTaken(false), 2000);
            }
        }
        catch (err) {
            console.warn('Screenshot error:', err);
        }
    };
    // Start Screen Recording with chosen resolution & format
    const startRecording = () => {
        setShowRecordMenu(false);
        const activeStream = remoteStream || localStream;
        const activeVideo = remoteStream ? videoRef.current : localVideoRef.current;
        if (!activeStream || !activeVideo) {
            console.warn('Cannot record: No active screen share stream or video element.');
            return;
        }
        try {
            recordedChunksRef.current = [];
            const preset = RESOLUTION_PRESETS.find((r) => r.id === selectedResolution) || RESOLUTION_PRESETS[0];
            // Determine supported MIME type
            let mimeType = 'video/webm;codecs=vp9,opus';
            if (selectedFormat === 'mp4') {
                if (typeof MediaRecorder !== 'undefined' &&
                    MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
                    mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
                }
                else if (typeof MediaRecorder !== 'undefined' &&
                    MediaRecorder.isTypeSupported('video/mp4')) {
                    mimeType = 'video/mp4';
                }
            }
            else {
                if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(mimeType)) {
                    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
                        mimeType = 'video/webm;codecs=vp8,opus';
                    }
                    else {
                        mimeType = 'video/webm';
                    }
                }
            }
            let streamToRecord;
            const srcW = activeVideo.videoWidth || 1920;
            const isNativeMatch = selectedResolution === '1080p' && Math.abs(srcW - 1920) < 60;
            if (isNativeMatch) {
                // Direct stream recording (0% CPU canvas overhead, 60 FPS)
                streamToRecord = activeStream;
            }
            else {
                // Offscreen high-performance scaling canvas for 720p or 480p
                const canvas = document.createElement('canvas');
                canvas.width = preset.width;
                canvas.height = preset.height;
                recordCanvasRef.current = canvas;
                const ctx = canvas.getContext('2d', { alpha: false });
                const drawFrame = () => {
                    if (!ctx)
                        return;
                    const currentW = activeVideo.videoWidth || preset.width;
                    const currentH = activeVideo.videoHeight || preset.height;
                    // Aspect ratio fit & center
                    const scale = Math.min(preset.width / currentW, preset.height / currentH);
                    const drawW = currentW * scale;
                    const drawH = currentH * scale;
                    const offsetX = (preset.width - drawW) / 2;
                    const offsetY = (preset.height - drawH) / 2;
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, preset.width, preset.height);
                    ctx.drawImage(activeVideo, offsetX, offsetY, drawW, drawH);
                    recordAnimationRef.current = requestAnimationFrame(drawFrame);
                };
                drawFrame();
                const canvasStream = canvas.captureStream(60);
                const combinedTracks = [
                    ...canvasStream.getVideoTracks(),
                    ...activeStream.getAudioTracks(),
                ];
                streamToRecord = new MediaStream(combinedTracks);
            }
            const recorder = new MediaRecorder(streamToRecord, {
                mimeType: typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)
                    ? mimeType
                    : undefined,
                videoBitsPerSecond: preset.bitrate,
            });
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    recordedChunksRef.current.push(e.data);
                }
            };
            recorder.onstop = () => {
                if (recordAnimationRef.current) {
                    cancelAnimationFrame(recordAnimationRef.current);
                    recordAnimationRef.current = null;
                }
                recordCanvasRef.current = null;
                const chunks = recordedChunksRef.current;
                if (chunks.length === 0)
                    return;
                const actualMime = recorder.mimeType || mimeType;
                const blob = new Blob(chunks, { type: actualMime });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const ext = selectedFormat === 'mp4' && actualMime.includes('mp4') ? 'mp4' : 'webm';
                a.download = `dropsphere-record-${selectedResolution}-${Date.now()}.${ext}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 2000);
                setJustSavedRecording(true);
                setTimeout(() => setJustSavedRecording(false), 3000);
            };
            recorder.start(1000); // 1-second chunks
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setRecordingSeconds(0);
            timerIntervalRef.current = setInterval(() => {
                setRecordingSeconds((prev) => prev + 1);
            }, 1000);
        }
        catch (err) {
            console.error('Failed to start screen recording:', err);
        }
    };
    const stopRecording = () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.stop();
            }
            catch (err) {
                console.warn('Error stopping mediaRecorder:', err);
            }
        }
        setIsRecording(false);
    };
    return (<div ref={containerRef} className={`bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4.5 transition-all duration-200 shadow-sm overflow-hidden flex flex-col justify-between ${isTheaterMode || isFullscreen
            ? 'fixed inset-4 z-50'
            : 'relative w-full h-full min-h-[380px] max-h-[calc(100vh-210px)]'}`}>
      {/* ── Slide-Down Approval Toast (Google Meet Standard Handover) ── */}
      {pendingRequest && (isBroadcasting || isHost) && (<div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl bg-slate-950/95 text-white px-4 py-2 text-xs shadow-2xl border border-white/20 backdrop-blur-xl animate-in slide-in-from-top-2">
          <span className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-cyan-400 animate-pulse"/>
            <span>
              <strong>{pendingRequest.requesterName}</strong> requested to share screen
            </span>
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            <button onClick={() => approveScreenShare(pendingRequest.requesterId)} className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-semibold text-[11px] text-white transition-colors cursor-pointer shadow-xs">
              Hand Over
            </button>
            <button onClick={() => declineScreenShare(pendingRequest.requesterId)} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 font-medium text-[11px] text-slate-300 transition-colors cursor-pointer">
              Decline
            </button>
          </div>
        </div>)}

      {/* Top Header Bar */}
      <div className="flex-none flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
            <Tv className="h-4 w-4"/>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 tracking-tight">
                Peer Screen Broadcast
              </h3>
              {remoteStream && (<span className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                  Live · {activePresenter?.peerName || connectedPeer?.name || 'Peer'}
                </span>)}
              {isBroadcasting && (<span className="flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"/>
                  Broadcasting to {peers.length} {peers.length === 1 ? 'Peer' : 'Peers'}
                </span>)}
            </div>
            <p className="text-[11px] text-slate-400">
              Direct WebRTC stream · 60 FPS LAN Cast
            </p>
          </div>
        </div>

        {/* Action controls when stream is active */}
        <div className="flex items-center gap-1.5">
          {/* Guest Request to Present Button (When someone else is presenting) */}
          {remoteStream && !isBroadcasting && !isHost && (<button onClick={requestScreenShare} disabled={requestStatus === 'requesting'} title="Request permission from current presenter to share screen" className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition-all cursor-pointer shadow-2xs shrink-0 ${requestStatus === 'requesting'
                ? 'bg-blue-50 border-blue-200 text-blue-700 animate-pulse cursor-wait'
                : requestStatus === 'denied'
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'}`}>
              <Hand className="h-3 w-3 text-blue-600"/>
              <span>
                {requestStatus === 'requesting'
                ? 'Sent...'
                : requestStatus === 'denied'
                    ? 'Declined'
                    : 'Request'}
              </span>
            </button>)}

          {/* Host Reclaim Stage Button (When another peer is presenting) */}
          {remoteStream && !isBroadcasting && isHost && (<button onClick={hostReclaimStage} title="Reclaim presentation stage as Room Host" className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-xs px-2.5 py-1 transition-all cursor-pointer shadow-2xs shrink-0">
              <Crown className="h-3 w-3 text-amber-600"/>
              <span>Reclaim</span>
            </button>)}

            {/* Snapshot Button */}
            <button onClick={takeSnapshot} title="Capture Frame" className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
              {snapshotTaken ? <Check className="h-3 w-3 text-emerald-600"/> : <Camera className="h-3 w-3 text-blue-600"/>}
              <span className="hidden sm:inline text-[11px]">{snapshotTaken ? 'Saved!' : 'Snapshot'}</span>
            </button>

            {/* Screen Recorder with 1080p, 720p, 480p Picker */}
            <div ref={recordMenuRef} className="relative inline-flex items-center">
              {isRecording ? (<button onClick={stopRecording} title="Stop recording and download video file" className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 text-xs font-semibold shadow-xs animate-pulse transition-all cursor-pointer">
                  <Square className="h-3 w-3 fill-white"/>
                  <span className="font-mono text-[11px]">{formatTime(recordingSeconds)}</span>
                  <span className="rounded bg-rose-800/80 px-1 py-0.2 text-[9px] uppercase tracking-wider">
                    {selectedResolution}
                  </span>
                  <span className="text-[10px] font-medium hidden sm:inline">Stop</span>
                </button>) : (<div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 shadow-2xs">
                  <button onClick={startRecording} title={`Record stream in ${selectedResolution} (${selectedFormat.toUpperCase()})`} className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-700 hover:text-rose-600 hover:bg-slate-100 transition-colors rounded-l-lg cursor-pointer">
                    {justSavedRecording ? (<>
                        <Check className="h-3 w-3 text-emerald-600"/>
                        <span className="text-[11px] text-emerald-600 font-semibold">Saved!</span>
                      </>) : (<>
                        <Circle className="h-3 w-3 fill-rose-500 text-rose-500"/>
                        <span className="text-[11px] font-medium">Record</span>
                        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                          {selectedResolution}
                        </span>
                      </>)}
                  </button>

                  <button onClick={() => setShowRecordMenu(!showRecordMenu)} title="Recording resolution and format options" className="border-l border-slate-200 px-1.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors rounded-r-lg cursor-pointer">
                    <ChevronDown className="h-3 w-3"/>
                  </button>
                </div>)}

              {/* Quality & Format Dropdown Menu */}
              {showRecordMenu && !isRecording && (<div className="absolute top-full mt-1.5 right-0 z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-blue-600"/> Recording Settings
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Direct P2P</span>
                  </div>

                  {/* Resolution Presets */}
                  <div className="mt-2.5">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Target Resolution
                    </div>
                    <div className="space-y-1">
                      {RESOLUTION_PRESETS.map((res) => {
                const isSelected = selectedResolution === res.id;
                return (<button key={res.id} onClick={() => setSelectedResolution(res.id)} className={`w-full flex items-start justify-between rounded-lg p-2 text-left transition-colors cursor-pointer ${isSelected
                        ? 'bg-blue-50 border border-blue-200 text-blue-900'
                        : 'hover:bg-slate-50 text-slate-700 border border-transparent'}`}>
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-semibold">
                                <span>{res.label}</span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-medium ${isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-500'}`}>
                                  {res.badge}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">{res.desc}</p>
                            </div>
                            {isSelected && (<Check className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5"/>)}
                          </button>);
            })}
                    </div>
                  </div>

                  {/* Format Choice */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Video Container
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button onClick={() => setSelectedFormat('webm')} className={`rounded-lg py-1.5 px-2 text-xs font-medium text-center transition-colors cursor-pointer border ${selectedFormat === 'webm'
                ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                        WebM
                        <span className="text-[10px] text-slate-400 block font-normal">Native VP9</span>
                      </button>

                      <button onClick={() => isMp4Supported && setSelectedFormat('mp4')} disabled={!isMp4Supported} className={`rounded-lg py-1.5 px-2 text-xs font-medium text-center transition-colors border ${!isMp4Supported
                ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                : selectedFormat === 'mp4'
                    ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold cursor-pointer'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer'}`}>
                        MP4
                        <span className="text-[10px] text-slate-400 block font-normal">
                          H.264 {isMp4Supported ? 'AVC' : 'N/A'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Direct Launch from Menu */}
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Zero cloud upload</span>
                    <button onClick={startRecording} className="flex items-center gap-1 rounded-lg bg-rose-600 hover:bg-rose-700 px-3 py-1 text-xs font-semibold text-white transition-colors cursor-pointer shadow-2xs">
                      <Circle className="h-2.5 w-2.5 fill-white text-white"/> Start Recording
                    </button>
                  </div>
                </div>)}
            </div>

            {remoteStream && (<button onClick={() => {
                const video = videoRef.current;
                const newMuted = !isMuted;
                setMuted(newMuted);
                if (video) {
                    video.muted = newMuted;
                    if (!newMuted) {
                        video.play().catch(() => { });
                    }
                }
            }} title={isMuted ? 'Unmute Audio' : 'Mute Audio'} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${isMuted
                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
                {isMuted ? (<>
                    <VolumeX className="h-3 w-3 text-amber-600"/>
                    <span className="hidden sm:inline text-[11px]">Unmute</span>
                  </>) : (<>
                    <Volume2 className="h-3 w-3 text-blue-600"/>
                    <span className="hidden sm:inline text-[11px]">Mute</span>
                  </>)}
              </button>)}


            <button onClick={() => setTheaterMode(!isTheaterMode)} title={isTheaterMode ? 'Standard View' : 'Theater Mode'} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors">
              <Layers className="h-3 w-3 text-blue-600"/>
              <span className="hidden sm:inline text-[11px]">{isTheaterMode ? 'Normal' : 'Theater'}</span>
            </button>

            <button onClick={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors">
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 text-blue-600"/> : <Maximize2 className="h-3.5 w-3.5 text-blue-600"/>}
            </button>

            {isBroadcasting && (<button onClick={handleStopShare} className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-xs">
                <StopCircle className="h-3 w-3"/>
                <span>Stop</span>
              </button>)}
          </div>
      </div>

      {/* Main Content Workspace */}
      <div className="flex-1 min-h-0 mt-2.5 flex flex-col justify-between">
        {/* CASE 1: INCOMING STREAM (We are receiver) */}
        {remoteStream ? (<div className="flex-1 min-h-0 flex flex-col justify-between">
            <div onClick={() => {
                const video = videoRef.current;
                if (video && video.paused) {
                    video.muted = isMuted;
                    video.play().then(() => setIsRemotePlaying(true)).catch(() => {
                        video.muted = true;
                        video.play().catch(() => { });
                    });
                }
            }} className="relative flex-1 min-h-0 w-full overflow-hidden rounded-xl border border-slate-900 bg-slate-950 shadow-md group cursor-pointer">
              <video ref={videoRef} autoPlay playsInline muted={isMuted} className="absolute inset-0 h-full w-full object-contain mx-auto bg-slate-950"/>

              {/* Click-to-Play Overlay if browser blocked autoplay */}
              {!isRemotePlaying && (<div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs transition-opacity">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/40 group-hover:scale-110 group-hover:bg-blue-500 transition-all duration-200">
                    <Play className="h-8 w-8 fill-white translate-x-0.5"/>
                  </div>
                  <p className="mt-3.5 text-sm font-semibold text-white tracking-wide">
                    Click to Watch Screen Stream
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Direct WebRTC 60 FPS Feed · Click anywhere to start
                  </p>
                </div>)}

              <div className="absolute top-2.5 left-2.5 flex items-center gap-2 rounded-lg bg-slate-900/80 backdrop-blur-md border border-white/10 px-2.5 py-1 z-10">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                <span className="text-xs font-medium text-white">
                  Live from {activePresenter?.peerName || connectedPeer?.name || 'Peer'}
                </span>
              </div>

              {/* Live Recording HUD Badge */}
              {isRecording && (<div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-2 rounded-lg bg-rose-950/85 backdrop-blur-md border border-rose-500/40 px-2.5 py-1 text-white shadow-lg animate-in fade-in">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"/>
                  <span className="text-[11px] font-mono font-bold tracking-wider text-rose-100">
                    REC {formatTime(recordingSeconds)}
                  </span>
                  <span className="text-[10px] rounded bg-rose-800/80 px-1 font-semibold text-rose-200">
                    {selectedResolution}
                  </span>
                </div>)}
            </div>

            <div className="flex-none mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <Zap className="h-3 w-3 text-blue-600"/> Direct P2P Stream
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-600"/> WebRTC Encrypted
                </span>
              </div>
              <span className="text-slate-400">60 FPS Hardware Rendered</span>
            </div>
          </div>) : isBroadcasting ? (
        /* CASE 2: WE ARE BROADCASTING */
        <div className="flex-1 min-h-0 flex flex-col justify-between">
            <div className="relative flex-1 min-h-0 w-full overflow-hidden rounded-xl border border-blue-500/30 bg-slate-950 shadow-md">
              <video ref={localVideoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-contain mx-auto bg-slate-950"/>
              <div className="absolute top-2.5 left-2.5 flex items-center gap-2 rounded-lg bg-slate-900/80 backdrop-blur-md border border-white/10 px-2.5 py-1 z-10">
                <Radio className="h-3 w-3 text-rose-400 animate-pulse"/>
                <span className="text-xs font-medium text-white">
                  Broadcasting to {connectedPeer?.name || 'Connected Peer'}
                </span>
              </div>

              {/* Live Recording HUD Badge */}
              {isRecording && (<div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-2 rounded-lg bg-rose-950/85 backdrop-blur-md border border-rose-500/40 px-2.5 py-1 text-white shadow-lg animate-in fade-in">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"/>
                  <span className="text-[11px] font-mono font-bold tracking-wider text-rose-100">
                    REC {formatTime(recordingSeconds)}
                  </span>
                  <span className="text-[10px] rounded bg-rose-800/80 px-1 font-semibold text-rose-200">
                    {selectedResolution}
                  </span>
                </div>)}
            </div>

            <div className="flex-none mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3 text-slate-600 font-mono">
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <Zap className="h-3 w-3 text-blue-600"/> Direct P2P Stream
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-600"/> WebRTC Encrypted
                </span>
              </div>
              <button onClick={handleStopShare} className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1 font-semibold text-white hover:bg-rose-700 transition-colors shadow-xs cursor-pointer text-xs">
                <StopCircle className="h-3.5 w-3.5"/> Stop Broadcast
              </button>
            </div>
          </div>) : (
        /* CASE 3: IDLE STATE (Ready to Start - Compact & Zero Overflow) */
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-5 px-4 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-600 mb-2 shadow-xs">
              <Monitor className="h-6 w-6"/>
            </div>

            <h4 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
              {activePresenter && !isBroadcasting
                ? `Connecting to ${activePresenter.peerName}'s Broadcast...`
                : 'Direct Display & Window Casting'}
            </h4>

            <p className="mt-0.5 text-xs text-slate-500 max-w-sm leading-relaxed">
              {activePresenter && !isBroadcasting
                ? 'Handshaking direct WebRTC stream. High-definition display will begin automatically.'
                : 'Stream your display, window, or tab to any paired device at 60 FPS without cloud relay.'}
            </p>

            {/* Target peers count indicator */}
            {peers.length > 0 ? (<div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-1.5 text-xs text-blue-900 shadow-2xs">
                <Radio className="h-3.5 w-3.5 text-blue-600 shrink-0 animate-pulse"/>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Room Audience:</span>
                  <strong className="font-semibold text-slate-900">
                    {peers.length} {peers.length === 1 ? 'Peer Connected' : 'Peers Online'}
                  </strong>
                </div>
                <span className="text-slate-300">·</span>
                <span className="text-emerald-700 font-mono font-medium">Ready</span>
              </div>) : (<div className="mt-3 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800">
                <span>Waiting for another device to join this room...</span>
              </div>)}

            {/* Audio Toggle */}
            {isDisplayMediaSupported && (<div className="mt-2.5 flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 hover:text-slate-900 select-none">
                  <input type="checkbox" checked={captureAudio} onChange={(e) => setCaptureAudio(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"/>
                  <span>Include System Audio</span>
                </label>
              </div>)}

            {/* Error message */}
            {errorMessage && (<div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700">
                {errorMessage}
              </div>)}

            {/* Primary Action Button or Receiver Mode */}
            {!isDisplayMediaSupported ? (<div className="mt-3.5 flex flex-col items-center max-w-sm rounded-xl border border-slate-200 bg-white p-3.5 text-center shadow-xs">
                <div className="flex items-center gap-1.5 text-blue-600 font-semibold text-xs mb-1">
                  <Radio className="h-3.5 w-3.5 animate-pulse text-blue-600"/>
                  <span>Receiver Mode Active</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">
                  {isMobile
                    ? 'Mobile browsers do not support display capturing. When a desktop peer casts, you will watch their live stream here.'
                    : 'Screen broadcasting requires HTTPS or localhost. You can receive incoming streams here.'}
                </p>
                <button onClick={syncScreenBroadcast} className="mt-3 flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95">
                  <Radio className="h-3 w-3 text-blue-200 animate-pulse"/>
                  <span>Sync Live Stream</span>
                </button>
              </div>) : (<div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                {connectedPeer ? (<button onClick={handleStartShare} disabled={isStarting} className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2 text-xs font-medium text-white transition-colors shadow-sm cursor-pointer disabled:opacity-50">
                    <Play className="h-3.5 w-3.5 fill-current"/>
                    <span>{isStarting ? 'Starting...' : 'Start Screen Share'}</span>
                  </button>) : (<button onClick={() => setActiveTab('transfer')} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs">
                    <Tv className="h-3.5 w-3.5 text-blue-600"/>
                    <span>Select a Device to Cast</span>
                  </button>)}
              </div>)}

            {/* Privacy and Tech Badges */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-blue-600"/> Direct P2P
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-600"/> Hardware Accelerated
              </span>
              <span className="flex items-center gap-1">
                <Radio className="h-3 w-3 text-slate-400"/> Up to 60 FPS
              </span>
            </div>
          </div>)}
      </div>
    </div>);
}
