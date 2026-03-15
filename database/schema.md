# MongoDB Atlas – Collection Schemas

This document describes the three MongoDB Atlas collections used by Interlude AI.

---

## 1. `users`

Stores one document per registered Appwrite user.

| Field       | Type     | Description                                |
|-------------|----------|--------------------------------------------|
| `userId`    | String   | Appwrite user `$id` (unique, indexed)      |
| `email`     | String   | User's email address                       |
| `createdAt` | Date     | UTC timestamp when the record was created  |

**Index:** unique on `userId`

```json
{
  "userId":    "6630abc123def456",
  "email":     "user@example.com",
  "createdAt": "2024-05-01T12:00:00.000Z"
}
```

---

## 2. `chats`

One document per conversation thread.

| Field       | Type     | Description                                         |
|-------------|----------|-----------------------------------------------------|
| `chatId`    | String   | Appwrite document `$id` (unique, indexed)           |
| `userId`    | String   | Owner's Appwrite user `$id`                         |
| `title`     | String   | Auto-generated title (first 40 chars of 1st message)|
| `createdAt` | Date     | UTC timestamp when the chat was created             |

**Indexes:**
- Unique on `chatId`
- Index on `userId` for fast per-user queries

```json
{
  "chatId":    "abc123def456",
  "userId":    "6630abc123def456",
  "title":     "Explain async/await in JavaScript",
  "createdAt": "2024-05-01T12:05:00.000Z"
}
```

---

## 3. `messages`

Each message (user turn or AI response) within a conversation.

| Field       | Type     | Description                                         |
|-------------|----------|-----------------------------------------------------|
| `chatId`    | String   | References `chats.chatId` (indexed)                 |
| `role`      | String   | `"user"` or `"assistant"`                           |
| `content`   | String   | The full message text (may include Markdown)        |
| `timestamp` | Date     | UTC timestamp when the message was stored           |

**Index:** on `chatId` + `timestamp` for chronological retrieval

```json
{
  "chatId":    "abc123def456",
  "role":      "user",
  "content":   "Explain async/await in JavaScript",
  "timestamp": "2024-05-01T12:05:01.000Z"
}
```

---

## Recommended Atlas Indexes

Run these in the Atlas UI or via `mongosh`:

```js
// users collection
db.users.createIndex({ userId: 1 }, { unique: true });

// chats collection
db.chats.createIndex({ chatId: 1 }, { unique: true });
db.chats.createIndex({ userId: 1 });

// messages collection
db.messages.createIndex({ chatId: 1, timestamp: 1 });
```
