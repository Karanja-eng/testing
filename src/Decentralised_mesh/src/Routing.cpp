#include "Routing.hpp"
#include <queue>
#include <limits>
#include <algorithm>

namespace meshnet {

Routing::Routing() {}

void Routing::add_link(const std::string& from, const std::string& to, const Link& link) {
    graph_[from][to] = link;
    // Add reverse link for bidirectional
    Link reverse = link;
    reverse.from_device = to;
    reverse.to_device = from;
    graph_[to][from] = reverse;
}

void Routing::update_link(const std::string& from, const std::string& to, float quality) {
    auto it1 = graph_.find(from);
    if (it1 != graph_.end()) {
        auto it2 = it1->second.find(to);
        if (it2 != it1->second.end()) {
            it2->second.quality = quality;
        }
    }
    
    // Update reverse
    auto it3 = graph_.find(to);
    if (it3 != graph_.end()) {
        auto it4 = it3->second.find(from);
        if (it4 != it3->second.end()) {
            it4->second.quality = quality;
        }
    }
}

Route Routing::dijkstra(const std::string& source, const std::string& dest) {
    Route result;
    
    // Cost: lower is better (inverse of quality, plus latency weight)
    std::unordered_map<std::string, float> cost;
    std::unordered_map<std::string, std::string> prev;
    
    for (const auto& [node, _] : graph_) {
        cost[node] = std::numeric_limits<float>::infinity();
    }
    cost[source] = 0.0f;
    
    // Priority queue: (cost, node)
    using QueueItem = std::pair<float, std::string>;
    std::priority_queue<QueueItem, std::vector<QueueItem>, std::greater<QueueItem>> pq;
    pq.push({0.0f, source});
    
    while (!pq.empty()) {
        auto [curr_cost, u] = pq.top();
        pq.pop();
        
        if (u == dest) {
            break;
        }
        
        if (curr_cost > cost[u]) {
            continue;
        }
        
        auto it = graph_.find(u);
        if (it == graph_.end()) {
            continue;
        }
        
        for (const auto& [v, link] : it->second) {
            // Cost function: latency + inverse quality
            float edge_cost = link.latency_ms + (1.0f - link.quality) * 50.0f;
            float new_cost = cost[u] + edge_cost;
            
            if (new_cost < cost[v]) {
                cost[v] = new_cost;
                prev[v] = u;
                pq.push({new_cost, v});
            }
        }
    }
    
    // Reconstruct path
    if (prev.find(dest) != prev.end() || dest == source) {
        std::string current = dest;
        while (!current.empty()) {
            result.path.insert(result.path.begin(), current);
            if (current == source) {
                break;
            }
            current = prev[current];
        }
        
        // Calculate metrics
        result.total_latency_ms = 0.0f;
        result.min_bandwidth_mbps = std::numeric_limits<float>::infinity();
        result.quality_score = 1.0f;
        
        for (size_t i = 0; i < result.path.size() - 1; ++i) {
            const auto& link = graph_[result.path[i]][result.path[i + 1]];
            result.total_latency_ms += link.latency_ms;
            result.min_bandwidth_mbps = std::min(result.min_bandwidth_mbps, link.bandwidth_mbps);
            result.quality_score *= link.quality;
        }
    }
    
    return result;
}

Route Routing::find_route(const std::string& source, const std::string& dest) {
    return dijkstra(source, dest);
}

std::vector<std::string> Routing::resolve_chunk_locations(const std::string& chunk_hash) {
    auto it = chunk_locations_.find(chunk_hash);
    if (it != chunk_locations_.end()) {
        return it->second;
    }
    return {};
}

std::vector<std::string> Routing::get_neighbors(const std::string& device_id) {
    std::vector<std::string> neighbors;
    auto it = graph_.find(device_id);
    if (it != graph_.end()) {
        for (const auto& [neighbor, _] : it->second) {
            neighbors.push_back(neighbor);
        }
    }
    return neighbors;
}

void Routing::remove_link(const std::string& from, const std::string& to) {
    auto it = graph_.find(from);
    if (it != graph_.end()) {
        it->second.erase(to);
    }
    
    auto it2 = graph_.find(to);
    if (it2 != graph_.end()) {
        it2->second.erase(from);
    }
}

void Routing::register_chunk_location(const std::string& chunk_hash,
                                      const std::vector<std::string>& device_ids) {
    chunk_locations_[chunk_hash] = device_ids;
}

} // namespace meshnet