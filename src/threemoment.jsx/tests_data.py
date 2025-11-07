# tests_data.py
from models import SpanModel, LoadModel, SupportModel

# Test 1: Two-span continuous beam (from your tests)
test1 = {
    "spans": [
        {
            "length": 6.0,
            "E": 200e9,
            "I": 8.33e-6,
            "loads": [{"load_type": "POINT", "magnitude": 50.0, "position": 3.0}],
        },
        {
            "length": 8.0,
            "E": 200e9,
            "I": 8.33e-6,
            "loads": [{"load_type": "POINT", "magnitude": 30.0, "position": 4.0}],
        },
    ],
    "supports": [
        {"support_type": "PINNED", "position": 0.0},
        {"support_type": "PINNED", "position": 6.0},
        {"support_type": "PINNED", "position": 14.0},
    ],
}

# Test 2: UDL three-span
test2 = {
    "spans": [
        {
            "length": 4.0,
            "E": 200e9,
            "I": 1e-5,
            "loads": [
                {"load_type": "UDL", "magnitude": 20.0, "position": 0.0, "length": 4.0}
            ],
        },
        {
            "length": 6.0,
            "E": 200e9,
            "I": 1e-5,
            "loads": [
                {"load_type": "UDL", "magnitude": 20.0, "position": 0.0, "length": 6.0}
            ],
        },
        {
            "length": 4.0,
            "E": 200e9,
            "I": 1e-5,
            "loads": [
                {"load_type": "UDL", "magnitude": 20.0, "position": 0.0, "length": 4.0}
            ],
        },
    ],
    "supports": [
        {"support_type": "PINNED", "position": 0.0},
        {"support_type": "PINNED", "position": 4.0},
        {"support_type": "PINNED", "position": 10.0},
        {"support_type": "PINNED", "position": 14.0},
    ],
}
