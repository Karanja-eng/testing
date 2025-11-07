# main.py
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

# --- Material / model constants ---
f_cu = 30.0  # N/mm²
f_y = 460.0  # N/mm²
E_s = 200000.0  # N/mm²
eps_cu = 0.0035

# --- Data table provided by user (Table 3.10 style) ---
data_table_3_10 = {
    6: [
        (1, 28.3),
        (2, 56.6),
        (3, 84.9),
        (4, 113),
        (5, 142),
        (6, 170),
        (7, 198),
        (8, 226),
        (9, 255),
        (10, 283),
    ],
    8: [
        (1, 50.3),
        (2, 101),
        (3, 151),
        (4, 201),
        (5, 252),
        (6, 302),
        (7, 352),
        (8, 402),
        (9, 453),
        (10, 503),
    ],
    10: [
        (1, 78.5),
        (2, 157),
        (3, 236),
        (4, 314),
        (5, 393),
        (6, 471),
        (7, 550),
        (8, 628),
        (9, 707),
        (10, 785),
    ],
    12: [
        (1, 113),
        (2, 226),
        (3, 339),
        (4, 452),
        (5, 565),
        (6, 678),
        (7, 791),
        (8, 904),
        (9, 1017),
        (10, 1130),
    ],
    16: [
        (1, 201),
        (2, 402),
        (3, 603),
        (4, 804),
        (5, 1010),
        (6, 1210),
        (7, 1410),
        (8, 1610),
        (9, 1810),
        (10, 2010),
    ],
    20: [
        (1, 314),
        (2, 628),
        (3, 942),
        (4, 1260),
        (5, 1570),
        (6, 1880),
        (7, 2200),
        (8, 2510),
        (9, 2830),
        (10, 3140),
    ],
    25: [
        (1, 491),
        (2, 982),
        (3, 1470),
        (4, 1960),
        (5, 2450),
        (6, 2940),
        (7, 3430),
        (8, 3920),
        (9, 4410),
        (10, 4910),
    ],
    32: [
        (1, 804),
        (2, 1610),
        (3, 2410),
        (4, 3220),
        (5, 4020),
        (6, 4830),
        (7, 5630),
        (8, 6430),
        (9, 7240),
        (10, 8040),
    ],
    40: [
        (1, 1260),
        (2, 2510),
        (3, 3770),
        (4, 5030),
        (5, 6280),
        (6, 7540),
        (7, 8800),
        (8, 10100),
        (9, 11300),
        (10, 12600),
    ],
}


def get_number_of_bars(diameter, required_area):
    """
    Return the smallest (num_bars, diameter, area) from data_table_3_10 where area >= required_area.
    If diameter not present or required_area exceeds table max, return None.
    """
    if diameter not in data_table_3_10:
        return None
    options = data_table_3_10[diameter]
    for num_bars, area in options:
        if area >= required_area:
            return int(num_bars), int(diameter), float(area)
    return None


# --- interaction model code (kept from previous implementation) ---


def compute_N_M(x, rho):
    As = rho / 100.0
    As_prime = As

    if x <= 1.1111:
        a = 0.9 * x
        Cc = 0.45 * f_cu * a
        x_bar = a / 2.0
    else:
        Cc = 0.45 * f_cu * 1.0
        x_bar = 0.5

    eps_s_prime = eps_cu * (x - 0.175) / x if x > 0 else 0.0
    eps_s = eps_cu * (0.825 - x) / x if x > 0 else 0.0

    fs_prime = (
        E_s * eps_s_prime
        if abs(E_s * eps_s_prime) <= 0.95 * f_y
        else 0.95 * f_y * np.sign(eps_s_prime)
    )
    fs = E_s * eps_s if abs(E_s * eps_s) <= 0.95 * f_y else 0.95 * f_y * np.sign(eps_s)

    N = Cc + fs_prime * As_prime - fs * As
    M = (
        Cc * (0.5 - x_bar)
        + fs_prime * As_prime * (0.5 - 0.175)
        + fs * As * (0.825 - 0.5)
    )
    return N, M


x_values = np.linspace(0.01, 10.0, 5000)
rho_base_values = np.arange(0.5, 8.1, 0.5)
interp_dict = {}


def build_interp_for_rho(rho):
    N_list, M_list = [], []
    for x in x_values:
        N, M = compute_N_M(x, rho)
        if N >= 0:
            N_list.append(N)
            M_list.append(M)
    if not N_list:
        N_list = [0.0, 1e-6]
        M_list = [0.0, 0.0]
    sorted_indices = np.argsort(N_list)
    N_sorted = np.array(N_list)[sorted_indices]
    M_sorted = np.array(M_list)[sorted_indices]
    return interp1d(N_sorted, M_sorted, kind="linear", fill_value="extrapolate")


for rho in rho_base_values:
    interp_dict[rho] = build_interp_for_rho(rho)


def ensure_interp(rho):
    if rho not in interp_dict:
        interp_dict[rho] = build_interp_for_rho(rho)
    return interp_dict[rho]


# --- spacing helpers (BS 8110 rules approximated) ---
def _clear_spacing_ok(
    side_len_mm: float, bar_dia: float, bars_on_side: int, s_min: float
) -> bool:
    if bars_on_side <= 1:
        return True
    pitch = side_len_mm / (bars_on_side - 1)
    clear = pitch - bar_dia
    return clear >= s_min


def _feasible_distribution(
    b_clear_x: float, b_clear_y: float, bar_dia: float, n_bars: int, s_min: float
):
    if n_bars < 4:
        n_bars = 4
    ex = 2
    ey = 2
    remaining = n_bars - 4

    if not (
        _clear_spacing_ok(b_clear_x, bar_dia, ex, s_min)
        and _clear_spacing_ok(b_clear_y, bar_dia, ey, s_min)
    ):
        return None

    def est_clear(L, ecount):
        if ecount <= 1:
            return 1e9
        pitch = L / (ecount - 1)
        return pitch - bar_dia

    while remaining > 0:
        cx = est_clear(b_clear_x, ex)
        cy = est_clear(b_clear_y, ey)

        # try increasing the count on the side with larger available clear (cx >= cy)
        if cx >= cy:
            trial = (ex, ey + 1)
            if _clear_spacing_ok(b_clear_x, bar_dia, ex, s_min) and _clear_spacing_ok(
                b_clear_y, bar_dia, ey + 1, s_min
            ):
                ey += 1
            elif _clear_spacing_ok(
                b_clear_x, bar_dia, ex + 1, s_min
            ) and _clear_spacing_ok(b_clear_y, bar_dia, ey, s_min):
                ex += 1
            else:
                return None
        else:
            trial = (ex + 1, ey)
            if _clear_spacing_ok(
                b_clear_x, bar_dia, ex + 1, s_min
            ) and _clear_spacing_ok(b_clear_y, bar_dia, ey, s_min):
                ex += 1
            elif _clear_spacing_ok(b_clear_x, bar_dia, ex, s_min) and _clear_spacing_ok(
                b_clear_y, bar_dia, ey + 1, s_min
            ):
                ey += 1
            else:
                return None
        remaining -= 1

    return {"top": ex, "bottom": ex, "left": ey, "right": ey}


def select_bars_with_table(
    b: float,
    h: float,
    cover: float,
    tie_dia: float,
    max_agg: float,
    A_sc_required: float,
):
    """
    Use data_table_3_10 to choose bars & distribution.
    Returns (bar_dia, num_bars, total_area, distribution) or (None,...) if none feasible.
    """
    # effective center-line lengths for bars along faces (mm)
    Lx = b - 2 * (cover + tie_dia)
    Ly = h - 2 * (cover + tie_dia)
    if Lx <= 0 or Ly <= 0:
        return None, None, None, None

    # s_min per BS-ish rule
    s_min = max(
        20.0, 0.0 + max_agg + 5.0
    )  # include max aggregate + 5; user can tweak later

    # try diameters in ascending order (favor smaller dia where possible)
    diameters = sorted(data_table_3_10.keys())
    for dia in diameters:
        # ask table for minimal number of bars to meet area
        table_result = get_number_of_bars(dia, A_sc_required)
        if table_result is None:
            continue
        num_bars_table, dia_table, total_area_table = table_result
        # ensure even number (prefer even for symmetric distribution)
        n_try = int(num_bars_table)
        if n_try % 2 == 1:
            n_try += 1

        # try small increments from table suggestion upwards (if table suggestion fails spacing)
        for n in range(n_try, max(12, n_try + 10), 2):
            dist = _feasible_distribution(Lx, Ly, dia, n, s_min)
            if dist is None:
                continue
            total_area = (
                n
                * next(
                    area for nopt, area in data_table_3_10[dia] if nopt == min(10, n)
                )
                if n > 10
                else n * next(area for nopt, area in data_table_3_10[dia] if nopt == n)
            )
            # If table only has up to 10 bars, compute area_per_bar from table at 1 bar to get per-bar area approx:
            area_per_bar = data_table_3_10[dia][0][
                1
            ]  # approximate area for 1 bar of that dia
            total_area = n * area_per_bar
            if total_area >= A_sc_required:
                return dia, n, total_area, dist

    # fallback: try largest dia and compute required bars (ceiling)
    max_dia = diameters[-1]
    area_per_bar = data_table_3_10[max_dia][0][1]
    n_needed = int(np.ceil(A_sc_required / area_per_bar))
    if n_needed % 2 == 1:
        n_needed += 1
    dist = _feasible_distribution(Lx, Ly, max_dia, n_needed, s_min)
    if dist is not None:
        total_area = n_needed * area_per_bar
        return max_dia, n_needed, total_area, dist

    # last resort: return None (not feasible with spacing)
    return None, None, None, None


# --- design logic (uniaxial / biaxial) ---
def uniaxial_design(b, h, N_actual, M_actual):
    N_design = N_actual * 1.5 / (b * h)
    M_design = M_actual * 1.25 / (b * h * h)
    rho_scan = np.arange(0.5, 8.01, 0.01)
    for rho in rho_scan:
        f = ensure_interp(rho)
        N_domain = f.x
        if N_design > np.max(N_domain):
            M_cap = 0.0
        else:
            M_cap = float(f(N_design))
        if M_design <= M_cap:
            Asc = (rho / 100.0) * b * h
            return rho, Asc, N_design, M_design, M_cap
    return None, None, N_design, M_design, None


def capacity_about_axis(b, h, rho, N_design):
    f = ensure_interp(rho)
    if N_design > np.max(f.x):
        return 0.0
    return float(f(N_design))


def biaxial_design(b, h, N_actual, Mx_actual, My_actual, alpha=1.0):
    N_design = N_actual * 1.5 / (b * h)
    Mx_design = Mx_actual * 1.25 / (b * h * h)
    My_design = My_actual * 1.25 / (b * h * h)
    rho_scan = np.arange(0.5, 8.01, 0.01)
    for rho in rho_scan:
        Mux = capacity_about_axis(b, h, rho, N_design)
        Muy = Mux  # symmetric assumption
        if Mux <= 0.0 and abs(Mx_design) > 1e-12:
            continue
        if Muy <= 0.0 and abs(My_design) > 1e-12:
            continue
        term_x = (abs(Mx_design) / max(Mux, 1e-12)) ** alpha if Mux > 0 else 0.0
        term_y = (abs(My_design) / max(Muy, 1e-12)) ** alpha if Muy > 0 else 0.0
        util = term_x + term_y
        if util <= 1.0 + 1e-9:
            Asc = (rho / 100.0) * b * h
            return rho, Asc, N_design, Mx_design, My_design, Mux, Muy, util
    return None, None, N_design, Mx_design, My_design, None, None, None


def get_interaction_data():
    data = []
    for rho in rho_base_values:
        f = ensure_interp(rho)
        points = [
            {"name": f"{rho}%", "M": float(m), "N": float(n)} for n, m in zip(f.x, f.y)
        ]
        data.append({"steelPercentage": float(rho), "points": points})
    return data


# --- endpoints ---
@app.post("/design-column")
async def design_column_endpoint(data: dict):
    try:
        b = float(data.get("b", 300))
        h = float(data.get("h", 300))
        mode = data.get("mode", "uniaxial")
        cover = float(data.get("cover", 40.0))
        tie_dia = float(data.get("tie_dia", 8.0))
        max_agg = float(data.get("max_agg", 20.0))

        # Input units: frontend sends N in kN, M in kNm (we expect kN/kNm)
        N_actual = float(data.get("N", 1480.0)) * 1e3  # kN -> N

        if mode == "uniaxial":
            M_actual = float(data.get("M", 54.0)) * 1e6  # kNm -> Nmm
            rho, Asc, N_design, M_design, M_cap = uniaxial_design(
                b, h, N_actual, M_actual
            )
            if rho is None:
                return {
                    "status": "error",
                    "message": "Design not possible within rho range",
                }
            # choose bars using table + spacing
            bar_dia, num_bars, total_area, distribution = select_bars_with_table(
                b, h, cover, tie_dia, max_agg, Asc
            )
            response = {
                "status": "success",
                "mode": mode,
                "dimensions": {"b": b, "h": h},
                "loads": {"N": N_actual, "M": M_actual},
                "effective_depth": {
                    "d": h - cover - (bar_dia / 2 if bar_dia else 0),
                    "d_prime": cover + (bar_dia / 2 if bar_dia else 0),
                },
                "steel_percentage": rho,
                "steel_area": Asc,
                "chart_point": {"N": N_design, "M": M_cap},
                "design_point": {"N": N_design, "M": M_design},
                "utilization": M_design / max(M_cap, 1e-12),
                "bar_selection": {
                    "bar_dia": bar_dia,
                    "num_bars": num_bars,
                    "total_area": total_area,
                    "distribution": distribution,
                    "cover": cover,
                    "tie_dia": tie_dia,
                    "max_agg": max_agg,
                },
            }
            return response

        elif mode == "biaxial":
            Mx_actual = float(data.get("Mx", 40.0)) * 1e6
            My_actual = float(data.get("My", 20.0)) * 1e6
            alpha = float(data.get("alpha", 1.0))
            rho, Asc, N_d, Mx_d, My_d, Mux, Muy, util = biaxial_design(
                b, h, N_actual, Mx_actual, My_actual, alpha=alpha
            )
            if rho is None:
                return {
                    "status": "error",
                    "message": "Design not possible within rho range",
                }
            bar_dia, num_bars, total_area, distribution = select_bars_with_table(
                b, h, cover, tie_dia, max_agg, Asc
            )
            response = {
                "status": "success",
                "mode": mode,
                "dimensions": {"b": b, "h": h},
                "loads": {"N": N_actual, "Mx": Mx_actual, "My": My_actual},
                "effective_depth": {
                    "d": h - cover - (bar_dia / 2 if bar_dia else 0),
                    "d_prime": cover + (bar_dia / 2 if bar_dia else 0),
                },
                "steel_percentage": rho,
                "steel_area": Asc,
                "chart_point": {"N": N_d, "Mux": Mux, "Muy": Muy, "alpha": alpha},
                "design_point": {"N": N_d, "Mx": Mx_d, "My": My_d},
                "utilization": util,
                "bar_selection": {
                    "bar_dia": bar_dia,
                    "num_bars": num_bars,
                    "total_area": total_area,
                    "distribution": distribution,
                    "cover": cover,
                    "tie_dia": tie_dia,
                    "max_agg": max_agg,
                },
            }
            return response

        else:
            return {"status": "error", "message": f"Unknown mode '{mode}'"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/get-interaction-data")
async def get_interaction_data_endpoint():
    return {"data": get_interaction_data()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
