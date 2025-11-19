#include "Scheduler.hpp"
#include <algorithm>
#include <stdexcept>

namespace meshnet {

Scheduler::Scheduler(int replication_factor) 
    : replication_factor_(replication_factor) {}

void Scheduler::register_device(const std::string& device_id, const Telemetry& telemetry) {
    devices_[device_id] = telemetry;
}

void Scheduler::update_telemetry(const std::string& device_id, const Telemetry& telemetry) {
    devices_[device_id] = telemetry;
}

float Scheduler::score_device_for_storage(const Telemetry& telemetry, size_t data_size_bytes) const {
    float score = 0.0f;
    
    // Check storage capacity (30%)
    size_t required_mb = data_size_bytes / (1024 * 1024);
    if (telemetry.available_storage_mb < required_mb) {
        return 0.0f;  // Insufficient storage
    }
    score += std::min(30.0f, (telemetry.available_storage_mb / (float)required_mb) * 5.0f);
    
    // Battery/power (25%)
    if (telemetry.is_plugged_in) {
        score += 25.0f;
    } else {
        score += (telemetry.battery_percent / 100.0f) * 25.0f;
    }
    
    // Link quality (25%)
    score += telemetry.link_quality * 25.0f;
    
    // Low resource usage indicates availability (20%)
    score += ((100.0f - telemetry.cpu_load_percent) / 100.0f) * 10.0f;
    score += ((100.0f - telemetry.ram_usage_percent) / 100.0f) * 10.0f;
    
    return score;
}

float Scheduler::score_device_for_compute(const Telemetry& telemetry) const {
    return telemetry.compute_score();
}

std::vector<std::string> Scheduler::select_devices(const std::vector<std::string>& candidates,
                                                   const std::vector<float>& scores,
                                                   int count) const {
    // Create pairs of (device_id, score)
    std::vector<std::pair<std::string, float>> pairs;
    for (size_t i = 0; i < candidates.size(); ++i) {
        if (scores[i] > 0.0f) {  // Only consider devices with positive scores
            pairs.push_back({candidates[i], scores[i]});
        }
    }
    
    // Sort by score descending
    std::sort(pairs.begin(), pairs.end(),
              [](const auto& a, const auto& b) { return a.second > b.second; });
    
    // Select top N
    std::vector<std::string> selected;
    for (int i = 0; i < std::min(count, (int)pairs.size()); ++i) {
        selected.push_back(pairs[i].first);
    }
    
    return selected;
}

std::vector<Placement> Scheduler::place_chunks(const std::vector<std::string>& chunk_hashes,
                                               size_t chunk_size_bytes) {
    std::vector<Placement> placements;
    
    for (const auto& hash : chunk_hashes) {
        Placement placement;
        placement.chunk_hash = hash;
        
        // Score all devices
        std::vector<std::string> candidates;
        std::vector<float> scores;
        
        for (const auto& [device_id, telemetry] : devices_) {
            candidates.push_back(device_id);
            scores.push_back(score_device_for_storage(telemetry, chunk_size_bytes));
        }
        
        // Select best devices
        placement.device_ids = select_devices(candidates, scores, replication_factor_);
        
        // Calculate average score
        float total_score = 0.0f;
        for (const auto& device_id : placement.device_ids) {
            total_score += score_device_for_storage(devices_.at(device_id), chunk_size_bytes);
        }
        placement.score = placement.device_ids.empty() ? 0.0f : 
                         total_score / placement.device_ids.size();
        
        placements.push_back(placement);
    }
    
    return placements;
}

Placement Scheduler::place_shard(const std::string& shard_id, size_t shard_size_bytes) {
    // Model shards use same logic as chunks but prioritize compute capability
    std::vector<std::string> candidates;
    std::vector<float> scores;
    
    for (const auto& [device_id, telemetry] : devices_) {
        candidates.push_back(device_id);
        // Combine storage and compute scores
        float storage_score = score_device_for_storage(telemetry, shard_size_bytes);
        float compute_score = score_device_for_compute(telemetry);
        scores.push_back(storage_score * 0.4f + compute_score * 0.6f);
    }
    
    Placement placement;
    placement.chunk_hash = shard_id;
    placement.device_ids = select_devices(candidates, scores, replication_factor_);
    
    float total_score = 0.0f;
    for (size_t i = 0; i < candidates.size(); ++i) {
        if (std::find(placement.device_ids.begin(), placement.device_ids.end(), candidates[i]) != placement.device_ids.end()) {
            total_score += scores[i];
        }
    }
    placement.score = placement.device_ids.empty() ? 0.0f : 
                     total_score / placement.device_ids.size();
    
    return placement;
}

std::vector<std::string> Scheduler::get_compute_devices(int count) {
    std::vector<std::string> candidates;
    std::vector<float> scores;
    
    for (const auto& [device_id, telemetry] : devices_) {
        candidates.push_back(device_id);
        scores.push_back(score_device_for_compute(telemetry));
    }
    
    return select_devices(candidates, scores, count);
}

void Scheduler::remove_device(const std::string& device_id) {
    devices_.erase(device_id);
}

Telemetry Scheduler::get_telemetry(const std::string& device_id) const {
    auto it = devices_.find(device_id);
    if (it != devices_.end()) {
        return it->second;
    }
    throw std::runtime_error("Device not found: " + device_id);
}

} // namespace meshnet