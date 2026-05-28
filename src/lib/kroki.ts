import pako from 'pako';

export const encodeDiagram = (source: string): string => {
  const data = new TextEncoder().encode(source);
  const compressed = pako.deflate(data, { level: 9 });
  const result = btoa(String.fromCharCode.apply(null, Array.from(compressed)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return result;
};

export const getKrokiUrl = (type: string, source: string, theme?: 'dark' | 'light'): string | null => {
  if (!source.trim()) return null;
  try {
    const encoded = encodeDiagram(source);
    // Supported types: mermaid, plantuml, graphviz, ditaa, erd, blockdiag, c4plantuml, etc.
    const normalizedType = type.toLowerCase().trim();
    let url = `https://kroki.io/${normalizedType}/svg/${encoded}`;
    
    // Some Kroki engines support theme via query param
    if (theme === 'dark') {
      if (['mermaid', 'blockdiag', 'nwdiag', 'seqdiag', 'actdiag', 'rackdiag'].includes(normalizedType)) {
        url += '?theme=dark';
      }
    }
    
    return url;
  } catch (e) {
    console.error("Failed to encode diagram for Kroki:", e);
    return null;
  }
};
