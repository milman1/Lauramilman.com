#!/usr/bin/env python3
"""The gold range fill must stay inside the track when max fields exceed the ceil."""


def paint_fill(floor: float, ceil: float, lo: float, hi: float) -> tuple[float, float]:
    span = ceil - floor or 1
    left = max(0, min(100, ((lo - floor) / span) * 100))
    right = max(0, min(100, ((hi - floor) / span) * 100))
    return min(left, right), 100 - max(left, right)


def test_default_full_range_stays_in_track() -> None:
    left, right = paint_fill(0, 50000, 0, 50000)
    assert left == 0
    assert right == 0


def test_oversized_max_fields_do_not_overflow() -> None:
    left, right = paint_fill(0.3, 10, 0.3, 100)
    assert 0 <= left <= 100
    assert 0 <= right <= 100
    left, right = paint_fill(0, 50000, 0, 500000)
    assert left == 0
    assert right == 0


if __name__ == "__main__":
    tests = [value for name, value in globals().items() if name.startswith("test_")]
    failed = 0
    for test in tests:
        try:
            test()
            print(f"PASS {test.__name__}")
        except Exception as exc:
            failed += 1
            print(f"FAIL {test.__name__}: {exc}")
    raise SystemExit(failed)
