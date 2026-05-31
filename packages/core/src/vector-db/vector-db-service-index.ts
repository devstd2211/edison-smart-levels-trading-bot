import type { EmbeddedDocument, ProjectIndex } from './vector-db.types';
import type { VectorDbIndexStorage } from './vector-db-index-storage';

type VectorDbLogger = Pick<Console, 'log' | 'warn'>;

type VectorDbDocumentStore = {
  clear(): Promise<void>;
  storeDocuments(documents: EmbeddedDocument[]): Promise<void>;
};

type VectorDbProjectIndexer = {
  indexProject(): Promise<ProjectIndex>;
};

type InitializeVectorDbIndexOptions = {
  createAndSaveIndex: () => Promise<ProjectIndex>;
  loadIndex: () => Promise<ProjectIndex | null>;
  logger: VectorDbLogger;
  storage: VectorDbIndexStorage;
  icons: {
    open_folder: string;
    search: string;
  };
};

type CreateAndSaveVectorDbIndexOptions = {
  indexer: VectorDbProjectIndexer;
  storage: VectorDbIndexStorage;
  store: VectorDbDocumentStore;
};

type LoadVectorDbIndexOptions = {
  logger: VectorDbLogger;
  storage: VectorDbIndexStorage;
  store: VectorDbDocumentStore;
  icons: {
    warning: string;
  };
};

type ReindexVectorDbProjectOptions = {
  createAndSaveIndex: () => Promise<ProjectIndex>;
  store: VectorDbDocumentStore;
};

export const initializeVectorDbIndex = async ({
  createAndSaveIndex,
  loadIndex,
  logger,
  storage,
  icons,
}: InitializeVectorDbIndexOptions): Promise<ProjectIndex | null> => {
  if (storage.hasStoredProjectIndex()) {
    logger.log(`${icons.open_folder} Loading existing index...`);
    return loadIndex();
  }

  logger.log(`${icons.search} Creating new index...`);
  return createAndSaveIndex();
};

export const createAndSaveVectorDbIndex = async ({
  indexer,
  storage,
  store,
}: CreateAndSaveVectorDbIndexOptions): Promise<ProjectIndex> => {
  const index = await indexer.indexProject();
  await store.storeDocuments(index.documents);
  storage.saveStoredProjectIndex(index);
  return index;
};

export const loadVectorDbIndex = async ({
  logger,
  storage,
  store,
  icons,
}: LoadVectorDbIndexOptions): Promise<ProjectIndex | null> => {
  try {
    const index = storage.loadStoredProjectIndex();
    await store.storeDocuments(index.documents);
    return index;
  } catch (error) {
    logger.warn(`${icons.warning} Failed to load index:`, (error as Error).message);
    return null;
  }
};

export const reindexVectorDbProject = async ({
  createAndSaveIndex,
  store,
}: ReindexVectorDbProjectOptions): Promise<ProjectIndex> => {
  await store.clear();
  return createAndSaveIndex();
};

export const exportVectorDbIndex = (
  storage: Pick<VectorDbIndexStorage, 'exportStoredProjectIndex'>,
): string => storage.exportStoredProjectIndex();
