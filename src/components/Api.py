from flask import Flask, request, jsonify  
from flask_cors import CORS  
from calculations import MomentDistribution  

app = Flask(__name__)  
CORS(app)  # Enable Cross-Origin Resource Sharing  

@app.route('/calculate', methods=['POST'])  
def calculate():  
    data = request.json  
    lengths = data['lengths']  
    load_types = data['loadTypes']  
    loads = data['loads']  
    load_positions = data['load_positions']  

    # Create MomentDistribution object and perform calculations  
    beam = MomentDistribution(lengths, load_types, loads, load_positions)  
    beam.calculate_fixed_end_moments()  
    beam.calculate_stiffness_factors()  
    beam.distribute_moments()  
    
    results = {  
        'fixed_end_moments': beam.fixed_end_moments.tolist(),  
        'final_moments': beam.final_moments.tolist(),  
        'diagrams': beam.plot_diagrams()  
    }  

    return jsonify(results)  

if __name__ == '__main__':  
    app.run(debug=True)  