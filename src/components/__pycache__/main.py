from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from scipy.interpolate import interp1d

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Material properties
f_cu = 30  # N/mm²
f_y = 460  # N/mm²
E_s = 200000  # N/mm²
ε_cu = 0.0035

def compute_N_M(x, ρ):
    """Calculate normalized N/bh and M/bh^2."""
    A_s = ρ / 100
    A_s_prime = A_s
    if x <= 1.1111:
        a = 0.9 * x
        C_c = 0.45 * f_cu * a
        x_bar = a / 2
    else:
        C_c = 0.45 * f_cu * 1
        x_bar = 0.5
    ε_s_prime = ε_cu * (x - 0.175) / x if x > 0 else 0
    ε_s = ε_cu * (0.825 - x) / x if x > 0 else 0
    f_s_prime = E_s * ε_s_prime if abs(E_s * ε_s_prime) <= 0.95 * f_y else 0.95 * f_y * np.sign(ε_s_prime)
    f_s = E_s * ε_s if abs(E_s * ε_s) <= 0.95 * f_y else 0.95 * f_y * np.sign(ε_s)
    N = C_c + f_s_prime * A_s_prime - f_s * A_s
    M = C_c * (0.5 - x_bar) + f_s_prime * A_s_prime * (0.5 - 0.175) + f_s * A_s * (0.825 - 0.5)
    return N, M

# Precompute interaction diagram data
x_values = np.linspace(0.01, 10, 5000)
ρ_values = np.arange(0.5, 8.1, 0.5)
interp_dict = {}

for ρ in ρ_values:
    N_list = []
    M_list = []
    for x in x_values:
        N, M = compute_N_M(x, ρ)
        if N >= 0:
            N_list.append(N)
            M_list.append(M)
    sorted_indices = np.argsort(N_list)
    N_sorted = np.array(N_list)[sorted_indices]
    M_sorted = np.array(M_list)[sorted_indices]
    interp_dict[ρ] = interp1d(N_sorted, M_sorted, kind='linear', fill_value="extrapolate")

def design_column(b, h, N_actual, M_actual):
    """Design the column with safety factors."""
    N_design = N_actual * 1.5 / (b * h)
    M_design = M_actual * 1.25 / (b * h * h)
    ρ_design_values = np.arange(0.5, 8.1, 0.01)
    for ρ in ρ_design_values:
        if ρ not in interp_dict:
            N_list = []
            M_list = []
            for x in x_values:
                N, M = compute_N_M(x, ρ)
                if N >= 0:
                    N_list.append(N)
                    M_list.append(M)
            sorted_indices = np.argsort(N_list)
            N_sorted = np.array(N_list)[sorted_indices]
            M_sorted = np.array(M_list)[sorted_indices]
            interp_dict[ρ] = interp1d(N_sorted, M_sorted, kind='linear', fill_value="extrapolate")
        
        N_sorted = interp_dict[ρ].x
        if N_design > max(N_sorted):
            M_capacity = 0
        else:
            M_capacity = interp_dict[ρ](N_design)
        if M_design <= M_capacity:
            A_sc = (ρ / 100) * b * h
            return ρ, A_sc, N_design, M_design
    return None, None, None, None

def get_interaction_data():
    """Return interaction diagram data for recharts."""
    data = []
    for ρ in ρ_values:
        points = [{"name": f"{ρ}%", "M": M, "N": N} for M, N in zip(interp_dict[ρ].x, interp_dict[ρ].y)]
        data.append({"steelPercentage": ρ, "points": points})
    return data

@app.post("/design-column")
async def design_column_endpoint(data: dict):
    """Endpoint to design the column and return results."""
    try:
        b = data.get("b", 300)
        h = data.get("h", 300)
        N_actual = data.get("N", 1480 * 10**3)
        M_actual = data.get("M", 54 * 10**6)
        required_ρ, A_sc, N_norm, M_norm = design_column(b, h, N_actual, M_actual)
       
        if required_ρ is not None:
            print('Returning Normalized Values', N_norm, M_norm)
            return {
                "status": "success",
                "dimensions": {"b": b, "h": h},
                "loads": {"N": N_actual / 10**3, "M": M_actual / 10**6},
                "effective_depth": {"d": h - 40 - 25/2, "d_prime": 40 + 25/2},
                "steel_percentage": required_ρ,
                "steel_area": A_sc,
                "design_point" : {"N" : N_norm,
                "M" : M_norm}
                
            }
        return {"status": "error", "message": "Design not possible within range"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/get-interaction-data")
async def get_interaction_data_endpoint():
    """Endpoint to get interaction diagram data for recharts."""
    return {"data": get_interaction_data()}

# Run the app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)