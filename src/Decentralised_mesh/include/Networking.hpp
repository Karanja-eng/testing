#pragma once
#include <string>
#include <vector>
#include <memory>
#include <functional>
#include <unordered_map>
#include <queue>
#include <mutex>

namespace meshnet {

// Network message types
enum class MessageType {
    CHUNK_REQUEST,
    CHUNK_RESPONSE,
    TELEMETRY_UPDATE,
    MODEL_SHARD_REQUEST,
    INFERENCE_REQUEST,
    INFERENCE_RESULT,
    PEER_DISCOVERY,
    HEARTBEAT
};

// Network message
struct NetworkMessage {
    MessageType type;
    std::string sender_id;
    std::string recipient_id;
    std::vector<uint8_t> payload;
    uint64_t timestamp;
    std::string message_id;
    
    NetworkMessage() : type(MessageType::HEARTBEAT), timestamp(0) {}
};

// Peer connection state
enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    FAILED
};

// Peer info
struct PeerInfo {
    std::string peer_id;
    std::string address;  // IP:port or signaling ID
    ConnectionState state;
    uint64_t last_seen;
    float rtt_ms;  // Round-trip time
    
    PeerInfo() : state(ConnectionState::DISCONNECTED), last_seen(0), rtt_ms(0.0f) {}
};

// Message handler callback
using MessageHandler = std::function<void(const NetworkMessage&)>;

class NetworkManager {
public:
    NetworkManager(const std::string& node_id, int port = 9000);
    ~NetworkManager();
    
    // Connection management
    bool connect_to_peer(const std::string& peer_id, const std::string& address);
    void disconnect_peer(const std::string& peer_id);
    std::vector<std::string> get_connected_peers() const;
    PeerInfo get_peer_info(const std::string& peer_id) const;
    
    // Messaging
    bool send_message(const NetworkMessage& message);
    bool broadcast_message(const NetworkMessage& message);
    void register_handler(MessageType type, MessageHandler handler);
    
    // Discovery
    void start_discovery();
    void stop_discovery();
    void announce_presence();
    
    // Network stats
    struct NetworkStats {
        uint64_t bytes_sent;
        uint64_t bytes_received;
        uint64_t messages_sent;
        uint64_t messages_received;
        uint32_t active_peers;
    };
    NetworkStats get_stats() const;
    
private:
    std::string node_id_;
    int port_;
    std::unordered_map<std::string, PeerInfo> peers_;
    std::unordered_map<MessageType, std::vector<MessageHandler>> handlers_;
    std::queue<NetworkMessage> outgoing_queue_;
    std::queue<NetworkMessage> incoming_queue_;
    mutable std::mutex mutex_;
    bool running_;
    NetworkStats stats_;
    
    // Internal methods
    void process_incoming_messages();
    void process_outgoing_messages();
    void handle_peer_discovery(const NetworkMessage& message);
    void send_heartbeat();
    std::string generate_message_id();
};

} // namespace meshnet