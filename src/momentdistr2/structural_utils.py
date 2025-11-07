# utils/structural_utils.py
import numpy as np
from typing import List, Tuple
import math

class StructuralCalculations:
    """Utility class for structural engineering calculations following BS standards"""
    
    @staticmethod
    def point_load_fem(P: float, a: float, L: float) -> Tuple[float, float]:
        """
        Calculate fixed end moments for point load
        P: Load magnitude (N)
        a: Distance from left end (m)
        L: Span length (m)
        Returns: (M_left, M_right) in N.m
        """
        b = L - a
        M_left = -P * a * b * b / (L * L)
        M_right = P * a * a * b / (L * L)
        return M_left, M_right
    
    @staticmethod
    def udl_fem(w: float, L: float) -> Tuple[float, float]:
        """
        Calculate fixed end moments for uniformly distributed load
        w: Load per unit length (N/m)
        L: Span length (m)
        Returns: (M_left, M_right) in N.m
        """
        M_left = -w * L * L / 12
        M_right = w * L * L / 12
        return M_left, M_right
    
    @staticmethod
    def partial_udl_fem(w: float, a: float, b: float, L: float) -> Tuple[float, float]:
        """
        Calculate fixed end moments for partial UDL
        w: Load per unit length (N/m)
        a: Start position from left (m)
        b: End position from left (m)
        L: Total span length (m)
        Returns: (M_left, M_right) in N.m
        """
        c = b - a  # Length of UDL
        x = a + c/2  # Position of resultant load
        P = w * c  # Total load
        
        return StructuralCalculations.point_load_fem(P, x, L)
    
    @staticmethod
    def varying_load_fem(w1: float, w2: float, a: float, b: float, L: float) -> Tuple[float, float]:
        """
        Calculate fixed end moments for linearly varying load
        w1: Load intensity at start (N/m)
        w2: Load intensity at end (N/m)
        a: Start position from left (m)
        b: End position from left (m)
        L: Total span length (m)
        Returns: (M_left, M_right) in N.m
        """
        c = b - a  # Length of varying load
        
        # Equivalent uniform load
        w_avg = (w1 + w2) / 2
        P_uniform = w_avg * c
        x_uniform = a + c/2
        
        # Triangular component
        w_tri = abs(w2 - w1)
        P_tri = w_tri * c / 2
        
        if w2 > w1:
            # Increasing load
            x_tri = a + 2*c/3
        else:
            # Decreasing load
            x_tri = a + c/3
        
        # Combine effects
        M1_uniform, M2_uniform = StructuralCalculations.point_load_fem(P_uniform, x_uniform, L)
        M1_tri, M2_tri = StructuralCalculations.point_load_fem(P_tri, x_tri, L)
        
        return M1_uniform + M1_tri, M2_uniform + M2_tri
    
    @staticmethod
    def applied_moment_fem(M: float, a: float, L: float) -> Tuple[float, float]:
        """
        Calculate fixed end moments for applied moment
        M: Applied moment (N.m, positive counterclockwise)
        a: Distance from left end (m)
        L: Span length (m)
        Returns: (M_left, M_right) in N.m
        """
        b = L - a
        M_left = -M * b / L
        M_right = M * a / L
        return M_left, M_right
    
    @staticmethod
    def beam_stiffness(E: float, I: float, L: float) -> float:
        """
        Calculate beam stiffness factor
        E: Young's modulus (Pa)
        I: Second moment of area (m^4)
        L: Length (m)
        Returns: Stiffness factor (N.m)
        """
        return 4 * E * I / L
    
    @staticmethod
    def distribution_factor(k_i: float, sum_k: float) -> float:
        """
        Calculate distribution factor at a joint
        k_i: Stiffness of member i
        sum_k: Sum of all stiffnesses at the joint
        Returns: Distribution factor
        """
        if sum_k == 0:
            return 0
        return k_i / sum_k
    
    @staticmethod
    def carry_over_factor() -> float:
        """
        Standard carry-over factor for prismatic members
        Returns: 0.5 for standard beams
        """
        return 0.5
    
    @staticmethod
    def deflection_point_load(P: float, a: float, x: float, L: float, E: float, I: float) -> float:
        """
        Calculate deflection at point x due to point load P at position a
        Using standard beam deflection formulas
        """
        b = L - a
        
        if x <= a:
            # Point is to the left of load
            delta = P * b * x * (L*L - b*b - x*x) / (6 * E * I * L)
        else:
            # Point is to the right of load
            delta = P * a * (L - x) * (2*L*x - x*x - a*a) / (6 * E * I * L)
        
        return delta
    
    @staticmethod
    def deflection_udl(w: float, x: float, L: float, E: float, I: float) -> float:
        """
        Calculate deflection at point x due to UDL w over entire span
        """
        delta = w * x * (L*L*L - 2*L*x*x + x*x*x) / (24 * E * I)
        return delta
    
    @staticmethod
    def slope_point_load(P: float, a: float, x: float, L: float, E: float, I: float) -> float:
        """
        Calculate slope at point x due to point load P at position a
        """
        b = L - a
        
        if x <= a:
            # Point is to the left of load
            theta = P * b * (L*L - b*b - 3*x*x) / (6 * E * I * L)
        else:
            # Point is to the right of load
            theta = P * a * (L*L - a*a - 3*(L-x)*(L-x)) / (6 * E * I * L)
        
        return theta
    
    @staticmethod
    def validate_beam_geometry(spans: List[float], supports: List[str]) -> bool:
        """
        Validate basic beam geometry requirements
        """
        if len(supports) != len(spans) + 1:
            return False
        
        if any(span <= 0 for span in spans):
            return False
        
        return True
    
    @staticmethod
    def calculate_natural_frequency(E: float, I: float, rho: float, A: float, L: float, mode: int = 1) -> float:
        """
        Calculate natural frequency of simply supported beam
        E: Young's modulus (Pa)
        I: Second moment of area (m^4)
        rho: Density (kg/m^3)
        A: Cross-sectional area (m^2)
        L: Length (m)
        mode: Mode number (1, 2, 3, ...)
        """
        lambda_n = mode * math.pi
        omega = (lambda_n / L)**2 * math.sqrt(E * I / (rho * A))
        frequency = omega / (2 * math.pi)
        return frequency