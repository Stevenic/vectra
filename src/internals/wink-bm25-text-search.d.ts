declare module "wink-bm25-text-search" {
    interface BM25Constructor {
        new(): BM25Instance;
        (): BM25Instance;
    }

    interface BM25Instance {
        addDoc(doc: string | object): void;
        consolidate(): void;
        search(query: string): Array<{ docId: number; score: number }>;
    }

    const bm25: BM25Constructor;
    export default bm25;
}