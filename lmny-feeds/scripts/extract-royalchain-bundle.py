#!/usr/bin/env python3
"""Safely extract the two-file encrypted Royal Chain input payload.

The archive is decrypted by the workflow before this script runs. This script
never prints archive names or file contents and refuses links, directories,
extra members, path traversal, and oversized members.
"""

from __future__ import annotations

import argparse
import pathlib
import shutil
import tarfile

EXPECTED = {"royalchain-products.jsonl", "availability.csv"}
MAX_MEMBER_BYTES = 50 * 1024 * 1024


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    archive = pathlib.Path(args.archive)
    output = pathlib.Path(args.output)
    if not archive.is_file():
        raise SystemExit("encrypted payload did not decrypt to a regular archive")
    if output.exists():
        if not output.is_dir() or any(output.iterdir()):
            raise SystemExit("staging directory must be empty")
    else:
        output.mkdir(parents=True, mode=0o700)

    try:
        with tarfile.open(archive, mode="r:gz") as bundle:
            members = bundle.getmembers()
            if len(members) != len(EXPECTED) or {member.name for member in members} != EXPECTED:
                raise SystemExit("encrypted payload must contain exactly the two approved input files")
            for member in members:
                if not member.isfile() or member.name not in EXPECTED or member.name != pathlib.PurePosixPath(member.name).name:
                    raise SystemExit("encrypted payload contains an unsafe member")
                if member.size < 0 or member.size > MAX_MEMBER_BYTES:
                    raise SystemExit("encrypted payload member is too large")
                source = bundle.extractfile(member)
                if source is None:
                    raise SystemExit("encrypted payload member could not be read")
                data = source.read(MAX_MEMBER_BYTES + 1)
                if len(data) != member.size or len(data) > MAX_MEMBER_BYTES:
                    raise SystemExit("encrypted payload member size is invalid")
                destination = output / member.name
                destination.write_bytes(data)
                destination.chmod(0o600)
    except (tarfile.TarError, OSError) as error:
        shutil.rmtree(output, ignore_errors=True)
        raise SystemExit("encrypted payload is not a valid approved archive") from error


if __name__ == "__main__":
    main()
