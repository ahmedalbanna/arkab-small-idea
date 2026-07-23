export interface TTSSegment {
  text: string;
  pos: number;
  cumulativeIndex: number;
}

export interface TTSRange {
  from: number;
  to: number;
}

/**
 * Maps a SpeechSynthesisUtterance `onboundary` charIndex (an offset into the
 * joined full-text string) back to a ProseMirror document range, using the
 * segment list built when the utterance was created.
 */
export function mapCharIndexToDocPosition(
  segments: TTSSegment[],
  charIndex: number,
): TTSRange | null {
  const segmentIndex = segments.findIndex((s, i) => {
    const next = segments[i + 1];
    return charIndex >= s.cumulativeIndex && (!next || charIndex < next.cumulativeIndex);
  });

  if (segmentIndex === -1) return null;

  const segment = segments[segmentIndex];
  const offsetInSegment = charIndex - segment.cumulativeIndex;

  const textAfter = segment.text.substring(offsetInSegment);
  const wordMatch = textAfter.match(/^\w+/);
  const wordLength = wordMatch ? wordMatch[0].length : 1;

  const from = segment.pos + offsetInSegment;
  const to = from + wordLength;

  return { from, to };
}

/**
 * Builds the cumulative-index segment list and joined full text from raw
 * (text, pos) segments, mirroring how the utterance's plain-text string is
 * assembled (segments joined with a single space).
 */
export function buildTTSSegments(
  rawSegments: { text: string; pos: number }[],
): { segments: TTSSegment[]; fullText: string } {
  let cumulative = 0;
  const segments = rawSegments.map((s) => {
    const seg = { ...s, cumulativeIndex: cumulative };
    cumulative += s.text.length + 1; // +1 for the space we join with
    return seg;
  });

  const fullText = rawSegments.map((s) => s.text).join(" ");

  return { segments, fullText };
}
