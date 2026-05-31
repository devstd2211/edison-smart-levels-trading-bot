import * as barrel from '../../vector-db/index';
import * as serviceModule from '../../vector-db/vector-db.service';
import { AdvancedSearchService } from '../../vector-db/advanced-search.service';
import { ProjectIndexer } from '../../vector-db/project-indexer';
import { SemanticSearchService } from '../../vector-db/semantic-search.service';
import { SQLiteVectorStore } from '../../vector-db/sqlite-vector-store';
import {
  DEFAULT_VECTOR_DB_PATH,
  DEFAULT_VECTOR_INDEX_PATH,
  resolveVectorDbRuntimePaths,
} from '../../vector-db/vector-db-runtime-paths';
import { VectorDatabaseService, getVectorDB } from '../../vector-db/vector-db.service';

describe('vector-db package exports', () => {
  test('re-exports leaf modules without routing through the runtime service barrel', () => {
    expect(barrel.VectorDatabaseService).toBe(VectorDatabaseService);
    expect(barrel.getVectorDB).toBe(getVectorDB);
    expect(barrel.SQLiteVectorStore).toBe(SQLiteVectorStore);
    expect(barrel.SemanticSearchService).toBe(SemanticSearchService);
    expect(barrel.AdvancedSearchService).toBe(AdvancedSearchService);
    expect(barrel.ProjectIndexer).toBe(ProjectIndexer);
  });

  test('keeps runtime path exports on the package barrel and leaf exports off the service module', () => {
    expect(barrel.DEFAULT_VECTOR_DB_PATH).toBe(DEFAULT_VECTOR_DB_PATH);
    expect(barrel.DEFAULT_VECTOR_INDEX_PATH).toBe(DEFAULT_VECTOR_INDEX_PATH);
    expect(barrel.resolveVectorDbRuntimePaths).toBe(resolveVectorDbRuntimePaths);

    const runtimeServiceExports = serviceModule as Record<string, unknown>;

    expect(runtimeServiceExports.SQLiteVectorStore).toBeUndefined();
    expect(runtimeServiceExports.SemanticSearchService).toBeUndefined();
    expect(runtimeServiceExports.ProjectIndexer).toBeUndefined();
  });
});
