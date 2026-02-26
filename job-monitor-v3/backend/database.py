import sqlite3
import threading
from contextlib import contextmanager
from typing import Generator
from config import DB_PATH

# GLOBAL LOCK: Only one thread can hold this for WRITING at a time.
# Readers do not need this lock in WAL mode.
DB_WRITE_LOCK = threading.Lock()

def get_db_connection(timeout: float = 30.0):
    """Factory for raw connections."""
    conn = sqlite3.connect(DB_PATH, timeout=timeout)
    conn.execute("PRAGMA journal_mode=WAL;")  # Ensure WAL is on
    conn.row_factory = sqlite3.Row
    return conn

@contextmanager
def get_read_connection() -> Generator[sqlite3.Connection, None, None]:
    """Get a connection for reading. Fully concurrent in WAL mode."""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()

@contextmanager
def get_write_connection(timeout: float = 30.0) -> Generator[sqlite3.Connection, None, None]:
    """
    Get a connection for writing. PROTECTED by global lock.
    This serializes all writes at the Python level, preventing SQLite file locks.
    """
    with DB_WRITE_LOCK:
        conn = get_db_connection(timeout=timeout)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

def execute_write(query: str, params: tuple = ()) -> bool:
    """Helper for simple single-query writes."""
    try:
        with get_write_connection() as conn:
            conn.execute(query, params)
        return True
    except Exception as e:
        print(f"DB Write Error: {e}")
        return False
