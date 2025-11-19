#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/chrono.h>
#include "Telemetry.hpp"
#include "ChunkStore.hpp"
#include "Scheduler.hpp"
#include "Consensus.hpp"
#include "Routing.hpp"
#include "ModelShardManager.hpp"

namespace py = pybind11;
using namespace meshnet;

PYBIND11_MODULE(meshcore, m) {
    m.doc() = "Decentralized Mesh Network with Distributed AI - Core C++ Module";
    
    // Telemetry
    py::class_<Telemetry>(m, "Telemetry")
        .def(py::init<>())
        .def_readwrite("device_id", &Telemetry::device_id)
        .def_readwrite("battery_percent", &Telemetry::battery_percent)
        .def_readwrite("cpu_load_percent", &Telemetry::cpu_load_percent)
        .def_readwrite("ram_usage_percent", &Telemetry::ram_usage_percent)
        .def_readwrite("idle_percent", &Telemetry::idle_percent)
        .def_readwrite("link_quality", &Telemetry::link_quality)
        .def_readwrite("available_storage_mb", &Telemetry::available_storage_mb)
        .def_readwrite("is_plugged_in", &Telemetry::is_plugged_in)
        .def_readwrite("timestamp", &Telemetry::timestamp)
        .def("compute_score", &Telemetry::compute_score);
    
    // Chunk
    py::class_<Chunk, std::shared_ptr<Chunk>>(m, "Chunk")
        .def(py::init<>())
        .def_readonly("hash", &Chunk::hash)
        .def_readonly("data", &Chunk::data)
        .def_readonly("original_size", &Chunk::original_size)
        .def_readonly("index", &Chunk::index)
        .def_readonly("is_encrypted", &Chunk::is_encrypted);
    
    // ChunkStore
    py::class_<ChunkStore>(m, "ChunkStore")
        .def(py::init<size_t>(), py::arg("chunk_size") = 262144)
        .def("store", &ChunkStore::store,
             py::arg("data"), py::arg("content_id"), py::arg("encrypt") = true)
        .def("retrieve", &ChunkStore::retrieve)
        .def("get_chunk", &ChunkStore::get_chunk)
        .def("store_chunk", &ChunkStore::store_chunk)
        .def("get_content_address", &ChunkStore::get_content_address)
        .def("list_chunks", &ChunkStore::list_chunks);
    
    // Placement
    py::class_<Placement>(m, "Placement")
        .def(py::init<>())
        .def_readonly("chunk_hash", &Placement::chunk_hash)
        .def_readonly("device_ids", &Placement::device_ids)
        .def_readonly("score", &Placement::score);
    
    // Scheduler
    py::class_<Scheduler>(m, "Scheduler")
        .def(py::init<int>(), py::arg("replication_factor") = 3)
        .def("register_device", &Scheduler::register_device)
        .def("update_telemetry", &Scheduler::update_telemetry)
        .def("place_chunks", &Scheduler::place_chunks)
        .def("place_shard", &Scheduler::place_shard)
        .def("get_compute_devices", &Scheduler::get_compute_devices,
             py::arg("count") = 5)
        .def("remove_device", &Scheduler::remove_device)
        .def("get_telemetry", &Scheduler::get_telemetry);
    
    // DAGEntry
    py::class_<DAGEntry, std::shared_ptr<DAGEntry>>(m, "DAGEntry")
        .def(py::init<>())
        .def_readonly("entry_id", &DAGEntry::entry_id)
        .def_readonly("chunk_hash", &DAGEntry::chunk_hash)
        .def_readonly("device_ids", &DAGEntry::device_ids)
        .def_readonly("parent_ids", &DAGEntry::parent_ids)
        .def_readonly("timestamp", &DAGEntry::timestamp)
        .def_readonly("version", &DAGEntry::version)
        .def_readonly("creator", &DAGEntry::creator);
    
    // Consensus
    py::class_<Consensus>(m, "Consensus")
        .def(py::init<>())
        .def("add_entry", &Consensus::add_entry)
        .def("get_latest", &Consensus::get_latest)
        .def("get_history", &Consensus::get_history)
        .def("merge_entry", &Consensus::merge_entry)
        .def("resolve_locations", &Consensus::resolve_locations)
        .def("list_chunks", &Consensus::list_chunks);
    
    // Link
    py::class_<Link>(m, "Link")
        .def(py::init<>())
        .def_readwrite("from_device", &Link::from_device)
        .def_readwrite("to_device", &Link::to_device)
        .def_readwrite("quality", &Link::quality)
        .def_readwrite("latency_ms", &Link::latency_ms)
        .def_readwrite("bandwidth_mbps", &Link::bandwidth_mbps);
    
    // Route
    py::class_<Route>(m, "Route")
        .def(py::init<>())
        .def_readonly("path", &Route::path)
        .def_readonly("total_latency_ms", &Route::total_latency_ms)
        .def_readonly("min_bandwidth_mbps", &Route::min_bandwidth_mbps)
        .def_readonly("quality_score", &Route::quality_score);
    
    // Routing
    py::class_<Routing>(m, "Routing")
        .def(py::init<>())
        .def("add_link", &Routing::add_link)
        .def("update_link", &Routing::update_link)
        .def("find_route", &Routing::find_route)
        .def("resolve_chunk_locations", &Routing::resolve_chunk_locations)
        .def("get_neighbors", &Routing::get_neighbors)
        .def("remove_link", &Routing::remove_link)
        .def("register_chunk_location", &Routing::register_chunk_location);
    
    // ModelShard
    py::class_<ModelShard, std::shared_ptr<ModelShard>>(m, "ModelShard")
        .def(py::init<>())
        .def_readwrite("shard_id", &ModelShard::shard_id)
        .def_readwrite("model_name", &ModelShard::model_name)
        .def_readwrite("layer_start", &ModelShard::layer_start)
        .def_readwrite("layer_end", &ModelShard::layer_end)
        .def_readwrite("device_ids", &ModelShard::device_ids)
        .def_readwrite("size_bytes", &ModelShard::size_bytes)
        .def_readwrite("content_hash", &ModelShard::content_hash);
    
    // InferenceRequest
    py::class_<InferenceRequest>(m, "InferenceRequest")
        .def(py::init<>())
        .def_readwrite("request_id", &InferenceRequest::request_id)
        .def_readwrite("model_name", &InferenceRequest::model_name)
        .def_readwrite("prompt", &InferenceRequest::prompt)
        .def_readwrite("max_tokens", &InferenceRequest::max_tokens)
        .def_readwrite("temperature", &InferenceRequest::temperature)
        .def_readwrite("input_embeddings", &InferenceRequest::input_embeddings);
    
    // InferenceResult
    py::class_<InferenceResult>(m, "InferenceResult")
        .def(py::init<>())
        .def_readonly("request_id", &InferenceResult::request_id)
        .def_readonly("generated_text", &InferenceResult::generated_text)
        .def_readonly("output_embeddings", &InferenceResult::output_embeddings)
        .def_readonly("latency_ms", &InferenceResult::latency_ms)
        .def_readonly("compute_path", &InferenceResult::compute_path);
    
    // ModelShardManager
    py::class_<ModelShardManager>(m, "ModelShardManager")
        .def(py::init<>())
        .def("register_model", &ModelShardManager::register_model)
        .def("update_shard_location", &ModelShardManager::update_shard_location)
        .def("get_shard", &ModelShardManager::get_shard)
        .def("get_model_shards", &ModelShardManager::get_model_shards)
        .def("run_inference", &ModelShardManager::run_inference)
        .def("plan_inference_path", &ModelShardManager::plan_inference_path);
}