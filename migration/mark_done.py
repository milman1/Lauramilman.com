#!/usr/bin/env python3
"""Record handles that have been written. Usage: mark_done.py <handle>..."""
import json, os, sys
done = set(json.load(open('done.json'))) if os.path.exists('done.json') else set()
done.update(sys.argv[1:])
json.dump(sorted(done), open('done.json', 'w'), indent=1)
print(f"done: {len(done)}/108")
