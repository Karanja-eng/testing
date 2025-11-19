#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>

namespace meshnet {

// Model shard metadata
struct ModelShard {
    std::string shard_id;
    std::string model_name;
    int layer_start;          // For layer-wise sharding
    int layer_end;
    std::vector<std::string> device_ids;  // Devices hosting this shard
    size_t size_bytes;
    std::string content_hash; // Hash of shard weights
    
    ModelShard() : layer_start(0), layer_end(0), size_bytes(0) {}
};

// Inference request
struct InferenceRequest {
    std::string request_id;
    std::string model_name;
    std::string prompt;
    int max_tokens;
    float temperature;
    std::vector<float> input_embeddings;  // Tokenized input
    
    InferenceRequest() : max_tokens(100), temperature(0.7f) {}
};

// Inference result
struct InferenceResult {
    std::string request_id;
    std::string generated_text;
    std::vector<float> output_embeddings;
    float latency_ms;
    std::vector<std::string> compute_path;  // Devices used
    
    InferenceResult() : latency_ms(0.0f) {}
};

// Manages distributed model execution
class ModelShardManager {
public:
    ModelShardManager();
    
    // Register model and its shards
    void register_model(const std::string& model_name,
                       const std::vector<ModelShard>& shards);
    
    // Update shard locations
    void update_shard_location(const std::string& shard_id,
                              const std::vector<std::string>& device_ids);
    
    // Get shard by ID
    std::shared_ptr<ModelShard> get_shard(const std::string& shard_id);
    
    // List all shards for a model
    std::vector<std::shared_ptr<ModelShard>> get_model_shards(const std::string& model_name);
    
    // Coordinate distributed inference
    InferenceResult run_inference(const InferenceRequest& request);
    
    // Plan inference path (which devices run which layers)
    std::vector<std::pair<std::string, std::string>> plan_inference_path(
        const std::string& model_name);
    
private:
    std::unordered_map<std::string, std::shared_ptr<ModelShard>> shards_;
    std::unordered_map<std::string, std::vector<std::string>> model_shards_;
    
    // Simulate layer execution (stub for now)
    std::vector<float> execute_layer(const std::vector<float>& input,
                                     const ModelShard& shard,
                                     const std::string& device_id);
    
    // Aggregate results from multiple devices
    std::vector<float> aggregate_results(const std::vector<std::vector<float>>& results);
};

} // namespace meshnet