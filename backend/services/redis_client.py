import redis
import os
import json

class RedisClient:
    """
    Singleton client to connect to either local Dockerized Redis or Azure Cache for Redis.
    Handles caching of expensive computations.
    """
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisClient, cls).__new__(cls)
            # Environment variables for seamless switching between local and Azure
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = int(os.getenv("REDIS_PORT", 6379))
            redis_password = os.getenv("REDIS_PASSWORD", None)
            redis_ssl = os.getenv("REDIS_SSL", "False").lower() in ("true", "1", "yes")
            
            try:
                cls._instance.client = redis.Redis(
                    host=redis_host, 
                    port=redis_port, 
                    password=redis_password,
                    ssl=redis_ssl,
                    socket_connect_timeout=3,
                    socket_timeout=3,
                    db=0,
                    decode_responses=True
                )
                # Test connection
                cls._instance.client.ping()
                print("✅ Redis Caching connected successfully.")
            except Exception as e:
                print(f"⚠️ Redis not available ({e}). Falling back to dict-cache.")
                cls._instance.client = None
                cls._instance.fallback_cache = {}
                
        return cls._instance

    def get(self, key: str):
        if self.client:
            try:
                data = self.client.get(key)
                return json.loads(data) if data else None
            except Exception as e:
                print(f"Redis GET error: {e}")
                return None
        else:
            return self.fallback_cache.get(key)

    def set(self, key: str, value: dict, expire_seconds: int = 3600):
        """
        Stores JSON payload. Default TTL is 1 hour (3600 seconds)
        for H3 localized data.
        """
        if self.client:
            try:
                self.client.setex(key, expire_seconds, json.dumps(value))
            except Exception as e:
                print(f"Redis SET error: {e}")
        else:
            self.fallback_cache[key] = value

redis_cache = RedisClient()
