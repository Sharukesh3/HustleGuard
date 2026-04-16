import h3

def get_h3_index(lat: float, lng: float, resolution: int = 9) -> str:
    """
    Converts latitude and longitude into a hyper-local H3 hex index.
    Resolution 9 represents a geographic area roughly the size of a city block (about 0.1 sq km).
    This allows hyper-local risk assessment and caching.
    """
    if lat is None or lng is None:
        return "unknown_hex"
    try:
        return h3.latlng_to_cell(lat, lng, resolution)
    except Exception as e:
        print(f"Error calculating H3 index: {e}")
        return "fallback_hex"
