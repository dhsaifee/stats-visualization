
import numpy as np
import json

# Reproduce the notebook's initial dataset exactly.
rng = np.random.default_rng(42)
values = rng.normal(loc=6, scale=27, size=450)

# Match the notebook's two-decimal-place input values.
values_text = ", ".join(f"{x:.2f}" for x in values)

# Create a JavaScript file containing the observations.
with open("sample-data.js", "w", encoding="utf-8") as f:
    f.write("const INITIAL_DATA = " + json.dumps(values_text) + ";\n")
