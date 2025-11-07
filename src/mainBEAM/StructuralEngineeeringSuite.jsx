import React, { useState } from "react";
import {
  Settings,
  GitBranch,
  Calculator,
  Award,
  BookOpen,
  Zap,
  Users,
  Building2,
  ChevronRight,
  ArrowLeft,
  Info,
} from "lucide-react";

// Import the individual analysis components
import MomentDistributionCalculator from "./distribution";
import EnhancedThreeMomentCalculator from "./Three";

const StructuralEngineeeringSuite = () => {
  const [currentView, setCurrentView] = useState("landing");
  const [selectedMethod, setSelectedMethod] = useState(null);

  const analysisMethod = [
    {
      id: "three-moment",
      name: "Three-Moment Theorem",
      description:
        "Classical method for analyzing continuous beams using the three-moment equation",
      icon: <Calculator className="h-8 w-8" />,
      color: "blue",
      features: [
        "Continuous beam analysis",
        "Multiple span configurations",
        "Advanced BMD decomposition",
        "Load vs support moment visualization",
        "Professional diagram generation",
      ],
      bestFor: [
        "Bridge analysis",
        "Building floor beams",
        "Continuous girders",
        "Educational purposes",
      ],
      advantages: [
        "Direct solution method",
        "Clear physical interpretation",
        "Excellent for hand calculations",
        "Well-established theory",
      ],
      limitations: [
        "Limited to beams only",
        "Cannot handle frames with columns",
        "Manual setup for complex loading",
      ],
      component: EnhancedThreeMomentCalculator,
    },
    {
      id: "moment-distribution",
      name: "Moment Distribution Method",
      description:
        "Hardy Cross iterative method for analyzing frames with beams and columns",
      icon: <GitBranch className="h-8 w-8" />,
      color: "green",
      features: [
        "Frame analysis (beams + columns)",
        "Iterative Hardy Cross procedure",
        "Portal frame analysis",
        "Multi-story structures",
        "Real-time convergence tracking",
      ],
      bestFor: [
        "Portal frames",
        "Multi-story buildings",
        "Industrial structures",
        "Complex joint configurations",
      ],
      advantages: [
        "Handles complex frame geometries",
        "Visual convergence process",
        "No matrix operations required",
        "Intuitive distribution concept",
      ],
      limitations: [
        "Slower for very large structures",
        "Requires iteration to convergence",
        "More complex than simple beam methods",
      ],
      component: MomentDistributionCalculator,
    },
  ];

  const LandingPage = () => {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        {/* Hero Section */}
        <div className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center">
              <div className="flex justify-center items-center mb-6">
                <Building2 className="h-16 w-16 text-blue-600 mr-4" />
                <div className="text-left">
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">
                    Professional Structural Engineering Suite
                  </h1>
                  <p className="text-xl text-gray-600">
                    Advanced Analysis Methods with Integrated BS 8110 Design
                  </p>
                </div>
              </div>
              <p className="max-w-3xl mx-auto text-lg text-gray-700 leading-relaxed">
                Complete structural analysis platform featuring classical
                methods with modern visualization. Choose from Three-Moment
                Theorem for continuous beams or Moment Distribution Method for
                frame analysis, both integrated with professional BS 8110
                reinforced concrete design.
              </p>
            </div>
          </div>
        </div>

        {/* Method Selection Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Choose Your Analysis Method
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Select the most appropriate structural analysis method for your
              project requirements
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {analysisMethod.map((method) => (
              <div
                key={method.id}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden"
              >
                {/* Method Header */}
                <div
                  className={`bg-gradient-to-r ${
                    method.color === "blue"
                      ? "from-blue-500 to-blue-600"
                      : "from-green-500 to-green-600"
                  } text-white p-6`}
                >
                  <div className="flex items-center mb-4">
                    {method.icon}
                    <h3 className="text-2xl font-bold ml-4">{method.name}</h3>
                  </div>
                  <p className="text-blue-100 leading-relaxed">
                    {method.description}
                  </p>
                </div>

                {/* Method Details */}
                <div className="p-6">
                  {/* Features */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                      <Zap className="h-5 w-5 mr-2 text-yellow-500" />
                      Key Features
                    </h4>
                    <ul className="space-y-2">
                      {method.features.map((feature, index) => (
                        <li
                          key={index}
                          className="flex items-start text-sm text-gray-600"
                        >
                          <ChevronRight className="h-4 w-4 mt-0.5 mr-2 text-green-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Best For */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                      <Award className="h-5 w-5 mr-2 text-orange-500" />
                      Best For
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {method.bestFor.map((application, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                        >
                          {application}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Advantages & Limitations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <h5 className="font-medium text-green-800 mb-2 text-sm">
                        ✓ Advantages
                      </h5>
                      <ul className="space-y-1">
                        {method.advantages.map((advantage, index) => (
                          <li key={index} className="text-xs text-green-700">
                            {advantage}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium text-red-800 mb-2 text-sm">
                        ⚠ Limitations
                      </h5>
                      <ul className="space-y-1">
                        {method.limitations.map((limitation, index) => (
                          <li key={index} className="text-xs text-red-700">
                            {limitation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => {
                      setSelectedMethod(method);
                      setCurrentView("analysis");
                    }}
                    className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors duration-200 ${
                      method.color === "blue"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    Launch {method.name}
                    <ChevronRight className="h-5 w-5 ml-2 inline" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Overview */}
        <div className="bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Integrated Design Capabilities
              </h2>
              <p className="text-lg text-gray-600">
                Both analysis methods integrate seamlessly with professional
                design tools
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-md text-center">
                <div className="bg-purple-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Settings className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  BS 8110 Design
                </h3>
                <p className="text-gray-600 text-sm">
                  Complete reinforced concrete beam design with rectangular,
                  T-beam, and L-beam sections. Full code compliance checking and
                  optimization.
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md text-center">
                <div className="bg-blue-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <BookOpen className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Professional Diagrams
                </h3>
                <p className="text-gray-600 text-sm">
                  High-quality shear force diagrams, bending moment diagrams,
                  and deflection curves. Publication-ready visualizations with
                  critical value annotations.
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md text-center">
                <div className="bg-green-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Users className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Educational Excellence
                </h3>
                <p className="text-gray-600 text-sm">
                  Step-by-step solution procedures, method comparisons, and
                  detailed calculations. Perfect for teaching and learning
                  structural analysis.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Method Comparison */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
              Method Comparison Guide
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-800">
                      Aspect
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-blue-600">
                      Three-Moment Theorem
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-green-600">
                      Moment Distribution
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">
                      Structure Type
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      Continuous Beams Only
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      Frames (Beams + Columns)
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-medium">
                      Solution Method
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      Direct (Matrix Solution)
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      Iterative (Hardy Cross)
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">
                      Complexity
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      Lower
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      Higher
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-medium">
                      Educational Value
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      Excellent for Beam Theory
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      Excellent for Frame Analysis
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">
                      Professional Use
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      Bridge Design, Floor Beams
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      Building Frames, Industrial
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 mt-1 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-blue-800 mb-2">
                    Selection Guidance
                  </h4>
                  <ul className="text-blue-700 text-sm space-y-1">
                    <li>
                      <strong>Choose Three-Moment Theorem</strong> for
                      continuous beams, bridge analysis, and when you need
                      direct solutions
                    </li>
                    <li>
                      <strong>Choose Moment Distribution Method</strong> for
                      portal frames, building structures, and when you need
                      frame analysis
                    </li>
                    <li>
                      <strong>Both methods</strong> integrate with BS 8110
                      design and provide professional-quality output
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-800 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-4">
                Professional Structural Engineering Suite
              </h3>
              <p className="text-gray-300 mb-4">
                Advanced structural analysis methods with integrated reinforced
                concrete design
              </p>
              <p className="text-gray-400 text-sm">
                © 2024 - Built with React, FastAPI, and cutting-edge structural
                engineering principles
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AnalysisView = () => {
    if (!selectedMethod || !selectedMethod.component) {
      return <div>Loading...</div>;
    }

    const SelectedComponent = selectedMethod.component;

    return (
      <div className="min-h-screen bg-gray-100">
        {/* Navigation Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setCurrentView("landing");
                    setSelectedMethod(null);
                  }}
                  className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Main Menu
                </button>
                <div className="border-l border-gray-300 pl-4">
                  <div className="flex items-center space-x-3">
                    {selectedMethod.icon}
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">
                        {selectedMethod.name}
                      </h1>
                      <p className="text-sm text-gray-600">
                        Professional Structural Analysis
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedMethod.color === "blue"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {selectedMethod.color === "blue"
                    ? "Beam Analysis"
                    : "Frame Analysis"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Component */}
        <SelectedComponent />
      </div>
    );
  };

  // Main render logic
  if (currentView === "landing") {
    return <LandingPage />;
  } else if (currentView === "analysis") {
    return <AnalysisView />;
  }

  return <LandingPage />;
};

export default StructuralEngineeeringSuite;
