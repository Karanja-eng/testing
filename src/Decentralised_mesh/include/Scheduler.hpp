#pragma once
#include "Telemetry.hpp"
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>

namespace meshnet {

// Placement decision
struct Placement {
    std::string chunk_hash;
    std::vector<std::string> device_ids;  // Replicas
    float score;                          // Placement quality
    
    Placement() : score(0.0f) {}
};

class Scheduler {
public:
    Scheduler(int replication_factor = 3);
    
    // Register device with telemetry
    void register_device(const std::string& device_id, const Telemetry& telemetry);
    
    // Update device telemetry
    void update_telemetry(const std::string& device_id, const Telemetry& telemetry);
    
    // Place chunks based on device capabilities
    std::vector<Placement> place_chunks(const std::vector<std::string>& chunk_hashes,
                                        size_t chunk_size_bytes);
    
    // Place model shard (special case of chunk placement)
    Placement place_shard(const std::string& shard_id, size_t shard_size_bytes);
    
    // Get best devices for computation
    std::vector<std::string> get_compute_devices(int count = 5);
    
    // Remove device
    void remove_device(const std::string& device_id);
    
    // Get device telemetry
    Telemetry get_telemetry(const std::string& device_id) const;
    
private:
    int replication_factor_;
    std::unordered_map<std::string, Telemetry> devices_;
    
    // Score function for placement
    float score_device_for_storage(const Telemetry& telemetry, size_t data_size_bytes) const;
    float score_device_for_compute(const Telemetry& telemetry) const;
    
    // Select best devices
    std::vector<std::string> select_devices(const std::vector<std::string>& candidates,
                                           const std::vector<float>& scores,
                                           int count) const;
};

} // namespace meshnet