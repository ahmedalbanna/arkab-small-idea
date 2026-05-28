import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX, 
  Settings2, 
  X,
  FastForward,
  Rewind
} from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { useEditorStore } from '../stores/editorStore';

const TTSSpeaker: React.FC = () => {
  const { showTTS, setTTS, ttsRate, setTTSRate } = useUIStore();
  const { activeFocusedPageId, pages } = useEditorStore();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentText, setCurrentText] = useState('');
  
  const synth = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  const activePage = pages.find(p => p.id === activeFocusedPageId);

  useEffect(() => {
    if (activePage) {
      const cleanText = activePage.content
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
        .replace(/[#*`~>_]/g, '')               // Remove markdown symbols
        .replace(/!\[[^\]]*\]\([^)]+\)/g, '')   // Remove images
        .replace(/```[\s\S]*?```/g, '');        // Remove code blocks
      setCurrentText(cleanText);
    }
  }, [activePage]);

  const stopSpeech = useCallback(() => {
    if (synth.current) {
      synth.current.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, []);

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
      
      utterance.current = new SpeechSynthesisUtterance(currentText);
      utterance.current.rate = ttsRate;
      utterance.current.volume = isMuted ? 0 : 1;
      
      utterance.current.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };
      
      utterance.current.onerror = (e) => {
        console.error("Speech error:", e);
        setIsPlaying(false);
        setIsPaused(false);
      };

      synth.current.speak(utterance.current);
      setIsPlaying(true);
      setIsPaused(false);
    }
  }, [currentText, ttsRate, isMuted, isPlaying, isPaused, stopSpeech]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (synth.current) synth.current.cancel();
    };
  }, []);

  // Update rate if it changes during playback
  useEffect(() => {
    if (isPlaying && synth.current) {
      // SpeechSynthesis API doesn't support changing rate mid-speech effectively on all browsers
      // Usually you have to stop and restart, but we'll leave it for now or just handle it on next start
    }
  }, [ttsRate, isPlaying]);

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
            onClick={() => { stopSpeech(); setTTS(false); }}
            className="absolute -top-2 -right-2 p-1 bg-minimal-sidebar border border-minimal-border rounded-full text-minimal-muted hover:text-minimal-accent transition-colors"
          >
            <X size={14} />
          </button>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                isPlaying && !isPaused 
                  ? 'bg-minimal-accent text-white shadow-lg shadow-minimal-accent/20' 
                  : 'bg-minimal-bg text-minimal-text hover:bg-minimal-accent/10 border border-minimal-border'
              }`}
            >
              {isPlaying && !isPaused ? <Pause size={18} fill="currentColor" /> : <Play size={18} className="translate-x-0.5" fill="currentColor" />}
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
          <div className="flex-1 flex flex-col gap-2 min-w-[120px]">
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

          {/* Mute Toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-lg transition-colors ${isMuted ? 'text-red-500 bg-red-50' : 'text-minimal-muted hover:text-minimal-accent'}`}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TTSSpeaker;
