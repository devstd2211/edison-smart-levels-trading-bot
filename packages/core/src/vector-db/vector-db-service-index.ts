import type { EmbeddedDocument, ProjectIndex } from './vector-db.types';

type VectorDbLogger = Pick<Console, 'log' | 'warn'>;

type VectorDbDocumentStore = {
  clear(): Promise<void>;
  storeDocuments(documents: EmbeddedDocument[]): Promise<void>;
};

type VectorDbProjectIndexer = {
  indexProject(): Promise<ProjectIndex>;
};

type VectorDbIndexStorage = {
  hasStoredProjectIndex(indexPath: string): boolean;
  loadStoredProjectIndex(indexPath: string): ProjectIndex;
  saveStoredProjectIndex(indexPath: string, index: ProjectIndex): void;
};

type InitializeVectorDbIndexOptions = {
  createAndSaveIndex: () => Promise<ProjectIndex>;
  indexPath: string;
  loadIndex: () => Promise<ProjectIndex | null>;
  logger: VectorDbLogger;
  storage: VectorDbIndexStorage;
  icons: {
    open_folder: string;
    search: string;
  };
};

type CreateAndSaveVectorDbIndexOptions = {
  indexPath: string;
  indexer: VectorDbProjectIndexer;
  storage: VectorDbIndexStorage;
  store: VectorDbDocumentStore;
};

type LoadVectorDbIndexOptions = {
  indexPath: string;
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
  indexPath,
  loadIndex,
  logger,
  storage,
  icons,
}: InitializeVectorDbIndexOptions): Promise<ProjectIndex | null> => {
  if (storage.hasStoredProjectIndex(indexPath)) {
    logger.log(`${icons.open_folder} Loading existing index...`);
    return loadIndex();
  }

  logger.log(`${icons.search} Creating new index...`);
  return createAndSaveIndex();
};

export const createAndSaveVectorDbIndex = async ({
  indexPath,
  indexer,
  storage,
  store,
}: CreateAndSaveVectorDbIndexOptions): Promise<ProjectIndex> => {
  const index = await indexer.indexProject();
  await store.storeDocuments(index.documents);
  storage.saveStoredProjectIndex(indexPath, index);
  return index;
};

export const loadVectorDbIndex = async ({
  indexPath,
  logger,
  storage,
  store,
  icons,
}: LoadVectorDbIndexOptions): Promise<ProjectIndex | null> => {
  try {
    const index = storage.loadStoredProjectIndex(indexPath);
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
  indexPath: string,
  storage: Pick<VectorDbIndexStorage, 'loadStoredProjectIndex'>,
): string => JSON.stringify(storage.loadStoredProjectIndex(indexPath), null, 2);
