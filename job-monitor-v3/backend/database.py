import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
import threading
import os
import re
from contextlib import contextmanager
from typing import Generator, Union, List, Any

# DATABASE_URL should be set in environment for Cloud (Postgres)
# If not set, it defaults to SQLite locally.
DATABASE_URL = os.getenv("DATABASE_URL")
DB_PATH = os.getenv("DB_PATH", "jobs.db")

# GLOBAL LOCK: Only used for SQLite to prevent file locks.
DB_WRITE_LOCK = threading.Lock()

def _translate_params(query: str) -> str:
    """Translate '?' placeholders to '%s' for Postgres."""
    if DATABASE_URL:
        return query.replace('?', '%s')
    return query

def get_db_connection():
    """Factory for connections based on environment."""
    if DATABASE_URL:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        return conn
    else:
        conn = sqlite3.connect(DB_PATH, timeout=30.0)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.row_factory = sqlite3.Row
        return conn

@contextmanager
def get_read_connection() -> Generator[Any, None, None]:
    """Get a connection for reading."""
    conn = get_db_connection()
    try:
        # For Postgres, we might want to return the connection but we'll use a wrapper
        yield conn
    finally:
        conn.close()

@contextmanager
def get_write_connection() -> Generator[Any, None, None]:
    """Get a connection for writing."""
    if DATABASE_URL:
        conn = get_db_connection()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
        with DB_WRITE_LOCK:
            conn = get_db_connection()
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

def db_execute(query: str, params: tuple = (), is_write: bool = False):
    """Universal execution helper that handles ? vs %s and cursors."""
    query = _translate_params(query)
    if is_write:
        with get_write_connection() as conn:
            cur = conn.cursor()
            cur.execute(query, params)
            if not DATABASE_URL: # SQLite
                return cur
            return cur
    else:
        with get_read_connection() as conn:
            cur = conn.cursor()
            cur.execute(query, params)
            # For Postgres, if we close connection, cursor becomes unusable.
            # So we fetch results here.
            return cur.fetchall()

def db_get_one(query: str, params: tuple = ()):
    """Fetch a single row."""
    results = db_execute(query, params, is_write=False)
    return results[0] if results else None
