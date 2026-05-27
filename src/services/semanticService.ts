import { embeddingService } from "./embeddingService";
import { getProvider } from "./aiService";

export interface SemanticCluster {
  id: string;
  name: string;
  summary: string;
  paragraphIndices: number[];
}

export interface SemanticOptions {
  provider: string;
  model: string;
  apiKeys: any;
  providerConfigs: any;
}

export class SemanticService {
  /**
   * Clusters paragraphs of a document using current selected AI provider.
   */
  async clusterDocument(markdown: string, options: SemanticOptions): Promise<SemanticCluster[]> {
    const { provider, model, apiKeys, providerConfigs } = options;
    
    // 1. Chunk by paragraphs
    const paragraphs = markdown.split(/\n\n+/).filter(p => p.trim().length > 20);
    if (paragraphs.length < 2) return [];

    // Check if local model is needed
    if (provider === 'pipeline' && !embeddingService.isReady()) {
      await embeddingService.loadModel();
    }

    // 2. Get embeddings for each paragraph
    const embeddings = await Promise.all(
      paragraphs.map(p => embeddingService.generateEmbedding(p, { 
        provider, 
        apiKey: apiKeys[provider as keyof typeof apiKeys],
        model: provider === 'google' ? 'text-embedding-004' : undefined 
      }))
    );

    // 3. Simple clustering
    const clusters: { name: string; paragraphs: string[]; indices: number[] }[] = [];
    const usedIndices = new Set<number>();

    for (let i = 0; i < embeddings.length; i++) {
      if (usedIndices.has(i)) continue;

      const currentCluster = {
        name: `Cluster ${clusters.length + 1}`,
        paragraphs: [paragraphs[i]],
        indices: [i]
      };
      usedIndices.add(i);

      for (let j = i + 1; j < embeddings.length; j++) {
        if (usedIndices.has(j)) continue;

        const similarity = embeddingService.cosineSimilarity(embeddings[i], embeddings[j]);
        if (similarity > 0.75) {
          currentCluster.paragraphs.push(paragraphs[j]);
          currentCluster.indices.push(j);
          usedIndices.add(j);
        }
      }
      clusters.push(currentCluster);
    }

    // 4. Label clusters using selected AI Provider
    const aiProvider = getProvider(provider, { apiKeys, providerConfigs });
    
    const labeledClusters = await Promise.all(
      clusters.map(async (c, idx) => {
        const sampleText = c.paragraphs.slice(0, 3).join("\n\n");
        
        try {
          const prompt = `Analyze these related paragraphs from a document and provide:
            1. A concise folder name (3-5 words) representing the shared topic.
            2. A one-sentence semantic summary.
            
            Paragraphs:
            ${sampleText}
            
            Return JSON format: { "name": "...", "summary": "..." }`;
          
          const responseText = await aiProvider.generate(prompt, "You are a structural analyzer. Return JSON.", model);
          
          const cleanJson = responseText.replace(/```json|```/g, "").trim();
          const data = JSON.parse(cleanJson);
          
          return {
            id: `cluster-${idx}`,
            name: data.name,
            summary: data.summary,
            paragraphIndices: c.indices
          };
        } catch (e) {
          console.error("Cluster labeling failed:", e);
          return {
            id: `cluster-${idx}`,
            name: `Group: ${c.paragraphs[0].substring(0, 20)}...`,
            summary: "Semantic grouping of related content.",
            paragraphIndices: c.indices
          };
        }
      })
    );

    return labeledClusters;
  }
}

export const semanticService = new SemanticService();
