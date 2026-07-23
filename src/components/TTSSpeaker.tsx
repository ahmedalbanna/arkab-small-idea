import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, Square, Volume2, VolumeX, X } from "lucide-react";
import { useUIStore } from "../stores/uiStore";
import { useEditorStore } from "../stores/editorStore";
import { type EditorRef } from "./ProseMirrorEditor";
import { buildTTSSegments, mapCharIndexToDocPosition, type TTSSegment } from "./ttsMapping";

interface TTSSpeakerProps {
  editorRef: React.RefObject<EditorRef>;
}

const TTSSpeaker: React.FC<TTSSpeakerProps> = ({ editorRef }) => {
  const {
    showTTS,
    setTTS,
    ttsRate,
    setTTSRate,
    ttsPitch,
    setTTSPitch,
    ttsVoiceURI,
    setTTSVoiceURI,
  } = useUIStore();
  const { activeFocusedPageId, pages } = useEditorStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const synth = useRef<SpeechSynthesis | null>(
    typeof window !== "undefined" ? window.speechSynthesis : null,
  );
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const segmentsRef = useRef<TTSSegment[]>([]);
  const fullTextRef = useRef("");
  const lastCharIndexRef = useRef(0);
  // Set right before a deliberate cancel+restart (e.g. mute toggle) so the
  // outgoing utterance's onend/onerror don't reset playback state.
  const isRestartingRef = useRef(false);

  useEffect(() => {
    if (!synth.current) return;

    const loadVoices = () => setVoices(synth.current!.getVoices());
    loadVoices();
    synth.current.addEventListener("voiceschanged", loadVoices);
    return () => synth.current?.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const stopSpeech = useCallback(() => {
    if (synth.current) {
      synth.current.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      editorRef.current?.setTTSHighlight(null);
    }
  }, [editorRef]);

  const speakFrom = useCallback(
    (baseCharIndex: number, muted: boolean) => {
      if (!synth.current) return;

      const textToSpeak = fullTextRef.current.slice(baseCharIndex);
      if (!textToSpeak) {
        setIsPlaying(false);
        setIsPaused(false);
        editorRef.current?.setTTSHighlight(null);
        return;
      }

      const selectedVoice = ttsVoiceURI
        ? (voices.find((v) => v.voiceURI === ttsVoiceURI) ?? null)
        : null;

      const u = new SpeechSynthesisUtterance(textToSpeak);
      u.rate = ttsRate;
      u.pitch = ttsPitch;
      u.volume = muted ? 0 : 1;
      if (selectedVoice) u.voice = selectedVoice;

      u.onboundary = (event) => {
        if (event.name === "word") {
          const absoluteCharIndex = baseCharIndex + event.charIndex;
          lastCharIndexRef.current = absoluteCharIndex;

          const range = mapCharIndexToDocPosition(segmentsRef.current, absoluteCharIndex);
          if (range) editorRef.current?.setTTSHighlight(range);
        }
      };

      u.onend = () => {
        if (isRestartingRef.current) {
          isRestartingRef.current = false;
          return;
        }
        setIsPlaying(false);
        setIsPaused(false);
        editorRef.current?.setTTSHighlight(null);
      };

      u.onerror = (e) => {
        if (isRestartingRef.current) {
          isRestartingRef.current = false;
          return;
        }
        console.error("Speech error:", e);
        setIsPlaying(false);
        setIsPaused(false);
        editorRef.current?.setTTSHighlight(null);
      };

      utterance.current = u;
      synth.current.speak(u);
      setIsPlaying(true);
      setIsPaused(false);
    },
    [editorRef, ttsRate, ttsPitch, ttsVoiceURI, voices],
  );

  const togglePlay = useCallback(() => {
    if (!synth.current) return;

    if (isPlaying && !isPaused) {
      synth.current.pause();
      setIsPaused(true);
    } else if (isPaused) {
      synth.current.resume();
      setIsPaused(false);
    } else {
      stopSpeech();

      // Get fresh segments from the editor
      const rawSegments = editorRef.current?.getTextWithPositions() || [];
      if (rawSegments.length === 0) {
        // Fallback to activePage content if editor ref is not available or empty
        const activePage = pages.find((p) => p.id === activeFocusedPageId);
        if (activePage) {
          rawSegments.push({ text: activePage.content, pos: 1 });
        }
      }

      const { segments, fullText } = buildTTSSegments(rawSegments);
      segmentsRef.current = segments;
      fullTextRef.current = fullText;
      lastCharIndexRef.current = 0;

      speakFrom(0, isMuted);
    }
  }, [isPlaying, isPaused, editorRef, pages, activeFocusedPageId, stopSpeech, isMuted, speakFrom]);

  const handleMuteToggle = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    // SpeechSynthesisUtterance.volume can't be changed after speak() has
    // started in most browsers, so restart from the current word to apply
    // the new mute state immediately.
    if (isPlaying && !isPaused && synth.current) {
      isRestartingRef.current = true;
      synth.current.cancel();
      speakFrom(lastCharIndexRef.current, nextMuted);
    }
  }, [isMuted, isPlaying, isPaused, speakFrom]);

  useEffect(() => {
    return () => {
      if (synth.current) synth.current.cancel();
    };
  }, []);

  if (!showTTS) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
      >
        <div className="bg-minimal-sidebar/90 backdrop-blur-xl border border-minimal-border px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-6 min-w-[320px]">
          {/* Close Button */}
          <button
            onClick={() => {
              stopSpeech();
              setTTS(false);
            }}
            className="absolute -top-2 -end-2 p-1 bg-minimal-sidebar border border-minimal-border rounded-full text-minimal-muted hover:text-minimal-accent transition-colors"
            aria-label="Close text to speech"
          >
            <X size={14} />
          </button>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                isPlaying && !isPaused
                  ? "bg-minimal-accent text-white shadow-lg shadow-minimal-accent/20"
                  : "bg-minimal-bg text-minimal-text hover:bg-minimal-accent/10 border border-minimal-border"
              }`}
            >
              {isPlaying && !isPaused ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} className="translate-x-0.5" fill="currentColor" />
              )}
            </button>
            <button
              onClick={stopSpeech}
              disabled={!isPlaying}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-minimal-bg text-minimal-muted hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-minimal-border"
            >
              <Square size={16} fill="currentColor" />
            </button>
          </div>

          {/* Speed Slider */}
          <div className="flex-1 flex flex-col gap-2 min-w-[100px]">
            <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-minimal-muted font-bold">
              <span>Speed</span>
              <span>{ttsRate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={ttsRate}
              onChange={(e) => setTTSRate(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-minimal-border rounded-lg appearance-none cursor-pointer accent-minimal-accent"
            />
          </div>

          {/* Pitch Slider */}
          <div className="flex-1 flex flex-col gap-2 min-w-[100px]">
            <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-minimal-muted font-bold">
              <span>Pitch</span>
              <span>{ttsPitch.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={ttsPitch}
              onChange={(e) => setTTSPitch(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-minimal-border rounded-lg appearance-none cursor-pointer accent-minimal-accent"
            />
          </div>

          {/* Voice Selector */}
          {voices.length > 0 && (
            <select
              value={ttsVoiceURI ?? ""}
              onChange={(e) => setTTSVoiceURI(e.target.value || null)}
              aria-label="Voice"
              className="bg-minimal-bg border border-minimal-border rounded-lg text-xs text-minimal-text px-2 py-1.5 max-w-[140px]"
            >
              <option value="">Default</option>
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          )}

          {/* Mute Toggle */}
          <button
            onClick={handleMuteToggle}
            className={`p-2 rounded-lg transition-colors ${isMuted ? "text-red-500 bg-red-50" : "text-minimal-muted hover:text-minimal-accent"}`}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TTSSpeaker;
