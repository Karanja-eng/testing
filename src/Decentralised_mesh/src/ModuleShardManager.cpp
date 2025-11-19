#include "ModelShardManager.hpp"
#include <algorithm>
#include <numeric>
#include <random>
#include <stdexcept>
#include <chrono>

namespace meshnet {

ModelShardManager::ModelShardManager() {}

void ModelShardManager::register_model(const std::string& model_name,
                                       const std::vector<ModelShard>& shards) {
    std::vector<std::string> shard_ids;
    
    for (const auto& shard : shards) {
        auto shard_ptr = std::make_shared<ModelShard>(shard);
        shards_[shard.shard_id] = shard_ptr;
        shard_ids.push_back(shard.shard_id);
    }
    
    model_shards_[model_name] = shard_ids;
}

void ModelShardManager::update_shard_location(const std::string& shard_id,
                                              const std::vector<std::string>& device_ids) {
    auto it = shards_.find(shard_id);
    if (it != shards_.end()) {
        it->second->device_ids = device_ids;
    }
}

std::shared_ptr<ModelShard> ModelShardManager::get_shard(const std::string& shard_id) {
    auto it = shards_.find(shard_id);
    return (it != shards_.end()) ? it->second : nullptr;
}

std::vector<std::shared_ptr<ModelShard>> ModelShardManager::get_model_shards(
    const std::string& model_name) {
    std::vector<std::shared_ptr<ModelShard>> result;
    
    auto it = model_shards_.find(model_name);
    if (it != model_shards_.end()) {
        for (const auto& shard_id : it->second) {
            auto shard = get_shard(shard_id);
            if (shard) {
                result.push_back(shard);
            }
        }
    }
    
    return result;
}

std::vector<std::pair<std::string, std::string>> ModelShardManager::plan_inference_path(
    const std::string& model_name) {
    std::vector<std::pair<std::string, std::string>> path;
    
    auto shards = get_model_shards(model_name);
    
    // Sort shards by layer order
    std::sort(shards.begin(), shards.end(),
              [](const auto& a, const auto& b) {
                  return a->layer_start < b->layer_start;
              });
    
    // For each shard, pick a device (prefer first available)
    for (const auto& shard : shards) {
        if (!shard->device_ids.empty()) {
            path.push_back({shard->shard_id, shard->device_ids[0]});
        } else {
            throw std::runtime_error("No device available for shard: " + shard->shard_id);
        }
    }
    
    return path;
}

std::vector<float> ModelShardManager::execute_layer(const std::vector<float>& input,
                                                    const ModelShard& shard,
                                                    const std::string& device_id) {
    // Stub implementation - simulate neural network layer execution
    // In production, this would:
    // 1. Send input to device via mesh network
    // 2. Device loads shard weights
    // 3. Device runs layer computation
    // 4. Device returns output
    
    std::vector<float> output(input.size());
    
    // Simulate with simple transformation
    std::mt19937 rng(std::hash<std::string>{}(shard.shard_id + device_id));
    std::uniform_real_distribution<float> dist(-0.1f, 0.1f);
    
    for (size_t i = 0; i < input.size(); ++i) {
        output[i] = input[i] * 0.9f + dist(rng);
    }
    
    return output;
}

std::vector<float> ModelShardManager::aggregate_results(
    const std::vector<std::vector<float>>& results) {
    if (results.empty()) {
        return {};
    }
    
    // Simple averaging (for parallel execution)
    size_t size = results[0].size();
    std::vector<float> aggregated(size, 0.0f);
    
    for (const auto& result : results) {
        for (size_t i = 0; i < size; ++i) {
            aggregated[i] += result[i];
        }
    }
    
    for (float& val : aggregated) {
        val /= results.size();
    }
    
    return aggregated;
}

InferenceResult ModelShardManager::run_inference(const InferenceRequest& request) {
    auto start_time = std::chrono::high_resolution_clock::now();
    
    InferenceResult result;
    result.request_id = request.request_id;
    
    try {
        // Plan execution path
        auto path = plan_inference_path(request.model_name);
        
        // Execute layers sequentially
        std::vector<float> current_embeddings = request.input_embeddings;
        
        if (current_embeddings.empty()) {
            // Simulate tokenization
            current_embeddings.resize(512, 0.1f);
        }
        
        for (const auto& [shard_id, device_id] : path) {
            auto shard = get_shard(shard_id);
            if (!shard) {
                throw std::runtime_error("Shard not found: " + shard_id);
            }
            
            // Execute layer on device
            current_embeddings = execute_layer(current_embeddings, *shard, device_id);
            result.compute_path.push_back(device_id);
        }
        
        result.output_embeddings = current_embeddings;
        
        // Simulate decoding (convert embeddings to text)
        result.generated_text = "Generated response to: " + request.prompt;
        
    } catch (const std::exception& e) {
        result.generated_text = "Error: " + std::string(e.what());
    }
    
    auto end_time = std::chrono::high_resolution_clock::now();
    result.latency_ms = std::chrono::duration<float, std::milli>(end_time - start_time).count();
    
    return result;
}

} // namespace meshnet