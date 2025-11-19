#pragma once
#include <string>
#include <chrono>

namespace meshnet {

// Device telemetry data structure
struct Telemetry {
    std::string device_id;
    float battery_percent;        // 0.0 - 100.0
    float cpu_load_percent;       // 0.0 - 100.0
    float ram_usage_percent;      // 0.0 - 100.0
    float idle_percent;           // 0.0 - 100.0 (inverse of activity)
    float link_quality;           // 0.0 - 1.0 (signal strength/latency)
    uint64_t available_storage_mb;
    bool is_plugged_in;
    std::chrono::system_clock::time_point timestamp;
    
    // Compute trust/capability score (0-100)
    float compute_score() const {
        float base_score = 0.0f;
        
        // Battery contribution (20%)
        if (is_plugged_in) {
            base_score += 20.0f;
        } else {
            base_score += (battery_percent / 100.0f) * 20.0f;
        }
        
        // CPU availability (30%)
        base_score += ((100.0f - cpu_load_percent) / 100.0f) * 30.0f;
        
        // RAM availability (20%)
        base_score += ((100.0f - ram_usage_percent) / 100.0f) * 20.0f;
        
        // Idle state (20%)
        base_score += (idle_percent / 100.0f) * 20.0f;
        
        // Link quality (10%)
        base_score += link_quality * 10.0f;
        
        return base_score;
    }
    
    Telemetry() 
        : battery_percent(100.0f)
        , cpu_load_percent(0.0f)
        , ram_usage_percent(0.0f)
        , idle_percent(100.0f)
        , link_quality(1.0f)
        , available_storage_mb(1024)
        , is_plugged_in(false)
        , timestamp(std::chrono::system_clock::now()) {}
};

} // namespace meshnet