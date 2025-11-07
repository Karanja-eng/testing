# moment_distribution.py
import numpy as np
import matplotlib.pyplot as plt

class MomentDistributionCalculator:
    def __init__(self):
        self.spans = []  # Main span lengths
        self.loads = []  # Loads for main spans: [(type, magnitude, position), ...]
        self.supports = []  # Support types: ["fixed", "pinned", "roller"]
        self.E = 2e8  # kN/m^2
        self.I = 2e-4  # m^4
        self.settlements = []  # Support settlements (m)
        self.left_cantilever = None  # (length, load_type, magnitude, position)
        self.right_cantilever = None  # (length, load_type, magnitude, position)
        self.fems = []
        self.stiffness = []
        self.dfs = []
        self.moments = []
        self.reactions = []
        self.tolerance = 0.001
        self.max_iterations = 100

    def calculate_fem(self, span_idx):
        if span_idx == -1:  # Left cantilever
            L, load_type, mag, pos = self.left_cantilever or (0, "none", 0, 0)
            if load_type == "udl":
                return [-mag * L**2 / 2, 0]
            elif load_type == "point":
                return [-mag * pos, 0]
            return [0, 0]
        elif span_idx == len(self.spans):  # Right cantilever
            L, load_type, mag, pos = self.right_cantilever or (0, "none", 0, 0)
            if load_type == "udl":
                return [0, -mag * L**2 / 2]
            elif load_type == "point":
                return [0, -mag * pos]
            return [0, 0]
        else:  # Main spans
            L = self.spans[span_idx]
            load_type, mag, pos = self.loads[span_idx]
            left_fem, right_fem = 0, 0
            if load_type == "udl":
                w = mag
                left_fem = -w * L**2 / 12
                right_fem = w * L**2 / 12
            elif load_type == "point":
                P = mag
                a = pos if pos is not None else 0  # Default to 0 if None
                b = L - a
                left_fem = -P * a * b**2 / L**2
                right_fem = P * a**2 * b / L**2

            delta_left = self.settlements[span_idx] if span_idx < len(self.settlements) else 0
            delta_right = self.settlements[span_idx + 1] if span_idx + 1 < len(self.settlements) else 0
            delta = delta_right - delta_left
            if abs(delta) > 0 and L > 0:  # Avoid division by zero
                fem_settlement = 6 * self.E * self.I * delta / L**2
                left_fem += fem_settlement
                right_fem -= fem_settlement

            return [left_fem, right_fem]

    def calculate_stiffness(self):
        self.stiffness = []
        for i, L in enumerate(self.spans):
            if L <= 0:  # Handle invalid span lengths
                L = 1e-6  # Small default value to avoid division by zero
            if self.supports[i] in ["pinned", "roller"] or self.supports[i + 1] in ["pinned", "roller"]:
                k = 3 * self.E * self.I / L
            else:
                k = 4 * self.E * self.I / L
            self.stiffness.append(k)

    def calculate_distribution_factors(self):
        self.dfs = [[0.0]]  # Left end (no left distribution)
        for i in range(1, len(self.supports) - 1):
            if i - 1 >= len(self.stiffness) or i >= len(self.stiffness):
                self.dfs.append([0.0, 0.0])  # Default to zero if out of bounds
                continue
            k_sum = self.stiffness[i - 1] + self.stiffness[i]
            df_left = self.stiffness[i - 1] / k_sum if k_sum > 0 else 0.0
            df_right = self.stiffness[i] / k_sum if k_sum > 0 else 0.0
            self.dfs.append([df_left, df_right])
        self.dfs.append([0.0])  # Right end (no right distribution)

    def moment_distribution(self):
        self.fems = []
        if self.left_cantilever:
            self.fems.append(self.calculate_fem(-1))
        self.fems.extend(self.calculate_fem(i) for i in range(len(self.spans)))
        if self.right_cantilever:
            self.fems.append(self.calculate_fem(len(self.spans)))
        self.moments = [0.0] * (len(self.spans) + 1)

        for _ in range(self.max_iterations):
            unbalanced = [0.0] * (len(self.spans) + 1)
            fem_idx = 0
            if self.left_cantilever and self.fems:
                unbalanced[0] += self.fems[0][0] + self.moments[0]
                fem_idx += 1
            for i in range(len(self.spans)):
                if fem_idx < len(self.fems):
                    unbalanced[i] += self.fems[fem_idx][0] + self.moments[i]
                    unbalanced[i + 1] += self.fems[fem_idx][1] + self.moments[i + 1]
                fem_idx += 1
            if self.right_cantilever and self.fems and fem_idx < len(self.fems):
                unbalanced[-1] += self.fems[-1][1] + self.moments[-1]

            delta_m = [0.0] * (len(self.spans) + 1)
            for i in range(1, len(self.supports) - 1):  # Interior supports
                if i < len(self.dfs) and self.dfs[i]:
                    delta_m[i] = -unbalanced[i]
                    self.moments[i] += delta_m[i]  # Hogging moment at interior support
                    if i > 0 and i - 1 < len(self.dfs) and self.dfs[i-1] and len(self.dfs[i-1]) > 0:
                        self.moments[i - 1] += delta_m[i] * self.dfs[i-1][0] * 0.5
                    if i < len(self.supports) - 2 and self.dfs[i] and len(self.dfs[i]) > 1:
                        self.moments[i + 1] += delta_m[i] * self.dfs[i][1] * 0.5

            max_delta = max(abs(d) for d in delta_m) if delta_m and all(isinstance(d, (int, float)) for d in delta_m) else 0.0
            if max_delta < self.tolerance:
                break


    def calculate_reactions(self):
        self.reactions = [0.0] * (len(self.spans) + 1)
        if self.left_cantilever:
            L, load_type, mag, pos = self.left_cantilever or (0, "none", 0, 0)
            if L > 0:
                if load_type == "udl":
                    self.reactions[0] += mag * L
                elif load_type == "point":
                    self.reactions[0] += mag
                self.reactions[0] += -self.moments[0] / L if L > 0 else 0

        for i in range(len(self.spans)):
            L = self.spans[i]
            load_type, mag, pos = self.loads[i]
            M_left, M_right = self.moments[i], self.moments[i + 1]

            if load_type == "udl":
                w = mag
                V_left = w * L / 2 + (M_right - M_left) / L if L > 0 else 0
                V_right = w * L - V_left if L > 0 else 0
            elif load_type == "point":
                P = mag
                a = pos if pos is not None else 0
                b = L - a
                V_left = P * b / L + (M_right - M_left) / L if L > 0 else 0
                V_right = P - V_left if L > 0 else 0
            else:  # "none" load
                V_left = (M_right - M_left) / L if L > 0 else 0
                V_right = -V_left if L > 0 else 0

            self.reactions[i] += V_left
            self.reactions[i + 1] += V_right

        if self.right_cantilever:
            L, load_type, mag, pos = self.right_cantilever or (0, "none", 0, 0)
            if L > 0:
                if load_type == "udl":
                    self.reactions[-1] += mag * L
                elif load_type == "point":
                    self.reactions[-1] += mag
                self.reactions[-1] += -self.moments[-1] / L if L > 0 else 0

    def calculate_sf_bm(self, x):
        current_x = 0
        sf, bm = 0, 0
        if self.left_cantilever and x <= self.left_cantilever[0]:
            L, load_type, mag, pos = self.left_cantilever or (0, "none", 0, 0)
            if load_type == "udl":
                sf = mag * x
                bm = -mag * x**2 / 2
            elif load_type == "point" and x >= pos:
                sf = mag
                bm = -mag * (x - pos)
            return sf, bm
        current_x += self.left_cantilever[0] if self.left_cantilever else 0

        for i in range(len(self.spans)):
            if current_x <= x <= current_x + self.spans[i]:
                x_local = x - current_x
                load_type, mag, pos = self.loads[i]
                M_left = self.moments[i]
                V_left = self.reactions[i]

                if load_type == "udl":
                    w = mag
                    sf = V_left - w * x_local
                    bm = M_left + V_left * x_local - w * x_local**2 / 2
                elif load_type == "point" and x_local >= pos:
                    P = mag
                    sf = V_left - P
                    bm = M_left + V_left * x_local - P * (x_local - pos)
                else:
                    sf = V_left
                    bm = M_left + V_left * x_local
                return sf, bm
            current_x += self.spans[i]

        if self.right_cantilever and current_x <= x <= current_x + self.right_cantilever[0]:
            x_local = x - current_x
            L, load_type, mag, pos = self.right_cantilever or (0, "none", 0, 0)
            M_left = self.moments[-1]
            V_left = self.reactions[-1]
            if load_type == "udl":
                sf = V_left - mag * x_local
                bm = M_left + V_left * x_local - mag * x_local**2 / 2
            elif load_type == "point" and x_local >= pos:
                sf = V_left - mag
                bm = M_left + V_left * x_local - mag * (x_local - pos)
            else:
                sf = V_left
                bm = M_left + V_left * x_local
            return sf, bm

        return sf, bm
    def calculate_initial_bm(self, x):
        current_x = 0
        bm = 0
        if self.left_cantilever and x <= self.left_cantilever[0]:
            L = self.left_cantilever[0]  # Use cantilever length
            load_type, mag, pos = self.left_cantilever[1:]
            if load_type == "udl":
                bm = -mag * x**2 / 2  # Moment due to UDL on cantilever
            elif load_type == "point" and x >= pos:
                bm = -mag * (x - pos)  # Moment due to point load
            return bm
        current_x += self.left_cantilever[0] if self.left_cantilever else 0

        for i in range(len(self.spans)):
            if current_x <= x <= current_x + self.spans[i]:
                x_local = x - current_x
                load_type, mag, pos = self.loads[i]
                L = self.spans[i]  # Define L as the current span length
                if load_type == "udl":
                    w = mag
                    bm = w * x_local * (L - x_local) / 2  # Parabolic moment for UDL
                elif load_type == "point" and pos is not None and x_local >= pos:
                    P = mag
                    a = pos if pos is not None else 0
                    b = L - a
                    if x_local <= a:
                        bm = P * x_local * b / L
                    else:
                        bm = P * (L - x_local) * a / L
                return bm
            current_x += self.spans[i]

        if self.right_cantilever and current_x <= x <= current_x + self.right_cantilever[0]:
            x_local = x - current_x
            L = self.right_cantilever[0]  # Use cantilever length
            load_type, mag, pos = self.right_cantilever[1:]
            if load_type == "udl":
                bm = mag * x_local * (L - x_local) / 2  # Moment due to UDL
            elif load_type == "point" and x_local >= pos:
                bm = mag * (x_local - pos)  # Moment due to point load
            return bm
        return bm
    def plot_diagrams(self):
        total_length = (self.left_cantilever[0] if self.left_cantilever else 0) + sum(self.spans) + (self.right_cantilever[0] if self.right_cantilever else 0)
        x = np.linspace(0, total_length, 500)
        sf = np.zeros_like(x)
        bm = np.zeros_like(x)
        initial_bm = np.zeros_like(x)

        # Calculate midspan moments for each span
        midspan_bm = []
        current_x = 0
        if self.left_cantilever:
            current_x += self.left_cantilever[0]
        for i, span in enumerate(self.spans):
            mid_x = current_x + span / 2
            _, bm_mid = self.calculate_sf_bm(mid_x)
            midspan_bm.append({"x": mid_x, "bm": round(bm_mid, 2), "support": f"Span {i+1} Mid"})
            current_x += span
        if self.right_cantilever:
            current_x += self.right_cantilever[0]

        for i, xi in enumerate(x):
            sf[i], bm[i] = self.calculate_sf_bm(xi)
            initial_bm[i] = self.calculate_initial_bm(xi)

        return x.tolist(), sf.tolist(), bm.tolist(), initial_bm.tolist(), midspan_bm



    def plot_beam_diagram(self):
        total_length = (self.left_cantilever[0] if self.left_cantilever else 0) + sum(self.spans) + (self.right_cantilever[0] if self.right_cantilever else 0)
        elements = []
        current_x = 0
        support_positions = []
        labels = []

        if self.left_cantilever:
            L = self.left_cantilever[0]
            elements.append({"type": "beam", "x_start": 0, "x_end": L})
            support_positions.append(L)
            labels.append(chr(65))
            current_x = L
        else:
            support_positions.append(0)
            labels.append(chr(65))

        for L in self.spans:
            elements.append({"type": "beam", "x_start": current_x, "x_end": current_x + L})
            current_x += L
            support_positions.append(current_x)
            labels.append(chr(65 + len(support_positions)))

        if self.right_cantilever:
            L = self.right_cantilever[0]
            elements.append({"type": "beam", "x_start": current_x, "x_end": current_x + L})
            labels[-1] = chr(65 + len(support_positions) - 1)
            labels.append(chr(65 + len(support_positions)))

        for i, (x, support) in enumerate(zip(support_positions, self.supports)):
            elements.append({"type": "support", "x": x, "support_type": support, "label": labels[i]})

        if self.left_cantilever:
            elements.append({"type": "free_end", "x": 0, "label": chr(65 + len(support_positions))})

        if self.right_cantilever:
            elements.append({"type": "free_end", "x": total_length, "label": labels[-1]})

        current_x = 0
        if self.left_cantilever:
            L, load_type, mag, pos = self.left_cantilever or (0, "none", 0, 0)
            if load_type == "udl":
                n_arrows = int(L * 5)
                x_positions = np.linspace(current_x, current_x + L, n_arrows).tolist()
                for x in x_positions:
                    elements.append({"type": "load_arrow", "x": x, "magnitude": mag, "load_type": "udl"})
                elements.append({"type": "load_label", "x": current_x + L/2, "text": f"{mag} kN/m"})
            elif load_type == "point":
                elements.append({"type": "load_arrow", "x": pos, "magnitude": mag, "load_type": "point"})
                elements.append({"type": "load_label", "x": pos, "text": f"{mag} kN"})
            elements.append({"type": "span_label", "x": current_x + L/2, "text": f"{L} m"})
            current_x += L

        for i, L in enumerate(self.spans):
            load_type, mag, pos = self.loads[i]
            if load_type == "udl":
                n_arrows = int(L * 5)
                x_positions = np.linspace(current_x, current_x + L, n_arrows).tolist()
                for x in x_positions:
                    elements.append({"type": "load_arrow", "x": x, "magnitude": mag, "load_type": "udl"})
                elements.append({"type": "load_label", "x": current_x + L/2, "text": f"{mag} kN/m"})
            elif load_type == "point":
                x = current_x + pos
                elements.append({"type": "load_arrow", "x": x, "magnitude": mag, "load_type": "point"})
                elements.append({"type": "load_label", "x": x, "text": f"{mag} kN"})
            elements.append({"type": "span_label", "x": current_x + L/2, "text": f"{L} m"})
            current_x += L

        if self.right_cantilever:
            L, load_type, mag, pos = self.right_cantilever or (0, "none", 0, 0)
            if load_type == "udl":
                n_arrows = int(L * 5)
                x_positions = np.linspace(current_x, current_x + L, n_arrows).tolist()
                for x in x_positions:
                    elements.append({"type": "load_arrow", "x": x, "magnitude": mag, "load_type": "udl"})
                elements.append({"type": "load_label", "x": current_x + L/2, "text": f"{mag} kN/m"})
            elif load_type == "point":
                x = current_x + pos
                elements.append({"type": "load_arrow", "x": x, "magnitude": mag, "load_type": "point"})
                elements.append({"type": "load_label", "x": x, "text": f"{mag} kN"})
            elements.append({"type": "span_label", "x": current_x + L/2, "text": f"{L} m"})

        return {"elements": elements, "total_length": total_length}