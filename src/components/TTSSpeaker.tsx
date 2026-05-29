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
import { type EditorRef } from './ProseMirrorEditor';

interface TTSSpeakerProps {
  editorRef: React.RefObject<EditorRef>;
}

const TTSSpeaker: React.FC<TTSSpeakerProps> = ({ editorRef }) => {
  const { showTTS, setTTS, ttsRate, setTTSRate, setTTSHighlightRange } = useUIStore();
  const { activeFocusedPageId, pages } = useEditorStore();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const synth = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const segmentsRef = useRef<{ text: string, pos: number, cumulativeIndex: number }[]>([]);

  const stopSpeech = useCallback(() => {
    if (synth.current) {
      synth.current.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      setTTSHighlightRange(null);
    }
  }, [setTTSHighlightRange]);

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
        const activePage = pages.find(p => p.id === activeFocusedPageId);
        if (activePage) {
           rawSegments.push({ text: activePage.content, pos: 1 });
        }
      }

      let cumulative = 0;
      segmentsRef.current = rawSegments.map(s => {
        const seg = { ...s, cumulativeIndex: cumulative };
        cumulative += s.text.length + 1; // +1 for the space we join with
        return seg;
      });

      const fullText = rawSegments.map(s => s.text).join(' ');
      
      utterance.current = new SpeechSynthesisUtterance(fullText);
      utterance.current.rate = ttsRate;
      utterance.current.volume = isMuted ? 0 : 1;
      
      utterance.current.onboundary = (event) => {
        if (event.name === 'word') {
          const charIndex = event.charIndex;
          
          // Find which segment contains this charIndex
          const segmentIndex = segmentsRef.current.findIndex((s, i) => {
            const next = segmentsRef.current[i+1];
            return charIndex >= s.cumulativeIndex && (!next || charIndex < next.cumulativeIndex);
          });

          if (segmentIndex !== -1) {
            const segment = segmentsRef.current[segmentIndex];
            const offsetInSegment = charIndex - segment.cumulativeIndex;
            
            // Find end of the word in the segment text
            const textAfter = segment.text.substring(offsetInSegment);
            const wordMatch = textAfter.match(/^\w+/);
            const wordLength = wordMatch ? wordMatch[0].length : 1;

            const from = segment.pos + offsetInSegment;
            const to = from + wordLength;

            setTTSHighlightRange({ from, to });
          }
        }
      };

      utterance.current.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setTTSHighlightRange(null);
      };
      
      utterance.current.onerror = (e) => {
        console.error("Speech error:", e);
        setIsPlaying(false);
        setIsPaused(false);
        setTTSHighlightRange(null);
      };

      synth.current.speak(utterance.current);
      setIsPlaying(true);
      setIsPaused(false);
    }
  }, [isPlaying, isPaused, editorRef, pages, activeFocusedPageId, stopSpeech, ttsRate, isMuted, setTTSHighlightRange]);

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
