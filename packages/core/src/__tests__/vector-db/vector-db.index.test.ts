import * as barrel from '../../vector-db/index';
import { AdvancedSearchService } from '../../vector-db/advanced-search.service';
import { ProjectIndexer } from '../../vector-db/project-indexer';
import { SemanticSearchService } from '../../vector-db/semantic-search.service';
import { SQLiteVectorStore } from '../../vector-db/sqlite-vector-store';
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
});
