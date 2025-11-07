# three_moment.py
import numpy as np
from dataclasses import dataclass
from typing import List, Tuple, Dict, Any
from enum import Enum
import math

class SupportType(Enum):
    FIXED = "FIXED"
    PINNED = "PINNED"
    FREE = "FREE"

class LoadType(Enum):
    POINT = "POINT"
    UDL = "UDL"
    PARTIAL_UDL = "PARTIAL_UDL"
    TRIANGULAR = "TRIANGULAR"
    TRAPEZOIDAL = "TRAPEZOIDAL"

@dataclass
class Load:
    load_type: LoadType
    magnitude: float
    position: float = 0.0
    length: float = 0.0
    magnitude2: float = 0.0

    def to_dict(self):
        return {"load_type": self.load_type.value, "magnitude": self.magnitude,
                "position": self.position, "length": self.length, "magnitude2": self.magnitude2}

@dataclass
class Span:
    length: float
    E: float
    I: float
    loads: List[Load]

    def __post_init__(self):
        self.EI = self.E * self.I

    def calculate_fixed_end_moments(self) -> Tuple[float, float]:
        M_left = 0.0
        M_right = 0.0
        L = self.length

        for load in self.loads:
            if load.load_type == LoadType.POINT:
                P = load.magnitude
                a = load.position
                b = L - a
                # classic fixed end moments for point load at 'a' (sign conv: + sagging)
                M_left += -P * a * b**2 / L**2
                M_right += P * a**2 * b / L**2

            elif load.load_type == LoadType.UDL:
                w = load.magnitude
                M_left += -w * L**2 / 12.0
                M_right += w * L**2 / 12.0

            elif load.load_type == LoadType.PARTIAL_UDL:
                w = load.magnitude
                a = load.position
                c = load.length
                P_eq = w * c
                x_centroid = a + c / 2.0
                a_eq = x_centroid
                b_eq = L - a_eq
                M_left += -P_eq * a_eq * b_eq**2 / L**2
                M_right += P_eq * a_eq**2 * b_eq / L**2

            elif load.load_type == LoadType.TRIANGULAR:
                w = load.magnitude
                a = load.position
                c = load.length
                P_eq = w * c / 2.0
                x_centroid = a + 2.0 * c / 3.0
                a_eq = x_centroid
                b_eq = L - a_eq
                if b_eq > 0:
                    M_left += -P_eq * a_eq * b_eq**2 / L**2
                    M_right += P_eq * a_eq**2 * b_eq / L**2

            elif load.load_type == LoadType.TRAPEZOIDAL:
                w1 = load.magnitude
                w2 = load.magnitude2
                a = load.position
                c = load.length
                w_rect = min(w1, w2)
                P_rect = w_rect * c
                x_rect = a + c / 2.0
                a_eq = x_rect
                b_eq = L - a_eq
                if b_eq > 0:
                    M_left += -P_rect * a_eq * b_eq**2 / L**2
                    M_right += P_rect * a_eq**2 * b_eq / L**2
                w_tri = abs(w2 - w1)
                P_tri = w_tri * c / 2.0
                if w2 > w1:
                    x_tri = a + 2.0 * c / 3.0
                else:
                    x_tri = a + c / 3.0
                a_eq = x_tri
                b_eq = L - a_eq
                if b_eq > 0:
                    M_left += -P_tri * a_eq * b_eq**2 / L**2
                    M_right += P_tri * a_eq**2 * b_eq / L**2

        return M_left, M_right

    def calculate_area_term(self) -> float:
        A = 0.0
        L = self.length

        for load in self.loads:
            if load.load_type == LoadType.POINT:
                P = load.magnitude
                a = load.position
                b = L - a
                A += P * a * b * (L**2 - a**2 - b**2) / (6.0 * L)

            elif load.load_type == LoadType.UDL:
                w = load.magnitude
                A += w * L**4 / 24.0

            elif load.load_type == LoadType.PARTIAL_UDL:
                w = load.magnitude
                c = load.length
                a = load.position
                P_eq = w * c
                x_centroid = a + c / 2.0
                a_eq = x_centroid
                b_eq = L - a_eq
                A += P_eq * a_eq * b_eq * (L**2 - a_eq**2 - b_eq**2) / (6.0 * L)

            elif load.load_type == LoadType.TRIANGULAR:
                w = load.magnitude
                a = load.position
                c = load.length
                P_eq = w * c / 2.0
                x_centroid = a + 2.0 * c / 3.0
                a_eq = x_centroid
                b_eq = L - a_eq
                if b_eq > 0:
                    A += P_eq * a_eq * b_eq * (L**2 - a_eq**2 - b_eq**2) / (6.0 * L)

            elif load.load_type == LoadType.TRAPEZOIDAL:
                w1 = load.magnitude
                w2 = load.magnitude2
                a = load.position
                c = load.length
                w_rect = min(w1, w2)
                P_rect = w_rect * c
                x_rect = a + c / 2.0
                a_eq = x_rect
                b_eq = L - a_eq
                if b_eq > 0:
                    A += P_rect * a_eq * b_eq * (L**2 - a_eq**2 - b_eq**2) / (6.0 * L)
                w_tri = abs(w2 - w1)
                P_tri = w_tri * c / 2.0
                if w2 > w1:
                    x_tri = a + 2.0 * c / 3.0
                else:
                    x_tri = a + c / 3.0
                a_eq = x_tri
                b_eq = L - a_eq
                if b_eq > 0:
                    A += P_tri * a_eq * b_eq * (L**2 - a_eq**2 - b_eq**2) / (6.0 * L)

        return A / (self.EI * L)

    def total_nodal_loads(self) -> float:
        """Return total equivalent nodal load (useful for checks)"""
        total = 0.0
        for load in self.loads:
            if load.load_type == LoadType.POINT:
                total += load.magnitude
            elif load.load_type == LoadType.UDL:
                total += load.magnitude * self.length
            elif load.load_type == LoadType.PARTIAL_UDL:
                total += load.magnitude * load.length
            elif load.load_type == LoadType.TRIANGULAR:
                total += load.magnitude * load.length / 2.0
            elif load.load_type == LoadType.TRAPEZOIDAL:
                total += (load.magnitude + load.magnitude2) * load.length / 2.0
        return total

class ContinuousBeam:
    def __init__(self, spans: List[Span], supports: List[SupportType]):
        if len(supports) != len(spans) + 1:
            raise ValueError("Number of supports must be number of spans + 1")

        # Validate support positions are not required here — left to caller
        self.spans = spans
        self.supports = supports
        self.n_spans = len(spans)
        self.support_moments = [0.0] * (self.n_spans + 1)
        self.reactions = [0.0] * (self.n_spans + 1)
        self.solved = False

    def solve(self) -> None:
        # initialize known pinned supports to zero moments, fixed supports unknown
        for i, s in enumerate(self.supports):
            if s == SupportType.PINNED or s == SupportType.FREE:
                self.support_moments[i] = 0.0
            else:
                # fixed -> unknown moment (start with zero)
                self.support_moments[i] = 0.0

        if self.n_spans == 1:
            # single span: use fixed-end moment approach
            left_support = self.supports[0]
            right_support = self.supports[1]
            M_left, M_right = self.spans[0].calculate_fixed_end_moments()
            if left_support == SupportType.FIXED and right_support == SupportType.FIXED:
                self.support_moments[0] = M_left
                self.support_moments[1] = M_right
            elif left_support == SupportType.FIXED:
                self.support_moments[0] = M_left
                self.support_moments[1] = 0.0
            elif right_support == SupportType.FIXED:
                self.support_moments[0] = 0.0
                self.support_moments[1] = M_right
            else:
                self.support_moments[0] = 0.0
                self.support_moments[1] = 0.0
        else:
            self._solve_multi_span_system()

        self._calculate_reactions()
        self.solved = True

    def _solve_multi_span_system(self) -> None:
        n_eq = self.n_spans - 1
        unknown_indices = [i for i in range(1, self.n_spans) if self.supports[i] == SupportType.FIXED]

        if not unknown_indices:
            # interior pinned: moments zero
            return

        n_unknowns = len(unknown_indices)
        A = np.zeros((n_unknowns, n_unknowns))
        b = np.zeros(n_unknowns)

        Ai = [sp.calculate_area_term() for sp in self.spans]

        # Build for each equation corresponding to unknown index
        # The system derived from M_i*L_i + 2*M_i+1*(L_i+L_i+1) + M_i+2*L_i+1 = -6(A_i + A_i+1)
        # We only construct rows for equations where the middle support is unknown (i+1 is unknown)
        rows = []
        for eq_index, supp_idx in enumerate(unknown_indices):
            # supp_idx corresponds to interior support index (1..n_spans-1)
            i = supp_idx - 1  # equation relates spans i and i+1
            L_i = self.spans[i].length
            L_i1 = self.spans[i+1].length

            coeffs = {i: L_i, i+1: 2.0 * (L_i + L_i1), i+2: L_i1}
            rhs = -6.0 * (Ai[i] + Ai[i+1])

            # move known moments to RHS, put unknown coeffs into A
            for support_idx, coeff in coeffs.items():
                if support_idx in unknown_indices:
                    col = unknown_indices.index(support_idx)
                    A[eq_index, col] += coeff
                else:
                    known_M = self.support_moments[support_idx]
                    rhs -= coeff * known_M

            b[eq_index] = rhs

        # Solve A x = b
        try:
            sol = np.linalg.solve(A, b)
        except np.linalg.LinAlgError:
            # fallback: least squares
            sol = np.linalg.lstsq(A, b, rcond=None)[0]

        for idx, supp_idx in enumerate(unknown_indices):
            self.support_moments[supp_idx] = sol[idx]

    def _calculate_reactions(self) -> None:
        # Reaction calculation per support
        for i in range(len(self.supports)):
            reaction = 0.0

            # left span (i-1) contributes right reaction
            if i > 0:
                span = self.spans[i-1]
                L = span.length
                M_left = self.support_moments[i-1]
                M_right = self.support_moments[i]
                reaction += (M_right - M_left) / L

                for load in span.loads:
                    if load.load_type == LoadType.POINT:
                        P = load.magnitude
                        a = load.position
                        reaction += P * (L - a) / L
                    elif load.load_type == LoadType.UDL:
                        w = load.magnitude
                        reaction += w * L / 2.0
                    elif load.load_type == LoadType.PARTIAL_UDL:
                        w = load.magnitude
                        c = load.length
                        a = load.position
                        P_eq = w * c
                        x_centroid = a + c / 2.0
                        reaction += P_eq * (L - x_centroid) / L
                    elif load.load_type == LoadType.TRIANGULAR:
                        w = load.magnitude
                        c = load.length
                        a = load.position
                        P_eq = w * c / 2.0
                        x_centroid = a + 2.0 * c / 3.0
                        reaction += P_eq * (L - x_centroid) / L
                    elif load.load_type == LoadType.TRAPEZOIDAL:
                        w1 = load.magnitude
                        w2 = load.magnitude2
                        c = load.length
                        a = load.position
                        P_eq = (w1 + w2) * c / 2.0
                        if abs(w2 - w1) < 1e-6:
                            x_centroid = a + c / 2.0
                        else:
                            x_centroid = a + c * (2.0 * w2 + w1) / (3.0 * (w1 + w2))
                        reaction += P_eq * (L - x_centroid) / L

            # right span (i) contributes left reaction
            if i < len(self.spans):
                span = self.spans[i]
                L = span.length
                M_left = self.support_moments[i]
                M_right = self.support_moments[i+1]
                reaction += (M_left - M_right) / L

                for load in span.loads:
                    if load.load_type == LoadType.POINT:
                        P = load.magnitude
                        a = load.position
                        reaction += P * a / L
                    elif load.load_type == LoadType.UDL:
                        w = load.magnitude
                        reaction += w * L / 2.0
                    elif load.load_type == LoadType.PARTIAL_UDL:
                        w = load.magnitude
                        c = load.length
                        a = load.position
                        P_eq = w * c
                        x_centroid = a + c / 2.0
                        reaction += P_eq * x_centroid / L
                    elif load.load_type == LoadType.TRIANGULAR:
                        w = load.magnitude
                        c = load.length
                        a = load.position
                        P_eq = w * c / 2.0
                        x_centroid = a + 2.0 * c / 3.0
                        reaction += P_eq * x_centroid / L
                    elif load.load_type == LoadType.TRAPEZOIDAL:
                        w1 = load.magnitude
                        w2 = load.magnitude2
                        c = load.length
                        a = load.position
                        P_eq = (w1 + w2) * c / 2.0
                        if abs(w2 - w1) < 1e-6:
                            x_centroid = a + c / 2.0
                        else:
                            x_centroid = a + c * (2.0 * w2 + w1) / (3.0 * (w1 + w2))
                        reaction += P_eq * x_centroid / L

            self.reactions[i] = reaction

    def calculate_shear_force(self, span_idx: int, x: float) -> float:
        if not self.solved:
            raise RuntimeError("Beam not solved")

        if span_idx < 0 or span_idx >= self.n_spans:
            raise ValueError("Invalid span index")

        span = self.spans[span_idx]
        if x < 0 or x > span.length:
            raise ValueError("x outside span")

        V = self.reactions[span_idx]

        for load in span.loads:
            if load.load_type == LoadType.POINT:
                if load.position <= x + 1e-12:
                    V -= load.magnitude
            elif load.load_type == LoadType.UDL:
                V -= load.magnitude * x
            elif load.load_type == LoadType.PARTIAL_UDL:
                if x > load.position:
                    length_covered = min(x - load.position, load.length)
                    V -= load.magnitude * length_covered
            elif load.load_type == LoadType.TRIANGULAR:
                if x > load.position:
                    length_covered = min(x - load.position, load.length)
                    # triangular area up to length_covered: 0.5 * base * height; approximate by centroid method
                    w_max = load.magnitude * (length_covered / load.length)
                    V -= 0.5 * w_max * length_covered
            elif load.load_type == LoadType.TRAPEZOIDAL:
                if x > load.position:
                    length_covered = min(x - load.position, load.length)
                    w1 = load.magnitude
                    w2 = load.magnitude2
                    w_at = w1 + (w2 - w1) * (length_covered / load.length)
                    # approximate integrated area using average intensity
                    w_avg = (w1 + w_at) / 2.0
                    V -= w_avg * length_covered

        return V

    def calculate_bending_moment(self, span_idx: int, x: float) -> float:
        if not self.solved:
            raise RuntimeError("Beam not solved")
        if span_idx < 0 or span_idx >= self.n_spans:
            raise ValueError("Invalid span index")
        span = self.spans[span_idx]
        if x < 0 or x > span.length:
            raise ValueError("x outside span")

        M = self.support_moments[span_idx]
        M += self.reactions[span_idx] * x

        for load in span.loads:
            if load.load_type == LoadType.POINT:
                if load.position <= x + 1e-12:
                    M -= load.magnitude * (x - load.position)
            elif load.load_type == LoadType.UDL:
                M -= load.magnitude * x**2 / 2.0
            elif load.load_type == LoadType.PARTIAL_UDL:
                if x > load.position:
                    l = min(x - load.position, load.length)
                    f = load.magnitude * l
                    x_centroid = load.position + l / 2.0
                    M -= f * (x - x_centroid)
            elif load.load_type == LoadType.TRIANGULAR:
                if x > load.position:
                    l = min(x - load.position, load.length)
                    w_max = load.magnitude * (l / load.length)
                    f = 0.5 * w_max * l
                    x_centroid = load.position + 2.0 * l / 3.0
                    M -= f * (x - x_centroid)
            elif load.load_type == LoadType.TRAPEZOIDAL:
                if x > load.position:
                    l = min(x - load.position, load.length)
                    w1 = load.magnitude
                    w2_at_x = load.magnitude + (load.magnitude2 - load.magnitude) * (l / load.length)
                    f = (w1 + w2_at_x) * l / 2.0
                    if abs(w2_at_x - w1) < 1e-9:
                        x_centroid = load.position + l/2.0
                    else:
                        x_centroid = load.position + l * (2.0 * w2_at_x + w1) / (3.0 * (w1 + w2_at_x))
                    M -= f * (x - x_centroid)

        return M

    def to_json(self, resolution_per_span: int = 100) -> Dict[str, Any]:
        if not self.solved:
            raise RuntimeError("Beam not solved")

        spans_json = []
        global_x = 0.0
        positions = []
        shear_values = []
        moment_values = []

        for s_idx, span in enumerate(self.spans):
            L = span.length
            n_pts = resolution_per_span
            xs = [i * L / (n_pts - 1) for i in range(n_pts)]
            Vx = [self.calculate_shear_force(s_idx, x) for x in xs]
            Mx = [self.calculate_bending_moment(s_idx, x) for x in xs]
            for j in range(len(xs)):
                positions.append(round(global_x + xs[j], 6))
                shear_values.append(Vx[j])
                moment_values.append(Mx[j])
            spans_json.append({
                "span_index": s_idx,
                "length": L,
                "EI": span.EI,
                "loads": [ld.to_dict() for ld in span.loads]
            })
            global_x += L

        return {
            "supports": [s.value for s in self.supports],
            "support_moments": [float(round(m, 6)) for m in self.support_moments],
            "reactions": [float(round(r, 6)) for r in self.reactions],
            "spans": spans_json,
            "positions": positions,
            "shear": shear_values,
            "moment": moment_values
        }

# Helper factory to build beam from API-like dicts
def build_beam_from_dict(spans_data, supports_data):
    spans = []
    for sp in spans_data:
        loads = []
        for ld in sp.get("loads", []):
            lt = LoadType(ld["load_type"])
            magnitude = float(ld["magnitude"])
            pos = float(ld.get("position", 0.0) or 0.0)
            length = float(ld.get("length", 0.0) or 0.0)
            m2 = float(ld.get("magnitude2", 0.0) or 0.0)
            loads.append(Load(lt, magnitude, pos, length, m2))
        E = float(sp.get("E", 200e9))
        I = float(sp.get("I", 1e-6))
        spans.append(Span(float(sp["length"]), E, I, loads))

    supports = [SupportType(s["support_type"]) if isinstance(s, dict) else SupportType(s) for s in supports_data]
    beam = ContinuousBeam(spans, supports)
    return beam
