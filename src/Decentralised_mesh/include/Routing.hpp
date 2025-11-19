#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>

namespace meshnet {

// Network link between devices
struct Link {
    std::string from_device;
    std::string to_device;
    float quality;           // 0.0 - 1.0
    float latency_ms;
    float bandwidth_mbps;
    
    Link() : quality(1.0f), latency_ms(10.0f), bandwidth_mbps(100.0f) {}
};

// Route from source to destination
struct Route {
    std::vector<std::string> path;  // Device IDs in order
    float total_latency_ms;
    float min_bandwidth_mbps;
    float quality_score;
    
    Route() : total_latency_ms(0.0f), min_bandwidth_mbps(0.0f), quality_score(0.0f) {}
};

class Routing {
public:
    Routing();
    
    // Add link between devices
    void add_link(const std::string& from, const std::string& to, const Link& link);
    
    // Update link quality
    void update_link(const std::string& from, const std::string& to, float quality);
    
    // Find route from source to destination
    Route find_route(const std::string& source, const std::string& dest);
    
    // Find device locations for chunk
    std::vector<std::string> resolve_chunk_locations(const std::string& chunk_hash);
    
    // Get neighbors of a device
    std::vector<std::string> get_neighbors(const std::string& device_id);
    
    // Remove link
    void remove_link(const std::string& from, const std::string& to);
    
    // Register chunk location (for routing queries)
    void register_chunk_location(const std::string& chunk_hash, 
                                const std::vector<std::string>& device_ids);
    
private:
    std::unordered_map<std::string, std::unordered_map<std::string, Link>> graph_;
    std::unordered_map<std::string, std::vector<std::string>> chunk_locations_;
    
    // Dijkstra's algorithm for shortest path
    Route dijkstra(const std::string& source, const std::string& dest);
};

} // namespace meshnet