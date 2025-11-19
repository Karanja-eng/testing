#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <chrono>

namespace meshnet {

// DAG Entry representing a chunk placement or update
struct DAGEntry {
    std::string entry_id;      // Unique ID (hash of content)
    std::string chunk_hash;    // Content hash
    std::vector<std::string> device_ids;  // Devices storing this chunk
    std::vector<std::string> parent_ids;  // DAG parents
    std::chrono::system_clock::time_point timestamp;
    uint64_t version;          // Version vector
    std::string creator;       // Device that created this entry
    
    DAGEntry() : version(0) {}
};

// Local DAG ledger for chunk metadata
class Consensus {
public:
    Consensus();
    
    // Add entry to DAG
    std::string add_entry(const std::string& chunk_hash,
                         const std::vector<std::string>& device_ids,
                         const std::string& creator);
    
    // Get latest entry for a chunk
    std::shared_ptr<DAGEntry> get_latest(const std::string& chunk_hash);
    
    // Get all entries for a chunk (full history)
    std::vector<std::shared_ptr<DAGEntry>> get_history(const std::string& chunk_hash);
    
    // Merge remote DAG entries (CRDT-style)
    void merge_entry(std::shared_ptr<DAGEntry> entry);
    
    // Get device locations for chunk
    std::vector<std::string> resolve_locations(const std::string& chunk_hash);
    
    // List all chunks in DAG
    std::vector<std::string> list_chunks() const;
    
private:
    std::unordered_map<std::string, std::vector<std::shared_ptr<DAGEntry>>> dag_;
    std::unordered_map<std::string, std::shared_ptr<DAGEntry>> entry_by_id_;
    
    // Generate entry ID
    std::string generate_entry_id(const DAGEntry& entry);
    
    // CRDT merge logic (last-write-wins for now)
    std::shared_ptr<DAGEntry> resolve_conflict(std::shared_ptr<DAGEntry> a,
                                               std::shared_ptr<DAGEntry> b);
};

} // namespace meshnet