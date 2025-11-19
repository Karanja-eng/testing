#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <openssl/sha.h>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/kdf.h>
#include <zstd.h>
#include <rocksdb/db.h>

namespace meshnet {

// Chunk metadata with enhanced security
struct Chunk {
    std::string hash;           // SHA-256 hash
    std::vector<uint8_t> data;  // Compressed + encrypted data
    std::vector<uint8_t> iv;    // AES-GCM IV (12 bytes)
    std::vector<uint8_t> tag;   // AES-GCM authentication tag (16 bytes)
    size_t original_size;
    size_t index;
    bool is_encrypted;
    
    Chunk() : original_size(0), index(0), is_encrypted(false) {}
};

class ChunkStore {
public:
    ChunkStore(size_t chunk_size = 262144, const std::string& db_path = "./meshnet_db");
    ~ChunkStore();
    
    // Store with AES-GCM encryption
    std::vector<std::string> store(const std::vector<uint8_t>& data, 
                                   const std::string& content_id,
                                   bool encrypt = true);
    
    // Retrieve and decrypt
    std::vector<uint8_t> retrieve(const std::string& content_id);
    
    // Chunk operations
    std::shared_ptr<Chunk> get_chunk(const std::string& hash);
    void store_chunk(const std::string& hash, std::shared_ptr<Chunk> chunk);
    std::string get_content_address(const std::string& content_id) const;
    std::vector<std::string> list_chunks(const std::string& content_id) const;
    
    // Persistence operations
    bool persist_chunk(const std::string& hash, const Chunk& chunk);
    bool load_chunk(const std::string& hash, Chunk& chunk);
    void flush_to_disk();
    
private:
    size_t chunk_size_;
    std::unordered_map<std::string, std::shared_ptr<Chunk>> chunks_;
    std::unordered_map<std::string, std::vector<std::string>> content_map_;
    std::unique_ptr<rocksdb::DB> db_;
    
    // Compression
    std::vector<uint8_t> compress(const std::vector<uint8_t>& data);
    std::vector<uint8_t> decompress(const std::vector<uint8_t>& data, size_t original_size);
    
    // AES-GCM encryption (production-grade)
    std::vector<uint8_t> aes_gcm_encrypt(const std::vector<uint8_t>& plaintext, 
                                          const std::vector<uint8_t>& key,
                                          std::vector<uint8_t>& iv,
                                          std::vector<uint8_t>& tag);
    std::vector<uint8_t> aes_gcm_decrypt(const std::vector<uint8_t>& ciphertext,
                                          const std::vector<uint8_t>& key,
                                          const std::vector<uint8_t>& iv,
                                          const std::vector<uint8_t>& tag);
    
    // SHA-256 hashing
    std::string compute_hash(const std::vector<uint8_t>& data) const;
    
    // Key derivation with PBKDF2
    std::vector<uint8_t> derive_key(const std::string& content_id, 
                                     const std::vector<uint8_t>& salt) const;
    
    // Generate random salt and IV
    std::vector<uint8_t> generate_random(size_t length);
};

} // namespace meshnet