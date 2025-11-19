#include "Consensus.hpp"
#include <openssl/sha.h>
#include <sstream>
#include <iomanip>
#include <algorithm>

namespace meshnet {

Consensus::Consensus() {}

std::string Consensus::generate_entry_id(const DAGEntry& entry) {
    // Generate ID from chunk_hash + devices + timestamp
    std::stringstream ss;
    ss << entry.chunk_hash;
    for (const auto& device : entry.device_ids) {
        ss << device;
    }
    ss << entry.version;
    
    std::string data = ss.str();
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256((unsigned char*)data.c_str(), data.size(), hash);
    
    std::stringstream result;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; ++i) {
        result << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];
    }
    return result.str();
}

std::string Consensus::add_entry(const std::string& chunk_hash,
                                 const std::vector<std::string>& device_ids,
                                 const std::string& creator) {
    auto entry = std::make_shared<DAGEntry>();
    entry->chunk_hash = chunk_hash;
    entry->device_ids = device_ids;
    entry->creator = creator;
    entry->timestamp = std::chrono::system_clock::now();
    
    // Find parent entries
    auto& history = dag_[chunk_hash];
    if (!history.empty()) {
        entry->parent_ids.push_back(history.back()->entry_id);
        entry->version = history.back()->version + 1;
    } else {
        entry->version = 1;
    }
    
    entry->entry_id = generate_entry_id(*entry);
    
    // Add to DAG
    history.push_back(entry);
    entry_by_id_[entry->entry_id] = entry;
    
    return entry->entry_id;
}

std::shared_ptr<DAGEntry> Consensus::get_latest(const std::string& chunk_hash) {
    auto it = dag_.find(chunk_hash);
    if (it != dag_.end() && !it->second.empty()) {
        return it->second.back();
    }
    return nullptr;
}

std::vector<std::shared_ptr<DAGEntry>> Consensus::get_history(const std::string& chunk_hash) {
    auto it = dag_.find(chunk_hash);
    if (it != dag_.end()) {
        return it->second;
    }
    return {};
}

std::shared_ptr<DAGEntry> Consensus::resolve_conflict(std::shared_ptr<DAGEntry> a,
                                                      std::shared_ptr<DAGEntry> b) {
    // Last-write-wins based on timestamp
    if (a->timestamp > b->timestamp) {
        return a;
    } else if (b->timestamp > a->timestamp) {
        return b;
    }
    
    // If timestamps equal, use version
    if (a->version > b->version) {
        return a;
    } else if (b->version > a->version) {
        return b;
    }
    
    // If still equal, use entry_id lexicographic order
    return (a->entry_id > b->entry_id) ? a : b;
}

void Consensus::merge_entry(std::shared_ptr<DAGEntry> entry) {
    // Check if entry already exists
    if (entry_by_id_.find(entry->entry_id) != entry_by_id_.end()) {
        return;  // Already have this entry
    }
    
    auto& history = dag_[entry->chunk_hash];
    
    // Find insertion point based on timestamp
    auto insert_pos = std::lower_bound(
        history.begin(), history.end(), entry,
        [](const std::shared_ptr<DAGEntry>& a, const std::shared_ptr<DAGEntry>& b) {
            return a->timestamp < b->timestamp;
        }
    );
    
    history.insert(insert_pos, entry);
    entry_by_id_[entry->entry_id] = entry;
}

std::vector<std::string> Consensus::resolve_locations(const std::string& chunk_hash) {
    auto latest = get_latest(chunk_hash);
    if (latest) {
        return latest->device_ids;
    }
    return {};
}

std::vector<std::string> Consensus::list_chunks() const {
    std::vector<std::string> chunks;
    for (const auto& [hash, _] : dag_) {
        chunks.push_back(hash);
    }
    return chunks;
}

} // namespace meshnet