"""
athena.memory.local_vectors — Local Mode v1.0

Fully local vector storage using ChromaDB.
No Supabase or cloud dependencies required.

Features:
    - ChromaDB for local vector storage
    - Optional: sentence-transformers for fully local embeddings
    - Optional: Gemini API for cloud embeddings (default)
"""

import os
import hashlib
import json
import threading
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional

# Global cache instance
_embedding_cache = None
_embedding_cache_lock = threading.Lock()

# ChromaDB client (lazy loaded)
_chroma_client = None
_chroma_collection = None
_chroma_lock = threading.Lock()


def get_chroma_client():
    """Get or create ChromaDB client for local storage."""
    global _chroma_client, _chroma_collection
    
    with _chroma_lock:
        if _chroma_client is None:
            try:
                import chromadb
                from athena.core.config import AGENT_DIR
                
                # Store ChromaDB data in .agent/state/chroma
                chroma_path = AGENT_DIR / "state" / "chroma"
                chroma_path.mkdir(parents=True, exist_ok=True)
                
                _chroma_client = chromadb.PersistentClient(path=str(chroma_path))
                _chroma_collection = _chroma_client.get_or_create_collection(
                    name="athena_memories",
                    metadata={"hnsw:space": "cosine"}
                )
            except ImportError:
                raise ImportError(
                    "ChromaDB not installed. Install with: pip install chromadb"
                )
        return _chroma_client, _chroma_collection


def get_embedding_cache():
    global _embedding_cache
    with _embedding_cache_lock:
        if _embedding_cache is None:
            _embedding_cache = PersistentEmbeddingCache()
        return _embedding_cache


class PersistentEmbeddingCache:
    """JSON-backed persistent cache with Thread-Safe Atomic Writes."""

    def __init__(self, filename="embedding_cache.json"):
        from athena.core.config import AGENT_DIR
        self.cache_file = AGENT_DIR / "state" / filename
        self.lock = threading.Lock()
        self._cache: Dict[str, List[float]] = {}
        self._dirty = False
        self._load()

    def _load(self):
        if self.cache_file.exists():
            try:
                with self.lock:
                    self._cache = json.loads(self.cache_file.read_text())
            except Exception:
                self._cache = {}

    def _save_worker(self, content: str):
        try:
            self.cache_file.parent.mkdir(parents=True, exist_ok=True)
            fd, temp_path = tempfile.mkstemp(dir=self.cache_file.parent)
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    f.write(content)
                os.replace(temp_path, self.cache_file)
            except Exception:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
        except Exception:
            pass

    def _save(self):
        try:
            with self.lock:
                if not self._dirty:
                    return
                content = json.dumps(self._cache)
                self._dirty = False
            threading.Thread(
                target=self._save_worker, args=(content,), daemon=True
            ).start()
        except Exception:
            pass

    def get(self, text_hash: str) -> Optional[List[float]]:
        with self.lock:
            return self._cache.get(text_hash)

    def set(self, text_hash: str, embedding: List[float]):
        with self.lock:
            self._cache[text_hash] = embedding
            self._dirty = True
        self._save()


def _hash_text(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


def get_embedding(text: str, use_local: bool = False) -> List[float]:
    """Generate embedding with persistent disk caching.
    
    Args:
        text: Text to embed
        use_local: If True, use sentence-transformers (local). 
                   If False, use Gemini API (cloud, default)
    
    Returns:
        List of floats (embedding vector)
    """
    text_hash = _hash_text(text)
    cache = get_embedding_cache()
    cached = cache.get(text_hash)
    if cached:
        return cached

    if use_local:
        # Local embeddings using sentence-transformers
        embedding = _get_local_embedding(text)
    else:
        # Cloud embeddings using Gemini API
        embedding = _get_gemini_embedding(text)

    cache.set(text_hash, embedding)
    return embedding


def _get_local_embedding(text: str) -> List[float]:
    """Generate embedding using sentence-transformers (fully local)."""
    try:
        from sentence_transformers import SentenceTransformer
        
        # Use a good all-around model
        model = SentenceTransformer('all-MiniLM-L6-v2')
        embedding = model.encode(text, convert_to_numpy=True)
        return embedding.tolist()
    except ImportError:
        raise ImportError(
            "sentence-transformers not installed. "
            "Install with: pip install sentence-transformers"
        )


def _get_gemini_embedding(text: str) -> List[float]:
    """Generate embedding using Gemini API (cloud)."""
    import requests
    from dotenv import load_dotenv

    load_dotenv()

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError(
            "GOOGLE_API_KEY missing. Set it in .env or use use_local=True"
        )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={api_key}"
    payload = {
        "model": "models/gemini-embedding-001",
        "content": {"parts": [{"text": text}]},
    }

    response = requests.post(url, json=payload, timeout=20)
    response.raise_for_status()
    embedding = response.json()["embedding"]["values"]
    return embedding


# =============================================================================
# Local Vector Storage (ChromaDB)
# =============================================================================

def store_memory(
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
    doc_id: Optional[str] = None,
    use_local_embedding: bool = False
) -> str:
    """Store a memory in local ChromaDB.
    
    Args:
        content: The text content to store
        metadata: Optional metadata dict
        doc_id: Optional document ID (auto-generated if not provided)
        use_local_embedding: Use local embeddings instead of Gemini
    
    Returns:
        The document ID
    """
    _, collection = get_chroma_client()
    
    if doc_id is None:
        doc_id = _hash_text(content)
    
    embedding = get_embedding(content, use_local=use_local_embedding)
    
    collection.upsert(
        ids=[doc_id],
        embeddings=[embedding],
        documents=[content],
        metadatas=[metadata or {}]
    )
    
    return doc_id


def search_memories(
    query: str,
    limit: int = 5,
    threshold: float = 0.3,
    use_local_embedding: bool = False,
    where_filter: Optional[Dict] = None
) -> List[Dict[str, Any]]:
    """Search memories in local ChromaDB.
    
    Args:
        query: Search query text
        limit: Maximum number of results
        threshold: Minimum similarity threshold (0-1)
        use_local_embedding: Use local embeddings instead of Gemini
        where_filter: Optional ChromaDB where filter
    
    Returns:
        List of results with content, metadata, and distance
    """
    _, collection = get_chroma_client()
    
    query_embedding = get_embedding(query, use_local=use_local_embedding)
    
    # ChromaDB uses distance, we want similarity
    # For cosine space: similarity = 1 - distance
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=limit,
        where=where_filter,
        include=["documents", "metadatas", "distances"]
    )
    
    # Format results
    formatted = []
    if results and results["ids"] and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            distance = results["distances"][0][i] if results["distances"] else 0
            similarity = 1 - distance
            
            if similarity >= threshold:
                formatted.append({
                    "id": doc_id,
                    "content": results["documents"][0][i] if results["documents"] else "",
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "similarity": similarity,
                    "distance": distance
                })
    
    return formatted


def delete_memory(doc_id: str) -> bool:
    """Delete a memory from local ChromaDB."""
    _, collection = get_chroma_client()
    collection.delete(ids=[doc_id])
    return True


def count_memories() -> int:
    """Count total memories in local storage."""
    _, collection = get_chroma_client()
    return collection.count()


def clear_all_memories() -> bool:
    """Clear all memories from local storage."""
    _, collection = get_chroma_client()
    # Delete all by getting all IDs first
    all_docs = collection.get()
    if all_docs and all_docs["ids"]:
        collection.delete(ids=all_docs["ids"])
    return True


# =============================================================================
# Compatibility Layer (drop-in replacement for vectors.py)
# =============================================================================

def get_client() -> Any:
    """Compatibility: Returns ChromaDB client instead of Supabase."""
    client, _ = get_chroma_client()
    return client


def search_rpc(
    rpc_name: str, 
    query_embedding: List[float], 
    limit: int = 5, 
    threshold: float = 0.3
) -> List[Dict]:
    """Compatibility: Search using ChromaDB instead of Supabase RPC."""
    _, collection = get_chroma_client()
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=limit,
        include=["documents", "metadatas", "distances"]
    )
    
    formatted = []
    if results and results["ids"] and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            distance = results["distances"][0][i] if results["distances"] else 0
            similarity = 1 - distance
            
            if similarity >= threshold:
                formatted.append({
                    "id": doc_id,
                    "content": results["documents"][0][i] if results["documents"] else "",
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "similarity": similarity
                })
    
    return formatted


# Collection-specific wrappers (compatibility with vectors.py)
def search_sessions(client, query_embedding, limit=5, threshold=0.3):
    return search_rpc("search_sessions", query_embedding, limit, threshold)

def search_case_studies(client, query_embedding, limit=5, threshold=0.3):
    return search_rpc("search_case_studies", query_embedding, limit, threshold)

def search_protocols(client, query_embedding, limit=5, threshold=0.3):
    return search_rpc("search_protocols", query_embedding, limit, threshold)

def search_capabilities(client, query_embedding, limit=5, threshold=0.3):
    return search_rpc("search_capabilities", query_embedding, limit, threshold)

def search_playbooks(client, query_embedding, limit=5, threshold=0.3):
    return search_rpc("search_playbooks", query_embedding, limit, threshold)

def search_references(client, query_embedding, limit=5, threshold=0.3):
    return search_rpc("search_references", query_embedding, limit, threshold)

def search_frameworks(client, query_embedding, limit=5, threshold=0.3):
    return search_rpc("search_frameworks", query_embedding, limit, threshold)

def search_workflows(client, query_embedding, limit=5, threshold=0.3):
    return search_rpc("search_workflows", query_embedding, limit, threshold)

def search_entities(client, query_embedding, limit=5, threshold=0.3):
    return search_rpc("search_entities", query_embedding, limit, threshold)

def search_user_profile(client, query_embedding, limit=5, threshold=0.3):
    return search_rpc("search_user_profile", query_embedding, limit, threshold)

def search_system_docs(client, query_embedding, limit=5, threshold=0.3):
    return search_rpc("search_system_docs", query_embedding, limit, threshold)

def search_insights(client, query_embedding, limit=5, threshold=0.3):
    return search_rpc("search_insights", query_embedding, limit, threshold)