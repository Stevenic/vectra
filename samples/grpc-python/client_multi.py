"""
Vectra gRPC Client — Multi-index mode

Demonstrates listing indexes, creating indexes, and targeting
specific indexes in multi-index server mode.

Start the server with: vectra serve --root ./indexes --keys ./keys.json --port 50051
"""
from vectra_client import VectraClient

client = VectraClient('localhost:50051')

# List available indexes
indexes = client.list_indexes()
print('Available indexes:', indexes)

# Create a new index
client.create_index('new-index')

# All operations specify which index to target
client.upsert_document(
    index_name='new-index',
    uri='doc://test',
    text='Test document for the new index.',
    doc_type='txt'
)

# Get index stats
stats = client.get_index_stats('new-index')
print(f'Items: {stats.item_count}')

# Query the new index
results = client.query_documents(
    index_name='new-index',
    query='test document',
    max_documents=3
)

for result in results:
    print(f'URI: {result.uri}  Score: {result.score:.4f}')
