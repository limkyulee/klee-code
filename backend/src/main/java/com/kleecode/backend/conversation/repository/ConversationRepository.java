package com.kleecode.backend.conversation.repository;

import com.kleecode.backend.conversation.dto.Conversation;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends MongoRepository<Conversation, String> {
    List<Conversation> findByUserId(String userId);

    List<Conversation> findByUserIdOrderByUpdatedAtDesc(String userId, Pageable pageable);

    Optional<Conversation> findByIdAndUserId(String id, String userId);
}
