# beam_calculator.py
import math
from typing import Dict

def design_beam_bs_simple(fcu: float, fy: float, b: float, d: float, Mu: float) -> Dict:
    """
    Simplified singly reinforced beam design using a BS-style working/limit scheme.
    fcu: concrete cube strength (N/mm^2)
    fy: steel yield strength (N/mm^2)
    b: breadth (mm)
    d: effective depth (mm)
    Mu: ultimate moment (kN·m)

    Returns: dict with Ast required, rho, lever arm, check values.
    Note: This is a simplified model for quick engineering checks — refine before final design.
    """

    # Safety factors (simplified)
    gamma_m = 1.15  # steel partial factor
    gamma_c = 1.5

    # Design strengths (N/mm2)
    fcd = 0.45 * fcu / gamma_c
    fyd = fy / gamma_m

    # Convert Mu to N·mm
    Mu_Nmm = Mu * 1e6

    # Estimated lever arm z = 0.9d (approx)
    z = 0.9 * d

    # Required tensile steel area (mm2)
    Ast = Mu_Nmm / (fyd * z)

    # Steel ratio
    rho = Ast / (b * d)

    # Provide recommended bar area rounding (choose nearest practical bar set)
    # provide a small suggestion helper (not deciding final bar schedule)
    suggestion = {
        "Ast_mm2": round(Ast, 2),
        "rho": round(rho, 6),
        "z_mm": round(z, 2),
        "fcd_Nmm2": round(fcd, 3),
        "fyd_Nmm2": round(fyd, 3)
    }
    # Basic checks
    # limiting steel ratio (approx) – typically 0.02 for under-reinforced for many codes
    suggestion["is_rho_reasonable"] = rho < 0.02

    return suggestion
