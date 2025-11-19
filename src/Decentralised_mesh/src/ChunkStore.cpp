#include "ChunkStore.hpp"
#include <stdexcept>
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <rocksdb/options.h>

namespace meshnet {

ChunkStore::ChunkStore(size_t chunk_size, const std::string& db_path) 
    : chunk_size_(chunk_size) {
    // Initialize RocksDB
    rocksdb::Options options;
    options.create_if_missing = true;
    options.compression = rocksdb::kZSTD;
    options.write_buffer_size = 64 * 1024 * 1024; // 64MB
    
    rocksdb::DB* db_ptr;
    rocksdb::Status status = rocksdb::DB::Open(options, db_path, &db_ptr);
    if (!status.ok()) {
        throw std::runtime_error("Failed to open RocksDB: " + status.ToString());
    }
    db_.reset(db_ptr);
}

ChunkStore::~ChunkStore() {
    flush_to_disk();
}

std::vector<uint8_t> ChunkStore::compress(const std::vector<uint8_t>& data) {
    size_t bound = ZSTD_compressBound(data.size());
    std::vector<uint8_t> compressed(bound);
    size_t compressed_size = ZSTD_compress(compressed.data(), bound, data.data(), data.size(), 3);
    if (ZSTD_isError(compressed_size)) throw std::runtime_error("Compression failed");
    compressed.resize(compressed_size);
    return compressed;
}

std::vector<uint8_t> ChunkStore::decompress(const std::vector<uint8_t>& data, size_t original_size) {
    std::vector<uint8_t> decompressed(original_size);
    size_t result = ZSTD_decompress(decompressed.data(), original_size, data.data(), data.size());
    if (ZSTD_isError(result)) throw std::runtime_error("Decompression failed");
    return decompressed;
}

std::vector<uint8_t> ChunkStore::generate_random(size_t length) {
    std::vector<uint8_t> random(length);
    if (RAND_bytes(random.data(), length) != 1) {
        throw std::runtime_error("Failed to generate random bytes");
    }
    return random;
}

std::vector<uint8_t> ChunkStore::derive_key(const std::string& content_id, 
                                            const std::vector<uint8_t>& salt) const {
    std::vector<uint8_t> key(32); // 256-bit key for AES-256
    
    if (PKCS5_PBKDF2_HMAC(
        content_id.c_str(), content_id.length(),
        salt.data(), salt.size(),
        100000, // 100k iterations
        EVP_sha256(),
        key.size(), key.data()) != 1) {
        throw std::runtime_error("Key derivation failed");
    }
    
    return key;
}

std::vector<uint8_t> ChunkStore::aes_gcm_encrypt(const std::vector<uint8_t>& plaintext,
                                                  const std::vector<uint8_t>& key,
                                                  std::vector<uint8_t>& iv,
                                                  std::vector<uint8_t>& tag) {
    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    if (!ctx) throw std::runtime_error("Failed to create cipher context");
    
    // Generate random IV (12 bytes for GCM)
    iv = generate_random(12);
    tag.resize(16); // 128-bit tag
    
    std::vector<uint8_t> ciphertext(plaintext.size());
    int len = 0;
    
    try {
        // Initialize encryption
        if (EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, nullptr, nullptr) != 1)
            throw std::runtime_error("Encrypt init failed");
        
        // Set IV length
        if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, nullptr) != 1)
            throw std::runtime_error("IV length set failed");
        
        // Initialize key and IV
        if (EVP_EncryptInit_ex(ctx, nullptr, nullptr, key.data(), iv.data()) != 1)
            throw std::runtime_error("Key/IV init failed");
        
        // Encrypt plaintext
        if (EVP_EncryptUpdate(ctx, ciphertext.data(), &len, plaintext.data(), plaintext.size()) != 1)
            throw std::runtime_error("Encryption failed");
        
        int ciphertext_len = len;
        
        // Finalize encryption
        if (EVP_EncryptFinal_ex(ctx, ciphertext.data() + len, &len) != 1)
            throw std::runtime_error("Encryption finalization failed");
        
        ciphertext_len += len;
        ciphertext.resize(ciphertext_len);
        
        // Get authentication tag
        if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, 16, tag.data()) != 1)
            throw std::runtime_error("Tag retrieval failed");
        
        EVP_CIPHER_CTX_free(ctx);
        return ciphertext;
        
    } catch (...) {
        EVP_CIPHER_CTX_free(ctx);
        throw;
    }
}

std::vector<uint8_t> ChunkStore::aes_gcm_decrypt(const std::vector<uint8_t>& ciphertext,
                                                  const std::vector<uint8_t>& key,
                                                  const std::vector<uint8_t>& iv,
                                                  const std::vector<uint8_t>& tag) {
    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    if (!ctx) throw std::runtime_error("Failed to create cipher context");
    
    std::vector<uint8_t> plaintext(ciphertext.size());
    int len = 0;
    
    try {
        // Initialize decryption
        if (EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, nullptr, nullptr) != 1)
            throw std::runtime_error("Decrypt init failed");
        
        // Set IV length
        if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, nullptr) != 1)
            throw std::runtime_error("IV length set failed");
        
        // Initialize key and IV
        if (EVP_DecryptInit_ex(ctx, nullptr, nullptr, key.data(), iv.data()) != 1)
            throw std::runtime_error("Key/IV init failed");
        
        // Decrypt ciphertext
        if (EVP_DecryptUpdate(ctx, plaintext.data(), &len, ciphertext.data(), ciphertext.size()) != 1)
            throw std::runtime_error("Decryption failed");
        
        int plaintext_len = len;
        
        // Set expected tag
        if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, 16, 
            const_cast<uint8_t*>(tag.data())) != 1)
            throw std::runtime_error("Tag set failed");
        
        // Finalize decryption (verifies tag)
        if (EVP_DecryptFinal_ex(ctx, plaintext.data() + len, &len) != 1)
            throw std::runtime_error("Authentication failed - data may be corrupted");
        
        plaintext_len += len;
        plaintext.resize(plaintext_len);
        
        EVP_CIPHER_CTX_free(ctx);
        return plaintext;
        
    } catch (...) {
        EVP_CIPHER_CTX_free(ctx);
        throw;
    }
}

std::string ChunkStore::compute_hash(const std::vector<uint8_t>& data) const {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256(data.data(), data.size(), hash);
    std::stringstream ss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; ++i)
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];
    return ss.str();
}

std::vector<std::string> ChunkStore::store(const std::vector<uint8_t>& data, 
                                           const std::string& content_id, bool encrypt) {
    std::vector<std::string> chunk_hashes;
    std::vector<uint8_t> salt = generate_random(32);
    std::vector<uint8_t> key = derive_key(content_id, salt);
    
    for (size_t offset = 0; offset < data.size(); offset += chunk_size_) {
        size_t chunk_len = std::min(chunk_size_, data.size() - offset);
        std::vector<uint8_t> chunk_data(data.begin() + offset, data.begin() + offset + chunk_len);
        
        // Compress
        std::vector<uint8_t> compressed = compress(chunk_data);
        
        auto chunk = std::make_shared<Chunk>();
        chunk->original_size = chunk_len;
        chunk->index = offset / chunk_size_;
        chunk->is_encrypted = encrypt;
        
        // Encrypt with AES-GCM
        if (encrypt) {
            chunk->data = aes_gcm_encrypt(compressed, key, chunk->iv, chunk->tag);
        } else {
            chunk->data = compressed;
        }
        
        chunk->hash = compute_hash(chunk->data);
        
        // Store in memory and persist
        chunks_[chunk->hash] = chunk;
        persist_chunk(chunk->hash, *chunk);
        chunk_hashes.push_back(chunk->hash);
    }
    
    content_map_[content_id] = chunk_hashes;
    
    // Persist content mapping
    std::string mapping_key = "content_map:" + content_id;
    std::string mapping_value;
    for (const auto& hash : chunk_hashes) {
        mapping_value += hash + ";";
    }
    db_->Put(rocksdb::WriteOptions(), mapping_key, mapping_value);
    
    return chunk_hashes;
}

std::vector<uint8_t> ChunkStore::retrieve(const std::string& content_id) {
    auto it = content_map_.find(content_id);
    if (it == content_map_.end()) {
        // Try loading from disk
        std::string mapping_key = "content_map:" + content_id;
        std::string mapping_value;
        rocksdb::Status status = db_->Get(rocksdb::ReadOptions(), mapping_key, &mapping_value);
        if (!status.ok()) throw std::runtime_error("Content not found: " + content_id);
        
        // Parse chunk hashes
        std::vector<std::string> chunk_hashes;
        std::stringstream ss(mapping_value);
        std::string hash;
        while (std::getline(ss, hash, ';')) {
            if (!hash.empty()) chunk_hashes.push_back(hash);
        }
        content_map_[content_id] = chunk_hashes;
        it = content_map_.find(content_id);
    }
    
    std::vector<uint8_t> result;
    std::vector<uint8_t> salt = generate_random(32);
    std::vector<uint8_t> key = derive_key(content_id, salt);
    
    for (const auto& hash : it->second) {
        auto chunk = get_chunk(hash);
        if (!chunk) {
            // Try loading from disk
            Chunk disk_chunk;
            if (load_chunk(hash, disk_chunk)) {
                chunk = std::make_shared<Chunk>(disk_chunk);
                chunks_[hash] = chunk;
            } else {
                throw std::runtime_error("Chunk not found: " + hash);
            }
        }
        
        std::vector<uint8_t> chunk_data = chunk->data;
        
        // Decrypt with AES-GCM
        if (chunk->is_encrypted) {
            chunk_data = aes_gcm_decrypt(chunk->data, key, chunk->iv, chunk->tag);
        }
        
        // Decompress
        std::vector<uint8_t> decompressed = decompress(chunk_data, chunk->original_size);
        result.insert(result.end(), decompressed.begin(), decompressed.end());
    }
    
    return result;
}

bool ChunkStore::persist_chunk(const std::string& hash, const Chunk& chunk) {
    // Serialize chunk to bytes
    std::vector<uint8_t> serialized;
    
    // Add original_size
    serialized.insert(serialized.end(), (uint8_t*)&chunk.original_size, 
                     (uint8_t*)&chunk.original_size + sizeof(chunk.original_size));
    
    // Add index
    serialized.insert(serialized.end(), (uint8_t*)&chunk.index, 
                     (uint8_t*)&chunk.index + sizeof(chunk.index));
    
    // Add is_encrypted flag
    serialized.push_back(chunk.is_encrypted ? 1 : 0);
    
    // Add IV length and data
    uint32_t iv_len = chunk.iv.size();
    serialized.insert(serialized.end(), (uint8_t*)&iv_len, (uint8_t*)&iv_len + sizeof(iv_len));
    serialized.insert(serialized.end(), chunk.iv.begin(), chunk.iv.end());
    
    // Add tag length and data
    uint32_t tag_len = chunk.tag.size();
    serialized.insert(serialized.end(), (uint8_t*)&tag_len, (uint8_t*)&tag_len + sizeof(tag_len));
    serialized.insert(serialized.end(), chunk.tag.begin(), chunk.tag.end());
    
    // Add data length and data
    uint32_t data_len = chunk.data.size();
    serialized.insert(serialized.end(), (uint8_t*)&data_len, (uint8_t*)&data_len + sizeof(data_len));
    serialized.insert(serialized.end(), chunk.data.begin(), chunk.data.end());
    
    rocksdb::Status status = db_->Put(rocksdb::WriteOptions(), 
                                      "chunk:" + hash, 
                                      rocksdb::Slice((char*)serialized.data(), serialized.size()));
    return status.ok();
}

bool ChunkStore::load_chunk(const std::string& hash, Chunk& chunk) {
    std::string value;
    rocksdb::Status status = db_->Get(rocksdb::ReadOptions(), "chunk:" + hash, &value);
    if (!status.ok()) return false;
    
    const uint8_t* data = (const uint8_t*)value.data();
    size_t offset = 0;
    
    // Read original_size
    chunk.original_size = *(size_t*)(data + offset);
    offset += sizeof(size_t);
    
    // Read index
    chunk.index = *(size_t*)(data + offset);
    offset += sizeof(size_t);
    
    // Read is_encrypted
    chunk.is_encrypted = data[offset] != 0;
    offset += 1;
    
    // Read IV
    uint32_t iv_len = *(uint32_t*)(data + offset);
    offset += sizeof(uint32_t);
    chunk.iv.assign(data + offset, data + offset + iv_len);
    offset += iv_len;
    
    // Read tag
    uint32_t tag_len = *(uint32_t*)(data + offset);
    offset += sizeof(uint32_t);
    chunk.tag.assign(data + offset, data + offset + tag_len);
    offset += tag_len;
    
    // Read data
    uint32_t data_len = *(uint32_t*)(data + offset);
    offset += sizeof(uint32_t);
    chunk.data.assign(data + offset, data + offset + data_len);
    
    chunk.hash = hash;
    return true;
}

void ChunkStore::flush_to_disk() {
    if (db_) {
        db_->Flush(rocksdb::FlushOptions());
    }
}

std::shared_ptr<Chunk> ChunkStore::get_chunk(const std::string& hash) {
    auto it = chunks_.find(hash);
    return (it != chunks_.end()) ? it->second : nullptr;
}

void ChunkStore::store_chunk(const std::string& hash, std::shared_ptr<Chunk> chunk) {
    chunks_[hash] = chunk;
    persist_chunk(hash, *chunk);
}

std::string ChunkStore::get_content_address(const std::string& content_id) const {
    auto it = content_map_.find(content_id);
    if (it == content_map_.end()) return "";
    std::string combined;
    for (const auto& hash : it->second) combined += hash;
    return compute_hash(std::vector<uint8_t>(combined.begin(), combined.end()));
}

std::vector<std::string> ChunkStore::list_chunks(const std::string& content_id) const {
    auto it = content_map_.find(content_id);
    return (it != content_map_.end()) ? it->second : std::vector<std::string>();
}

} // namespace meshnet