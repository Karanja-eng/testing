# services/beam_service.py
import numpy as np
from typing import List, Dict, Tuple
from beam_models import (
    BeamInput, BeamResults, MomentDistributionStep, 
    SupportType, PointLoad, UDLLoad, VaryingLoad, AppliedMoment
)
from structural_utils import StructuralCalculations

class BeamAnalysisService:
    def __init__(self):
        self.calc = StructuralCalculations()
        self.tolerance = 1e-6
        self.max_iterations = 100

    def analyze(self, beam_data: BeamInput) -> BeamResults:
        """Main analysis method using Moment Distribution Method"""
        
        # Validate input
        self.validate_input(beam_data)
        
        # Initialize analysis
        num_spans = len(beam_data.spans)
        num_joints = num_spans - 1
        
        # Calculate stiffness factors
        stiffness_factors = self._calculate_stiffness_factors(beam_data)
        
        # Calculate distribution factors
        distribution_factors = self._calculate_distribution_factors(
            stiffness_factors, beam_data.supports
        )
        
        # Calculate fixed end moments
        fem = self._calculate_fixed_end_moments(beam_data)
        
        # Perform moment distribution
        distribution_steps = []
        joint_moments = np.zeros(num_joints)
        member_moments = np.zeros((num_spans, 2))  # [span][left_end, right_end]
        
        # Initialize with FEMs
        for i in range(num_spans):
            member_moments[i, 0] = fem[i][0]  # Left end
            member_moments[i, 1] = fem[i][1]  # Right end
        
        # Moment distribution iterations
        converged = False
        iteration = 0
        
        while not converged and iteration < self.max_iterations:
            max_unbalanced = 0
            
            for joint_idx in range(num_joints):
                # Calculate unbalanced moment at joint
                unbalanced = self._calculate_unbalanced_moment(
                    joint_idx, member_moments, beam_data.supports
                )
                
                if abs(unbalanced) > self.tolerance:
                    max_unbalanced = max(max_unbalanced, abs(unbalanced))
                    
                    # Distribute moment
                    dist_factors = distribution_factors[joint_idx]
                    distributed = []
                    carry_over = []
                    
                    # Left member (if exists)
                    if joint_idx > 0:
                        dist_moment = -unbalanced * dist_factors[0]
                        distributed.append(dist_moment)
                        member_moments[joint_idx, 0] += dist_moment
                        
                        # Carry over to far end
                        carry_over_moment = dist_moment * 0.5
                        member_moments[joint_idx, 1] += carry_over_moment
                        carry_over.append(carry_over_moment)
                    else:
                        distributed.append(0)
                        carry_over.append(0)
                    
                    # Right member (if exists)
                    if joint_idx < num_spans - 1:
                        dist_moment = -unbalanced * dist_factors[1]
                        distributed.append(dist_moment)
                        member_moments[joint_idx + 1, 1] += dist_moment
                        
                        # Carry over to far end
                        carry_over_moment = dist_moment * 0.5
                        member_moments[joint_idx + 1, 0] += carry_over_moment
                        carry_over.append(carry_over_moment)
                    else:
                        distributed.append(0)
                        carry_over.append(0)
                    
                    # Record step
                    step = MomentDistributionStep(
                        iteration=iteration,
                        joint_index=joint_idx,
                        unbalanced_moment=unbalanced,
                        distribution_factors=dist_factors,
                        distributed_moments=distributed,
                        carry_over_moments=carry_over
                    )
                    distribution_steps.append(step)
            
            converged = max_unbalanced < self.tolerance
            iteration += 1
        
        # Calculate final moments at supports
        final_moments = self._extract_support_moments(member_moments, beam_data.supports)
        
        # Calculate support reactions
        support_reactions = self._calculate_support_reactions(beam_data, member_moments)
        
        # Calculate SFD and BMD values
        sfd_values, sfd_positions = self._calculate_sfd(beam_data, support_reactions, member_moments)
        bmd_values, bmd_positions = self._calculate_bmd(beam_data, member_moments)
        
        return BeamResults(
            distribution_steps=distribution_steps,
            final_moments=final_moments.tolist(),
            support_reactions=support_reactions.tolist(),
            sfd_values=sfd_values,
            bmd_values=bmd_values,
            sfd_positions=sfd_positions,
            bmd_positions=bmd_positions,
            convergence_achieved=converged,
            max_iterations=iteration
        )

    def validate_input(self, beam_data: BeamInput) -> Dict:
        """Validate input data"""
        if len(beam_data.spans) < 2:
            raise ValueError("Minimum 2 spans required for indeterminate analysis")
        
        if len(beam_data.supports) != len(beam_data.spans) + 1:
            raise ValueError("Number of supports must be spans + 1")
        
        # Check for minimum constraints
        fixed_supports = sum(1 for s in beam_data.supports if s == SupportType.FIXED)
        pinned_supports = sum(1 for s in beam_data.supports if s == SupportType.PINNED)
        roller_supports = sum(1 for s in beam_data.supports if s == SupportType.ROLLER)
        
        total_reactions = fixed_supports * 3 + pinned_supports * 2 + roller_supports * 1
        degrees_of_indeterminacy = total_reactions - 3  # For 2D beam
        
        if degrees_of_indeterminacy < 1:
            raise ValueError("Structure is not indeterminate")
        
        return {
            "spans": len(beam_data.spans),
            "supports": len(beam_data.supports),
            "degree_of_indeterminacy": degrees_of_indeterminacy
        }

    def _calculate_stiffness_factors(self, beam_data: BeamInput) -> List[List[float]]:
        """Calculate stiffness factors for each member"""
        E = beam_data.material.E * 1e6  # Convert MPa to Pa
        I = beam_data.material.I * 1e-12  # Convert mm^4 to m^4
        
        stiffness = []
        for i, length in enumerate(beam_data.spans):
            # Standard beam stiffness: 4EI/L for fixed ends, 3EI/L for pinned
            k = 4 * E * I / length
            stiffness.append([k, k])  # [left_stiffness, right_stiffness]
        
        return stiffness

    def _calculate_distribution_factors(self, stiffness_factors: List[List[float]], 
                                      supports: List[SupportType]) -> List[List[float]]:
        """Calculate distribution factors at each joint"""
        num_joints = len(supports) - 2
        dist_factors = []
        
        for joint_idx in range(num_joints):
            joint_idx_actual = joint_idx + 1  # Actual support index
            
            if supports[joint_idx_actual] == SupportType.FIXED:
                # Fixed support - no distribution
                dist_factors.append([0.0, 0.0])
            else:
                # Calculate total stiffness at joint
                left_stiffness = stiffness_factors[joint_idx][1] if joint_idx >= 0 else 0
                right_stiffness = stiffness_factors[joint_idx + 1][0] if joint_idx + 1 < len(stiffness_factors) else 0
                
                total_stiffness = left_stiffness + right_stiffness
                
                if total_stiffness > 0:
                    left_df = left_stiffness / total_stiffness
                    right_df = right_stiffness / total_stiffness
                else:
                    left_df = right_df = 0
                
                dist_factors.append([left_df, right_df])
        
        return dist_factors

    def _calculate_fixed_end_moments(self, beam_data: BeamInput) -> List[Tuple[float, float]]:
        """Calculate fixed end moments for all spans"""
        fem_list = []
        
        for span_idx, length in enumerate(beam_data.spans):
            fem_left = 0.0
            fem_right = 0.0
            
            # Point loads
            for load in beam_data.point_loads:
                if load.span_index == span_idx:
                    a = load.position
                    b = length - a
                    P = load.magnitude * 1000  # Convert kN to N
                    
                    # Fixed end moments for point load
                    fem_left += -P * a * b * b / (length * length)
                    fem_right += P * a * a * b / (length * length)
            
            # UDL loads
            for load in beam_data.udl_loads:
                if load.span_index == span_idx:
                    w = load.magnitude * 1000  # Convert kN/m to N/m
                    start = load.start_position
                    end = load.end_position
                    load_length = end - start
                    
                    # For uniformly distributed load
                    if start == 0 and end == length:
                        # Full span UDL
                        fem_left += -w * length * length / 12
                        fem_right += w * length * length / 12
                    else:
                        # Partial UDL - treat as equivalent point load at centroid
                        total_load = w * load_length
                        a = start + load_length / 2
                        b = length - a
                        
                        fem_left += -total_load * a * b * b / (length * length)
                        fem_right += total_load * a * a * b / (length * length)
            
            # Applied moments
            for moment in beam_data.applied_moments:
                if moment.span_index == span_idx:
                    M = moment.magnitude * 1000  # Convert kN.m to N.m
                    a = moment.position
                    b = length - a
                    
                    # Fixed end moments for applied moment
                    fem_left += -M * b / length
                    fem_right += M * a / length
            
            fem_list.append((fem_left, fem_right))
        
        return fem_list

    def _calculate_unbalanced_moment(self, joint_idx: int, member_moments: np.ndarray, 
                                   supports: List[SupportType]) -> float:
        """Calculate unbalanced moment at a joint"""
        joint_support_idx = joint_idx + 1
        
        if supports[joint_support_idx] == SupportType.FIXED:
            return 0.0  # Fixed supports don't allow rotation
        
        # Sum moments from connected members
        unbalanced = 0.0
        
        # Left member
        if joint_idx >= 0:
            unbalanced += member_moments[joint_idx, 1]  # Right end of left span
        
        # Right member
        if joint_idx + 1 < len(member_moments):
            unbalanced += member_moments[joint_idx + 1, 0]  # Left end of right span
        
        return unbalanced

    def _extract_support_moments(self, member_moments: np.ndarray, 
                               supports: List[SupportType]) -> np.ndarray:
        """Extract final moments at support locations"""
        num_supports = len(supports)
        support_moments = np.zeros(num_supports)
        
        for i in range(num_supports):
            if supports[i] == SupportType.FIXED:
                if i == 0:
                    # First support - left end of first span
                    support_moments[i] = member_moments[0, 0]
                elif i == num_supports - 1:
                    # Last support - right end of last span
                    support_moments[i] = member_moments[-1, 1]
                else:
                    # Intermediate support - average of connected members
                    left_moment = member_moments[i-1, 1]
                    right_moment = member_moments[i, 0]
                    support_moments[i] = (left_moment + right_moment) / 2
            # Pinned and roller supports have zero moment
        
        return support_moments

    def _calculate_support_reactions(self, beam_data: BeamInput, 
                                   member_moments: np.ndarray) -> np.ndarray:
        """Calculate vertical reactions at supports"""
        num_supports = len(beam_data.supports)
        reactions = np.zeros(num_supports)
        
        for span_idx, length in enumerate(beam_data.spans):
            left_moment = member_moments[span_idx, 0]
            right_moment = member_moments[span_idx, 1]
            
            # Calculate equivalent loads and reactions for this span
            span_load = 0.0  # Total load on span
            span_moment = 0.0  # Total moment from loads about left end
            
            # Point loads
            for load in beam_data.point_loads:
                if load.span_index == span_idx:
                    P = load.magnitude * 1000  # Convert to N
                    a = load.position
                    span_load += P
                    span_moment += P * a
            
            # UDL loads
            for load in beam_data.udl_loads:
                if load.span_index == span_idx:
                    w = load.magnitude * 1000  # Convert to N/m
                    start = load.start_position
                    end = load.end_position
                    load_length = end - start
                    total_load = w * load_length
                    centroid = start + load_length / 2
                    
                    span_load += total_load
                    span_moment += total_load * centroid
            
            # Calculate reactions using equilibrium
            # Sum of moments about left end = 0
            right_reaction = (span_moment + left_moment - right_moment) / length
            left_reaction = span_load - right_reaction
            
            reactions[span_idx] += left_reaction
            reactions[span_idx + 1] += right_reaction
        
        return reactions / 1000  # Convert back to kN

    def _calculate_sfd(self, beam_data: BeamInput, reactions: np.ndarray, 
                      member_moments: np.ndarray) -> Tuple[List[List[float]], List[List[float]]]:
        """Calculate shear force diagram values"""
        sfd_values = []
        sfd_positions = []
        
        for span_idx, length in enumerate(beam_data.spans):
            positions = np.linspace(0, length, 101)  # 101 points for smooth curve
            shear_forces = []
            
            left_reaction = reactions[span_idx]
            running_shear = left_reaction
            
            for x in positions:
                shear = running_shear
                
                # Subtract point loads passed
                for load in beam_data.point_loads:
                    if load.span_index == span_idx and load.position <= x:
                        shear -= load.magnitude
                
                # Subtract UDL loads
                for load in beam_data.udl_loads:
                    if load.span_index == span_idx:
                        if x >= load.start_position:
                            if x <= load.end_position:
                                # Within UDL range
                                udl_length = x - load.start_position
                            else:
                                # Past UDL end
                                udl_length = load.end_position - load.start_position
                            shear -= load.magnitude * udl_length
                
                shear_forces.append(shear)
            
            sfd_values.append(shear_forces)
            sfd_positions.append(positions.tolist())
        
        return sfd_values, sfd_positions

    def _calculate_bmd(self, beam_data: BeamInput, 
                      member_moments: np.ndarray) -> Tuple[List[List[float]], List[List[float]]]:
        """Calculate bending moment diagram values"""
        bmd_values = []
        bmd_positions = []
        
        # This is simplified - full implementation would integrate SFD
        for span_idx, length in enumerate(beam_data.spans):
            positions = np.linspace(0, length, 101)
            moments = []
            
            left_moment = member_moments[span_idx, 0] / 1000  # Convert to kN.m
            right_moment = member_moments[span_idx, 1] / 1000
            
            # Linear interpolation between end moments (simplified)
            for x in positions:
                # This is a simplified calculation
                # Full implementation would properly integrate loads
                factor = x / length
                moment = left_moment * (1 - factor) + right_moment * factor
                moments.append(moment)
            
            bmd_values.append(moments)
            bmd_positions.append(positions.tolist())
        
        return bmd_values, bmd_positions