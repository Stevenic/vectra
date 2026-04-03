"""
Vectra gRPC Client — Single-index mode

Demonstrates ingesting documents and querying via gRPC.
The server computes embeddings — you just send text.

See the full tutorial: https://stevenic.github.io/vectra/tutorials/cross-language
"""
from vectra_client import VectraClient

client = VectraClient('localhost:50051')

# --- Ingest documents ---
client.upsert_document(
    index_name='my-index',
    uri='doc://python-guide',
    text='''
    Python is a high-level, general-purpose programming language.
    Its design philosophy emphasizes code readability with the use
    of significant indentation.
    ''',
    doc_type='txt'
)

client.upsert_document(
    index_name='my-index',
    uri='doc://rust-guide',
    text='''
    Rust is a systems programming language focused on safety,
    speed, and concurrency. It achieves memory safety without
    garbage collection.
    ''',
    doc_type='txt'
)

print('Documents ingested.')

# --- Query ---
results = client.query_documents(
    index_name='my-index',
    query='Which language focuses on memory safety?',
    max_documents=3
)

for result in results:
    print(f'URI: {result.uri}  Score: {result.score:.4f}')
    for section in result.sections:
        print(f'  {section.text[:100]}...')
