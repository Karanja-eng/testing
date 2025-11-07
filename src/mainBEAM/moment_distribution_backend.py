"""
Moment Distribution Method (Hardy Cross Method) Implementation
Professional structural analysis for continuous beams and frames
Integrated with Three-Moment Theorem and BS 8110 Design
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Dict, Optional, Union, Tuple
from enum import Enum
import numpy as np
import math
import copy


# Enums for Moment Distribution Method
class MemberType(str, Enum):
    BEAM = "Beam"
    COLUMN = "Column"


class EndCondition(str, Enum):
    FIXED = "Fixed"
    PINNED = "Pinned"
    FREE = "Free"


class JointType(str, Enum):
    FIXED_JOINT = "Fixed Joint"
    PINNED_JOINT = "Pinned Joint"
    FREE_END = "Free End"


# Pydantic Models for Moment Distribution
class LoadMD(BaseModel):
    """Load for moment distribution analysis"""

    load_type: str  # "Point", "UDL", "Partial UDL", "Triangular", "Trapezoidal"
    magnitude: float
    position: float = 0.0
    length: float = 0.0
    magnitude2: float = 0.0  # For trapezoidal loads


class MemberMD(BaseModel):
    """Member for moment distribution analysis"""

    member_id: str
    member_type: MemberType
    start_joint_id: str
    end_joint_id: str
    length: float  # m
    E: float = 200e9  # Pa
    I: float = 1e-6  # m^4
    start_condition: EndCondition = EndCondition.FIXED
    end_condition: EndCondition = EndCondition.FIXED
    loads: List[LoadMD] = []

    @validator("length", "E", "I")
    def positive_values(cls, v):
        if v <= 0:
            raise ValueError("Length, E, and I must be positive")
        return v


class JointMD(BaseModel):
    """Joint for moment distribution analysis"""

    joint_id: str
    joint_type: JointType
    x_coordinate: float = 0.0
    y_coordinate: float = 0.0
    is_support: bool = False


class FrameMD(BaseModel):
    """Frame structure for moment distribution analysis"""

    joints: List[JointMD]
    members: List[MemberMD]
    convergence_tolerance: float = 0.001
    max_iterations: int = 50


class MomentDistributionResponse(BaseModel):
    """Response from moment distribution analysis"""

    final_moments: Dict[
        str, Dict[str, float]
    ]  # member_id -> {start: moment, end: moment}
    fixed_end_moments: Dict[str, Dict[str, float]]
    distribution_factors: Dict[str, Dict[str, float]]  # joint_id -> {member_id: factor}
    iteration_history: List[Dict]
    support_reactions: Dict[str, Dict[str, float]]  # joint_id -> {Fx, Fy, Mz}
    shear_force_data: Dict[str, List[Dict]]  # member_id -> [{x, y}]
    moment_data: Dict[str, List[Dict]]  # member_id -> [{x, y}]
    deflection_data: Dict[str, List[Dict]]  # member_id -> [{x, y}]
    convergence_achieved: bool
    iterations_performed: int
    analysis_summary: List[str]


class MomentDistributionSolver:
    """Hardy Cross Moment Distribution Method solver"""

    def __init__(self, frame: FrameMD):
        self.frame = frame
        self.joints = {joint.joint_id: joint for joint in frame.joints}
        self.members = {member.member_id: member for member in frame.members}
        self.member_connectivity = self._build_connectivity()

        # Analysis results
        self.fixed_end_moments = {}
        self.stiffness_factors = {}
        self.distribution_factors = {}
        self.final_moments = {}
        self.support_reactions = {}
        self.iteration_history = []
        self.analysis_summary = []

    def _build_connectivity(self) -> Dict[str, List[str]]:
        """Build joint-member connectivity"""
        connectivity = {}
        for joint_id in self.joints.keys():
            connectivity[joint_id] = []

        for member in self.members.values():
            connectivity[member.start_joint_id].append(member.member_id)
            connectivity[member.end_joint_id].append(member.member_id)

        return connectivity

    def solve(self) -> MomentDistributionResponse:
        """Main solving method using Hardy Cross procedure"""

        self.analysis_summary.append("=== MOMENT DISTRIBUTION METHOD ANALYSIS ===")
        self.analysis_summary.append("Hardy Cross Iterative Procedure")
        self.analysis_summary.append("")

        # Step 1: Calculate fixed-end moments
        self._calculate_fixed_end_moments()

        # Step 2: Calculate stiffness factors
        self._calculate_stiffness_factors()

        # Step 3: Calculate distribution factors
        self._calculate_distribution_factors()

        # Step 4: Perform moment distribution iterations
        self._perform_moment_distribution()

        # Step 5: Calculate support reactions
        self._calculate_support_reactions()

        # Step 6: Generate member force diagrams
        shear_data, moment_data, deflection_data = self._generate_member_diagrams()

        return MomentDistributionResponse(
            final_moments=self.final_moments,
            fixed_end_moments=self.fixed_end_moments,
            distribution_factors=self.distribution_factors,
            iteration_history=self.iteration_history,
            support_reactions=self.support_reactions,
            shear_force_data=shear_data,
            moment_data=moment_data,
            deflection_data=deflection_data,
            convergence_achieved=len(self.iteration_history)
            < self.frame.max_iterations,
            iterations_performed=len(self.iteration_history),
            analysis_summary=self.analysis_summary,
        )

    def _calculate_fixed_end_moments(self):
        """Calculate fixed-end moments for all loaded members"""

        self.analysis_summary.append("STEP 1: FIXED-END MOMENTS CALCULATION")
        self.analysis_summary.append("-" * 50)

        for member_id, member in self.members.items():
            fem_start, fem_end = self._calculate_member_fem(member)

            self.fixed_end_moments[member_id] = {"start": fem_start, "end": fem_end}

            if abs(fem_start) > 1e-6 or abs(fem_end) > 1e-6:
                self.analysis_summary.append(f"Member {member_id}:")
                self.analysis_summary.append(f"  FEM_start = {fem_start:.2f} kN⋅m")
                self.analysis_summary.append(f"  FEM_end = {fem_end:.2f} kN⋅m")

        self.analysis_summary.append("")

    def _calculate_member_fem(self, member: MemberMD) -> Tuple[float, float]:
        """Calculate fixed-end moments for a single member"""

        fem_start = 0.0
        fem_end = 0.0
        L = member.length

        for load in member.loads:
            if load.load_type == "Point":
                # Point load: P at distance 'a' from start
                P = load.magnitude
                a = load.position
                b = L - a

                # Fixed-end moments for point load
                fem_start += -P * a * b**2 / L**2
                fem_end += P * a**2 * b / L**2

            elif load.load_type == "UDL":
                # Uniformly distributed load over entire span
                w = load.magnitude
                fem_start += -w * L**2 / 12
                fem_end += w * L**2 / 12

            elif load.load_type == "Partial UDL":
                # Partial UDL: w over length 'c' starting at distance 'a'
                w = load.magnitude
                a = load.position
                c = load.length

                # Convert to equivalent point load at centroid
                P_eq = w * c
                x_centroid = a + c / 2

                # Apply point load formula
                a_eq = x_centroid
                b_eq = L - a_eq
                fem_start += -P_eq * a_eq * b_eq**2 / L**2
                fem_end += P_eq * a_eq**2 * b_eq / L**2

            elif load.load_type == "Triangular":
                # Triangular load: zero at 'a', max 'w' at 'a+c'
                w = load.magnitude
                a = load.position
                c = load.length

                # Equivalent point load
                P_eq = w * c / 2
                x_centroid = a + 2 * c / 3

                a_eq = x_centroid
                b_eq = L - a_eq
                if b_eq > 0:
                    fem_start += -P_eq * a_eq * b_eq**2 / L**2
                    fem_end += P_eq * a_eq**2 * b_eq / L**2

            elif load.load_type == "Trapezoidal":
                # Trapezoidal load: w1 at 'a', w2 at 'a+c'
                w1 = load.magnitude
                w2 = load.magnitude2
                a = load.position
                c = load.length

                # Split into rectangular and triangular parts
                w_rect = min(w1, w2)
                w_tri = abs(w2 - w1)

                # Rectangular part
                P_rect = w_rect * c
                x_rect = a + c / 2
                a_eq = x_rect
                b_eq = L - a_eq
                if b_eq > 0:
                    fem_start += -P_rect * a_eq * b_eq**2 / L**2
                    fem_end += P_rect * a_eq**2 * b_eq / L**2

                # Triangular part
                P_tri = w_tri * c / 2
                if w2 > w1:  # Triangle points right
                    x_tri = a + 2 * c / 3
                else:  # Triangle points left
                    x_tri = a + c / 3

                a_eq = x_tri
                b_eq = L - a_eq
                if b_eq > 0:
                    fem_start += -P_tri * a_eq * b_eq**2 / L**2
                    fem_end += P_tri * a_eq**2 * b_eq / L**2

        # Apply end condition modifications
        if member.start_condition == EndCondition.PINNED:
            fem_end += fem_start
            fem_start = 0.0
        elif member.end_condition == EndCondition.PINNED:
            fem_start += fem_end
            fem_end = 0.0

        return fem_start, fem_end

    def _calculate_stiffness_factors(self):
        """Calculate relative stiffness factors for all members"""

        self.analysis_summary.append("STEP 2: STIFFNESS FACTORS CALCULATION")
        self.analysis_summary.append("-" * 50)

        for member_id, member in self.members.items():
            # Relative stiffness K = I/L (assuming same E for all members)
            K = member.I / member.length

            # Modify for end conditions
            if (
                member.start_condition == EndCondition.PINNED
                or member.end_condition == EndCondition.PINNED
            ):
                K *= 0.75  # Reduction factor for pinned ends

            self.stiffness_factors[member_id] = {"start": K, "end": K}

            self.analysis_summary.append(f"Member {member_id}: K = {K:.2e} (I/L)")

        self.analysis_summary.append("")

    def _calculate_distribution_factors(self):
        """Calculate distribution factors at each joint"""

        self.analysis_summary.append("STEP 3: DISTRIBUTION FACTORS CALCULATION")
        self.analysis_summary.append("-" * 50)

        for joint_id, joint in self.joints.items():
            if joint.joint_type == JointType.FIXED_JOINT:
                # Calculate sum of stiffnesses at this joint
                connected_members = self.member_connectivity[joint_id]
                total_stiffness = 0.0
                member_stiffnesses = {}

                for member_id in connected_members:
                    member = self.members[member_id]
                    if member.start_joint_id == joint_id:
                        stiffness = self.stiffness_factors[member_id]["start"]
                    else:
                        stiffness = self.stiffness_factors[member_id]["end"]

                    member_stiffnesses[member_id] = stiffness
                    total_stiffness += stiffness

                # Calculate distribution factors
                distribution_factors = {}
                for member_id, stiffness in member_stiffnesses.items():
                    if total_stiffness > 0:
                        distribution_factors[member_id] = stiffness / total_stiffness
                    else:
                        distribution_factors[member_id] = 0.0

                self.distribution_factors[joint_id] = distribution_factors

                self.analysis_summary.append(f"Joint {joint_id}:")
                for member_id, df in distribution_factors.items():
                    self.analysis_summary.append(f"  Member {member_id}: DF = {df:.3f}")

            else:
                # Pinned joints don't distribute moments
                self.distribution_factors[joint_id] = {}

        self.analysis_summary.append("")

    def _perform_moment_distribution(self):
        """Perform Hardy Cross moment distribution iterations"""

        self.analysis_summary.append("STEP 4: MOMENT DISTRIBUTION ITERATIONS")
        self.analysis_summary.append("-" * 50)

        # Initialize moment arrays
        # moments[joint_id][member_id] = moment at joint for member
        moments = {}
        for joint_id in self.joints.keys():
            moments[joint_id] = {}
            for member_id in self.member_connectivity[joint_id]:
                moments[joint_id][member_id] = 0.0

        # Add fixed-end moments to initial state
        for member_id, fem in self.fixed_end_moments.items():
            member = self.members[member_id]
            start_joint = member.start_joint_id
            end_joint = member.end_joint_id

            moments[start_joint][member_id] = fem["start"]
            moments[end_joint][member_id] = fem["end"]

        # Store initial state
        self.iteration_history.append(
            {
                "iteration": 0,
                "type": "Initial FEM",
                "moments": copy.deepcopy(moments),
                "unbalanced_moments": self._calculate_unbalanced_moments(moments),
            }
        )

        # Iterative distribution process
        for iteration in range(1, self.frame.max_iterations + 1):
            max_unbalance = 0.0
            iteration_changes = {}

            # Check each joint for unbalanced moments
            for joint_id, joint in self.joints.items():
                if joint.joint_type == JointType.FIXED_JOINT:
                    # Calculate unbalanced moment at joint
                    unbalanced_moment = 0.0
                    for member_id in self.member_connectivity[joint_id]:
                        unbalanced_moment += moments[joint_id][member_id]

                    max_unbalance = max(max_unbalance, abs(unbalanced_moment))

                    if abs(unbalanced_moment) > self.frame.convergence_tolerance:
                        # Distribute unbalanced moment
                        distributed_moments = {}
                        for member_id in self.member_connectivity[joint_id]:
                            if member_id in self.distribution_factors[joint_id]:
                                df = self.distribution_factors[joint_id][member_id]
                                distributed_moment = -unbalanced_moment * df
                                moments[joint_id][member_id] += distributed_moment
                                distributed_moments[member_id] = distributed_moment

                        iteration_changes[joint_id] = {
                            "unbalanced_moment": unbalanced_moment,
                            "distributed_moments": distributed_moments,
                        }

                        # Carry-over moments to far ends
                        for member_id, dist_moment in distributed_moments.items():
                            member = self.members[member_id]
                            if member.start_joint_id == joint_id:
                                far_joint = member.end_joint_id
                            else:
                                far_joint = member.start_joint_id

                            # Carry-over factor is 0.5 for fixed-fixed members, 0 for pinned ends
                            carry_over_factor = 0.5
                            if (
                                member.start_condition == EndCondition.PINNED
                                or member.end_condition == EndCondition.PINNED
                            ):
                                carry_over_factor = 0.0

                            carry_over_moment = dist_moment * carry_over_factor
                            moments[far_joint][member_id] += carry_over_moment

            # Store iteration results
            self.iteration_history.append(
                {
                    "iteration": iteration,
                    "type": "Distribution",
                    "moments": copy.deepcopy(moments),
                    "unbalanced_moments": self._calculate_unbalanced_moments(moments),
                    "max_unbalance": max_unbalance,
                    "changes": iteration_changes,
                }
            )

            self.analysis_summary.append(
                f"Iteration {iteration}: Max unbalance = {max_unbalance:.6f} kN⋅m"
            )

            # Check convergence
            if max_unbalance < self.frame.convergence_tolerance:
                self.analysis_summary.append(
                    f"Convergence achieved in {iteration} iterations"
                )
                break

        else:
            self.analysis_summary.append(
                f"Maximum iterations ({self.frame.max_iterations}) reached"
            )

        # Store final moments
        for member_id, member in self.members.items():
            start_joint = member.start_joint_id
            end_joint = member.end_joint_id

            self.final_moments[member_id] = {
                "start": moments[start_joint][member_id],
                "end": moments[end_joint][member_id],
            }

        self.analysis_summary.append("")

    def _calculate_unbalanced_moments(self, moments: Dict) -> Dict[str, float]:
        """Calculate unbalanced moments at each joint"""
        unbalanced = {}
        for joint_id in self.joints.keys():
            unbalance = 0.0
            for member_id in self.member_connectivity[joint_id]:
                unbalance += moments[joint_id][member_id]
            unbalanced[joint_id] = unbalance
        return unbalanced

    def _calculate_support_reactions(self):
        """Calculate support reactions at fixed joints"""

        self.analysis_summary.append("STEP 5: SUPPORT REACTIONS CALCULATION")
        self.analysis_summary.append("-" * 50)

        for joint_id, joint in self.joints.items():
            if joint.is_support:
                reactions = {"Fx": 0.0, "Fy": 0.0, "Mz": 0.0}

                # Sum moments at support
                moment_reaction = 0.0
                for member_id in self.member_connectivity[joint_id]:
                    moment_reaction += (
                        self.final_moments[member_id]["start"]
                        if self.members[member_id].start_joint_id == joint_id
                        else self.final_moments[member_id]["end"]
                    )

                reactions["Mz"] = moment_reaction

                # Calculate force reactions from member end forces
                for member_id in self.member_connectivity[joint_id]:
                    member = self.members[member_id]
                    is_start = member.start_joint_id == joint_id

                    # Calculate member end forces
                    V_end, N_end = self._calculate_member_end_forces(
                        member_id, is_start
                    )

                    if member.member_type == MemberType.BEAM:
                        reactions["Fy"] += V_end
                        reactions["Fx"] += N_end
                    else:  # COLUMN
                        reactions["Fx"] += V_end
                        reactions["Fy"] += N_end

                self.support_reactions[joint_id] = reactions

                self.analysis_summary.append(f"Support {joint_id}:")
                self.analysis_summary.append(f"  Fx = {reactions['Fx']:.2f} kN")
                self.analysis_summary.append(f"  Fy = {reactions['Fy']:.2f} kN")
                self.analysis_summary.append(f"  Mz = {reactions['Mz']:.2f} kN⋅m")

        self.analysis_summary.append("")

    def _calculate_member_end_forces(
        self, member_id: str, is_start: bool
    ) -> Tuple[float, float]:
        """Calculate shear and axial forces at member end"""
        member = self.members[member_id]

        # Get moments at member ends
        M_start = self.final_moments[member_id]["start"]
        M_end = self.final_moments[member_id]["end"]

        # Calculate equivalent joint loads from applied loads
        V_loads = 0.0  # Shear from applied loads
        N_loads = 0.0  # Axial force from applied loads

        for load in member.loads:
            if load.load_type == "UDL" and member.member_type == MemberType.BEAM:
                w = load.magnitude
                V_loads += w * member.length / 2
            elif load.load_type == "Point" and member.member_type == MemberType.BEAM:
                P = load.magnitude
                a = load.position
                if is_start:
                    V_loads += P * (member.length - a) / member.length
                else:
                    V_loads += P * a / member.length

        # Add forces from moments
        V_moments = (M_start - M_end) / member.length

        # Total end forces
        if is_start:
            V_end = V_loads + V_moments
        else:
            V_end = V_loads - V_moments

        return V_end, N_loads

    def _generate_member_diagrams(self) -> Tuple[Dict, Dict, Dict]:
        """Generate shear, moment, and deflection diagrams for all members"""

        shear_data = {}
        moment_data = {}
        deflection_data = {}

        for member_id, member in self.members.items():
            # Generate points along member
            n_points = 50
            x_points = np.linspace(0, member.length, n_points)

            shear_values = []
            moment_values = []
            deflection_values = []

            for x in x_points:
                # Calculate shear force at x
                V = self._calculate_member_shear(member_id, x)
                shear_values.append(V)

                # Calculate bending moment at x
                M = self._calculate_member_moment(member_id, x)
                moment_values.append(M)

                # Calculate deflection at x (simplified)
                delta = self._calculate_member_deflection(member_id, x)
                deflection_values.append(delta)

            # Format data for frontend
            shear_data[member_id] = [
                {"x": float(x), "y": float(V)} for x, V in zip(x_points, shear_values)
            ]
            moment_data[member_id] = [
                {"x": float(x), "y": float(M)} for x, M in zip(x_points, moment_values)
            ]
            deflection_data[member_id] = [
                {"x": float(x), "y": float(delta)}
                for x, delta in zip(x_points, deflection_values)
            ]

        return shear_data, moment_data, deflection_data

    def _calculate_member_shear(self, member_id: str, x: float) -> float:
        """Calculate shear force at distance x from start of member"""
        member = self.members[member_id]

        # Start with end moments contribution
        M_start = self.final_moments[member_id]["start"]
        M_end = self.final_moments[member_id]["end"]

        V_moments = (M_start - M_end) / member.length

        # Add load contributions
        V_loads = 0.0
        for load in member.loads:
            if load.load_type == "Point":
                if load.position <= x:
                    V_loads -= load.magnitude
            elif load.load_type == "UDL":
                V_loads -= load.magnitude * x
            # Add other load types as needed

        return V_moments + V_loads

    def _calculate_member_moment(self, member_id: str, x: float) -> float:
        """Calculate bending moment at distance x from start of member"""
        member = self.members[member_id]

        # Start with end moment and linear interpolation
        M_start = self.final_moments[member_id]["start"]
        M_end = self.final_moments[member_id]["end"]

        # Linear moment from end moments
        M_linear = M_start + (M_end - M_start) * x / member.length

        # Add load-induced moments
        M_loads = 0.0

        # Calculate reaction at start due to loads
        V_start_loads = 0.0
        for load in member.loads:
            if load.load_type == "Point":
                P = load.magnitude
                a = load.position
                V_start_loads += P * (member.length - a) / member.length
            elif load.load_type == "UDL":
                w = load.magnitude
                V_start_loads += w * member.length / 2

        # Moment from start reaction
        M_loads += V_start_loads * x

        # Subtract moments from loads to the left of x
        for load in member.loads:
            if load.load_type == "Point":
                if load.position <= x:
                    M_loads -= load.magnitude * (x - load.position)
            elif load.load_type == "UDL":
                M_loads -= load.magnitude * x**2 / 2

        return M_linear + M_loads

    def _calculate_member_deflection(self, member_id: str, x: float) -> float:
        """Calculate deflection at distance x from start of member (simplified)"""
        member = self.members[member_id]

        # This is a simplified deflection calculation
        # For accurate deflection, numerical integration would be required

        L = member.length
        E = member.E
        I = member.I

        # Use simplified formula for uniformly loaded beam with end moments
        # This is an approximation

        total_load = sum(
            load.magnitude * (load.length if load.load_type != "Point" else 1)
            for load in member.loads
        )

        if total_load == 0:
            return 0.0

        # Simplified deflection formula
        w_equiv = total_load / L if L > 0 else 0

        # Maximum deflection approximation
        delta_max = w_equiv * L**4 / (384 * E * I) if E * I > 0 else 0

        # Parabolic distribution approximation
        xi = x / L if L > 0 else 0
        delta = delta_max * 4 * xi * (1 - xi) * (1 - xi**2)

        return delta


app = FastAPI(
    title="Structural Engineering Suite",
    description="Complete Three-Moment Theorem Analysis with BS 8110 Reinforced Concrete Design",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)
# # API Integration Functions
# def add_moment_distribution_endpoints(app: FastAPI):
#     """Add moment distribution endpoints to FastAPI app"""


@app.post("/analyze_moment_distribution", response_model=MomentDistributionResponse)
async def analyze_moment_distribution(frame: FrameMD):
    """Analyze frame using Moment Distribution Method"""
    try:
        solver = MomentDistributionSolver(frame)
        return solver.solve()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/moment_distribution_examples")
async def get_moment_distribution_examples():
    """Get example frame configurations"""
    examples = [
        {
            "name": "Two-Span Continuous Beam",
            "description": "Simple continuous beam with UDL",
            "joints": [
                {
                    "joint_id": "A",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 0.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
                {
                    "joint_id": "B",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 6.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
                {
                    "joint_id": "C",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 12.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
            ],
            "members": [
                {
                    "member_id": "AB",
                    "member_type": "Beam",
                    "start_joint_id": "A",
                    "end_joint_id": "B",
                    "length": 6.0,
                    "E": 200e9,
                    "I": 8.33e-6,
                    "loads": [{"load_type": "UDL", "magnitude": 15.0}],
                }
            ],
            "convergence_tolerance": 0.001,
            "max_iterations": 50,
        },
        {
            "name": "Portal Frame",
            "description": "Simple portal frame with lateral and vertical loads",
            "joints": [
                {
                    "joint_id": "A",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 0.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
                {
                    "joint_id": "B",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 0.0,
                    "y_coordinate": 4.0,
                    "is_support": False,
                },
                {
                    "joint_id": "C",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 8.0,
                    "y_coordinate": 4.0,
                    "is_support": False,
                },
                {
                    "joint_id": "D",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 8.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
            ],
            "members": [
                {
                    "member_id": "AB",
                    "member_type": "Column",
                    "start_joint_id": "A",
                    "end_joint_id": "B",
                    "length": 4.0,
                    "E": 200e9,
                    "I": 5e-6,
                    "loads": [],
                },
                {
                    "member_id": "BC",
                    "member_type": "Beam",
                    "start_joint_id": "B",
                    "end_joint_id": "C",
                    "length": 8.0,
                    "E": 200e9,
                    "I": 1e-5,
                    "loads": [{"load_type": "UDL", "magnitude": 25.0}],
                },
                {
                    "member_id": "CD",
                    "member_type": "Column",
                    "start_joint_id": "C",
                    "end_joint_id": "D",
                    "length": 4.0,
                    "E": 200e9,
                    "I": 5e-6,
                    "loads": [],
                },
            ],
            "convergence_tolerance": 0.001,
            "max_iterations": 50,
        },
        {
            "name": "Multi-Span Continuous Beam",
            "description": "Three-span continuous beam with different loads",
            "joints": [
                {
                    "joint_id": "A",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 0.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
                {
                    "joint_id": "B",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 5.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
                {
                    "joint_id": "C",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 10.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
                {
                    "joint_id": "D",
                    "joint_type": "Fixed Joint",
                    "x_coordinate": 15.0,
                    "y_coordinate": 0.0,
                    "is_support": True,
                },
            ],
            "members": [
                {
                    "member_id": "AB",
                    "member_type": "Beam",
                    "start_joint_id": "A",
                    "end_joint_id": "B",
                    "length": 5.0,
                    "E": 200e9,
                    "I": 1e-5,
                    "loads": [
                        {"load_type": "Point", "magnitude": 100.0, "position": 2.5}
                    ],
                },
                {
                    "member_id": "BC",
                    "member_type": "Beam",
                    "start_joint_id": "B",
                    "end_joint_id": "C",
                    "length": 5.0,
                    "E": 200e9,
                    "I": 1e-5,
                    "loads": [{"load_type": "UDL", "magnitude": 30.0}],
                },
                {
                    "member_id": "CD",
                    "member_type": "Beam",
                    "start_joint_id": "C",
                    "end_joint_id": "D",
                    "length": 5.0,
                    "E": 200e9,
                    "I": 1e-5,
                    "loads": [
                        {
                            "load_type": "Triangular",
                            "magnitude": 40.0,
                            "position": 0.0,
                            "length": 3.0,
                        }
                    ],
                },
            ],
            "convergence_tolerance": 0.001,
            "max_iterations": 50,
        },
    ]
    return examples


@app.post("/integrate_md_analysis_design")
async def integrate_md_analysis_design(data: dict):
    """Integrate Moment Distribution analysis with BS 8110 beam design"""
    try:
        md_results = data.get("md_results")
        design_parameters = data.get("design_parameters")

        if not md_results or not design_parameters:
            raise ValueError("Both MD results and design parameters required")

        # Import BS8110 designer and models from the dedicated design module
        from beaamDesigner import (
            BS8110BeamDesigner as BS8110Designer,
            BeamDesignRequest,
            BeamType,
            SupportCondition,
            MaterialProperties,
            RectangularBeamGeometry,
            TBeamGeometry,
            LBeamGeometry,
        )

        designer = BS8110Designer()
        design_results = []

        # Process each member for design
        for member_id, moment_data in md_results.get("moment_data", {}).items():
            if not moment_data:
                continue

            # Extract design forces from MD results
            moments = [point["y"] for point in moment_data]
            positions = [point["x"] for point in moment_data]

            # Get shear data
            shear_data = md_results.get("shear_force_data", {}).get(member_id, [])
            shears = [point["y"] for point in shear_data] if shear_data else [0.0]

            # Get member length (from positions)
            member_length = max(positions) if positions else 6.0

            # Create design request
            design_request = BeamDesignRequest(
                beam_type=BeamType(design_parameters["beam_type"]),
                support_condition=SupportCondition(
                    design_parameters["support_condition"]
                ),
                span_length=member_length,
                design_moments=moments,
                design_shears=shears,
                moment_positions=positions,
                shear_positions=positions,
                imposed_load=design_parameters.get("imposed_load", 0.0),
                permanent_load=design_parameters.get("permanent_load", 0.0),
                materials=MaterialProperties(**design_parameters.get("materials", {})),
            )

            # Add geometry based on beam type
            if design_parameters["beam_type"] == "Rectangular":
                design_request.rectangular_geometry = RectangularBeamGeometry(
                    **design_parameters["rectangular_geometry"]
                )
            elif design_parameters["beam_type"] == "T-Beam":
                design_request.t_beam_geometry = TBeamGeometry(
                    **design_parameters["t_beam_geometry"]
                )
            elif design_parameters["beam_type"] == "L-Beam":
                design_request.l_beam_geometry = LBeamGeometry(
                    **design_parameters["l_beam_geometry"]
                )

            # Design the member
            member_design = designer.design_beam(design_request)
            # Convert Pydantic model to dict if necessary, then attach member_id
            if hasattr(member_design, "dict"):
                mdict = member_design.dict()
            else:
                mdict = member_design
            mdict["member_id"] = member_id
            design_results.append(mdict)

        return {
            "success": True,
            "member_designs": design_results,
            "summary": {
                "total_members": len(design_results),
                "beam_type": design_parameters["beam_type"],
                "all_designs_ok": all(
                    (
                        r.get("design_checks", {}).get("moment_capacity_ok", True)
                        and r.get("design_checks", {}).get("shear_capacity_ok", True)
                    )
                    for r in design_results
                ),
                "analysis_method": "Moment Distribution Method",
            },
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"MD Integration failed: {str(e)}")


# # Export for main app integration
# __all__ = [
#     "MomentDistributionSolver",
#     "FrameMD",
#     "MomentDistributionResponse",
#     "add_moment_distribution_endpoints",
# ]
